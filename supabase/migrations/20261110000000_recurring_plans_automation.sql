-- ══════════════════════════════════════════════════════════════
-- MakeMeClean — Recurring Plans Automated Billing & Schedule
-- ══════════════════════════════════════════════════════════════

-- Add Stripe customer & payment method storage to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- Add recurring scheduling & off-session payment tracking to recurring_plans
ALTER TABLE public.recurring_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS next_booking_date DATE,
  ADD COLUMN IF NOT EXISTS last_booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;

-- Index to quickly look up due recurring plans for automated execution
CREATE INDEX IF NOT EXISTS recurring_plans_active_due_idx
  ON public.recurring_plans (status, next_booking_date)
  WHERE status = 'active';

-- Ensure bookings has recurring_plan_id reference if not already present
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_plan_id UUID REFERENCES public.recurring_plans(id) ON DELETE SET NULL;
