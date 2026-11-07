import { useEffect, useState } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Clock,
  Info,
  Send,
  Bell,
  Trophy,
  Sparkles,
  Trash2,
  Plus,
  Home,
  Power,
  CalendarX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { SETTING_DEFAULTS, invalidateSettingsCache } from "@/hooks/useSettings";

type FormValues = {
  business_phone: string;
  contact_email: string;
  business_hours: string;
  email_info: string;
  email_recruitment: string;
  email_payment: string;
  email_payroll: string;
  email_staffing: string;
};

const FIELDS: {
  key: keyof FormValues;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
}[] = [
  {
    key: "business_phone",
    label: "Business phone",
    sub: "Shown in footer, contact page and homepage call button",
    icon: Phone,
  },
  {
    key: "contact_email",
    label: "Contact email",
    sub: "Shown in footer, contact page and FAQ",
    icon: Mail,
  },
  {
    key: "business_hours",
    label: "Business hours",
    sub: "Shown in footer and contact page",
    icon: Clock,
  },
  {
    key: "email_info",
    label: "Info / general email",
    sub: "Used in customer reply emails (info@...)",
    icon: Mail,
  },
  {
    key: "email_recruitment",
    label: "Recruitment email",
    sub: "Shown on applicant emails and recruitment pages",
    icon: Mail,
  },
  {
    key: "email_payment",
    label: "Payments email",
    sub: "Shown on invoices and payment pages",
    icon: Mail,
  },
  {
    key: "email_payroll",
    label: "Payroll email",
    sub: "Shown on staff payslips",
    icon: Mail,
  },
  {
    key: "email_staffing",
    label: "Staffing email",
    sub: "Used in staff shift assignment emails",
    icon: Mail,
  },
];

const CRON_SCHEDULES = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Every 12 hours", cron: "0 */12 * * *" },
  { label: "Every day at 8 AM", cron: "0 8 * * *" },
  { label: "Every day at 9 AM", cron: "0 9 * * *" },
  { label: "Every day at 10 AM", cron: "0 10 * * *" },
];

function ScheduleDropdown() {
  const [cron, setCron] = useState("0 * * * *");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "reminder_schedule_cron")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCron(data.value);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      {
        key: "reminder_schedule_cron",
        value: cron,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading)
    return (
      <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    );

  return (
    <div className="flex items-end gap-3 flex-wrap mb-6">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">
          Schedule for sending reminders
        </label>
        <select
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          {CRON_SCHEDULES.map((s) => (
            <option key={s.cron} value={s.cron}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1.5">
          Cron:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">
            {cron}
          </code>
        </p>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {saved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}

function ReminderHoursSetting() {
  const [hours, setHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "reminder_hours_before")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setHours(data.value);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      {
        key: "reminder_hours_before",
        value: hours,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading)
    return (
      <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    );

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">
          Send reminder how many hours before booking?
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="168"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-sm text-gray-500 font-medium">
            hours before
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          e.g. 24 = reminder sent 24 hours before the booking time
        </p>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {saved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}

interface BookingExtraItem {
  id: string;
  label: string;
  icon: string;
  duration: number;
  desc: string;
}

const DEFAULT_BOOKING_EXTRAS: BookingExtraItem[] = [
  {
    id: "oven",
    label: "Inside Oven & Grill",
    icon: "🍳",
    duration: 0.75,
    desc: "Deep degreasing & rack soaking",
  },
  {
    id: "fridge",
    label: "Inside Fridge / Freezer",
    icon: "❄️",
    duration: 0.5,
    desc: "Shelves washed & sanitized",
  },
  {
    id: "windows",
    label: "Interior Window Glass",
    icon: "🪟",
    duration: 0.5,
    desc: "Internal panes & sills buffed",
  },
  {
    id: "ironing",
    label: "Ironing & Laundry",
    icon: "🧺",
    duration: 1.0,
    desc: "Shirts, linens & folding",
  },
  {
    id: "carpet",
    label: "Carpet Stain Extraction",
    icon: "🧹",
    duration: 1.0,
    desc: "Hot water shampoo machine",
  },
  {
    id: "cupboards",
    label: "Inside Kitchen Cabinets",
    icon: "📦",
    duration: 0.75,
    desc: "Shelves wiped & sanitized",
  },
];

function BookingExtrasManager() {
  const [extras, setExtras] = useState<BookingExtraItem[]>(
    DEFAULT_BOOKING_EXTRAS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("✨");
  const [newMinutes, setNewMinutes] = useState(45);
  const [newDesc, setNewDesc] = useState("");

  const fetchExtras = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "booking_extras")
      .maybeSingle();

    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExtras(parsed);
        }
      } catch (_) {}
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExtras();
  }, []);

  const saveExtras = async (updated: BookingExtraItem[]) => {
    setSaving(true);
    setExtras(updated);
    await supabase.from("settings").upsert(
      {
        key: "booking_extras",
        value: JSON.stringify(updated),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    invalidateSettingsCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const id = newLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32);
    const durationHours = Math.max(
      0.25,
      Math.round((newMinutes / 60) * 100) / 100
    );
    const newItem: BookingExtraItem = {
      id: `${id}-${Date.now().toString().slice(-4)}`,
      label: newLabel.trim(),
      icon: newIcon.trim() || "✨",
      duration: durationHours,
      desc: newDesc.trim() || "Specialist cleaning extra",
    };
    const updated = [...extras, newItem];
    saveExtras(updated);
    setNewLabel("");
    setNewIcon("✨");
    setNewMinutes(45);
    setNewDesc("");
  };

  const handleDelete = (id: string) => {
    const updated = extras.filter((e) => e.id !== id);
    saveExtras(updated);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all specialist extras to factory defaults?")) {
      saveExtras(DEFAULT_BOOKING_EXTRAS);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center text-green-600 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">
              Specialist Booking Extras Checklist
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Customize add-ons, icons, descriptions, and duration added on the
              booking page
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved Live!
            </span>
          )}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-gray-500 hover:text-gray-900 px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {extras.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-gray-900 leading-tight">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-green-700 font-bold mt-0.5">
                          +{Math.round(item.duration * 60)} mins (
                          {item.duration}h)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete extra"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddExtra}
              className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3"
            >
              <p className="text-xs font-bold text-gray-900">
                + Add New Specialist Extra
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">
                    Emoji / Icon
                  </label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    placeholder="🍳"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-center bg-white"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">
                    Extra Title / Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Balcony Pressure Wash"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">
                    Time Added (Mins)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    max="300"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={saving || !newLabel.trim()}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    + Add Extra
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Jet washing floor tiles and clearing leaves"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white"
                />
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function RoomCalculatorSettings() {
  const [baseHours, setBaseHours] = useState("2.0");
  const [bedHours, setBedHours] = useState("0.5");
  const [bathHours, setBathHours] = useState("0.5");
  const [livingHours, setLivingHours] = useState("0.5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "room_calc_base_hours",
        "room_calc_bed_hours",
        "room_calc_bath_hours",
        "room_calc_living_hours",
      ])
      .then(({ data }) => {
        if (data) {
          for (const row of data) {
            if (row.key === "room_calc_base_hours") setBaseHours(row.value);
            if (row.key === "room_calc_bed_hours") setBedHours(row.value);
            if (row.key === "room_calc_bath_hours") setBathHours(row.value);
            if (row.key === "room_calc_living_hours") setLivingHours(row.value);
          }
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      [
        {
          key: "room_calc_base_hours",
          value: baseHours,
          updated_at: new Date().toISOString(),
        },
        {
          key: "room_calc_bed_hours",
          value: bedHours,
          updated_at: new Date().toISOString(),
        },
        {
          key: "room_calc_bath_hours",
          value: bathHours,
          updated_at: new Date().toISOString(),
        },
        {
          key: "room_calc_living_hours",
          value: livingHours,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    );
    invalidateSettingsCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">
              Room Duration Calculator Multipliers
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Control how many hours are automatically recommended when
              customers change room counters
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          {saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Multipliers"}
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <label className="text-xs font-bold text-gray-800 block mb-1">
                Base Time (1 Bed + 1 Bath)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="6"
                  value={baseHours}
                  onChange={(e) => setBaseHours(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-bold"
                />
                <span className="text-xs text-gray-500">hours</span>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <label className="text-xs font-bold text-gray-800 block mb-1">
                Per Extra Bedroom
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="3"
                  value={bedHours}
                  onChange={(e) => setBedHours(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-bold"
                />
                <span className="text-xs text-gray-500">hours</span>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <label className="text-xs font-bold text-gray-800 block mb-1">
                Per Extra Bathroom
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="3"
                  value={bathHours}
                  onChange={(e) => setBathHours(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-bold"
                />
                <span className="text-xs text-gray-500">hours</span>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <label className="text-xs font-bold text-gray-800 block mb-1">
                Per Extra Living Room
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="3"
                  value={livingHours}
                  onChange={(e) => setLivingHours(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-bold"
                />
                <span className="text-xs text-gray-500">hours</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceCitiesManagement() {
  const [cities, setCities] = useState<
    {
      id: string;
      name: string;
      region: string;
      postcode_prefix?: string;
      is_active: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [newCityName, setNewCityName] = useState("");
  const [newCityRegion, setNewCityRegion] = useState("South Wales");
  const [newCityPrefix, setNewCityPrefix] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCities = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_cities")
      .select("id, name, region, postcode_prefix, is_active")
      .order("name", { ascending: true });
    if (data) setCities(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const toggleCity = async (id: string, current: boolean) => {
    setTogglingId(id);
    await supabase
      .from("service_cities")
      .update({ is_active: !current })
      .eq("id", id);
    setCities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c))
    );
    setTogglingId(null);
  };

  const deleteCity = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from coverage?`))
      return;
    await supabase.from("service_cities").delete().eq("id", id);
    setCities((prev) => prev.filter((c) => c.id !== id));
  };

  const addCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    const { data } = await supabase
      .from("service_cities")
      .insert({
        name: newCityName.trim(),
        region: newCityRegion,
        postcode_prefix: newCityPrefix.trim() || undefined,
        is_active: true,
      })
      .select()
      .single();
    if (data) {
      setCities((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewCityName("");
      setNewCityPrefix("");
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-black text-gray-900">
            Service Locations & Coverage (Wales)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Toggle locations on/off or add new areas. Changes immediately update
            the website & booking flow.
          </p>
        </div>
        <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
          {cities.filter((c) => c.is_active).length} Active Locations
        </span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cities.map((city) => (
                <div
                  key={city.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                    city.is_active
                      ? "bg-green-50/60 border-green-200"
                      : "bg-gray-50 border-gray-200 opacity-60"
                  }`}
                >
                  <div
                    onClick={() => toggleCity(city.id, city.is_active)}
                    className="min-w-0 flex-1 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {city.name}
                      </p>
                      {city.postcode_prefix && (
                        <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-gray-500 border border-gray-200 font-mono">
                          {city.postcode_prefix}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {city.region}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleCity(city.id, city.is_active)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black transition-colors ${
                        city.is_active
                          ? "bg-green-600 text-white"
                          : "bg-gray-300 text-gray-600"
                      }`}
                      title={
                        city.is_active
                          ? "Active (Click to pause)"
                          : "Paused (Click to activate)"
                      }
                    >
                      {city.is_active ? "✓" : "✕"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCity(city.id, city.name)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Location"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Location form */}
            <form
              onSubmit={addCity}
              className="flex gap-2 pt-4 border-t border-gray-100 flex-wrap sm:flex-nowrap"
            >
              <input
                type="text"
                placeholder="City/Town name (e.g. Caerphilly)..."
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Postcode (e.g. CF83)..."
                value={newCityPrefix}
                onChange={(e) => setNewCityPrefix(e.target.value)}
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-green-500 focus:outline-none uppercase"
              />
              <select
                value={newCityRegion}
                onChange={(e) => setNewCityRegion(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
              >
                <option value="South Wales">South Wales</option>
                <option value="Mid Wales">Mid Wales</option>
                <option value="North Wales">North Wales</option>
                <option value="West Wales">West Wales</option>
                <option value="Vale of Glamorgan">Vale of Glamorgan</option>
                <option value="Gwent">Gwent</option>
                <option value="Rhondda Cynon Taf">Rhondda Cynon Taf</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Location
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingAvailabilityControl() {
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState(
    "We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly."
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["booking_enabled", "booking_disabled_message"])
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const row of data || []) {
          map.set(row.key, row.value);
        }
        if (map.has("booking_enabled")) {
          setEnabled(map.get("booking_enabled") !== "false");
        }
        if (map.has("booking_disabled_message")) {
          setMessage(map.get("booking_disabled_message") || "");
        }
        setLoading(false);
      });
  }, []);

  const handleToggle = async (newVal: boolean) => {
    setSaving(true);
    setEnabled(newVal);
    await supabase.from("settings").upsert(
      [
        {
          key: "booking_enabled",
          value: newVal ? "true" : "false",
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    );
    invalidateSettingsCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveMessage = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      [
        {
          key: "booking_disabled_message",
          value: message,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    );
    invalidateSettingsCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              enabled
                ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                : "bg-rose-50 border-rose-100 text-rose-600"
            }`}
          >
            <Power className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">
              Booking Availability Control
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Turn customer bookings on or off whenever you are unavailable or
              at full capacity
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${
            enabled
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-rose-700 bg-rose-50 border-rose-200"
          }`}
        >
          {enabled ? "Accepting Bookings" : "Bookings Paused"}
        </span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap p-4 rounded-xl border ${
                enabled
                  ? "bg-emerald-50/50 border-emerald-100"
                  : "bg-rose-50/50 border-rose-100"
              }`}
            >
              <div>
                <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      enabled ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                    }`}
                  />
                  {enabled
                    ? "Customer bookings are currently OPEN"
                    : "Customer bookings are currently PAUSED"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {enabled
                    ? "Customers across Wales can view available dates and book cleaning appointments normally."
                    : "The booking form will show a clear paused announcement to customers, preventing anyone from booking."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(!enabled)}
                disabled={saving}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-2 ${
                  enabled
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {saving ? (
                  "Updating..."
                ) : saved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Updated!
                  </>
                ) : enabled ? (
                  <>
                    <CalendarX className="w-4 h-4" /> Pause Bookings
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4" /> Resume Bookings
                  </>
                )}
              </button>
            </div>

            {/* Custom message for customers when paused */}
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Notice displayed to customers when bookings are paused:
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Notice to customers when paused..."
                className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveMessage}
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Save Notice Text
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoyaltyProgramToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "loyalty_enabled")
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.value === "true");
        setLoading(false);
      });
  }, []);

  const toggle = async () => {
    const nextVal = !enabled;
    setSaving(true);
    setEnabled(nextVal);
    await supabase.from("settings").upsert(
      {
        key: "loyalty_enabled",
        value: nextVal ? "true" : "false",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    invalidateSettingsCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">
              Customer Loyalty & Rewards Program
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Control whether the Loyalty Rewards system is visible to customers
              across web and mobile
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${
            enabled
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-gray-500 bg-gray-50 border-gray-200"
          }`}
        >
          {enabled ? "Active & Visible" : "Hidden / Disabled"}
        </span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-900">
                {enabled
                  ? "Loyalty Rewards is currently ACTIVE"
                  : "Loyalty Rewards is currently HIDDEN"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {enabled
                  ? "Customers can see their points, tiers, and redeem rewards on both the web portal and mobile app."
                  : "Loyalty links, badges, and points are completely hidden from customer navigation until you turn it on."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              disabled={saving}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-2 ${
                enabled
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {saving ? (
                "Saving..."
              ) : saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Saved!
                </>
              ) : enabled ? (
                "Turn Off Loyalty"
              ) : (
                "Turn On Loyalty"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [values, setValues] = useState<FormValues>({
    ...SETTING_DEFAULTS,
  } as FormValues);
  const [original, setOriginal] = useState<FormValues>({
    ...SETTING_DEFAULTS,
  } as FormValues);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterBody, setNewsletterBody] = useState("");
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState("");

  useEffect(() => {
    if (loading || roleLoading || !isAdmin) return;
    supabase
      .from("settings")
      .select("key, value")
      .then(({ data }) => {
        const map: Record<string, string> = { ...SETTING_DEFAULTS };
        for (const row of data ?? []) map[row.key] = row.value;
        const v = map as FormValues;
        setValues(v);
        setOriginal(v);
        setFetching(false);
      });
  }, [loading, roleLoading, isAdmin]);

  const isDirty = JSON.stringify(values) !== JSON.stringify(original);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    const rows = (Object.keys(values) as (keyof FormValues)[]).map((key) => ({
      key,
      value: values[key].trim() || SETTING_DEFAULTS[key],
      updated_at: new Date().toISOString(),
    }));
    const { error: err } = await supabase
      .from("settings")
      .upsert(rows, { onConflict: "key" });
    if (err) {
      setError(err.message);
    } else {
      invalidateSettingsCache();
      setOriginal({ ...values });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    }
    setSaving(false);
  };

  const sendNewsletter = async () => {
    if (!newsletterSubject.trim() || !newsletterBody.trim()) {
      setNewsletterError("Subject and body are required");
      return;
    }

    setSendingNewsletter(true);
    setNewsletterError("");
    setNewsletterSuccess(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-newsletter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            subject: newsletterSubject.trim(),
            bodyText: newsletterBody.trim(),
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to send newsletter");
      }

      setNewsletterSuccess(true);
      setNewsletterSubject("");
      setNewsletterBody("");
      setTimeout(() => setNewsletterSuccess(false), 5000);
    } catch (e: any) {
      setNewsletterError(e.message ?? "Error sending newsletter");
    } finally {
      setSendingNewsletter(false);
    }
  };

  if (loading || roleLoading) return null;
  if (!isAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Access denied
      </div>
    );

  const sections = [
    {
      title: "Customer-facing contact info",
      subtitle:
        "Shown to customers on the website — footer, contact page, and homepage.",
      keys: [
        "business_phone",
        "contact_email",
        "business_hours",
      ] as (keyof FormValues)[],
    },
    {
      title: "Department email addresses",
      subtitle:
        "Shown on invoices, payslips, and recruitment pages. To change the actual sending address for automated emails, update your Brevo sender settings.",
      keys: [
        "email_info",
        "email_recruitment",
        "email_payment",
        "email_payroll",
        "email_staffing",
      ] as (keyof FormValues)[],
    },
  ];

  return (
    <AdminLayout
      title="Site Settings"
      subtitle="Manage contact info and email addresses shown across the site"
      actions={
        <button
          onClick={save}
          disabled={saving || !isDirty || fetching}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      }
    >
      {fetching ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {success && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                Settings saved. Changes are live on the website immediately.
              </p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-sm font-black text-gray-900">
                  {section.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1">{section.subtitle}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {section.keys.map((key) => {
                  const field = FIELDS.find((f) => f.key === key)!;
                  const Icon = field.icon;
                  const changed = values[key] !== original[key];
                  return (
                    <div key={key} className="px-6 py-4 flex items-start gap-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-1">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-xs font-bold text-gray-700">
                            {field.label}
                          </label>
                          {changed && (
                            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                              unsaved
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mb-2">
                          {field.sub}
                        </p>
                        <input
                          type="text"
                          value={values[key]}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [key]: e.target.value }))
                          }
                          placeholder={SETTING_DEFAULTS[key]}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-blue-700 mb-1">
                Automated email senders
              </p>
              <p className="text-xs text-blue-600 leading-relaxed">
                The email addresses above control what is <em>displayed</em> on
                the website. The actual sending address for automated emails
                (booking confirmations, staff assignments, etc.) is controlled
                by your Brevo account. To change the sender, update it there.
              </p>
            </div>
          </div>

          {/* Booking Availability On/Off Switch */}
          <BookingAvailabilityControl />

          {/* Customer Loyalty Toggle */}
          <LoyaltyProgramToggle />

          {/* Specialist Booking Extras Manager */}
          <BookingExtrasManager />

          {/* Room Calculator Multipliers */}
          <RoomCalculatorSettings />

          {/* Service Cities Management */}
          <ServiceCitiesManagement />

          {/* Booking Reminders Section */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">
                Booking Reminders
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Automatic email reminders sent to customers before their booking
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                <Bell className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-700 mb-1">
                    How to set up automatic reminders
                  </p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    To enable automatic reminders, schedule the{" "}
                    <code className="bg-blue-100 px-1 py-0.5 rounded">
                      send-booking-reminders
                    </code>{" "}
                    Edge Function in your Supabase dashboard under{" "}
                    <strong>Edge Functions → Schedules</strong>. Choose a
                    schedule below, and the function will automatically read the
                    hours setting.
                  </p>
                </div>
              </div>
              <ScheduleDropdown />
              <ReminderHoursSetting />
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">Newsletter</h2>
              <p className="text-xs text-gray-400 mt-1">
                Send email to all newsletter subscribers
              </p>
            </div>
            <div className="p-6 space-y-4">
              {newsletterSuccess && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-semibold text-green-800">
                    Newsletter sent successfully!
                  </p>
                </div>
              )}
              {newsletterError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{newsletterError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={newsletterSubject}
                  onChange={(e) => setNewsletterSubject(e.target.value)}
                  placeholder="e.g. Spring Cleaning Tips"
                  disabled={sendingNewsletter}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={newsletterBody}
                  onChange={(e) => setNewsletterBody(e.target.value)}
                  placeholder="Write your newsletter message..."
                  disabled={sendingNewsletter}
                  rows={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                />
              </div>

              <button
                onClick={sendNewsletter}
                disabled={
                  sendingNewsletter ||
                  !newsletterSubject.trim() ||
                  !newsletterBody.trim()
                }
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendingNewsletter ? "Sending..." : "Send Newsletter"}
              </button>
            </div>
          </div>

          <div className="flex justify-end pb-4">
            <button
              onClick={save}
              disabled={saving || !isDirty}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
