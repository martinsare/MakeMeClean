import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getServerSupabase,
  verifyAuth,
  sendJson,
  sendError,
} from '../_lib/server.js';

function randomPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

export async function handleStaff(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  // 1. Verify caller is an authenticated admin
  const { user, error: authErr } = await verifyAuth(req);
  if (authErr || !user) {
    return sendError(res, authErr || 'Unauthorized', 401);
  }

  const supabase = getServerSupabase();
  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    return sendError(res, 'Forbidden: Admin access required', 403);
  }

  // 2. Parse payload
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

  if (!cleanFirstName || !cleanLastName || !cleanEmail) {
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
  let tempPassword = '';

  // 3. Create or link auth user if requested
  if (create_login) {
    tempPassword = randomPassword();
    const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
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

      // If user already exists in auth, look them up
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = (listData?.users || []).find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );
      if (existingUser) {
        authUserId = existingUser.id;
        tempPassword = ''; // Won't show temp password if account already exists
      }
    } else if (createdUser?.user?.id) {
      authUserId = createdUser.user.id;
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

  return sendJson(res, {
    success: true,
    staff: newStaff,
    tempPassword: tempPassword || undefined,
    message: tempPassword
      ? `Staff member created with temporary login password: ${tempPassword}`
      : 'Staff member created successfully.',
  });
}

