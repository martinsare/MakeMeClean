-- ══════════════════════════════════════════════════════════════════════════════
-- MakeMeClean — Cancellation Policy & Minimum Booking Lead Time Settings
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Seed new settings defaults (safe if already present)
INSERT INTO public.settings (key, value) VALUES
  ('min_booking_lead_hours', '5'),
  ('cancellation_late_hours', '3'),
  ('cancellation_late_refund_percent', '75')
ON CONFLICT (key) DO NOTHING;

-- 2. Update settings_public_read RLS policy to allow reading these configuration keys
DROP POLICY IF EXISTS "settings_public_read" ON public.settings;
CREATE POLICY "settings_public_read"
  ON public.settings FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR key IN (
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
      'email_staffing',
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
      'max_bookings_per_slot',
      'min_booking_lead_hours',
      'cancellation_late_hours',
      'cancellation_late_refund_percent'
    )
  );
