// Supabase Edge Function: hire-applicant
// Admin-only: creates or links Supabase Auth user via O(1) email lookup, upserts staff row,
// and emails a secure one-time password setup link (never emailing plaintext passwords).

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

function mustGetEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function randomInitialSecret(length = 24) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function sendWelcomeEmail(args: { toEmail: string; setupLink?: string; portalUrl: string }) {
  const apiKey = mustGetEnv("BREVO_API_KEY");
  const sender = { email: "recruitment@makemeclean.co.uk", name: "MakeMeClean Recruitment" };
  const isNew = Boolean(args.setupLink);

  const actionBlock = isNew
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#374151">
         Click the secure button below to set your staff portal password and activate your account:
       </p>
       <p style="margin:18px 0 0">
         <a href="${escapeHtml(args.setupLink!)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 20px;border-radius:12px">
           Set My Password &amp; Sign In
         </a>
       </p>
       <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#6b7280">
         For security, this one-time link expires shortly. If it expires, use "Forgot password" on ${escapeHtml(args.portalUrl)}/login.
       </p>`
    : `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#374151">
         You already have a MakeMeClean account. Sign in using your existing email and password to access your staff portal.
       </p>
       <p style="margin:18px 0 0">
         <a href="${escapeHtml(args.portalUrl)}/staff" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 20px;border-radius:12px">
           Open Staff Portal
         </a>
       </p>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
          <tr><td style="padding:22px 22px 16px;border-bottom:1px solid #eef2f7">
            <div style="font-weight:900;font-size:22px;color:#111827">MakeMeClean</div>
            <div style="font-weight:600;font-size:12px;color:#6b7280;margin-top:6px">Welcome to the team</div>
          </td></tr>
          <tr><td style="padding:18px 22px">
            <h2 style="margin:0 0 10px;font-weight:900;font-size:18px;color:#111827">Welcome onboard</h2>
            <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#374151">
              We're delighted to welcome you to MakeMeClean! Your staff profile is now active.
            </p>
            ${actionBlock}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, Accept: "application/json" },
    body: JSON.stringify({
      sender,
      to: [{ email: args.toEmail }],
      subject: "Welcome to the MakeMeClean team",
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
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? mustGetEnv("ANON_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json(401, { ok: false, error: "Unauthorized" }, req);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Forbidden" }, req);

    const { applicationId } = (await req.json()) as { applicationId?: string };
    if (!applicationId) return json(400, { ok: false, error: "Missing applicationId" }, req);

    const { data: app, error: appErr } = await adminClient
      .from("job_applications")
      .select("*")
      .eq("id", applicationId)
      .single();
    if (appErr || !app) return json(404, { ok: false, error: "Applicant not found" }, req);

    const cleanEmail = String(app.email).trim().toLowerCase();
    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://makemeclean.co.uk").replace(/\/$/, "");

    let authUserId: string | null = app.user_id || null;
    let setupLink: string | undefined;

    if (!authUserId) {
      // O(1) check if auth user already exists
      const { data: existingId } = await adminClient.rpc("get_auth_user_id_by_email", { p_email: cleanEmail });
      if (existingId) {
        authUserId = String(existingId);
      } else {
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: randomInitialSecret(),
          email_confirm: true,
          user_metadata: { must_change_password: true, staff_role: app.role ?? "Staff" },
        });
        if (createErr || !created?.user?.id) {
          return json(500, { ok: false, error: createErr?.message || "Failed to create user" }, req);
        }
        authUserId = created.user.id;

        // Generate a secure one-time password setup link instead of emailing plaintext passwords
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: cleanEmail,
          options: { redirectTo: `${siteUrl}/change-password` },
        });
        setupLink = linkData?.properties?.action_link;
      }
    }

    const staffRow = {
      user_id: authUserId,
      application_id: app.id,
      first_name: app.first_name,
      last_name: app.last_name,
      email: cleanEmail,
      phone: app.phone,
      city: app.city,
      postcode: app.postcode,
      role: app.role,
      active: true,
    };
    const { error: staffErr } = await adminClient.from("staff").upsert(staffRow, { onConflict: "email" });
    if (staffErr) return json(500, { ok: false, error: staffErr.message }, req);

    await adminClient.from("job_applications").update({ status: "hired" }).eq("id", app.id);

    try {
      await sendWelcomeEmail({ toEmail: cleanEmail, setupLink, portalUrl: siteUrl });
    } catch (emailErr) {
      console.error("[hire-applicant] welcome email failed:", emailErr);
    }

    return json(200, { ok: true }, req);
  } catch (e) {
    console.error("[hire-applicant]", e);
    return json(500, { ok: false, error: "Failed to hire applicant" }, req);
  }
});
