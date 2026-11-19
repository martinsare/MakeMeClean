// Edge Function: process-stripe-refund
// Admin-only: issues idempotent Stripe refunds, prevents over-refunding, and syncs DB state.

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

async function requireAdmin(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false as const, response: json(401, { ok: false, error: "Unauthorised" }, req) };

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false as const, response: json(401, { ok: false, error: "Unauthorised" }, req) };
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    return { ok: false as const, response: json(403, { ok: false, error: "Forbidden" }, req) };
  }

  return { ok: true as const, supabase, user: userData.user };
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

    const adminCheck = await requireAdmin(req, supabaseUrl, serviceKey);
    if (!adminCheck.ok) return adminCheck.response;

    const { refundRequestId, adminNotes } = (await req.json()) as {
      refundRequestId?: string;
      adminNotes?: string;
    };
    if (!refundRequestId) return json(400, { ok: false, error: "refundRequestId is required" }, req);
    const cleanAdminNotes = typeof adminNotes === "string" ? adminNotes.trim().slice(0, 1000) : "";

    const supabase = adminCheck.supabase;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: refundRequest, error: refundErr } = await supabase
      .from("refund_requests")
      .select(
        "id, booking_id, user_id, reason, status, refund_amount, source, stripe_refund_id, stripe_payment_intent_id, stripe_charge_id",
      )
      .eq("id", refundRequestId)
      .single();

    if (refundErr || !refundRequest) return json(404, { ok: false, error: "Refund request not found" }, req);
    if (refundRequest.status !== "pending" || refundRequest.stripe_refund_id) {
      return json(409, { ok: false, error: "Refund request already processed" }, req);
    }

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, user_id, price, payment_status, stripe_payment_intent_id, stripe_charge_id, refunded_amount")
      .eq("id", refundRequest.booking_id)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" }, req);
    if (booking.user_id !== refundRequest.user_id) {
      return json(409, { ok: false, error: "Refund request does not match booking owner" }, req);
    }
    if (refundRequest.source === "user" && booking.payment_status !== "paid") {
      return json(409, { ok: false, error: "Only paid bookings can be refunded" }, req);
    }

    const paymentIntentId = booking.stripe_payment_intent_id ?? refundRequest.stripe_payment_intent_id ?? null;
    if (!paymentIntentId) {
      return json(400, { ok: false, error: "Missing Stripe payment reference for this booking" }, req);
    }

    const paymentAmountPence = Math.round(Number(booking.price) * 100);
    const alreadyRefundedPence = Math.round(Number(booking.refunded_amount ?? 0) * 100);
    const remainingPence = Math.max(0, paymentAmountPence - alreadyRefundedPence);
    if (remainingPence <= 0) {
      return json(409, { ok: false, error: "This booking has already been fully refunded" }, req);
    }

    const requestedAmount = Number(refundRequest.refund_amount ?? booking.price);
    const requestedPence = Math.max(0, Math.round(requestedAmount * 100));
    const effectiveAmount = requestedPence > 0 ? Math.min(requestedPence, remainingPence) : remainingPence;

    // Deterministic Stripe idempotency key prevents duplicate refunds on retry/double-click
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: effectiveAmount,
        metadata: {
          booking_id: booking.id,
          refund_request_id: refundRequest.id,
        },
      },
      {
        idempotencyKey: `refund-request-${refundRequest.id}`,
      },
    );

    const refundedValue = effectiveAmount / 100;
    const totalRefundedPence = alreadyRefundedPence + effectiveAmount;
    const fullRefund = totalRefundedPence >= paymentAmountPence;

    const { error: updateRefundErr } = await supabase
      .from("refund_requests")
      .update({
        status: "approved",
        refund_amount: refundedValue,
        admin_notes:
          cleanAdminNotes ||
          `Processed via Stripe refund${refundRequest.source === "stripe_dispute" ? " after dispute" : ""}`,
        processed_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
      })
      .eq("id", refundRequest.id)
      .eq("status", "pending");

    if (updateRefundErr) return json(500, { ok: false, error: updateRefundErr.message }, req);

    const { error: updateBookingErr } = await supabase
      .from("bookings")
      .update({
        payment_status: fullRefund ? "refunded" : "paid",
        refunded_amount: Number((totalRefundedPence / 100).toFixed(2)),
      })
      .eq("id", booking.id);

    if (updateBookingErr) return json(500, { ok: false, error: updateBookingErr.message }, req);

    return json(200, { ok: true, refundId: refund.id, amount: refundedValue }, req);
  } catch (e) {
    console.error("[process-stripe-refund]", e);
    return json(500, { ok: false, error: "Refund processing failed" }, req);
  }
});
