import { VercelRequest, VercelResponse, getServerSupabase, sendSuccess, sendError } from '../_lib/server.js';

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
      business_hours: '7 days a week, 8am–8pm',
      email_info: 'info@makemeclean.co.uk',
      email_recruitment: 'recruitment@makemeclean.co.uk',
      email_payment: 'payment@makemeclean.co.uk',
      email_payroll: 'payroll@makemeclean.co.uk',
      loyalty_enabled: 'false',
      booking_enabled: 'true',
      booking_disabled_message: 'We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly.',
    };

    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('settings').select('key, value');

    if (error) {
      return sendSuccess(res, settingsMap);
    }

    if (data) {
      for (const row of data) {
        settingsMap[row.key] = row.value;
      }
    }

    return sendSuccess(res, settingsMap);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch settings', 500);
  }
}

