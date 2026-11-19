// Edge Function: confirm-stripe-checkout
// Idempotently confirms a Stripe Checkout session with atomic paid-state transition
// so concurrent webhook + client polling never send duplicate confirmation emails.

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

function internalHeaders() {
  const token = Deno.env.get("NOTIFICATIONS_INTERNAL_TOKEN");
  return token ? { "x-internal-token": token } : undefined;
}

function calculateNextDate(currentDateStr: string, frequency: string): string {
  const [y, m, d] = currentDateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  if (frequency === "weekly") {
    dt.setUTCDate(dt.getUTCDate() + 7);
  } else if (frequency === "fortnightly" || frequency === "biweekly") {
    dt.setUTCDate(dt.getUTCDate() + 14);
  } else if (frequency === "monthly") {
    const targetMonth = dt.getUTCMonth() + 1;
    const targetYear = dt.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(d || 1, daysInTargetMonth);
    return `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  } else {
    dt.setUTCDate(dt.getUTCDate() + 7);
  }
  return dt.toISOString().split("T")[0];
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

    const { bookingId, sessionId } = (await req.json()) as { bookingId?: string; sessionId?: string };
    if (!bookingId || !sessionId) {
      return json(400, { ok: false, error: "bookingId and sessionId are required" }, req);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Unauthorised" }, req);

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, user_id, date, payment_status, recurring_plan_id, recurring_freq")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" }, req);
    if (booking.user_id !== userData.user.id) return json(403, { ok: false, error: "Forbidden" }, req);
    if (booking.payment_status === "paid") return json(200, { ok: true, paid: true }, req);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge", "payment_intent.payment_method", "customer"],
    });

    const sessionBookingId = session.metadata?.booking_id ?? session.client_reference_id ?? "";
    if (sessionBookingId !== booking.id) {
      return json(403, { ok: false, error: "Checkout session does not match this booking" }, req);
    }

    if (session.payment_status !== "paid") {
      return json(200, { ok: true, paid: false }, req);
    }

    const paymentIntent = typeof session.payment_intent === "string" ? null : session.payment_intent;
    const latestCharge = paymentIntent?.latest_charge;
    const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const paymentMethodId = paymentIntent?.payment_method
      ? typeof paymentIntent.payment_method === "string"
        ? paymentIntent.payment_method
        : paymentIntent.payment_method.id
      : null;

    // Atomic conditional update so only ONE caller triggers confirmation emails
    const { data: transitioned, error: updateErr } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          paymentIntent?.id ?? (typeof session.payment_intent === "string" ? session.payment_intent : null),
        stripe_charge_id: chargeId,
      })
      .eq("id", booking.id)
      .neq("payment_status", "paid")
      .select("id")
      .maybeSingle();

    if (updateErr) return json(500, { ok: false, error: updateErr.message }, req);

    if (customerId || paymentMethodId) {
      const profileUpdates: Record<string, string> = {};
      if (customerId) profileUpdates.stripe_customer_id = customerId;
      if (paymentMethodId) profileUpdates.stripe_payment_method_id = paymentMethodId;
      await supabase.from("profiles").update(profileUpdates).eq("id", userData.user.id);
    }

    const planId = booking.recurring_plan_id || session.metadata?.recurring_plan_id;
    if (planId) {
      const { data: plan } = await supabase.from("recurring_plans").select("frequency").eq("id", planId).maybeSingle();
      const nextDate = calculateNextDate(booking.date, plan?.frequency || booking.recurring_freq || "weekly");
      await supabase
        .from("recurring_plans")
        .update({
          stripe_customer_id: customerId,
          stripe_payment_method_id: paymentMethodId,
          next_booking_date: nextDate,
          last_booked_at: new Date().toISOString(),
          last_booking_id: booking.id,
          failure_count: 0,
          last_failure_reason: null,
        })
        .eq("id", planId);
    }

    if (transitioned) {
      const notificationHeaders = internalHeaders();
      if (notificationHeaders) {
        try {
          await supabase.functions.invoke("notifications", {
            body: { type: "booking_confirmation", bookingId: booking.id },
            headers: notificationHeaders,
          });
        } catch (e) {
          console.error("[confirm-stripe-checkout] booking_confirmation failed:", e);
        }

        try {
          await supabase.functions.invoke("notifications", {
            body: { type: "payment_receipt", bookingId: booking.id },
            headers: notificationHeaders,
          });
        } catch (e) {
          console.error("[confirm-stripe-checkout] payment_receipt failed:", e);
        }
      }
    }

    return json(200, { ok: true, paid: true }, req);
  } catch (e) {
    console.error("[confirm-stripe-checkout]", e);
    return json(500, { ok: false, error: "Payment confirmation failed" }, req);
  }
});
