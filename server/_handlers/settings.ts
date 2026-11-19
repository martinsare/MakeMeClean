import { VercelRequest, VercelResponse, getServerSupabase, sendSuccess, sendError } from '../_lib/server.js';

const PUBLIC_SETTING_KEYS = new Set([
  'discount_weekly',
  'discount_fortnightly',
  'discount_biweekly',
  'discount_monthly',
  'business_phone',
  'contact_email',
  'business_hours',
  'email_info',
  'email_recruitment',
  'email_payment',
  'email_payroll',
  'loyalty_enabled',
  'booking_enabled',
  'booking_disabled_message',
  'booking_availability_schedule',
  'booking_extras',
  'room_calc_base_hours',
  'room_calc_bed_hours',
  'room_calc_bath_hours',
  'room_calc_living_hours',
  'vat_registered',
  'vat_number',
  'company_legal_name',
  'company_reg_number',
  'company_registered_address',
  'social_facebook',
  'social_instagram',
  'social_twitter',
  'social_linkedin',
]);

export async function handleSettings(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const settingsMap: Record<string, string> = {
      discount_weekly: '15',
      discount_fortnightly: '10',
      discount_monthly: '5',
      business_phone: '+44 7362 068202',
      contact_email: 'contact@makemeclean.co.uk',
      business_hours: '24/7',
      email_info: 'info@makemeclean.co.uk',
      email_recruitment: 'recruitment@makemeclean.co.uk',
      email_payment: 'payment@makemeclean.co.uk',
      email_payroll: 'payroll@makemeclean.co.uk',
      loyalty_enabled: 'false',
      booking_enabled: 'true',
      booking_disabled_message: 'We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly.',
      vat_registered: 'false',
      vat_number: '',
      company_legal_name: 'MakeMeClean Ltd',
      company_reg_number: '',
      company_registered_address: 'Wales, United Kingdom',
    };

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', Array.from(PUBLIC_SETTING_KEYS));

    if (error) {
      return sendSuccess(res, settingsMap);
    }

    if (data) {
      for (const row of data) {
        if (PUBLIC_SETTING_KEYS.has(row.key)) {
          settingsMap[row.key] = row.value;
        }
      }
    }

    return sendSuccess(res, settingsMap);
  } catch (err: any) {
    console.error('[settings] error:', err);
    return sendError(res, 'Failed to fetch settings', 500);
  }
}

