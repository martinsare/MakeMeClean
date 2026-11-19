-- ══════════════════════════════════════════════════════════════════════════════
-- MakeMeClean — Production Hardening, Security, Scale & Schema Consolidation
-- Safe to re-run (idempotent). Apply via `supabase db push` or SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SCHEMA CONSOLIDATION (Ensure all columns/tables referenced by app exist)
-- ─────────────────────────────────────────────────────────────────────────────

-- Services metadata columns
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category   TEXT DEFAULT 'domestic',
  ADD COLUMN IF NOT EXISTS badge      TEXT,
  ADD COLUMN IF NOT EXISTS tagline    TEXT,
  ADD COLUMN IF NOT EXISTS icon       TEXT DEFAULT '🧹',
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Profiles Stripe & Loyalty columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_points           INT NOT NULL DEFAULT 0;

-- Bookings extended property, access & recurring columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS bedrooms          INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms         INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS living_rooms      INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extras            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS property_type     TEXT DEFAULT 'House / Flat',
  ADD COLUMN IF NOT EXISTS duration_hours    NUMERIC(5,2) DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS access_method     TEXT DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS supplies_option   TEXT DEFAULT 'cleaner',
  ADD COLUMN IF NOT EXISTS parking_option    TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS has_pets          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_freq    TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurring_plan_id UUID REFERENCES public.recurring_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_sent     BOOLEAN NOT NULL DEFAULT false;

-- Recurring plans extended columns
ALTER TABLE public.recurring_plans
  ADD COLUMN IF NOT EXISTS bedrooms                 INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms                INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS living_rooms             INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extras                   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS property_type            TEXT DEFAULT 'House / Flat',
  ADD COLUMN IF NOT EXISTS access_method            TEXT DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS supplies_option          TEXT DEFAULT 'cleaner',
  ADD COLUMN IF NOT EXISTS parking_option           TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS has_pets                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS next_booking_date        DATE,
  ADD COLUMN IF NOT EXISTS last_booked_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_booking_id          UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failure_count            INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_reason      TEXT;

-- Email verifications hardening columns (brute-force protection + reset tokens)
ALTER TABLE public.email_verifications
  ADD COLUMN IF NOT EXISTS attempts                INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalidated_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reset_token             TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reset_token_used_at     TIMESTAMPTZ;

-- Booking photos type column
ALTER TABLE public.booking_photos
  ADD COLUMN IF NOT EXISTS photo_type TEXT DEFAULT 'after';

-- Service cities table
CREATE TABLE IF NOT EXISTS public.service_cities (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  region          TEXT DEFAULT 'South Wales',
  postcode_prefix TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- In-app customer notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift applications table (staff open shifts marketplace)
CREATE TABLE IF NOT EXISTS public.shift_applications (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id      TEXT NOT NULL,
  booking_id    UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  cleaner_id    UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  cleaner_notes TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, cleaner_id)
);

-- Stripe webhook event idempotency table
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Server-side rate limiting table (used by service_role only)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key           TEXT PRIMARY KEY,
  count         INT NOT NULL DEFAULT 1,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Collision-free invoice sequence
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 100001;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTIONS (SECURITY DEFINER — O(1) lookups & atomic helpers)
-- ─────────────────────────────────────────────────────────────────────────────

-- O(1) auth user lookup by email (replaces O(N) listUsers() loops)
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;

-- Atomic invoice number generator
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  seq_val := nextval('public.invoice_number_seq');
  RETURN 'INV-' || to_char(NOW() AT TIME ZONE 'Europe/London', 'YYYYMMDD') || '-' || seq_val::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- Atomic server-side rate limiter (fixed window)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_requests INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_now   TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now THEN v_now
      ELSE public.rate_limits.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO service_role;

-- GDPR-compliant anonymous newsletter unsubscribe RPC
CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.newsletter_subscriptions
  SET unsubscribed_at = NOW()
  WHERE lower(email) = lower(trim(p_email))
    AND unsubscribed_at IS NULL;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_newsletter(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(TEXT) TO anon, authenticated, service_role;

-- Safe redacted open shifts marketplace RPC (active staff only — never leaks street addresses or lockbox codes)
CREATE OR REPLACE FUNCTION public.get_open_marketplace_shifts()
RETURNS TABLE (
  id UUID,
  service_name TEXT,
  city TEXT,
  outward_postcode TEXT,
  date DATE,
  time_slot TEXT,
  duration_hours NUMERIC,
  hourly_rate NUMERIC,
  bedrooms INT,
  bathrooms INT,
  living_rooms INT,
  property_type TEXT,
  extras JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hourly_rate NUMERIC := 12.71;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.active = true
  ) AND NOT public.is_admin(auth.uid()) THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(ps.hourly_rate, 0), 12.71)
  INTO v_hourly_rate
  FROM public.payroll_settings ps
  WHERE ps.id = 1
  LIMIT 1;

  RETURN QUERY
  SELECT
    b.id,
    b.service_name,
    b.city,
    split_part(trim(coalesce(b.postcode, '')), ' ', 1) AS outward_postcode,
    b.date,
    b.time_slot,
    b.duration_hours,
    v_hourly_rate AS hourly_rate,
    b.bedrooms,
    b.bathrooms,
    b.living_rooms,
    b.property_type,
    b.extras
  FROM public.bookings b
  WHERE b.status = 'upcoming'
    AND b.payment_status = 'paid'
    AND b.date >= (NOW() AT TIME ZONE 'Europe/London')::date
    AND NOT EXISTS (
      SELECT 1 FROM public.booking_assignments ba
      WHERE ba.booking_id = b.id
    )
  ORDER BY b.date ASC, b.time_slot ASC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.get_open_marketplace_shifts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_marketplace_shifts() TO authenticated, service_role;

-- Public reviews + aggregate stats RPC (joins service_name & city safely without exposing customer PII)
CREATE OR REPLACE FUNCTION public.get_public_reviews(p_limit INT DEFAULT 8)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_avg   NUMERIC;
  v_items JSONB;
  v_cap   INT := GREATEST(1, LEAST(COALESCE(p_limit, 8), 50));
BEGIN
  SELECT COUNT(*)::INT, ROUND(AVG(overall_rating)::NUMERIC, 1)
  INTO v_total, v_avg
  FROM public.reviews;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      r.overall_rating,
      r.comments,
      r.created_at,
      COALESCE(b.service_name, 'Domestic Clean') AS service_name,
      COALESCE(b.city, 'Wales') AS city
    FROM public.reviews r
    LEFT JOIN public.bookings b ON b.id = r.booking_id
    WHERE r.comments IS NOT NULL AND length(trim(r.comments)) > 0
    ORDER BY r.created_at DESC
    LIMIT v_cap
  ) t;

  RETURN jsonb_build_object(
    'total_count', COALESCE(v_total, 0),
    'avg_rating', COALESCE(v_avg, 0),
    'reviews', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_reviews(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(INT) TO anon, authenticated, service_role;

-- Prevent non-admin users from modifying protected profile columns directly
CREATE OR REPLACE FUNCTION public.guard_profile_protected_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.loyalty_points := OLD.loyalty_points;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_payment_method_id := OLD.stripe_payment_method_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_protected_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_protected_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_protected_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HARDENED ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.service_cities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits        ENABLE ROW LEVEL SECURITY;

-- Profiles: REMOVE cross-user PII exposure! Only self or admin can read.
DROP POLICY IF EXISTS "Profiles readable by all authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"           ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));

-- Bookings: REMOVE direct client INSERT/UPDATE (prevents self-marking paid or price=0.01!).
-- Customers create/cancel bookings through validated /api/bookings server endpoints.
DROP POLICY IF EXISTS "Users can create own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;

-- Reschedule requests: Customers can SELECT own only (mutations via /api/bookings/:id/reschedule)
DROP POLICY IF EXISTS "reschedule_own"        ON public.reschedule_requests;
DROP POLICY IF EXISTS "reschedule_own_select" ON public.reschedule_requests;
CREATE POLICY "reschedule_own_select"
  ON public.reschedule_requests FOR SELECT USING (user_id = auth.uid());

-- Recurring plans: Customers can SELECT own only (mutations via /api/plans/:id)
DROP POLICY IF EXISTS "recurring_own"        ON public.recurring_plans;
DROP POLICY IF EXISTS "recurring_own_select" ON public.recurring_plans;
CREATE POLICY "recurring_own_select"
  ON public.recurring_plans FOR SELECT USING (user_id = auth.uid());

-- Refund requests: Customers can only insert pending user-sourced requests (never self-approved)
DROP POLICY IF EXISTS "refund_requests_user_create" ON public.refund_requests;
CREATE POLICY "refund_requests_user_create"
  ON public.refund_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND source = 'user'
    AND stripe_refund_id IS NULL
    AND processed_at IS NULL
  );

-- Settings: Allowlist public keys only! Internal keys remain admin/service-role only.
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
      'social_twitter'
    )
  );

-- Service cities
DROP POLICY IF EXISTS "service_cities_public_read" ON public.service_cities;
DROP POLICY IF EXISTS "service_cities_admin_all"   ON public.service_cities;
CREATE POLICY "service_cities_public_read"
  ON public.service_cities FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));
CREATE POLICY "service_cities_admin_all"
  ON public.service_cities FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Notifications
DROP POLICY IF EXISTS "notifications_own_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_all"  ON public.notifications;
CREATE POLICY "notifications_own_select"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_own_update"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_admin_all"
  ON public.notifications FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Shift applications (staff can manage own applications, admins manage all)
DROP POLICY IF EXISTS "shift_apps_staff_own"  ON public.shift_applications;
DROP POLICY IF EXISTS "shift_apps_admin_all"  ON public.shift_applications;
CREATE POLICY "shift_apps_staff_own"
  ON public.shift_applications FOR ALL
  USING (
    cleaner_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid() AND active = true)
  )
  WITH CHECK (
    cleaner_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid() AND active = true)
    AND status = 'pending'
  );
CREATE POLICY "shift_apps_admin_all"
  ON public.shift_applications FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Public reviews readability (for Homepage ratings without leaking customer PII)
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
CREATE POLICY "Public can view reviews"
  ON public.reviews FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STORAGE BUCKETS — MAKE SENSITIVE BUCKETS PRIVATE (Passports, DBS, Homes)
-- ─────────────────────────────────────────────────────────────────────────────

-- Set applications & booking-photos buckets to PRIVATE
UPDATE storage.buckets SET public = false WHERE id IN ('applications', 'booking-photos');

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-photos', 'booking-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Applications bucket policies (owner-scoped upload/read, admin full read)
DROP POLICY IF EXISTS "Anyone can upload applications"    ON storage.objects;
DROP POLICY IF EXISTS "Public read applications"          ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload own applications" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin read applications"   ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete applications" ON storage.objects;

CREATE POLICY "Auth users upload own applications"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'applications'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owner or admin read applications"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'applications'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "Owner or admin delete applications"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'applications'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Booking photos bucket policies (private: owner + admin only via signed URLs)
DROP POLICY IF EXISTS "Public read booking photos"           ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload own booking photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin read booking photos"   ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete booking photos" ON storage.objects;

CREATE POLICY "Auth users upload own booking photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'booking-photos'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'bookings'
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id::text = (storage.foldername(name))[2]
            AND b.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Owner or admin read booking photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'booking-photos'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'bookings'
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id::text = (storage.foldername(name))[2]
            AND b.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Owner or admin delete booking photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'booking-photos'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'bookings'
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id::text = (storage.foldername(name))[2]
            AND b.user_id = auth.uid()
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SCALABILITY INDEXES & INTEGRITY CONSTRAINTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS bookings_user_date_idx
  ON public.bookings (user_id, date DESC);

CREATE INDEX IF NOT EXISTS bookings_date_status_idx
  ON public.bookings (date, status);

CREATE INDEX IF NOT EXISTS bookings_payment_status_idx
  ON public.bookings (payment_status);

CREATE INDEX IF NOT EXISTS bookings_created_at_idx
  ON public.bookings (created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_reminder_due_idx
  ON public.bookings (date, status, payment_status)
  WHERE reminder_sent = false;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_recurring_plan_date_uidx
  ON public.bookings (recurring_plan_id, date)
  WHERE recurring_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS booking_assignments_staff_idx
  ON public.booking_assignments (staff_id);

CREATE INDEX IF NOT EXISTS booking_assignments_booking_idx
  ON public.booking_assignments (booking_id);

CREATE INDEX IF NOT EXISTS job_applications_user_idx
  ON public.job_applications (user_id);

CREATE INDEX IF NOT EXISTS job_applications_recruitment_status_idx
  ON public.job_applications (recruitment_id, status);

CREATE INDEX IF NOT EXISTS payslips_staff_period_idx
  ON public.payslips (staff_id, period_start DESC);

-- Prevent duplicate payslips for the same staff + pay period
CREATE UNIQUE INDEX IF NOT EXISTS payslips_staff_period_uidx
  ON public.payslips (staff_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS recurring_plans_due_idx
  ON public.recurring_plans (status, next_booking_date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS reschedule_requests_booking_status_idx
  ON public.reschedule_requests (booking_id, status);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verifications_reset_token_idx
  ON public.email_verifications (reset_token)
  WHERE reset_token IS NOT NULL;

-- Seed new compliance/capacity settings defaults (non-destructive)
INSERT INTO public.settings (key, value) VALUES
  ('vat_registered', 'false'),
  ('vat_number', ''),
  ('company_legal_name', 'MakeMeClean Ltd'),
  ('company_reg_number', ''),
  ('company_registered_address', 'Wales, United Kingdom'),
  ('max_bookings_per_slot', '10')
ON CONFLICT (key) DO NOTHING;
