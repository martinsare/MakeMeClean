import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

function internalHeaders() {
  const token = Deno.env.get("NOTIFICATIONS_INTERNAL_TOKEN");
  return token ? { "x-internal-token": token } : undefined;
}

function calculateNextDate(currentDateStr: string, frequency: string): string {
  const d = new Date(currentDateStr);
  if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (frequency === "fortnightly" || frequency === "biweekly") {
    d.setDate(d.getDate() + 14);
  } else if (frequency === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setDate(d.getDate() + 7);
  }
  return d.toISOString().split("T")[0];
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

    const { bookingId, sessionId } = (await req.json()) as { bookingId?: string; sessionId?: string };
    if (!bookingId || !sessionId) {
      return json(400, { ok: false, error: "bookingId and sessionId are required" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Unauthorised" });

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, user_id, date, payment_status, recurring_plan_id, recurring_freq")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" });
    if (booking.user_id !== userData.user.id) return json(403, { ok: false, error: "Forbidden" });
    if (booking.payment_status === "paid") return json(200, { ok: true, paid: true });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge", "payment_intent.payment_method", "customer"],
    });

    const sessionBookingId = session.metadata?.booking_id ?? session.client_reference_id ?? "";
    if (sessionBookingId !== booking.id) {
      return json(403, { ok: false, error: "Checkout session does not match this booking" });
    }

    if (session.payment_status !== "paid") {
      return json(200, { ok: true, paid: false });
    }

    const paymentIntent =
      typeof session.payment_intent === "string" ? null : session.payment_intent;
    const latestCharge = paymentIntent?.latest_charge;
    const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const paymentMethodId = paymentIntent?.payment_method
      ? (typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : paymentIntent.payment_method.id)
      : null;

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntent?.id ?? (typeof session.payment_intent === "string" ? session.payment_intent : null),
        stripe_charge_id: chargeId,
      })
      .eq("id", booking.id);

    if (updateErr) return json(500, { ok: false, error: updateErr.message });

    // Store customer and default payment method in profiles
    if (customerId || paymentMethodId) {
      const profileUpdates: Record<string, string> = {};
      if (customerId) profileUpdates.stripe_customer_id = customerId;
      if (paymentMethodId) profileUpdates.stripe_payment_method_id = paymentMethodId;
      await supabase.from("profiles").update(profileUpdates).eq("id", userData.user.id);
    }

    // If this booking is associated with a recurring plan, link payment credentials and initialize next schedule
    const planId = booking.recurring_plan_id || session.metadata?.recurring_plan_id;
    if (planId) {
      const { data: plan } = await supabase.from("recurring_plans").select("frequency").eq("id", planId).single();
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
        })
        .eq("id", planId);
    }

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
    } else {
      console.warn("[confirm-stripe-checkout] NOTIFICATIONS_INTERNAL_TOKEN missing; skipping emails");
    }

    return json(200, { ok: true, paid: true });
  } catch (e) {
    console.error("[confirm-stripe-checkout]", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
