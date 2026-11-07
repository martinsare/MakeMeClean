-- ══════════════════════════════════════════════════════════════
-- Migration: Add booking availability pause/resume toggle settings
-- ══════════════════════════════════════════════════════════════

-- Seed booking_enabled and booking_disabled_message if not exists
INSERT INTO public.settings (key, value)
VALUES 
  ('booking_enabled', 'true'),
  ('booking_disabled_message', 'We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly.')
ON CONFLICT (key) DO NOTHING;

