import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAdminSupabase,
  verifyAuth,
  sendJson,
  sendError,
  getEnv,
} from '../_lib/server.js';

function randomInitialSecret(length = 24) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(crypto.randomInt(0, alphabet.length));
  }
  return out;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendStaffInviteEmail(args: {
  toEmail: string;
  firstName: string;
  setupLink?: string;
  siteUrl: string;
}): Promise<boolean> {
  const brevoKey = getEnv('BREVO_API_KEY');
  if (!brevoKey) return false;

  const isNew = Boolean(args.setupLink);
  const actionBlock = isNew
    ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#374151">
         Click the secure button below to set your staff portal password and activate your account:
       </p>
       <p style="margin:18px 0 0">
         <a href="${escapeHtml(args.setupLink!)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 20px;border-radius:12px">
           Set My Password &amp; Sign In
         </a>
       </p>
       <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#6b7280">
         This secure one-time link expires shortly. If it expires, use "Forgot password" at ${escapeHtml(args.siteUrl)}/login.
       </p>`
    : `<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#374151">
         Your staff portal access is active. Sign in with your existing MakeMeClean account to view your shifts:
       </p>
       <p style="margin:18px 0 0">
         <a href="${escapeHtml(args.siteUrl)}/staff" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 20px;border-radius:12px">
           Open Staff Portal
         </a>
       </p>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
          <tr><td style="padding:22px;border-bottom:1px solid #eef2f7">
            <div style="font-weight:900;font-size:22px;color:#111827">MakeMe<span style="color:#16a34a">Clean</span></div>
            <div style="font-weight:600;font-size:12px;color:#6b7280;margin-top:4px">Staff Portal Invitation</div>
          </td></tr>
          <tr><td style="padding:22px">
            <h2 style="margin:0 0 8px;font-weight:900;font-size:18px;color:#111827">Welcome, ${escapeHtml(args.firstName)}</h2>
            ${actionBlock}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'staffing@makemeclean.co.uk', name: 'MakeMeClean Staffing' },
        to: [{ email: args.toEmail }],
        subject: 'Your MakeMeClean Staff Portal Access',
        htmlContent: html,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch (err) {
    console.error('[staff POST] Brevo invite error:', err);
    return false;
  }
}

export async function handleStaff(
  req: VercelRequest,
  res: VercelResponse,
  subPath = ''
) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST' && method !== 'DELETE') {
    return sendError(res, 'Method not allowed', 405);
  }

  // 1. Verify caller is an authenticated admin
  const { user, error: authErr } = await verifyAuth(req);
  if (authErr || !user) {
    return sendError(res, authErr || 'Unauthorized', 401);
  }

  const supabase = getAdminSupabase();
  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    return sendError(res, 'Forbidden: Admin access required', 403);
  }

  // ─── DELETE /api/staff/:id (Offboard staff & revoke auth access) ───────────
  if (method === 'DELETE') {
    const staffId = subPath.split('/').filter(Boolean)[0] || String(req.query?.id || '').trim();
    if (!staffId) {
      return sendError(res, 'Staff ID is required', 400);
    }

    const { data: staffRow, error: fetchErr } = await supabase
      .from('staff')
      .select('id, user_id, email')
      .eq('id', staffId)
      .maybeSingle();

    if (fetchErr || !staffRow) {
      return sendError(res, 'Staff member not found', 404);
    }

    // Prevent an admin from accidentally banning themselves if linked
    if (staffRow.user_id && staffRow.user_id === user.id) {
      return sendError(res, 'Cannot remove your own admin user account via staff offboarding.', 400);
    }

    const { error: deleteErr } = await supabase
      .from('staff')
      .delete()
      .eq('id', staffId);

    if (deleteErr) {
      return sendError(res, `Failed to delete staff record: ${deleteErr.message}`, 500);
    }

    // Revoke Supabase Auth access immediately so terminated staff cannot log in
    let authRevoked = false;
    if (staffRow.user_id) {
      const { data: isAlsoAdmin } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', staffRow.user_id)
        .maybeSingle();

      if (!isAlsoAdmin) {
        const { error: banErr } = await supabase.auth.admin.updateUserById(staffRow.user_id, {
          ban_duration: '876000h', // ~100 years
        });
        if (!banErr) {
          authRevoked = true;
        } else {
          console.error('[staff DELETE] failed to ban auth user:', banErr);
        }
      }
    }

    return sendJson(res, 200, {
      ok: true,
      success: true,
      authRevoked,
      message: authRevoked
        ? 'Staff member removed and portal login access revoked.'
        : 'Staff member removed.',
    });
  }

  // ─── POST /api/staff (Create staff member & optional auth login) ───────────
  const body = req.body || {};
  const {
    first_name,
    last_name,
    email,
    phone,
    city,
    postcode,
    role = 'Cleaner',
    active = true,
    create_login = true,
  } = body;

  const cleanFirstName = String(first_name || '').trim();
  const cleanLastName = String(last_name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanCity = city ? String(city).trim() : null;
  const cleanPostcode = postcode ? String(postcode).trim() : null;
  const cleanRole = String(role || 'Cleaner').trim();

  if (!cleanFirstName || !cleanLastName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    return sendError(res, 'First name, last name, and a valid email are required', 400);
  }

  // Check if staff email already exists
  const { data: existingStaff } = await supabase
    .from('staff')
    .select('id, email')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingStaff) {
    return sendError(res, `A staff member with email "${cleanEmail}" already exists`, 409);
  }

  let authUserId: string | null = null;
  let setupLink: string | undefined;
  let isNewAccount = false;
  const siteUrl = getEnv('SITE_URL', 'https://makemeclean.co.uk').replace(/\/$/, '');

  // 3. Create or link auth user if requested (never returning plaintext passwords)
  if (create_login) {
    const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: randomInitialSecret(),
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        staff_role: cleanRole,
        full_name: `${cleanFirstName} ${cleanLastName}`,
      },
    });

    if (createErr) {
      const alreadyRegistered =
        createErr.message?.toLowerCase().includes('already registered') ||
        createErr.message?.toLowerCase().includes('already exists') ||
        (createErr as any).status === 422;

      if (!alreadyRegistered) {
        return sendError(res, `Failed to create staff account: ${createErr.message}`, 500);
      }

      // O(1) indexed lookup via SECURITY DEFINER RPC (instead of paginated listUsers)
      const { data: existingUserId } = await supabase.rpc('get_auth_user_id_by_email', {
        p_email: cleanEmail,
      });
      if (existingUserId) {
        authUserId = String(existingUserId);
        // Unban in case the staff member is being rehired
        await supabase.auth.admin.updateUserById(authUserId, { ban_duration: 'none' }).catch(() => {});
      }
    } else if (createdUser?.user?.id) {
      authUserId = createdUser.user.id;
      isNewAccount = true;
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: { redirectTo: `${siteUrl}/change-password` },
      });
      setupLink = linkData?.properties?.action_link;
    }
  }

  // 4. Insert into staff table
  const { data: newStaff, error: insertErr } = await supabase
    .from('staff')
    .insert({
      first_name: cleanFirstName,
      last_name: cleanLastName,
      email: cleanEmail,
      phone: cleanPhone,
      city: cleanCity,
      postcode: cleanPostcode,
      role: cleanRole,
      active: Boolean(active),
      user_id: authUserId,
    })
    .select()
    .single();

  if (insertErr) {
    return sendError(res, `Failed to save staff record: ${insertErr.message}`, 500);
  }

  let inviteSent = false;
  if (create_login && authUserId) {
    inviteSent = await sendStaffInviteEmail({
      toEmail: cleanEmail,
      firstName: cleanFirstName,
      setupLink: isNewAccount ? setupLink : undefined,
      siteUrl,
    });
  }

  return sendJson(res, 201, {
    ok: true,
    success: true,
    staff: newStaff,
    loginCreated: Boolean(create_login && authUserId),
    inviteSent,
    // Only expose one-time setup link to the admin UI if email delivery was unavailable
    setupLink: isNewAccount && !inviteSent ? setupLink : undefined,
    message: inviteSent
      ? `Staff member created and password setup invitation emailed to ${cleanEmail}.`
      : isNewAccount && setupLink
        ? 'Staff member created. Email service unavailable — share the secure one-time setup link below.'
        : 'Staff member created successfully.',
  });
}

