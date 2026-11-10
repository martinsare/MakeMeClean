// Supabase Edge Function: notifications
// Receives an event (booking_confirmation/payment_receipt/booking_reminder),
// loads booking + customer email from DB, then sends via Brevo Transactional Email API.

import { createClient } from "jsr:@supabase/supabase-js@2";

type NotificationEvent =
  | { type: "booking_confirmation"; bookingId: string }
  | { type: "payment_receipt"; bookingId: string }
  | { type: "booking_reminder"; bookingId: string };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  const origin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function mustGetEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function requireInternalRequest(req: Request) {
  const expected = Deno.env.get("NOTIFICATIONS_INTERNAL_TOKEN");
  if (!expected) throw new Error("Missing env var: NOTIFICATIONS_INTERNAL_TOKEN");
  const provided = req.headers.get("x-internal-token") ?? "";
  if (provided !== expected) {
    return false;
  }
  return true;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatGBP(penceOrNumber: number) {
  const amount = typeof penceOrNumber === "number" ? penceOrNumber : Number(penceOrNumber);
  return `£${amount.toFixed(2)}`;
}

function buildEmail(event: NotificationEvent, booking: any) {
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const bookingUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/bookings/${booking.id}` : "";
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "support@makemeclean.co.uk";
  const paymentsEmail = Deno.env.get("PAYMENTS_EMAIL") ?? "payment@makemeclean.co.uk";

  const safeService = escapeHtml(String(booking.service_name ?? "Cleaning"));
  const safeDate = escapeHtml(String(booking.date ?? ""));
  const safeTime = escapeHtml(String(booking.time_slot ?? ""));
  const safeAddress = escapeHtml(String(booking.address ?? ""));
  const safeCity = escapeHtml(String(booking.city ?? ""));
  const safePostcode = escapeHtml(String(booking.postcode ?? ""));
  const safeInvoice = escapeHtml(String(booking.invoice_number ?? ""));
  const safePrice = formatGBP(Number(booking.price ?? 0));
  const invoiceNumber = escapeHtml(String(booking.invoice_number ?? booking.id));

  // Property Layout & Specialist Add-Ons
  const bedrooms = booking.bedrooms || 1;
  const bathrooms = booking.bathrooms || 1;
  const livingRooms = booking.living_rooms || 1;
  const propertyType = escapeHtml(String(booking.property_type || "House/Flat"));
  const layoutString = `${bedrooms} Bedroom${bedrooms > 1 ? "s" : ""}, ${bathrooms} Bathroom${bathrooms > 1 ? "s" : ""}, ${livingRooms} Living Area${livingRooms > 1 ? "s" : ""}`;
  const durationString = `${booking.duration_hours || 2} Hours`;
  
  let extrasList: string[] = [];
  if (Array.isArray(booking.extras)) {
    extrasList = booking.extras.map((x: any) => String(x));
  } else if (typeof booking.extras === "string") {
    try {
      const parsed = JSON.parse(booking.extras);
      if (Array.isArray(parsed)) extrasList = parsed.map((x: any) => String(x));
    } catch (_) {}
  }
  const extrasString = extrasList.length > 0 ? escapeHtml(extrasList.join(", ")) : "None selected";
  const safeNotes = booking.notes ? escapeHtml(String(booking.notes)) : "";

  const font = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  const bg = "#f6f7fb";
  const border = "#e5e7eb";
  const divider = "#eef2f7";

  const styles = {
    body: `margin:0;padding:0;background:${bg}`,
    container: "width:100%;padding:28px 12px",
    card: `width:100%;max-width:640px;background:#ffffff;border:1px solid ${border};border-radius:20px;overflow:hidden`,
    header: `padding:22px 22px 16px;border-bottom:1px solid ${divider}`,
    brand: `font-family:${font};font-weight:900;font-size:22px;line-height:1.1;color:#111827;margin:0`,
    meta: `font-family:${font};font-weight:600;font-size:12px;line-height:1.4;color:#6b7280;margin:6px 0 0`,
    bodyCell: `padding:18px 22px;font-family:${font}`,
    h2: `margin:0 0 10px;font-weight:900;font-size:18px;line-height:1.2;color:#111827`,
    p: `margin:0 0 12px;font-weight:500;font-size:14px;line-height:1.6;color:#374151`,
    panel: `border:1px solid ${border};border-radius:16px;overflow:hidden`,
    panelHeader: `background:#f9fafb;padding:12px 14px;font-family:${font};font-weight:800;font-size:12px;line-height:1.4;color:#111827`,
    rowLabel: `font-family:${font};font-weight:700;font-size:13px;line-height:1.6;color:#6b7280;padding:10px 14px;border-top:1px solid ${divider}`,
    rowValue: `font-family:${font};font-weight:900;font-size:13px;line-height:1.6;color:#111827;padding:10px 14px;border-top:1px solid ${divider};text-align:right`,
    cta: `display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-family:${font};font-weight:900;font-size:14px;line-height:1;padding:12px 16px;border-radius:12px`,
    hr: `height:1px;background:${divider};margin:16px 0`,
    small: `margin:0;font-weight:500;font-size:12px;line-height:1.6;color:#6b7280;font-family:${font}`,
    footer: `padding:14px 22px 22px;font-family:${font}`,
  } as const;

  const panelRow = (label: string, value: string) =>
    `<tr><td style="${styles.rowLabel}">${label}</td><td style="${styles.rowValue}">${value}</td></tr>`;

  const emailShell = (args: {
    preheader: string;
    heading: string;
    intro: string;
    panelTitle: string;
    panelRows: string;
    ctaHref?: string;
    ctaLabel?: string;
    helpText: string;
  }) =>
    `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${escapeHtml(args.heading)}</title>
        </head>
        <body style="${styles.body}">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
            ${escapeHtml(args.preheader)}
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.container}">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.card}">
                  <tr>
                    <td style="${styles.header}">
                      <p style="${styles.brand}">MakeMe<span style="color:#16a34a">Clean</span></p>
                      <p style="${styles.meta}">${escapeHtml(args.heading)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="${styles.bodyCell}">
                      <h2 style="${styles.h2}">${escapeHtml(args.heading)}</h2>
                      <p style="${styles.p}">${escapeHtml(args.intro)}</p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.panel}">
                        <tr><td colspan="2" style="${styles.panelHeader}">${escapeHtml(args.panelTitle)}</td></tr>
                        ${args.panelRows}
                      </table>

                      ${args.ctaHref ? `<p style="margin:16px 0 0"><a href="${args.ctaHref}" style="${styles.cta}">${escapeHtml(args.ctaLabel ?? "View details")}</a></p>` : ""}
                      <div style="${styles.hr}"></div>
                      <p style="${styles.small}">${escapeHtml(args.helpText)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="${styles.footer}">
                      <p style="${styles.small}">MakeMeClean • Wales, UK</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `.trim();

  if (event.type === "booking_confirmation") {
    return {
      subject: `Booking confirmed: ${safeService}`,
      html: emailShell({
        preheader: `Booking confirmed for ${safeDate} ${safeTime}`,
        heading: "Booking confirmation",
        intro: "Thanks for booking with MakeMeClean. Your customized cleaning session is confirmed and scheduled.",
        panelTitle: "Booking details & specifications",
        panelRows: [
          panelRow("Service", safeService),
          panelRow("Date", safeDate),
          panelRow("Time", safeTime),
          panelRow("Property Type", propertyType),
          panelRow("Property Layout", layoutString),
          panelRow("Estimated Duration", durationString),
          panelRow("Specialist Add-Ons", extrasString),
          safeNotes ? panelRow("Special Instructions", safeNotes) : "",
          safeAddress ? panelRow("Address", safeAddress) : "",
          safeCity ? panelRow("City", safeCity) : "",
          safePostcode ? panelRow("Postcode", safePostcode) : "",
          panelRow("Total Amount", safePrice),
          panelRow("Booking Reference", escapeHtml(String(booking.id))),
        ].join(""),
        ctaHref: bookingUrl || undefined,
        ctaLabel: "View booking",
        helpText: `Need to amend your booking? Visit your dashboard or reach our team at ${supportEmail}.`,
      }),
    };
  }

  if (event.type === "payment_receipt") {
    return {
      subject: `Payment received${safeInvoice ? ` • ${safeInvoice}` : ""}`,
      html: emailShell({
        preheader: `Receipt for invoice ${invoiceNumber}`,
        heading: "Payment receipt",
        intro: "Thanks — we’ve received your payment. Here is the full breakdown of your clean and chosen options.",
        panelTitle: `Invoice • ${invoiceNumber}`,
        panelRows: [
          panelRow("Service", safeService),
          panelRow("Date", safeDate),
          panelRow("Time", safeTime),
          panelRow("Property Layout", layoutString),
          panelRow("Specialist Add-Ons", extrasString),
          panelRow("Total Paid", escapeHtml(safePrice)),
        ].join(""),
        ctaHref: bookingUrl || undefined,
        ctaLabel: "View booking",
        helpText: `Questions about this invoice? Contact our finance team at ${paymentsEmail}.`,
      }),
    };
  }

  // booking_reminder
  return {
    subject: `Reminder: ${safeService} on ${safeDate}`,
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; padding: 16px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb">
        <h2 style="margin:0 0 12px; color: #111827">Booking reminder</h2>
        <p style="margin:0 0 12px; color: #374151">Just a reminder about your upcoming clean with MakeMeClean.</p>
        <ul style="margin:0 0 16px; padding-left: 18px; color: #374151">
          <li><b>Service:</b> ${safeService}</li>
          <li><b>Date & Time:</b> ${safeDate} at ${safeTime}</li>
          <li><b>Property:</b> ${layoutString} (${propertyType})</li>
          <li><b>Add-Ons:</b> ${extrasString}</li>
          ${safeAddress ? `<li><b>Address:</b> ${safeAddress}, ${safeCity} ${safePostcode}</li>` : ""}
          ${safeNotes ? `<li><b>Entry Notes:</b> ${safeNotes}</li>` : ""}
        </ul>
        ${bookingUrl ? `<p style="margin:0 0 16px"><a href="${bookingUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px">View booking details</a></p>` : ""}
      </div>
    `.trim(),
  };
}

function senderForEvent(event: NotificationEvent) {
  if (event.type === "booking_confirmation") {
    return { email: "booking@makemeclean.co.uk", name: "MakeMeClean Bookings" };
  }

  if (event.type === "payment_receipt") {
    return { email: "payment@makemeclean.co.uk", name: "MakeMeClean Payments" };
  }

  // Fallback sender (e.g. reminders)
  return { email: "info@makemeclean.co.uk", name: "MakeMeClean" };
}

async function sendTelegram(event: NotificationEvent, booking: any, customerEmail: string, customerName?: string, customerPhone?: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return;

  const invoice = booking.invoice_number ?? booking.id;
  const title =
    event.type === "payment_receipt"
      ? "✅ Payment Received (Booking Confirmed)"
      : event.type === "booking_confirmation"
        ? "🧾 Booking Confirmed (Paid)"
        : "⏰ Booking Reminder";

  let extrasList: string[] = [];
  if (Array.isArray(booking.extras)) extrasList = booking.extras.map((x: any) => String(x));
  const extrasText = extrasList.length > 0 ? extrasList.join(", ") : "None";

  const accessLabel = booking.access_method === "home" ? "Customer at home" : booking.access_method === "key_safe" ? "Key safe / Lockbox" : booking.access_method === "concierge" ? "Concierge" : booking.access_method === "hidden_key" ? "Hidden key" : (booking.access_method || "Customer at home");
  const suppliesLabel = booking.supplies_option === "customer" ? "Customer provides supplies" : "Cleaner brings eco supplies";
  const parkingLabel = booking.parking_option === "paid" ? "Paid parking meter nearby" : booking.parking_option === "none" ? "No parking (public transport only)" : "Free on-street/driveway";
  const petsLabel = booking.has_pets ? "Yes 🐾" : "No";

  const lines = [
    `*${title}*`,
    "",
    `*Service:* ${booking.service_name ?? "Cleaning"}`,
    `*Date:* ${booking.date ?? ""}`,
    booking.time_slot ? `*Time:* ${booking.time_slot}` : null,
    booking.price != null ? `*Amount:* ${formatGBP(Number(booking.price))}` : null,
    invoice ? `*Invoice:* \`${invoice}\`` : null,
    "",
    `👤 *Customer Information:*`,
    customerName ? `*Name:* ${customerName}` : null,
    `*Email:* ${customerEmail}`,
    customerPhone ? `*Phone:* ${customerPhone}` : null,
    "",
    `📍 *Property & Location:*`,
    `*Property:* ${booking.bedrooms || 1} Bed · ${booking.bathrooms || 1} Bath · ${booking.living_rooms || 1} Living (${booking.property_type || "House/Flat"})`,
    `*Duration:* ${booking.duration_hours || 2}h`,
    booking.address ? `*Address:* ${booking.address}` : null,
    booking.city ? `*City:* ${booking.city}` : null,
    booking.postcode ? `*Postcode:* ${booking.postcode}` : null,
    "",
    `⚙️ *Access & Instructions:*`,
    `*Access:* ${accessLabel}`,
    `*Supplies:* ${suppliesLabel}`,
    `*Parking:* ${parkingLabel}`,
    `*Pets:* ${petsLabel}`,
    `*Add-Ons:* ${extrasText}`,
    booking.notes && String(booking.notes).trim() ? `*Special Notes:* "${String(booking.notes).trim()}"` : null,
    "",
    `*Booking ID:* \`${booking.id}\``,
  ].filter(Boolean);

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    if (!requireInternalRequest(req)) {
      return json(403, { error: "Forbidden" });
    }

    const payload = (await req.json()) as NotificationEvent;
    if (!payload?.type || !payload?.bookingId) return json(400, { error: "Invalid payload" });

    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, user_id, service_name, date, time_slot, address, city, postcode, price, invoice_number, payment_status, bedrooms, bathrooms, living_rooms, property_type, duration_hours, extras, notes, access_method, supplies_option, parking_option, has_pets")
      .eq("id", payload.bookingId)
      .single();

    if (error || !booking) return json(404, { error: "Booking not found" });

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(booking.user_id);
    if (userErr || !userData?.user?.email) return json(400, { error: "Customer email not found" });

    // Fetch profile info for name and phone if available
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", booking.user_id)
      .maybeSingle();

    const customerName = profile?.full_name || userData.user.user_metadata?.full_name || userData.user.email?.split("@")[0];
    const customerPhone = profile?.phone || userData.user.user_metadata?.phone;

    const email = buildEmail(payload, booking);
    const sender = senderForEvent(payload);
    await (async () => {
      const apiKey = mustGetEnv("BREVO_API_KEY");
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: userData.user.email }],
          subject: email.subject,
          htmlContent: email.html,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Brevo error (${res.status}): ${text}`);
      }
    })();

    // Internal notification sent to Telegram upon booking confirmation or payment
    if (payload.type === "payment_receipt" || payload.type === "booking_confirmation") {
      try {
        await sendTelegram(payload, booking, userData.user.email, customerName, customerPhone);
      } catch (e) {
        console.error("[notifications] Telegram failed:", e);
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
