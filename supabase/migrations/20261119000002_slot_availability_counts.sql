-- ══════════════════════════════════════════════════════════════════════════════
-- MakeMeClean — Secure Slot Availability Counter RPC
-- Returns aggregated booking counts per start hour for a given date.
-- Exposes zero PII / customer data; allows frontend slot capacity filtering.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_booked_slot_counts(p_date DATE)
RETURNS TABLE (
  start_hour TEXT,
  booking_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUBSTRING(b.time_slot FROM '^([0-9]{2}:[0-9]{2})') AS start_hour,
    COUNT(*)::BIGINT AS booking_count
  FROM public.bookings b
  WHERE b.date = p_date
    AND b.status != 'cancelled'
  GROUP BY SUBSTRING(b.time_slot FROM '^([0-9]{2}:[0-9]{2})');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slot_counts(DATE) TO anon, authenticated, service_role;
