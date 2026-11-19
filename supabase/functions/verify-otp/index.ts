// Edge Function: verify-otp
// Verifies a submitted 6-digit OTP with brute-force lockout (max 5 attempts),
// constant-time comparison, and issues a single-use resetToken for password_reset.

import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;

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

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: "Server misconfiguration" }, req);

    const { email, otp, purpose } = (await req.json()) as {
      email?: string;
      otp?: string;
      purpose?: string;
    };

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanOtp = typeof otp === "string" ? otp.trim() : "";
    if (!normalizedEmail || !cleanOtp || !purpose) {
      return json(400, { ok: false, error: "email, otp and purpose are required" }, req);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();

    const { data, error } = await db
      .from("email_verifications")
      .select("id, otp, attempts, expires_at, verified_at, invalidated_at")
      .eq("email", normalizedEmail)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .is("invalidated_at", null)
      .gte("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return json(200, { ok: true, verified: false, reason: "expired_or_not_found" }, req);
    }

    const currentAttempts = Number(data.attempts || 0);
    if (currentAttempts >= MAX_ATTEMPTS) {
      await db
        .from("email_verifications")
        .update({ invalidated_at: now })
        .eq("id", data.id);
      return json(200, { ok: true, verified: false, reason: "too_many_attempts" }, req);
    }

    if (!constantTimeEquals(String(data.otp), cleanOtp)) {
      const nextAttempts = currentAttempts + 1;
      await db
        .from("email_verifications")
        .update({
          attempts: nextAttempts,
          ...(nextAttempts >= MAX_ATTEMPTS ? { invalidated_at: now } : {}),
        })
        .eq("id", data.id);
      return json(
        200,
        {
          ok: true,
          verified: false,
          reason: nextAttempts >= MAX_ATTEMPTS ? "too_many_attempts" : "wrong_code",
        },
        req,
      );
    }

    // Issue single-use cryptographic reset token for password_reset flow
    const resetToken = purpose === "password_reset" ? generateResetToken() : null;
    const resetTokenExpiresAt = resetToken
      ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
      : null;

    const { data: updated, error: updateErr } = await db
      .from("email_verifications")
      .update({
        verified_at: now,
        ...(resetToken
          ? { reset_token: resetToken, reset_token_expires_at: resetTokenExpiresAt }
          : {}),
      })
      .eq("id", data.id)
      .is("verified_at", null)
      .select("id")
      .maybeSingle();

    if (updateErr || !updated) {
      return json(200, { ok: true, verified: false, reason: "expired_or_not_found" }, req);
    }

    return json(
      200,
      {
        ok: true,
        verified: true,
        ...(resetToken ? { resetToken } : {}),
      },
      req,
    );
  } catch (e) {
    console.error("verify-otp error:", e);
    return json(500, { ok: false, error: "Verification failed" }, req);
  }
});
