import {
  VercelRequest,
  VercelResponse,
  verifyAuth,
  getAdminSupabase,
  sendSuccess,
  sendError,
} from '../_lib/server.js';

export function computeLoyaltyTier(points: number) {
  if (points >= 2500) {
    return {
      tier: 'Platinum',
      discountPercent: 15,
      nextTierName: 'Max Tier',
      nextTierPoints: 2500,
      progressPercent: 100,
    };
  }
  if (points >= 1000) {
    return {
      tier: 'Gold',
      discountPercent: 10,
      nextTierName: 'Platinum',
      nextTierPoints: 2500,
      progressPercent: Math.min(100, Math.round(((points - 1000) / 1500) * 100)),
    };
  }
  if (points >= 500) {
    return {
      tier: 'Silver',
      discountPercent: 5,
      nextTierName: 'Gold',
      nextTierPoints: 1000,
      progressPercent: Math.min(100, Math.round(((points - 500) / 500) * 100)),
    };
  }
  return {
    tier: 'Bronze',
    discountPercent: 0,
    nextTierName: 'Silver',
    nextTierPoints: 500,
    progressPercent: Math.min(100, Math.round((points / 500) * 100)),
  };
}

export async function handleLoyalty(req: VercelRequest, res: VercelResponse) {
  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user || !supabase) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  // ─── POST /api/loyalty (Admin manual point award by email or userId) ───────
  if (req.method === 'POST') {
    try {
      const admin = getAdminSupabase();
      const { data: adminRow } = await admin
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!adminRow) {
        return sendError(res, 'Forbidden: Admin access required', 403);
      }

      const body = req.body || {};
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const explicitUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
      const points = Number(body.points);
      const reason = typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 200)
        : 'Admin bonus';

      if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 100000) {
        return sendError(res, 'Points must be a non-zero integer within valid limits.', 400);
      }

      let targetUserId = explicitUserId;
      if (!targetUserId && email) {
        const { data: resolvedId, error: rpcErr } = await admin.rpc('get_auth_user_id_by_email', {
          p_email: email,
        });
        if (rpcErr || !resolvedId) {
          return sendError(res, `No user found with email "${email}".`, 404);
        }
        targetUserId = String(resolvedId);
      }

      if (!targetUserId) {
        return sendError(res, 'Either email or userId is required.', 400);
      }

      const { data: inserted, error: insertErr } = await admin
        .from('loyalty_points')
        .insert({
          user_id: targetUserId,
          points,
          reason,
        })
        .select()
        .single();

      if (insertErr) {
        return sendError(res, insertErr.message, 500);
      }

      return sendSuccess(res, inserted, 201);
    } catch (err: any) {
      console.error('[loyalty POST] error:', err);
      return sendError(res, 'Failed to award loyalty points', 500);
    }
  }

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const [{ data: ledgerRows, error }, { data: settingRow }] = await Promise.all([
      supabase
        .from('loyalty_points')
        .select('points')
        .eq('user_id', user.id),
      supabase
        .from('settings')
        .select('value')
        .eq('key', 'loyalty_enabled')
        .maybeSingle(),
    ]);

    const isEnabled = settingRow?.value === 'true';

    if (error && error.code !== 'PGRST116') {
      return sendError(res, error.message, 500);
    }

    const points = Math.max(
      0,
      (ledgerRows || []).reduce((sum, r) => sum + Number(r.points || 0), 0)
    );
    const tierInfo = computeLoyaltyTier(points);

    return sendSuccess(res, {
      enabled: isEnabled,
      points,
      tier: tierInfo.tier,
      discount_percent: tierInfo.discountPercent,
      next_tier_name: tierInfo.nextTierName,
      next_tier_points: tierInfo.nextTierPoints,
      progress_percent: tierInfo.progressPercent,
      tiers: [
        { name: 'Bronze', min_points: 0, discount_percent: 0, perks: 'Earn 10 points per £1 spent' },
        { name: 'Silver', min_points: 500, discount_percent: 5, perks: '5% loyalty rewards & priority support' },
        { name: 'Gold', min_points: 1000, discount_percent: 10, perks: '10% loyalty rewards + priority slot allocation' },
        { name: 'Platinum', min_points: 2500, discount_percent: 15, perks: '15% VIP rewards + dedicated cleaner matching' },
      ],
    });
  } catch (err: any) {
    console.error('[loyalty GET] error:', err);
    return sendError(res, 'Failed to fetch loyalty status', 500);
  }
}

