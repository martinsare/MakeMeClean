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

  try {
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

    // Find all active recurring plans due on or before today
    const { data: duePlans, error: plansErr } = await supabase
      .from("recurring_plans")
      .select("*")
      .eq("status", "active")
      .lte("next_booking_date", todayStr);

    if (plansErr) {
      return json(500, { ok: false, error: plansErr.message });
    }

    const results = [];

    for (const plan of (duePlans || [])) {
      try {
        const targetDate = plan.next_booking_date || todayStr;
        const timeSlot = plan.start_time
          ? `${plan.start_time} - ${String(Number(plan.start_time.split(":")[0]) + Math.ceil(plan.duration_hours || 2)).padStart(2, "0")}:${plan.start_time.split(":")[1] || "00"}`
          : "09:00 - 11:00";

        // Check if an existing booking already exists for this date and plan to prevent duplicates
        const { data: existingBooking } = await supabase
          .from("bookings")
          .select("id, payment_status")
          .eq("recurring_plan_id", plan.id)
          .eq("date", targetDate)
          .maybeSingle();

        if (existingBooking) {
          // If already booked, advance next date and continue
          const nextDate = calculateNextDate(targetDate, plan.frequency);
          await supabase.from("recurring_plans").update({ next_booking_date: nextDate }).eq("id", plan.id);
          results.push({ planId: plan.id, status: "skipped_existing", bookingId: existingBooking.id });
          continue;
        }

        // Generate invoice number
        const randomHex = Math.floor(1000 + Math.random() * 9000);
        const invoiceNumber = `MMC-${targetDate.replace(/-/g, "")}-${randomHex}`;

        // Create the new booking record
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
          console.error(`[Process Plan Error] Failed to create booking for plan ${plan.id}:`, bookingErr);
          results.push({ planId: plan.id, error: bookingErr?.message || "Booking insert failed" });
          continue;
        }

        // Attempt automated off-session charge via Stripe
        let chargeSuccess = false;
        let paymentIntentId = null;
        let chargeId = null;

        if (plan.stripe_customer_id && plan.stripe_payment_method_id) {
          try {
            const amount = Math.round(Number(plan.price_per_visit) * 100);
            const paymentIntent = await stripe.paymentIntents.create({
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
            });

            if (paymentIntent.status === "succeeded") {
              chargeSuccess = true;
              paymentIntentId = paymentIntent.id;
              const latestCharge = paymentIntent.latest_charge;
              chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
            }
          } catch (stripeErr: any) {
            console.error(`[Stripe Off-Session Charge Error] Plan ${plan.id}:`, stripeErr.message);
            await supabase.from("recurring_plans").update({
              failure_count: (plan.failure_count || 0) + 1,
              last_failure_reason: stripeErr.message,
            }).eq("id", plan.id);

            await sendTelegramAlert(
              `⚠️ *Recurring Plan Payment Failed*\n\n` +
              `*Plan ID:* \`${plan.id}\`\n` +
              `*Service:* ${plan.service_name}\n` +
              `*Visit Date:* ${targetDate}\n` +
              `*Amount:* £${plan.price_per_visit}\n` +
              `*Reason:* ${stripeErr.message}\n` +
              `A pending booking (\`${newBooking.id}\`) was created so staff knows the appointment is scheduled, but payment requires attention.`
            );
          }
        }

        if (chargeSuccess) {
          // Update booking to paid
          await supabase
            .from("bookings")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntentId,
              stripe_charge_id: chargeId,
            })
            .eq("id", newBooking.id);

          // Advance next booking date on plan
          const nextDate = calculateNextDate(targetDate, plan.frequency);
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

          // Send confirmation & receipt
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
          // Advance date anyway so we do not loop every hour on the same plan
          const nextDate = calculateNextDate(targetDate, plan.frequency);
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
    return json(500, { ok: false, error: e.message || String(e) });
  }
});
