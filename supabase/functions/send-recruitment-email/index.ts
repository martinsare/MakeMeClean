// Edge function: send-recruitment-email
// Admin-only: sends a freeform email from recruitment@makemeclean.co.uk via Brevo.

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function escapeHtml(v: string) {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildHtml(subject: string, bodyText: string, toName: string, recruitmentEmail: string) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const safeBody = escapeHtml(bodyText).replaceAll("\n", "<br>");
  const safeName = escapeHtml(toName);
  const safeSubject = escapeHtml(subject);
  const safeEmail = escapeHtml(recruitmentEmail);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f6f7fb">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:22px 24px 16px;border-bottom:1px solid #eef2f7">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#111827">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-size:12px;font-weight:600;color:#6b7280">Recruitment Team</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;font-family:${font}">
            <p style="margin:0 0 14px;font-size:14px;color:#374151">Hi ${safeName},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">${safeBody}</p>
            <hr style="border:none;border-top:1px solid #eef2f7;margin:20px 0"/>
            <p style="margin:0;font-size:12px;color:#9ca3af">
              MakeMeClean Recruitment &bull; Wales, UK<br>
              To get in touch, reply to this email or write to
              <a href="mailto:${safeEmail}" style="color:#16a34a">${safeEmail}</a>
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
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!supabaseUrl || !serviceKey || !brevoKey) {
      return json(500, { ok: false, error: "Email service not configured" }, req);
    }

    // Verify caller is an authenticated admin via public.admins (consistent with all other admin checks)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Unauthorised" }, req);

    const supabase = createClient(supabaseUrl, serviceKey);
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user) return json(401, { ok: false, error: "Unauthorised" }, req);

    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Forbidden" }, req);

    const { to, toName, subject, bodyText } = (await req.json()) as {
      to?: string;
      toName?: string;
      subject?: string;
      bodyText?: string;
    };

    if (!to || !subject || !bodyText) {
      return json(400, { ok: false, error: "Missing required fields: to, subject, bodyText" }, req);
    }

    const recruitmentEmail = Deno.env.get("RECRUITMENT_EMAIL") ?? "recruitment@makemeclean.co.uk";
    const html = buildHtml(subject, bodyText, toName ?? to, recruitmentEmail);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: recruitmentEmail, name: "MakeMeClean Recruitment" },
        to: [{ email: to, name: toName ?? to }],
        subject,
        htmlContent: html,
        replyTo: { email: recruitmentEmail, name: "MakeMeClean Recruitment" },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Brevo error (${res.status}): ${text}`);
    }

    return json(200, { ok: true }, req);
  } catch (e) {
    console.error("[send-recruitment-email]", e);
    return json(500, { ok: false, error: "Failed to send recruitment email" }, req);
  }
});
