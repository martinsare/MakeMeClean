import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// All settings are admin-managed in database via /admin/settings
// Sensible fallback defaults if DB is temporarily unreachable
export const SETTING_DEFAULTS: Record<string, string> = {
  booking_enabled: "true",
  booking_disabled_message:
    "We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly.",
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
