import {
  VercelRequest,
  VercelResponse,
  getServerSupabase,
  getAdminSupabase,
  sendSuccess,
  sendError,
  resolveServiceImageUrl,
  START_HOURS,
  MIN_DURATION_HOURS,
  MAX_DURATION_HOURS,
  DURATION_STEP_HOURS,
  parseWeeklyAvailability,
} from '../_lib/server.js';

export async function handleBookingOptions(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const supabase = getServerSupabase();

    const [servicesRes, settingsRes, citiesRes] = await Promise.all([
      supabase.from('services').select('*').eq('active', true).order('price', { ascending: true }),
      supabase.from('settings').select('key, value'),
      supabase.from('service_cities').select('name').eq('is_active', true).order('name', { ascending: true }),
    ]);

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

    const discounts: Record<string, number> = {
      none: 0,
      weekly: 15,
      fortnightly: 10,
      monthly: 5,
    };

    let schedule = parseWeeklyAvailability(null);
    if (settingsRes.data) {
      for (const row of settingsRes.data) {
        if (row.key === 'discount_weekly') discounts.weekly = Number(row.value) || 15;
        if (row.key === 'discount_fortnightly') discounts.fortnightly = Number(row.value) || 10;
        if (row.key === 'discount_monthly') discounts.monthly = Number(row.value) || 5;
        if (row.key === 'booking_availability_schedule') schedule = parseWeeklyAvailability(row.value);
      }
    }

    const defaultCities = [
      'Cardiff', 'Swansea', 'Newport', 'Barry', 'Bridgend',
      'Penarth', 'Caerphilly', 'Pontypridd', 'Cwmbran',
      'Llanelli', 'Neath', 'Port Talbot', 'Merthyr Tydfil',
    ];
    const cities = citiesRes.data && citiesRes.data.length > 0
      ? citiesRes.data.map((c) => c.name)
      : defaultCities;

    const slotCounts: Record<string, number> = {};
    const dateParam = typeof req.query?.date === 'string' ? req.query.date.trim() : '';
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const admin = getAdminSupabase();
      const { data: bData } = await admin
        .from('bookings')
        .select('time_slot')
        .eq('date', dateParam)
        .neq('status', 'cancelled');
      if (bData) {
        for (const row of bData) {
          const start = (row.time_slot || '').slice(0, 5);
          if (start) {
            slotCounts[start] = (slotCounts[start] || 0) + 1;
          }
        }
      }
    }

    return sendSuccess(res, {
      services,
      cities,
      discounts,
      schedule,
      startHours: START_HOURS,
      minDurationHours: MIN_DURATION_HOURS,
      maxDurationHours: MAX_DURATION_HOURS,
      durationStepHours: DURATION_STEP_HOURS,
      slotCounts,
    });
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch booking options', 500);
  }
}

