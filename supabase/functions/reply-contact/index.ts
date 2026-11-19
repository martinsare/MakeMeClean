// Supabase Edge Function: reply-contact
// Admin-only: sends an email reply to a contact form submission via Brevo.

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function mustGetEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReplyEmail(args: {
  recipientName: string;
  subject: string;
  originalMessage: string;
  replyText: string;
}) {
  const font   = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const bg     = "#f6f7fb";
  const border = "#e5e7eb";
  const divider = "#eef2f7";

  const safe = (v: string) => escapeHtml(v);

  const replyHtml = safe(args.replyText).replaceAll("\n", "<br />");
  const originalHtml = safe(args.originalMessage).replaceAll("\n", "<br />");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${safe(args.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${bg}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      A reply from MakeMeClean regarding your enquiry.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:640px;background:#ffffff;border:1px solid ${border};border-radius:20px;overflow:hidden">

          <!-- Header -->
          <tr><td style="padding:22px 22px 16px;border-bottom:1px solid ${divider}">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#111827">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-weight:600;font-size:12px;color:#6b7280">Reply to your enquiry</p>
          </td></tr>

          <!-- Reply body -->
          <tr><td style="padding:24px 22px;font-family:${font}">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#111827">Hi ${safe(args.recipientName)},</p>
            <div style="margin:12px 0 0;font-size:14px;line-height:1.75;color:#374151">${replyHtml}</div>

            <div style="height:1px;background:${divider};margin:24px 0"></div>

            <!-- Original message quoted -->
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Your original message</p>
            <div style="background:#f9fafb;border:1px solid ${border};border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.7;color:#6b7280">
              ${originalHtml}
            </div>

            <div style="height:1px;background:${divider};margin:24px 0"></div>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;font-family:${font}">
              MakeMeClean · Wales, UK<br />
              Replies to this email go to <a href="mailto:info@makemeclean.co.uk" style="color:#16a34a">info@makemeclean.co.uk</a>
            </p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl  = mustGetEnv("SUPABASE_URL");
    const serviceKey   = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey      = Deno.env.get("SUPABASE_ANON_KEY") ?? mustGetEnv("ANON_KEY");

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json(401, { ok: false, error: "Unauthorised" }, req);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await adminClient
      .from("admins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Forbidden" }, req);

    const { messageId, replyText } = (await req.json()) as { messageId?: string; replyText?: string };
    if (!messageId)  return json(400, { ok: false, error: "Missing messageId" }, req);
    if (!replyText?.trim()) return json(400, { ok: false, error: "Reply text is empty" }, req);

    // Fetch the contact message
    const { data: msg, error: msgErr } = await adminClient
      .from("contact_messages")
      .select("id, name, email, subject, message")
      .eq("id", messageId)
      .single();
    if (msgErr || !msg) return json(404, { ok: false, error: "Message not found" }, req);

    // Send reply via Brevo
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json(500, { ok: false, error: "BREVO_API_KEY not configured" }, req);

    const subject  = msg.subject ? `Re: ${msg.subject}` : "Reply from MakeMeClean";
    const htmlBody = buildReplyEmail({
      recipientName:   msg.name,
      subject,
      originalMessage: msg.message,
      replyText:       replyText.trim(),
    });

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender:      { email: "info@makemeclean.co.uk", name: "MakeMeClean" },
        replyTo:     { email: "info@makemeclean.co.uk", name: "MakeMeClean" },
        to:          [{ email: msg.email, name: msg.name }],
        subject,
        htmlContent: htmlBody,
      }),
    });

    if (!brevoRes.ok) {
      const text = await brevoRes.text().catch(() => "");
      console.error(`[reply-contact] Brevo error ${brevoRes.status}: ${text}`);
      return json(502, { ok: false, error: `Email delivery failed (${brevoRes.status})` }, req);
    }

    // Mark message as replied
    await adminClient
      .from("contact_messages")
      .update({ status: "replied" })
      .eq("id", messageId);

    return json(200, { ok: true }, req);
  } catch (e) {
    console.error("[reply-contact] error:", e);
    return json(500, { ok: false, error: "Internal server error" }, req);
  }
});
