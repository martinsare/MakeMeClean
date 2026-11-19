// Edge function: send-booking-reminders
// Sends reminder emails before paid upcoming bookings via Brevo.
// Designed to run automatically on an hourly schedule via Supabase cron.
// Reads `reminder_hours_before` from the settings table (default: 24).
// Tracks sent reminders via the `reminder_sent` column on bookings.

import { createClient } from "jsr:@supabase/supabase-js@2";

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (
      host === "makemeclean.co.uk" ||
      host.endsWith(".makemeclean.co.uk") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return true;
    }
    const configured = [
      Deno.env.get("ALLOWED_ORIGIN") ?? "",
      Deno.env.get("SITE_URL") ?? "",
      ...(Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(","),
    ];
    for (const entry of configured) {
      const trimmed = entry.trim();
      if (!trimmed || trimmed === "*") continue;
      try {
        const candidate = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        if (candidate.origin === url.origin) return true;
      } catch {
        // ignore invalid origin
      }
    }
  } catch {
    return false;
  }
  return false;
}

function corsHeaders(req?: Request) {
  const reqOrigin = req?.headers.get("origin") ?? "";
  const fallback = Deno.env.get("ALLOWED_ORIGIN") || Deno.env.get("SITE_URL") || "https://makemeclean.co.uk";
  const origin = reqOrigin && isAllowedOrigin(reqOrigin) ? new URL(reqOrigin).origin : fallback;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function constantTimeEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function isAuthorizedCronRequest(req: Request, serviceKey: string): boolean {
  const internalToken = (
    Deno.env.get("CRON_INTERNAL_TOKEN") ??
    Deno.env.get("NOTIFICATIONS_INTERNAL_TOKEN") ??
    ""
  ).trim();
  const providedInternal = (req.headers.get("x-internal-token") ?? "").trim();
  if (internalToken && providedInternal && constantTimeEquals(providedInternal, internalToken)) {
    return true;
  }
  const authHeader = (req.headers.get("authorization") ?? "").trim();
  if (serviceKey && authHeader && constantTimeEquals(authHeader, `Bearer ${serviceKey}`)) {
    return true;
  }
  return false;
}

function getUkNowParts(now: Date = new Date()): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour === "24" ? 0 : parts.hour);
  const minute = Number(parts.minute || 0);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
  };
}

function getHoursUntilUkSlot(dateStr: string, timeSlot: string | null | undefined, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const startPart = (timeSlot || "09:00").split(/[-–]/)[0]?.trim() || "09:00";
  const m = startPart.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const slotMinutes = Number(m[1]) * 60 + Number(m[2]);

  const ukNow = getUkNowParts(now);
  const [by, bm, bd] = dateStr.split("-").map(Number);
  const [ny, nm, nd] = ukNow.date.split("-").map(Number);
  const bookingDayMs = Date.UTC(by, bm - 1, bd);
  const nowDayMs = Date.UTC(ny, nm - 1, nd);
  const dayDiffMinutes = Math.round((bookingDayMs - nowDayMs) / 60000);
  return (dayDiffMinutes + slotMinutes - ukNow.minutes) / 60;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReminderHtml(customerName: string, serviceName: string, date: string, timeSlot: string, hoursLabel: string) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const safeCustomerName = escapeHtml(customerName);
  const safeServiceName = escapeHtml(serviceName);
  const safeDate = escapeHtml(date);
  const safeTimeSlot = escapeHtml(timeSlot);
  const safeHoursLabel = escapeHtml(hoursLabel);
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f6f7fb">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:22px 24px 16px;border-bottom:1px solid #eef2f7;background:#16a34a">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#fff">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-size:12px;font-weight:600;color:#dcfce7">Booking Reminder</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 24px;font-family:${font}">
            <p style="margin:0 0 16px;font-size:14px;color:#374151">Hi ${safeCustomerName},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">
              This is a friendly reminder that your <strong>${safeServiceName}</strong> cleaning is coming up in <strong>${safeHoursLabel}</strong>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:20px 0">
              <p style="margin:0 0 8px;font-size:13px;color:#374151"><strong>Date:</strong> ${safeDate}</p>
              <p style="margin:0;font-size:13px;color:#374151"><strong>Time:</strong> ${safeTimeSlot}</p>
            </div>
            <p style="margin:16px 0;font-size:14px;color:#374151">
              Please ensure property access is ready at the scheduled time. If you need to reschedule or have any questions, log in to your account or contact us.
            </p>
            <hr style="border:none;border-top:1px solid #eef2f7;margin:20px 0"/>
            <p style="margin:0;font-size:12px;color:#9ca3af">
              MakeMeClean · Wales, UK<br/>
              Need to reschedule? Log in at makemeclean.co.uk or email contact@makemeclean.co.uk
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Server misconfiguration" }, req);
    }
    if (!isAuthorizedCronRequest(req, serviceKey)) {
      return json(401, { error: "Unauthorized" }, req);
    }
    if (!brevoKey) return json(500, { error: "Email service not configured" }, req);

    const sb = createClient(supabaseUrl, serviceKey);

    // Read reminder_hours_before from settings (default 24)
    const { data: settingRow } = await sb
      .from("settings")
      .select("value")
      .eq("key", "reminder_hours_before")
      .maybeSingle();

    const hoursBeforeRaw = parseFloat(settingRow?.value ?? "24");
    const hoursBefore = Number.isNaN(hoursBeforeRaw) || hoursBeforeRaw < 1 ? 24 : hoursBeforeRaw;

    // Query paid upcoming bookings within candidate dates spanning Europe/London target window
    const now = new Date();
    const ukToday = getUkNowParts(now).date;
    const windowEndDate = getUkNowParts(new Date(now.getTime() + (hoursBefore + 24) * 3600 * 1000)).date;

    const { data: candidateBookings, error: bookingErr } = await sb
      .from("bookings")
      .select("id, date, time_slot, service_name, status, payment_status, user_id, reminder_sent")
      .eq("status", "upcoming")
      .eq("payment_status", "paid")
      .eq("reminder_sent", false)
      .gte("date", ukToday)
      .lte("date", windowEndDate)
      .limit(500);

    if (bookingErr) {
      console.error("[send-booking-reminders] query error:", bookingErr);
      return json(500, { error: "Failed to fetch bookings" }, req);
    }

    // Filter precisely to bookings starting within (0, hoursBefore + 0.5] hours from now (UK time)
    // so hourly cron runs send each reminder once right around `hoursBefore` hours before start.
    const dueBookings = (candidateBookings ?? []).filter((b) => {
      const hrsUntil = getHoursUntilUkSlot(b.date, b.time_slot, now);
      return hrsUntil !== null && hrsUntil > 0 && hrsUntil <= hoursBefore + 0.5;
    });

    if (dueBookings.length === 0) {
      return json(200, { ok: true, sent: 0, message: "No paid upcoming bookings currently due for reminders" }, req);
    }

    // Batch-fetch customer profile names
    const userIds = [...new Set(dueBookings.map((b) => b.user_id).filter(Boolean))];
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.id && p.full_name) nameMap.set(p.id, p.full_name);
    }

    // Cache resolved auth emails per userId
    const emailCache = new Map<string, string | null>();
    const getEmail = async (uid: string): Promise<string | null> => {
      if (emailCache.has(uid)) return emailCache.get(uid) ?? null;
      const { data: uData } = await sb.auth.admin.getUserById(uid);
      const email = uData?.user?.email ?? null;
      emailCache.set(uid, email);
      return email;
    };

    let sent = 0;
    let failed = 0;
    const sentIds: string[] = [];

    for (const booking of dueBookings) {
      try {
        const email = await getEmail(booking.user_id);
        if (!email) {
          failed++;
          continue;
        }

        const customerName = nameMap.get(booking.user_id) || "there";
        const hoursLabel = hoursBefore === 24 ? "24 hours" : `${hoursBefore} hours`;
        const html = buildReminderHtml(customerName, booking.service_name, booking.date, booking.time_slot, hoursLabel);

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: [{ email, name: customerName }],
            sender: { email: "booking@makemeclean.co.uk", name: "MakeMeClean Bookings" },
            subject: `Reminder: Your ${booking.service_name} is coming up`,
            htmlContent: html,
            replyTo: { email: "contact@makemeclean.co.uk", name: "MakeMeClean" },
          }),
        });

        if (res.ok) {
          sent++;
          sentIds.push(booking.id);
        } else {
          const errText = await res.text().catch(() => "");
          console.error(`[send-booking-reminders] Brevo error for ${booking.id}: ${res.status} ${errText}`);
          failed++;
        }
      } catch (err) {
        console.error(`[send-booking-reminders] error for ${booking.id}:`, err);
        failed++;
      }
    }

    if (sentIds.length > 0) {
      await sb.from("bookings").update({ reminder_sent: true }).in("id", sentIds);
    }

    return json(200, { ok: true, sent, failed, total: dueBookings.length, hours_before: hoursBefore }, req);
  } catch (err) {
    console.error("[send-booking-reminders] unexpected error:", err);
    return json(500, { error: "Internal server error" }, req);
  }
});
