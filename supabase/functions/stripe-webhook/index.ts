// Edge Function: stripe-webhook
// Handles Stripe payment confirmations, refunds, disputes/chargebacks, and failures
// with event deduplication and atomic state transitions to prevent duplicate notifications.

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
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
    } catch (sigErr) {
      console.error("[stripe-webhook] signature verification failed:", sigErr);
      return json(400, { ok: false, error: "Invalid Stripe signature" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Event-level idempotency check
    try {
      const { error: eventErr } = await supabase
        .from("stripe_events")
        .insert({ event_id: event.id, event_type: event.type });
      if (eventErr?.code === "23505") {
        return json(200, { ok: true, duplicate: true });
      }
    } catch {
      // Proceed even if stripe_events table hasn't been created yet
    }

    // ── 1. Checkout completed / async payment succeeded ──────────────────────
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id ?? session.client_reference_id ?? "";

      if (session.payment_status !== "paid" || !bookingId) {
        return json(200, { ok: true, ignored: true });
      }

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
          paymentMethodId =
            typeof paymentIntent.payment_method === "string"
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

      // Atomic conditional update: only transition pending -> paid once so emails are never duplicated
      const { data: transitioned, error: updateErr } = await supabase
        .from("bookings")
        .update({
          payment_status: "paid",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          stripe_charge_id: chargeId,
        })
        .eq("id", bookingId)
        .neq("payment_status", "paid")
        .select("id")
        .maybeSingle();

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

      // Update linked recurring plan credentials & next schedule
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

      // Only send confirmation & receipt if THIS handler performed the paid transition
      if (transitioned) {
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
      }

      return json(200, { ok: true, processed: true, newlyPaid: Boolean(transitioned) });
    }

    // ── 2. Stripe Chargeback / Dispute Created ───────────────────────────────
    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
      const paymentIntentId =
        typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;

      let booking: { id: string; user_id: string; price: number } | null = null;
      if (paymentIntentId) {
        const { data } = await supabase
          .from("bookings")
          .select("id, user_id, price")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();
        booking = data;
      }
      if (!booking && chargeId) {
        const { data } = await supabase
          .from("bookings")
          .select("id, user_id, price")
          .eq("stripe_charge_id", chargeId)
          .maybeSingle();
        booking = data;
      }

      if (booking) {
        await supabase.from("bookings").update({ payment_status: "disputed" }).eq("id", booking.id);
        await supabase.from("refund_requests").insert({
          booking_id: booking.id,
          user_id: booking.user_id,
          reason: `Stripe dispute opened: ${dispute.reason || "unspecified"}`,
          status: "pending",
          source: "stripe_dispute",
          refund_amount: Number((dispute.amount / 100).toFixed(2)),
          stripe_dispute_id: dispute.id,
          stripe_charge_id: chargeId,
          stripe_payment_intent_id: paymentIntentId,
        });
      }

      return json(200, { ok: true, handled: "charge.dispute.created" });
    }

    // ── 3. Stripe Chargeback / Dispute Closed ────────────────────────────────
    if (event.type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      const nextPaymentStatus = dispute.status === "won" ? "paid" : "refunded";
      const nextRefundStatus = dispute.status === "won" ? "rejected" : "approved";

      const { data: reqRow } = await supabase
        .from("refund_requests")
        .select("id, booking_id")
        .eq("stripe_dispute_id", dispute.id)
        .maybeSingle();

      if (reqRow) {
        await supabase
          .from("refund_requests")
          .update({
            status: nextRefundStatus,
            admin_notes: `Stripe dispute closed (${dispute.status})`,
            processed_at: new Date().toISOString(),
          })
          .eq("id", reqRow.id);

        await supabase
          .from("bookings")
          .update({ payment_status: nextPaymentStatus })
          .eq("id", reqRow.booking_id);
      }

      return json(200, { ok: true, handled: "charge.dispute.closed" });
    }

    // ── 4. External / Dashboard Stripe Refund Sync ───────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;

      const query = paymentIntentId
        ? supabase.from("bookings").select("id, price").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle()
        : supabase.from("bookings").select("id, price").eq("stripe_charge_id", charge.id).maybeSingle();

      const { data: booking } = await query;
      if (booking) {
        const totalRefunded = Number((charge.amount_refunded / 100).toFixed(2));
        const isFullyRefunded = charge.refunded || totalRefunded >= Number(booking.price);
        await supabase
          .from("bookings")
          .update({
            refunded_amount: totalRefunded,
            ...(isFullyRefunded ? { payment_status: "refunded" } : {}),
          })
          .eq("id", booking.id);
      }

      return json(200, { ok: true, handled: "charge.refunded" });
    }

    return json(200, { ok: true, ignored: true });
  } catch (e) {
    console.error("[stripe-webhook]", e);
    return json(500, { ok: false, error: "Webhook processing failed" });
  }
});
