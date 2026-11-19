// Edge Function: reset-password
// Resets a user's password ONLY after atomically verifying and consuming a single-use
// cryptographic resetToken issued by verify-otp for purpose='password_reset'.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json(500, { ok: false, error: "Server misconfiguration" }, req);
    }

    const { email, password, resetToken } = (await req.json()) as {
      email?: string;
      password?: string;
      resetToken?: string;
    };

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanToken = typeof resetToken === "string" ? resetToken.trim() : "";

    if (!normalizedEmail || !password || !cleanToken) {
      return json(400, { ok: false, error: "Email, password, and a valid verification token are required" }, req);
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return json(400, { ok: false, error: "Password must be at least 8 characters and include a letter and a number" }, req);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const nowIso = new Date().toISOString();

    // Atomically verify AND consume the single-use reset token before changing password
    const { data: consumed, error: tokenErr } = await adminClient
      .from("email_verifications")
      .update({ reset_token_used_at: nowIso })
      .eq("email", normalizedEmail)
      .eq("purpose", "password_reset")
      .eq("reset_token", cleanToken)
      .not("verified_at", "is", null)
      .is("reset_token_used_at", null)
      .gte("reset_token_expires_at", nowIso)
      .select("id")
      .maybeSingle();

    if (tokenErr || !consumed) {
      return json(403, { ok: false, error: "Invalid or expired reset session. Please verify a new code." }, req);
    }

    // O(1) user lookup via SECURITY DEFINER RPC
    const { data: authUserId, error: lookupErr } = await adminClient.rpc("get_auth_user_id_by_email", {
      p_email: normalizedEmail,
    });

    if (lookupErr || !authUserId) {
      return json(404, { ok: false, error: "Unable to locate account for password reset" }, req);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(String(authUserId), {
      password,
    });

    if (updateError) {
      console.error("[reset-password] Update error:", updateError);
      return json(500, { ok: false, error: "Failed to reset password" }, req);
    }

    return json(200, { ok: true }, req);
  } catch (err) {
    console.error("[reset-password]", err);
    return json(500, { ok: false, error: "Internal server error" }, req);
  }
});
