// Edge function: send-newsletter
// Admin-only: sends newsletter in concurrent batches to all active subscribers via Brevo.

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

function escapeHtml(v: string) {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildNewsletterHtml(subject: string, bodyText: string) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const safeBody = escapeHtml(bodyText).replaceAll("\n", "<br>");
  const safeSubject = escapeHtml(subject);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f6f7fb">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:22px 24px 16px;border-bottom:1px solid #eef2f7;background:#16a34a">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#fff">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-size:12px;font-weight:600;color:#dcfce7">Newsletter</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;font-family:${font}">
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">${safeBody}</p>
            <hr style="border:none;border-top:1px solid #eef2f7;margin:20px 0"/>
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af">
              MakeMeClean · Wales, UK<br>
              <a href="https://makemeclean.co.uk/unsubscribe" style="color:#16a34a;text-decoration:underline;font-weight:600">Unsubscribe</a>
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

    if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: "Server misconfiguration" }, req);
    if (!brevoKey) return json(500, { ok: false, error: "Brevo not configured" }, req);

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Unauthorized" }, req);

    const sb = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json(401, { ok: false, error: "Invalid token" }, req);

    const { data: adminRow } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Not an admin" }, req);

    const body = await req.json();
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";

    if (!subject || !bodyText) {
      return json(400, { ok: false, error: "Subject and body are required" }, req);
    }
    if (subject.length > 200 || bodyText.length > 20000) {
      return json(400, { ok: false, error: "Newsletter content exceeds allowed length" }, req);
    }

    // Fetch all active subscribers across paginated batches (avoids 1,000-row PostgREST truncation)
    const allSubscribers: string[] = [];
    const pageSize = 1000;
    for (let from = 0; from < 50000; from += pageSize) {
      const { data: batch, error: subErr } = await sb
        .from("newsletter_subscriptions")
        .select("email")
        .is("unsubscribed_at", null)
        .range(from, from + pageSize - 1);

      if (subErr) {
        console.error("[send-newsletter] query error:", subErr);
        return json(500, { ok: false, error: "Failed to fetch subscribers" }, req);
      }
      if (!batch || batch.length === 0) break;
      for (const row of batch) {
        if (row.email) allSubscribers.push(String(row.email).trim().toLowerCase());
      }
      if (batch.length < pageSize) break;
    }

    const uniqueSubscribers = [...new Set(allSubscribers)];
    if (uniqueSubscribers.length === 0) {
      return json(200, { ok: true, sent: 0, message: "No active subscribers" }, req);
    }

    const html = buildNewsletterHtml(subject, bodyText);
    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://makemeclean.co.uk").replace(/\/$/, "");

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const CONCURRENCY = 10;

    for (let i = 0; i < uniqueSubscribers.length; i += CONCURRENCY) {
      const chunk = uniqueSubscribers.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (email) => {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: [{ email }],
              sender: { email: "info@makemeclean.co.uk", name: "MakeMeClean" },
              subject,
              htmlContent: html,
              replyTo: { email: "contact@makemeclean.co.uk", name: "MakeMeClean" },
              headers: {
                "List-Unsubscribe": `<${siteUrl}/unsubscribe>`,
              },
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
          }
        })
      );

      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          sent++;
        } else {
          failed++;
          if (errors.length < 5) {
            errors.push(`${chunk[idx]}: ${String(result.reason)}`);
          }
        }
      });
    }

    return json(
      200,
      {
        ok: true,
        sent,
        failed,
        total: uniqueSubscribers.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      req
    );
  } catch (err) {
    console.error("[send-newsletter] unexpected error:", err);
    return json(500, { ok: false, error: "Internal server error" }, req);
  }
});
