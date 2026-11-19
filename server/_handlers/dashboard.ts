import {
  VercelRequest,
  VercelResponse,
  verifyAuth,
  sendSuccess,
  sendError,
  resolveServiceImageUrl,
  getUkNowParts,
} from '../_lib/server.js';
import { computeLoyaltyTier } from './loyalty.js';

function isPastDate(date: string) {
  const today = getUkNowParts().dateStr;
  return date < today;
}

function isActiveUpcoming(status: string, date: string) {
  return ['upcoming', 'pending', 'confirmed'].includes(status) && !isPastDate(date);
}

export async function handleDashboard(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user || !supabase) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  try {
    const [profileRes, bookingsRes, servicesRes, notifsRes, settingsRes, loyaltyRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase.from('services').select('*').eq('active', true).order('price', { ascending: true }),
      supabase.from('notifications').select('id, title, message, read, created_at').eq('user_id', user.id).eq('read', false),
      supabase.from('settings').select('value').eq('key', 'loyalty_enabled').maybeSingle(),
      supabase.from('loyalty_points').select('points').eq('user_id', user.id),
    ]);

    const loyaltyEnabled = settingsRes?.data?.value === 'true';

    const bookings = bookingsRes?.data || [];
    const counts = {
      total: bookings.length,
      upcoming: bookings.filter((b) => isActiveUpcoming(b.status, b.date)).length,
      in_progress: bookings.filter((b) => b.status === 'in_progress').length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    };

    const recentBookings = bookings.slice(0, 4).map((b) => ({
      id: b.id,
      service_type: b.service_type,
      service_name: b.service_name,
      date: b.date,
      time_slot: b.time_slot,
      price: Number(b.price),
      status: b.status,
      payment_status: b.payment_status,
      invoice_number: b.invoice_number,
      address: b.address,
      city: b.city,
      postcode: b.postcode,
      created_at: b.created_at,
    }));

    const services = (servicesRes.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      image_url: resolveServiceImageUrl(s.id, s.image_url),
    }));

    const profile = profileRes.data || {
      id: user.id,
      full_name: user.email?.split('@')[0] || 'Customer',
      phone: null,
      address: null,
      city: null,
      postcode: null,
      created_at: null,
    };

    const points = Math.max(
      0,
      (loyaltyRes.data || []).reduce((sum, row) => sum + Number(row.points || 0), 0)
    );
    const tierInfo = computeLoyaltyTier(points);

    return sendSuccess(res, {
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: user.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        postcode: profile.postcode,
        loyalty_points: points,
        created_at: profile.created_at,
      },
      counts,
      recent_bookings: recentBookings,
      services,
      loyalty: {
        enabled: loyaltyEnabled,
        points,
        tier: tierInfo.tier,
        discount_percent: tierInfo.discountPercent,
        next_tier_points: tierInfo.nextTierPoints,
      },
      loyalty_enabled: loyaltyEnabled,
      unread_notifications_count: notifsRes.data ? notifsRes.data.length : 0,
    });
  } catch (err: any) {
    console.error('[dashboard] error:', err);
    return sendError(res, 'Failed to fetch dashboard data', 500);
  }
}
