import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// All settings are admin-managed in database via /admin/settings
// Sensible fallback defaults if DB is temporarily unreachable
export const SETTING_DEFAULTS: Record<string, string> = {
  booking_enabled: "true",
  booking_disabled_message:
    "We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly.",
  business_phone: "+44 7362 068202",
  contact_email: "contact@makemeclean.co.uk",
  business_hours: "24/7",
  email_info: "info@makemeclean.co.uk",
  email_payment: "payment@makemeclean.co.uk",
  email_recruitment: "recruitment@makemeclean.co.uk",
  email_payroll: "payroll@makemeclean.co.uk",
  company_legal_name: "MakeMeClean Ltd",
  company_reg_number: "",
  company_registered_address: "Wales, United Kingdom",
  vat_registered: "false",
  vat_number: "",
};

// Module-level cache so every component shares one fetch per session
let _cache: Record<string, string> | null = null;
let _pending: Promise<Record<string, string>> | null = null;

async function loadSettings(): Promise<Record<string, string>> {
  if (_cache) return _cache;
  if (_pending) return _pending;
  _pending = Promise.resolve(
    supabase
    .from("settings")
    .select("key, value")
    .then(({ data }) => {
      const map: Record<string, string> = { ...SETTING_DEFAULTS };
      for (const row of data ?? []) map[row.key] = row.value;
      _cache = map;
      _pending = null;
      return map;
    })
  );
  return _pending ?? SETTING_DEFAULTS;
}

export function invalidateSettingsCache() {
  _cache = null;
  _pending = null;
}

export function useSettings(): Record<string, string> {
  const [settings, setSettings] = useState<Record<string, string>>(SETTING_DEFAULTS);
  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);
  return settings;
}
