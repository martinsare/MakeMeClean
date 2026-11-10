export const START_HOURS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as string[];

export const BOOKING_DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
] as const;

export type BookingDayKey = (typeof BOOKING_DAYS)[number]["key"];

export interface DayAvailabilityConfig {
  enabled: boolean;
  slots: string[];
}

export type WeeklyAvailabilitySchedule = Record<BookingDayKey, DayAvailabilityConfig>;

export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailabilitySchedule = {
  mon: { enabled: true, slots: [...START_HOURS] },
  tue: { enabled: true, slots: [...START_HOURS] },
  wed: { enabled: true, slots: [...START_HOURS] },
  thu: { enabled: true, slots: [...START_HOURS] },
  fri: { enabled: true, slots: [...START_HOURS] },
  sat: { enabled: true, slots: [...START_HOURS] },
  sun: { enabled: true, slots: [...START_HOURS] },
};

/**
 * Safely parses the weekly availability schedule JSON. Falls back to default schedule.
 */
export function parseWeeklyAvailability(value: unknown): WeeklyAvailabilitySchedule {
  if (!value) return DEFAULT_WEEKLY_AVAILABILITY;

  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return DEFAULT_WEEKLY_AVAILABILITY;
    }
  }

  if (!raw || typeof raw !== "object") return DEFAULT_WEEKLY_AVAILABILITY;

  const result: Partial<WeeklyAvailabilitySchedule> = {};
  for (const day of BOOKING_DAYS) {
    const dayData = (raw as Record<string, unknown>)[day.key];
    if (dayData && typeof dayData === "object") {
      const enabled = (dayData as { enabled?: boolean }).enabled !== false;
      const rawSlots = (dayData as { slots?: unknown }).slots;
      const validSlots = Array.isArray(rawSlots)
        ? rawSlots.filter((s): s is string => typeof s === "string" && START_HOURS.includes(s))
        : [...START_HOURS];

      result[day.key] = {
        enabled,
        slots: validSlots.length > 0 ? validSlots : [...START_HOURS],
      };
    } else {
      result[day.key] = { enabled: true, slots: [...START_HOURS] };
    }
  }

  return result as WeeklyAvailabilitySchedule;
}

/**
 * Resolves the 3-letter day key ("mon".."sun") from a "YYYY-MM-DD" date string.
 */
export function getDayKeyFromDateStr(dateStr: string): BookingDayKey {
  if (!dateStr || !dateStr.includes("-")) return "mon";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dayIndex = dt.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const map: Record<number, BookingDayKey> = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
  };
  return map[dayIndex] || "mon";
}

export const MIN_DURATION_HOURS = 1.5;
export const MAX_DURATION_HOURS = 12;
export const DURATION_STEP_HOURS = 0.5;

export interface BookingExtra {
  id: string;
  label: string;
  icon: string;
  duration: number;
  desc: string;
}

export interface BookingDurationMultipliers {
  base: number;
  bed: number;
  bath: number;
  living: number;
}

export const DEFAULT_DURATION_MULTIPLIERS: BookingDurationMultipliers = {
  base: 2,
  bed: 0.5,
  bath: 0.5,
  living: 0.5,
};

export const MAX_ROOM_COUNTS = {
  bedrooms: 8,
  bathrooms: 6,
  livingAreas: 5,
} as const;

export const BOOKING_PROPERTY_TYPES = [
  "House / Flat",
  "Studio",
  "HMO / Shared House",
] as const;

export const ACCESS_METHODS = [
  { id: "home", label: "I\'ll be at home", desc: "You or someone will let the cleaner in" },
  { id: "key_safe", label: "Key safe / Lockbox", desc: "Access code left in instructions" },
  { id: "concierge", label: "Concierge / Front desk", desc: "Keys with building reception" },
  { id: "hidden_key", label: "Hidden key", desc: "Key left in a designated secure spot" },
] as const;

export const CLEANING_SUPPLIES_OPTIONS = [
  { id: "cleaner", label: "Cleaner brings eco supplies", desc: "Sprays, microfibre cloths & safe products included" },
  { id: "customer", label: "I will provide cleaning products", desc: "Cleaner uses your preferred sprays and supplies" },
] as const;

export const DEFAULT_BOOKING_EXTRAS: BookingExtra[] = [
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
    duration: 1,
    desc: "Shirts, linens & folding",
  },
  {
    id: "cupboards",
    label: "Inside Kitchen Cabinets",
    icon: "📦",
    duration: 0.75,
    desc: "Shelves wiped & sanitized",
  },
  {
    id: "bed_linen",
    label: "Bed Linen Change",
    icon: "🛏️",
    duration: 0.5,
    desc: "Fresh bedsheets changed & made up",
  },
];

/**
 * Parses the admin-configured extras list without silently accepting malformed
 * or duplicate entries. A null result signals invalid configuration.
 */
export function parseBookingExtras(value: unknown): BookingExtra[] | null {
  if (value == null || value === "") return DEFAULT_BOOKING_EXTRAS;

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  const ids = new Set<string>();
  const extras: BookingExtra[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const duration = Number(item.duration);
    if (
      !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) ||
      ids.has(id) ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > MAX_DURATION_HOURS
    ) {
      return null;
    }

    ids.add(id);
    extras.push({
      id,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : id,
      icon: typeof item.icon === "string" ? item.icon : "",
      duration,
      desc: typeof item.desc === "string" ? item.desc : "",
    });
  }

  return extras;
}

export function parseDurationMultipliers(
  values: Record<string, unknown> | null | undefined,
): BookingDurationMultipliers | null {
  const read = (key: string, fallback: number): number | null => {
    const value = values?.[key];
    if (value == null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const base = read("room_calc_base_hours", DEFAULT_DURATION_MULTIPLIERS.base);
  const bed = read("room_calc_bed_hours", DEFAULT_DURATION_MULTIPLIERS.bed);
  const bath = read("room_calc_bath_hours", DEFAULT_DURATION_MULTIPLIERS.bath);
  const living = read("room_calc_living_hours", DEFAULT_DURATION_MULTIPLIERS.living);

  if (base == null || bed == null || bath == null || living == null) return null;
  return { base, bed, bath, living };
}

/**
 * The estimator intentionally subtracts the contribution of absent rooms.
 * With the standard one-bedroom/one-bathroom/one-living-area layout, the
 * configured base remains unchanged; each count of zero reduces that baseline.
 */
export function calculateRecommendedHours(
  beds: number,
  baths: number,
  livingAreas: number,
  selectedExtraIds: string[],
  multipliers: BookingDurationMultipliers = DEFAULT_DURATION_MULTIPLIERS,
  extras: BookingExtra[] = DEFAULT_BOOKING_EXTRAS,
): number {
  let hours =
    multipliers.base +
    (beds - 1) * multipliers.bed +
    (baths - 1) * multipliers.bath +
    (livingAreas - 1) * multipliers.living;

  for (const extraId of new Set(selectedExtraIds)) {
    const extra = extras.find((item) => item.id === extraId);
    if (extra) hours += extra.duration;
  }

  return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
}

export function calcTimeSlot(startHour: string, durationHours: number): string {
  const [hour, minute] = startHour.split(":").map(Number);
  const startMinutes = hour * 60 + minute;
  const endMinutes = startMinutes + Math.round(durationHours * 60);
  const endHour = Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;
  const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

  return `${startHour} – ${endTime}`;
}

export function calculateDurationHours(timeSlot: string): number {
  if (!timeSlot) return 2;

  const parts = timeSlot.split(/[-–]/).map((part) => part.trim());
  if (parts.length < 2) return 2;

  const [startHour, startMinute] = (parts[0] || "09:00").split(":").map(Number);
  const [endHour, endMinute] = (parts[1] || "11:00").split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const duration = (endMinutes - startMinutes) / 60;

  return duration > 0 ? duration : 2;
}

/**
 * Returns true if the scheduled slot start time on the booking date has already arrived or passed.
 */
export function isBookingStartTimePassed(dateStr: string, timeSlot?: string | null): boolean {
  if (!dateStr) return false;
  const startHourStr = (timeSlot || "09:00").split(/[-–]/)[0]?.trim() || "09:00";
  const [hour, min] = startHourStr.split(":").map(Number);
  const scheduledTime = new Date(`${dateStr}T${String(hour || 9).padStart(2, "0")}:${String(min || 0).padStart(2, "0")}:00`);
  const now = new Date();
  return Number.isFinite(scheduledTime.getTime()) && now > scheduledTime;
}

/**
 * Returns true if the entire scheduled cleaning slot has concluded.
 */
export function isBookingEndTimePassed(dateStr: string, timeSlot?: string | null, durationHours?: number | null): boolean {
  if (!dateStr) return false;
  const parts = (timeSlot || "").split(/[-–]/).map((p) => p.trim());
  let endHour = 11;
  let endMin = 0;

  if (parts.length >= 2 && parts[1]) {
    const [h, m] = parts[1].split(":").map(Number);
    if (Number.isFinite(h)) endHour = h;
    if (Number.isFinite(m)) endMin = m || 0;
  } else {
    const startStr = parts[0] || "09:00";
    const [startH, startM] = startStr.split(":").map(Number);
    const duration = durationHours || 2;
    const totalMinutes = (startH || 9) * 60 + (startM || 0) + Math.round(duration * 60);
    endHour = Math.floor(totalMinutes / 60);
    endMin = totalMinutes % 60;
  }

  const scheduledEnd = new Date(
    `${dateStr}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`
  );
  const now = new Date();
  return Number.isFinite(scheduledEnd.getTime()) && now > scheduledEnd;
}
