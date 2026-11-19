// Edge Function: create-stripe-checkout
// Creates an idempotent Stripe Checkout session for an authenticated user's unpaid,
// non-expired booking, storing payment methods off-session when linked to a recurring plan.

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

function corsHeaders(req?: Request) {
  const configured = Deno.env.get("ALLOWED_ORIGIN");
  const reqOrigin = req?.headers.get("Origin") ?? "";
  let allowOrigin = configured || "https://makemeclean.co.uk";
  if (
    reqOrigin &&
    (reqOrigin === "https://makemeclean.co.uk" ||
      reqOrigin === "https://www.makemeclean.co.uk" ||
      reqOrigin.startsWith("http://localhost:") ||
      reqOrigin.startsWith("http://127.0.0.1:") ||
      (configured && reqOrigin === configured))
  ) {
    allowOrigin = reqOrigin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    Vary: "Origin",
  };
}

const json = (status: number, data: unknown, req?: Request) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });

function normalizeOrigin(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\/$/, "");
}

function withoutWww(origin: string) {
  return origin.replace("://www.", "://");
}

function sameSiteOrigin(a: string, b: string) {
  return a === b || withoutWww(a) === withoutWww(b);
}

/** Checks both date AND start time in Europe/London so expired same-day slots cannot be paid. */
function isPayableBooking(date: string, timeSlot: string | null | undefined, status: string | null | undefined): boolean {
  if (status === "cancelled" || status === "completed") return false;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const nowParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const part = (type: string) => nowParts.find((p) => p.type === type)?.value ?? "00";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  if (date > today) return true;
  if (date < today) return false;

  const rawHour = Number(part("hour"));
  const nowMinutes = (rawHour === 24 ? 0 : rawHour) * 60 + Number(part("minute"));
  const startStr = (timeSlot || "09:00").split(/[-–]/)[0]?.trim() || "09:00";
  const [sh, sm] = startStr.split(":").map(Number);
  const startMinutes = (Number.isFinite(sh) ? sh : 9) * 60 + (Number.isFinite(sm) ? sm : 0);

  return startMinutes > nowMinutes;
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  supabase: any,
  userId: string,
  email: string,
  name?: string | null,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create(
    {
      email,
      name: name || profile?.full_name || undefined,
      metadata: {
        supabase_user_id: userId,
      },
    },
    {
      idempotencyKey: `stripe-customer-${userId}`,
    },
  );

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceKey || !stripeKey) {
      return json(500, { ok: false, error: "Server misconfiguration" }, req);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Unauthorised" }, req);

    const { bookingId, origin } = (await req.json()) as { bookingId?: string; origin?: string };
    if (!bookingId) return json(400, { ok: false, error: "bookingId is required" }, req);

    const configuredOrigin = normalizeOrigin(Deno.env.get("SITE_URL")) || "https://makemeclean.co.uk";
    const clientOrigin = normalizeOrigin(origin);
    const appOrigin =
      clientOrigin && sameSiteOrigin(clientOrigin, configuredOrigin)
        ? clientOrigin
        : configuredOrigin;

    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Unauthorised" }, req);

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select(
        "id, user_id, service_name, date, time_slot, price, invoice_number, status, payment_status, recurring_plan_id, recurring_freq",
      )
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" }, req);
    if (booking.user_id !== userData.user.id) return json(403, { ok: false, error: "Forbidden" }, req);
    if (booking.payment_status === "paid") {
      return json(409, { ok: false, error: "This booking is already paid" }, req);
    }
    if (booking.payment_status === "refunded" || booking.payment_status === "disputed") {
      return json(409, { ok: false, error: `Cannot pay for a ${booking.payment_status} booking` }, req);
    }
    if (!isPayableBooking(String(booking.date), booking.time_slot, booking.status)) {
      return json(409, { ok: false, error: "This booking slot has already passed or is cancelled" }, req);
    }

    const amount = Math.round(Number(booking.price) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { ok: false, error: "Invalid booking amount" }, req);
    }

    const isRecurring = Boolean(
      booking.recurring_plan_id ||
        (booking.recurring_freq && !["none", "one_off"].includes(booking.recurring_freq)),
    );

    const userEmail = userData.user.email || "";
    const customerId = userEmail
      ? await getOrCreateStripeCustomer(stripe, supabase, userData.user.id, userEmail)
      : undefined;

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      metadata: {
        booking_id: booking.id,
        user_id: userData.user.id,
        invoice_number: booking.invoice_number ?? booking.id,
        recurring_plan_id: booking.recurring_plan_id ?? "",
      },
    };

    if (isRecurring) {
      paymentIntentData.setup_future_usage = "off_session";
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      client_reference_id: booking.id,
      customer: customerId,
      customer_email: customerId ? undefined : userEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amount,
            product_data: {
              name: `MakeMeClean - ${booking.service_name}`,
              description: `${booking.date} - ${booking.time_slot}${isRecurring ? " (Recurring Plan)" : ""}`,
            },
          },
        },
      ],
      payment_intent_data: paymentIntentData,
      metadata: {
        booking_id: booking.id,
        user_id: userData.user.id,
        invoice_number: booking.invoice_number ?? booking.id,
        recurring_plan_id: booking.recurring_plan_id ?? "",
      },
      success_url: `${appOrigin}/pay/${booking.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/bookings/${booking.id}`,
    };

    const minuteBucket = Math.floor(Date.now() / 60000);
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `checkout-${booking.id}-${amount}-${minuteBucket}`,
    });

    if (!session.url) {
      return json(500, { ok: false, error: "Stripe did not return a checkout URL" }, req);
    }

    return json(200, { ok: true, url: session.url, sessionId: session.id }, req);
  } catch (e) {
    console.error("[create-stripe-checkout]", e);
    return json(500, { ok: false, error: "Unable to initiate payment session" }, req);
  }
});
