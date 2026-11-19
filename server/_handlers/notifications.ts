import { VercelRequest, VercelResponse, verifyAuth, sendSuccess, sendError } from '../_lib/server.js';

export async function handleNotifications(req: VercelRequest, res: VercelResponse) {
  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user || !supabase) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  // ─── GET /api/notifications ───────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        return sendError(res, error.message, 500);
      }

      return sendSuccess(res, data || []);
    } catch (err: any) {
      console.error('[notifications GET] error:', err);
      return sendError(res, 'Failed to fetch notifications', 500);
    }
  }

  // ─── PATCH /api/notifications ─────────────────────────────────────────────
  if (req.method === 'PATCH' || req.method === 'POST') {
    try {
      const body = req.body || {};
      const notifId = body.notificationId || body.id;

      if (notifId) {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notifId)
          .eq('user_id', user.id);
        if (error) return sendError(res, error.message, 500);
      } else {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);
        if (error) return sendError(res, error.message, 500);
      }

      return sendSuccess(res, { success: true });
    } catch (err: any) {
      console.error('[notifications PATCH] error:', err);
      return sendError(res, 'Failed to update notifications', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}

