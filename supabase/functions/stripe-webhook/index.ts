import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!supabaseUrl || !serviceKey || !stripeKey || !webhookSecret) {
      return json(500, { ok: false, error: "Server misconfiguration" });
    }

    const signature = req.headers.get("Stripe-Signature");
    if (!signature) {
      return json(400, { ok: false, error: "Missing Stripe-Signature header" });
    }

    const payload = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id ?? session.client_reference_id ?? "";

      if (session.payment_status !== "paid" || !bookingId) {
        return json(200, { ok: true, ignored: true });
      }

      const supabase = createClient(supabaseUrl, serviceKey);
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      let chargeId: string | null = null;
      let paymentMethodId: string | null = null;

      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge", "payment_method"],
        });
        const latestCharge = paymentIntent.latest_charge;
        chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
        if (paymentIntent.payment_method) {
          paymentMethodId = typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : paymentIntent.payment_method.id;
        }
      }

      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("id, user_id, date, payment_status, recurring_plan_id, recurring_freq")
        .eq("id", bookingId)
        .single();

      if (bookingErr || !booking) {
        return json(404, { ok: false, error: "Booking not found" });
      }

      if (session.metadata?.user_id && booking.user_id !== session.metadata.user_id) {
        return json(403, { ok: false, error: "Booking ownership mismatch" });
      }

      const updatePayload: Record<string, unknown> = {
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
      };
      if (booking.payment_status !== "paid") {
        updatePayload.payment_status = "paid";
      }

      const { error: updateErr } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", bookingId);

      if (updateErr) {
        return json(500, { ok: false, error: updateErr.message });
      }

      // Store customer and payment method in profile
      if (customerId || paymentMethodId) {
        const profileUpdates: Record<string, string> = {};
        if (customerId) profileUpdates.stripe_customer_id = customerId;
        if (paymentMethodId) profileUpdates.stripe_payment_method_id = paymentMethodId;
        await supabase.from("profiles").update(profileUpdates).eq("id", booking.user_id);
      }

      // If linked to a recurring plan, update plan credentials and advance next schedule
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
          console.error("[stripe-webhook] booking_confirmation failed:", e);
        }

        try {
          await supabase.functions.invoke("notifications", {
            body: { type: "payment_receipt", bookingId: booking.id },
            headers: notificationHeaders,
          });
        } catch (e) {
          console.error("[stripe-webhook] payment_receipt failed:", e);
        }
      }

      return json(200, { ok: true, processed: true });
    }

    return json(200, { ok: true, ignored: true });
  } catch (e) {
    console.error("[stripe-webhook]", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
