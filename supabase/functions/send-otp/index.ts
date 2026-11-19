// Edge Function: send-otp
// Generates a 6-digit OTP, saves to DB with proper rate limiting (non-destructive),
// prevents account enumeration on password_reset, and emails it via Brevo.

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

function generateOtp(): string {
  // Rejection-sampled unbiased 6-digit code
  const max = 900000;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let val = 0;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);
  return String(100000 + (val % max));
}

async function sendOtpEmail(toEmail: string, otp: string, purpose: string) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY not set");

  const isCareer = purpose === "careers";
  const isReset = purpose === "password_reset";
  const subject = isReset
    ? "Your MakeMeClean password reset code"
    : isCareer
      ? "Your MakeMeClean application verification code"
      : "Verify your MakeMeClean account";

  const heading = isReset
    ? "Reset your password"
    : isCareer
      ? "Verify your email to continue your application"
      : "Confirm your email address";

  const intro = isReset
    ? "Enter this code on the password reset screen to choose a new password."
    : isCareer
      ? "Enter this code to verify your email and save your application progress."
      : "Enter this code on the verification screen to create your account.";

  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="background:#16a34a;padding:20px 28px">
            <span style="font-weight:900;font-size:20px;color:#fff;letter-spacing:-0.5px">MakeMeClean</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 12px">
            <h2 style="margin:0 0 10px;font-weight:800;font-size:20px;color:#111827">${heading}</h2>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b7280">${intro}</p>
            <div style="background:#f9fafb;border:2px dashed #d1fae5;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Your verification code</p>
              <span style="font-size:40px;font-weight:900;color:#16a34a;letter-spacing:8px;font-family:monospace">${otp}</span>
            </div>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              This code expires in <strong>15 minutes</strong>. If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #f3f4f6">
            <p style="margin:0;font-size:11px;color:#d1d5db">MakeMeClean · Wales, UK · no-reply@makemeclean.co.uk</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: "no-reply@makemeclean.co.uk", name: "MakeMeClean" },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo error (${res.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: "Server misconfiguration" }, req);

    const { email, purpose } = (await req.json()) as { email?: string; purpose?: string };
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
      return json(400, { ok: false, error: "Valid email required" }, req);
    }

    const validPurposes = ["registration", "careers", "password_reset"];
    const resolvedPurpose = validPurposes.includes(purpose ?? "") ? purpose! : "registration";

    const db = createClient(supabaseUrl, serviceKey);

    // Rate-limit: max 3 OTPs per email per purpose per 10 minutes
    // (Rows are soft-invalidated rather than deleted so the rate limit cannot be bypassed)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db
      .from("email_verifications")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .eq("purpose", resolvedPurpose)
      .gte("created_at", tenMinsAgo);

    if ((count ?? 0) >= 3) {
      return json(429, { ok: false, error: "Too many attempts. Please wait a few minutes." }, req);
    }

    // Also enforce IP-level rate limit if rate_limits RPC is available
    const clientIp = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    try {
      const { data: ipAllowed } = await db.rpc("check_rate_limit", {
        p_key: `send-otp:${clientIp}`,
        p_max_requests: 10,
        p_window_seconds: 600,
      });
      if (ipAllowed === false) {
        return json(429, { ok: false, error: "Too many requests from this network. Please wait a few minutes." }, req);
      }
    } catch {
      // Fallback if migration has not run yet
    }

    // For password_reset, check user existence in O(1) without leaking whether account exists
    if (resolvedPurpose === "password_reset") {
      const { data: userId, error: lookupErr } = await db.rpc("get_auth_user_id_by_email", {
        p_email: normalizedEmail,
      });
      if (lookupErr) {
        console.error("[send-otp] email lookup error:", lookupErr);
        return json(500, { ok: false, error: "Unable to process request" }, req);
      }
      if (!userId) {
        // Return generic 200 to prevent account enumeration
        return json(200, { ok: true }, req);
      }
    }

    const otp = generateOtp();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Soft-invalidate previous unverified OTPs (keep rows intact for rate limiting!)
    await db
      .from("email_verifications")
      .update({ invalidated_at: nowIso })
      .eq("email", normalizedEmail)
      .eq("purpose", resolvedPurpose)
      .is("verified_at", null)
      .is("invalidated_at", null);

    const { error: insertErr } = await db.from("email_verifications").insert({
      email: normalizedEmail,
      purpose: resolvedPurpose,
      otp,
      expires_at: expiresAt,
      attempts: 0,
    });
    if (insertErr) {
      console.error("[send-otp] insert error:", insertErr);
      return json(500, { ok: false, error: "Failed to generate verification code" }, req);
    }

    await sendOtpEmail(normalizedEmail, otp, resolvedPurpose);

    return json(200, { ok: true }, req);
  } catch (e) {
    console.error("send-otp error:", e);
    return json(500, { ok: false, error: "Failed to send verification code" }, req);
  }
});
