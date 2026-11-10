import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

function normalizeOrigin(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\/$/, "");
}

function withoutWww(origin: string) {
  return origin.replace("://www.", "://");
}

function sameSiteOrigin(a: string, b: string) {
  return a === b || withoutWww(a) === withoutWww(b);
}

function isPayableBooking(date: string, status: string | null | undefined) {
  if (status === "cancelled") return false;
  const nowParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) => nowParts.find((p) => p.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;

  return date >= today;
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  supabase: any,
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || profile?.full_name || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceKey || !stripeKey) {
      return json(500, { ok: false, error: "Server misconfiguration" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Unauthorised" });

    const { bookingId, origin } = (await req.json()) as { bookingId?: string; origin?: string };
    if (!bookingId) return json(400, { ok: false, error: "bookingId is required" });

    const configuredOrigin = normalizeOrigin(Deno.env.get("SITE_URL")) || "https://makemeclean.co.uk";
    const clientOrigin = normalizeOrigin(origin);
    const appOrigin = clientOrigin && sameSiteOrigin(clientOrigin, configuredOrigin)
      ? clientOrigin
      : configuredOrigin;

    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Unauthorised" });

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, user_id, service_name, date, time_slot, price, invoice_number, status, payment_status, recurring_plan_id, recurring_freq")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" });
    if (booking.user_id !== userData.user.id) return json(403, { ok: false, error: "Forbidden" });
    if (booking.payment_status === "paid") {
      return json(409, { ok: false, error: "This booking is already paid" });
    }
    if (!isPayableBooking(String(booking.date), booking.status)) {
      return json(409, { ok: false, error: "This booking date has already passed or is cancelled" });
    }

    const amount = Math.round(Number(booking.price) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { ok: false, error: "Invalid booking amount" });
    }

    // Determine if this booking is part of a recurring plan
    const isRecurring = Boolean(
      booking.recurring_plan_id ||
      (booking.recurring_freq && !["none", "one_off"].includes(booking.recurring_freq))
    );

    // Get or create customer ID in Stripe for tracking and recurring billing
    const userEmail = userData.user.email || "";
    const customerId = userEmail ? await getOrCreateStripeCustomer(stripe, supabase, userData.user.id, userEmail) : undefined;

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      metadata: {
        booking_id: booking.id,
        user_id: userData.user.id,
        invoice_number: booking.invoice_number ?? booking.id,
        recurring_plan_id: booking.recurring_plan_id ?? "",
      },
    };

    // If recurring, setup payment method for future off-session charges
    if (isRecurring) {
      paymentIntentData.setup_future_usage = "off_session";
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      client_reference_id: booking.id,
      customer: customerId,
      customer_email: customerId ? undefined : (userEmail || undefined),
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

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return json(500, { ok: false, error: "Stripe did not return a checkout URL" });
    }

    return json(200, { ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("[create-stripe-checkout]", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
