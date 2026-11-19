// Edge Function: process-recurring-plans
// Internal cron-only endpoint: creates due recurring bookings and executes off-session
// Stripe PaymentIntents with strict authentication, idempotency keys, and failure suspension.

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://makemeclean.co.uk",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-token",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

function constantTimeEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function internalHeaders() {
  const token = Deno.env.get("NOTIFICATIONS_INTERNAL_TOKEN");
  return token ? { "x-internal-token": token } : undefined;
}

/** Month-end-safe next date calculation (e.g., Jan 31 + 1 month -> Feb 28/29, not Mar 3). */
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

function buildTimeSlot(startTime: string | null | undefined, durationHours: number | null | undefined): string {
  const cleanStart = startTime && /^\d{1,2}:\d{2}$/.test(startTime) ? startTime : "09:00";
  const [h, m] = cleanStart.split(":").map(Number);
  const dur = Number.isFinite(Number(durationHours)) && Number(durationHours) > 0 ? Number(durationHours) : 2;
  const endTotal = h * 60 + m + Math.round(dur * 60);
  const endH = String(Math.floor(endTotal / 60)).padStart(2, "0");
  const endM = String(endTotal % 60).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} – ${endH}:${endM}`;
}

function escapeTelegram(value: string): string {
  return String(value ?? "").replace(/([_*`\[])/g, "\\$1");
}

function generateCryptoInvoiceNumber(targetDate: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `INV-${targetDate.replace(/-/g, "")}-${hex}`;
}

async function sendTelegramAlert(message: string) {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") || Deno.env.get("TELEGRAM_CHAT_ID");
    if (!token || !chatId) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("[Telegram Alert Error]:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const expectedToken = Deno.env.get("CRON_INTERNAL_TOKEN") || Deno.env.get("NOTIFICATIONS_INTERNAL_TOKEN");
    if (!expectedToken) {
      return json(500, { ok: false, error: "Internal cron token not configured" });
    }
    const providedToken = req.headers.get("x-internal-token") ?? "";
    if (!constantTimeEquals(providedToken, expectedToken)) {
      return json(403, { ok: false, error: "Forbidden" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceKey || !stripeKey) {
      return json(500, { ok: false, error: "Server misconfiguration" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Current date in UK Europe/London
    const nowParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const part = (type: string) => nowParts.find((p) => p.type === type)?.value ?? "";
    const todayStr = `${part("year")}-${part("month")}-${part("day")}`;

    // Find all active recurring plans due on or before today (batch capped at 100 per run)
    const { data: duePlans, error: plansErr } = await supabase
      .from("recurring_plans")
      .select("*")
      .eq("status", "active")
      .lte("next_booking_date", todayStr)
      .limit(100);

    if (plansErr) {
      return json(500, { ok: false, error: plansErr.message });
    }

    const results = [];

    for (const plan of duePlans || []) {
      try {
        const targetDate = plan.next_booking_date || todayStr;
        const timeSlot = buildTimeSlot(plan.start_time, plan.duration_hours);

        // Check if an existing booking already exists for this date and plan
        const { data: existingBooking } = await supabase
          .from("bookings")
          .select("id, payment_status")
          .eq("recurring_plan_id", plan.id)
          .eq("date", targetDate)
          .maybeSingle();

        if (existingBooking) {
          const nextDate = calculateNextDate(targetDate, plan.frequency);
          await supabase.from("recurring_plans").update({ next_booking_date: nextDate }).eq("id", plan.id);
          results.push({ planId: plan.id, status: "skipped_existing", bookingId: existingBooking.id });
          continue;
        }

        // Generate collision-free invoice number
        let invoiceNumber = generateCryptoInvoiceNumber(targetDate);
        try {
          const { data: seqInv } = await supabase.rpc("next_invoice_number");
          if (typeof seqInv === "string" && seqInv) invoiceNumber = seqInv;
        } catch {
          // Use crypto fallback
        }

        // Create booking (unique index on (recurring_plan_id, date) prevents concurrent duplicates)
        const { data: newBooking, error: bookingErr } = await supabase
          .from("bookings")
          .insert({
            user_id: plan.user_id,
            service_type: plan.service_type,
            service_name: plan.service_name,
            date: targetDate,
            time_slot: timeSlot,
            address: plan.address,
            city: plan.city,
            postcode: plan.postcode,
            price: plan.price_per_visit,
            status: "upcoming",
            payment_status: "pending",
            notes: plan.notes,
            invoice_number: invoiceNumber,
            bedrooms: plan.bedrooms,
            bathrooms: plan.bathrooms,
            living_rooms: plan.living_rooms,
            extras: plan.extras,
            property_type: plan.property_type,
            duration_hours: plan.duration_hours,
            access_method: plan.access_method || "home",
            supplies_option: plan.supplies_option || "cleaner",
            parking_option: plan.parking_option || "free",
            has_pets: Boolean(plan.has_pets),
            recurring_plan_id: plan.id,
            recurring_freq: plan.frequency,
          })
          .select()
          .single();

        if (bookingErr || !newBooking) {
          // Unique violation means a concurrent worker already created this visit
          if (bookingErr?.code === "23505") {
            results.push({ planId: plan.id, status: "skipped_concurrent" });
            continue;
          }
          console.error(`[Process Plan Error] Failed to create booking for plan ${plan.id}:`, bookingErr);
          results.push({ planId: plan.id, error: bookingErr?.message || "Booking insert failed" });
          continue;
        }

        let chargeSuccess = false;
        let paymentIntentId: string | null = null;
        let chargeId: string | null = null;

        if (plan.stripe_customer_id && plan.stripe_payment_method_id) {
          try {
            const amount = Math.round(Number(plan.price_per_visit) * 100);
            const paymentIntent = await stripe.paymentIntents.create(
              {
                amount,
                currency: "gbp",
                customer: plan.stripe_customer_id,
                payment_method: plan.stripe_payment_method_id,
                off_session: true,
                confirm: true,
                metadata: {
                  booking_id: newBooking.id,
                  recurring_plan_id: plan.id,
                  user_id: plan.user_id,
                  invoice_number: invoiceNumber,
                },
                description: `MakeMeClean - ${plan.service_name} (${targetDate})`,
              },
              {
                idempotencyKey: `recurring-${plan.id}-${targetDate}`,
              },
            );

            if (paymentIntent.status === "succeeded") {
              chargeSuccess = true;
              paymentIntentId = paymentIntent.id;
              const latestCharge = paymentIntent.latest_charge;
              chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
            }
          } catch (stripeErr: any) {
            const nextFailureCount = (plan.failure_count || 0) + 1;
            const shouldPause = nextFailureCount >= 3;
            console.error(`[Stripe Off-Session Charge Error] Plan ${plan.id}:`, stripeErr.message);

            await supabase
              .from("recurring_plans")
              .update({
                failure_count: nextFailureCount,
                last_failure_reason: stripeErr.message,
                ...(shouldPause ? { status: "paused" } : {}),
              })
              .eq("id", plan.id);

            await sendTelegramAlert(
              `⚠️ *Recurring Plan Payment Failed*\n\n` +
                `*Plan ID:* \`${plan.id}\`\n` +
                `*Service:* ${escapeTelegram(plan.service_name)}\n` +
                `*Visit Date:* ${targetDate}\n` +
                `*Amount:* £${Number(plan.price_per_visit).toFixed(2)}\n` +
                `*Failures:* ${nextFailureCount}${shouldPause ? " (Plan auto-paused)" : ""}\n` +
                `*Reason:* ${escapeTelegram(stripeErr.message || "Payment requires action")}\n` +
                `Pending booking \`${newBooking.id}\` created; customer must complete payment online.`,
            );
          }
        }

        const nextDate = calculateNextDate(targetDate, plan.frequency);

        if (chargeSuccess) {
          await supabase
            .from("bookings")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntentId,
              stripe_charge_id: chargeId,
            })
            .eq("id", newBooking.id);

          await supabase
            .from("recurring_plans")
            .update({
              next_booking_date: nextDate,
              last_booked_at: new Date().toISOString(),
              last_booking_id: newBooking.id,
              failure_count: 0,
              last_failure_reason: null,
            })
            .eq("id", plan.id);

          const notificationHeaders = internalHeaders();
          if (notificationHeaders) {
            try {
              await supabase.functions.invoke("notifications", {
                body: { type: "booking_confirmation", bookingId: newBooking.id },
                headers: notificationHeaders,
              });
              await supabase.functions.invoke("notifications", {
                body: { type: "payment_receipt", bookingId: newBooking.id },
                headers: notificationHeaders,
              });
            } catch (notifyErr) {
              console.error("[Notification Error]:", notifyErr);
            }
          }

          results.push({ planId: plan.id, status: "charged", bookingId: newBooking.id });
        } else {
          await supabase
            .from("recurring_plans")
            .update({
              next_booking_date: nextDate,
              last_booked_at: new Date().toISOString(),
              last_booking_id: newBooking.id,
            })
            .eq("id", plan.id);

          results.push({ planId: plan.id, status: "payment_pending", bookingId: newBooking.id });
        }
      } catch (itemErr: any) {
        console.error(`[Process Plan Item Error] Plan ${plan.id}:`, itemErr);
        results.push({ planId: plan.id, error: itemErr.message });
      }
    }

    return json(200, { ok: true, processedCount: results.length, results });
  } catch (e: any) {
    console.error("[process-recurring-plans error]", e);
    return json(500, { ok: false, error: "Internal server error" });
  }
});
