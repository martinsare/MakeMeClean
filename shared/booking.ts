export const START_HOURS = [
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
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
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
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
  { id: "home", label: "I'll be at home", desc: "You will be present on site to grant access and remain during clean" },
  { id: "representative", label: "Representative on site", desc: "An adult family member, flatmate, or agent will be present" },
  { id: "concierge", label: "Concierge / On-site staff", desc: "Building front desk or on-site concierge will admit cleaner and monitor premises" },
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
  const read = (primaryKey: string, aliasKey: string, fallback: number): number | null => {
    const rawPrimary = values?.[primaryKey];
    const value = rawPrimary != null && rawPrimary !== "" ? rawPrimary : values?.[aliasKey];
    if (value == null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const base = read("room_calc_base_hours", "base", DEFAULT_DURATION_MULTIPLIERS.base);
  const bed = read("room_calc_bed_hours", "bed", DEFAULT_DURATION_MULTIPLIERS.bed);
  const bath = read("room_calc_bath_hours", "bath", DEFAULT_DURATION_MULTIPLIERS.bath);
  const living = read("room_calc_living_hours", "living", DEFAULT_DURATION_MULTIPLIERS.living);

  if (base == null || bed == null || bath == null || living == null) return null;
  return { base, bed, bath, living };
}

export type ServiceCategory =
  | "ironing"
  | "cleaning_ironing"
  | "office"
  | "airbnb"
  | "domestic";

export function getServiceCategory(serviceIdOrName: string): ServiceCategory {
  const s = (serviceIdOrName || "").toLowerCase();
  if (s === "ironing-service" || s.includes("ironing service") || (s.includes("ironing") && !s.includes("cleaning"))) {
    return "ironing";
  }
  if (s === "cleaning-and-ironing" || s.includes("cleaning and ironing") || s.includes("cleaning & ironing")) {
    return "cleaning_ironing";
  }
  if (s === "office-cleaning" || s.includes("office") || s.includes("commercial")) {
    return "office";
  }
  if (s === "airbnb-cleaning" || s.includes("airbnb") || s.includes("holiday") || s.includes("short-let")) {
    return "airbnb";
  }
  return "domestic";
}

export const SERVICE_CATEGORY_EXTRAS: Record<ServiceCategory, BookingExtra[]> = {
  ironing: [
    { id: "wash_fold", label: "Wash & Fold Cycle", icon: "🫧", duration: 1.0, desc: "Run washing machine cycle & tumble/air dry" },
    { id: "bed_linen_change", label: "Fresh Bed Making", icon: "🛏️", duration: 0.5, desc: "Strip and redress beds with ironed linens" },
    { id: "hangers_folding", label: "Wardrobe Staging", icon: "👗", duration: 0.5, desc: "Sort onto hangers & colour-coordinated fold" },
    { id: "steam_press", label: "Steam Touch-Up", icon: "💨", duration: 0.5, desc: "Delicate vertical steam freshening" },
  ],
  cleaning_ironing: [
    { id: "inside_oven", label: "Inside Oven & Grill", icon: "🍳", duration: 0.75, desc: "Deep degreasing & rack soaking" },
    { id: "inside_fridge", label: "Inside Fridge / Freezer", icon: "❄️", duration: 0.5, desc: "Shelves washed & sanitized" },
    { id: "bed_linen_change", label: "Bed Linen Change", icon: "🛏️", duration: 0.5, desc: "Fresh bedsheets changed & made up" },
    { id: "inside_windows", label: "Interior Window Glass", icon: "🪟", duration: 0.5, desc: "Internal panes & sills buffed" },
  ],
  office: [
    { id: "kitchenette_deep", label: "Kitchenette & Microwave", icon: "☕", duration: 0.75, desc: "Coffee machines, sink, fridge & counters" },
    { id: "it_sanitise", label: "IT & Phone Sanitisation", icon: "⌨️", duration: 0.75, desc: "Antiviral wipe of keyboards, mice & screens" },
    { id: "glass_partitions", label: "Glass Partitions & Doors", icon: "🪟", duration: 0.5, desc: "Meeting room glass buffed streak-free" },
    { id: "bin_recycling", label: "Waste & Recycling Sort", icon: "♻️", duration: 0.5, desc: "Central collection & recycling liners changed" },
  ],
  airbnb: DEFAULT_BOOKING_EXTRAS,
  domestic: DEFAULT_BOOKING_EXTRAS,
};

export const SERVICE_CATEGORY_FIELD_LIMITS: Record<
  ServiceCategory,
  { field1Max: number; field2Max: number; field3Max: number }
> = {
  ironing: { field1Max: 8, field2Max: 20, field3Max: 8 },
  cleaning_ironing: { field1Max: 8, field2Max: 6, field3Max: 6 },
  office: { field1Max: 50, field2Max: 12, field3Max: 8 },
  airbnb: { field1Max: 8, field2Max: 6, field3Max: 5 },
  domestic: {
    field1Max: MAX_ROOM_COUNTS.bedrooms,
    field2Max: MAX_ROOM_COUNTS.bathrooms,
    field3Max: MAX_ROOM_COUNTS.livingAreas,
  },
};

export function getAllowedExtrasForService(
  serviceIdOrName: string,
  configuredDomesticExtras: BookingExtra[] = DEFAULT_BOOKING_EXTRAS,
): BookingExtra[] {
  const category = getServiceCategory(serviceIdOrName);
  if (category === "domestic") {
    return configuredDomesticExtras;
  }
  return SERVICE_CATEGORY_EXTRAS[category];
}

export function getServiceFieldLimits(serviceIdOrName: string): {
  field1Max: number;
  field2Max: number;
  field3Max: number;
} {
  return SERVICE_CATEGORY_FIELD_LIMITS[getServiceCategory(serviceIdOrName)];
}

export function calculateRecommendedHoursForService(
  serviceIdOrName: string,
  val1: number,
  val2: number,
  val3: number,
  selectedExtraIds: string[],
  multipliers: BookingDurationMultipliers = DEFAULT_DURATION_MULTIPLIERS,
  configuredDomesticExtras: BookingExtra[] = DEFAULT_BOOKING_EXTRAS,
): number {
  const category = getServiceCategory(serviceIdOrName);
  const extras = getAllowedExtrasForService(serviceIdOrName, configuredDomesticExtras);

  if (category === "ironing") {
    let hours = val1 * 1.0 + val2 * 0.1 + val3 * 0.35;
    for (const extraId of new Set(selectedExtraIds)) {
      const extra = extras.find((item) => item.id === extraId);
      if (extra) hours += extra.duration;
    }
    return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
  }

  if (category === "office") {
    let hours = 1.0 + val1 * 0.1 + val2 * 0.5 + val3 * 0.5;
    for (const extraId of new Set(selectedExtraIds)) {
      const extra = extras.find((item) => item.id === extraId);
      if (extra) hours += extra.duration;
    }
    return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
  }

  if (category === "cleaning_ironing") {
    let hours = 1.5 + val1 * 0.5 + val2 * 0.5 + val3 * 1.0;
    for (const extraId of new Set(selectedExtraIds)) {
      const extra = extras.find((item) => item.id === extraId);
      if (extra) hours += extra.duration;
    }
    return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
  }

  return calculateRecommendedHours(
    val1,
    val2,
    val3,
    selectedExtraIds,
    multipliers,
    extras,
  );
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
  const startMinutes = (Number.isFinite(hour) ? hour : 9) * 60 + (Number.isFinite(minute) ? minute : 0);
  const endMinutes = startMinutes + Math.round(durationHours * 60);
  const endHour = Math.floor(endMinutes / 60) % 24;
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
  const startMinutes = (Number.isFinite(startHour) ? startHour : 9) * 60 + (Number.isFinite(startMinute) ? startMinute : 0);
  const endMinutes = (Number.isFinite(endHour) ? endHour : 11) * 60 + (Number.isFinite(endMinute) ? endMinute : 0);
  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes <= 0) {
    diffMinutes += 24 * 60;
  }
  const duration = diffMinutes / 60;

  return duration > 0 ? duration : 2;
}

/**
 * Returns the current UK (Europe/London) local date & time components,
 * ensuring BST/GMT accuracy on UTC servers and non-UK browsers.
 */
export function getUkNowParts(now: Date = new Date()): {
  dateStr: string;
  hour: number;
  minute: number;
  totalMinutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const dateStr = `${part("year")}-${part("month")}-${part("day")}`;
  const rawHour = Number(part("hour"));
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(part("minute"));
  return {
    dateStr,
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

/**
 * Computes hours remaining until a scheduled UK (Europe/London) booking start time.
 * Positive = in the future, negative = already passed.
 */
export function getHoursUntilBookingStart(
  dateStr: string,
  timeSlot?: string | null,
  now: Date = new Date(),
): number {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0;
  const startHourStr = (timeSlot || "09:00").split(/[-–]/)[0]?.trim() || "09:00";
  const [hour, min] = startHourStr.split(":").map(Number);
  const startMinutes = (Number.isFinite(hour) ? hour : 9) * 60 + (Number.isFinite(min) ? min : 0);

  const ukNow = getUkNowParts(now);
  const targetDayUtc = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
  );
  const nowDayUtc = Date.UTC(
    Number(ukNow.dateStr.slice(0, 4)),
    Number(ukNow.dateStr.slice(5, 7)) - 1,
    Number(ukNow.dateStr.slice(8, 10)),
  );
  const dayDiffMinutes = Math.round((targetDayUtc - nowDayUtc) / 60000);
  return (dayDiffMinutes + startMinutes - ukNow.totalMinutes) / 60;
}

/**
 * Shared authoritative booking price calculation (used by both frontend & backend).
 * Applies service discount first, then recurring discount, with total effective discount capped at 50%.
 */
export function calculateBookingPrice(params: {
  baseHourlyRate: number;
  durationHours: number;
  serviceDiscountPercent?: number;
  recurringDiscountPercent?: number;
}): {
  basePrice: number;
  afterServiceDiscount: number;
  effectiveDiscountPercent: number;
  finalPrice: number;
} {
  const rate = Number.isFinite(params.baseHourlyRate) && params.baseHourlyRate > 0 ? params.baseHourlyRate : 20;
  const duration = Number.isFinite(params.durationHours) && params.durationHours > 0 ? params.durationHours : 2;
  const svcPct = Math.max(0, Math.min(100, Number(params.serviceDiscountPercent) || 0));
  const recPct = Math.max(0, Math.min(100, Number(params.recurringDiscountPercent) || 0));

  const basePrice = Math.round(rate * duration * 100) / 100;
  const afterServiceDiscount = Math.round(rate * duration * (1 - svcPct / 100) * 100) / 100;
  const multiplier = (1 - svcPct / 100) * (1 - recPct / 100);
  const cappedMultiplier = Math.max(0.5, multiplier); // Max 50% total combined discount
  const effectiveDiscountPercent = Math.round((1 - cappedMultiplier) * 10000) / 100;
  const finalPrice = Math.round(rate * duration * cappedMultiplier * 100) / 100;

  return { basePrice, afterServiceDiscount, effectiveDiscountPercent, finalPrice };
}

/**
 * Returns true if the scheduled slot start time on the booking date (Europe/London) has already arrived or passed.
 */
export function isBookingStartTimePassed(dateStr: string, timeSlot?: string | null): boolean {
  if (!dateStr) return false;
  return getHoursUntilBookingStart(dateStr, timeSlot) <= 0;
}

/**
 * Returns true if the entire scheduled cleaning slot (Europe/London) has concluded.
 */
export function isBookingEndTimePassed(dateStr: string, timeSlot?: string | null, durationHours?: number | null): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = (timeSlot || "").split(/[-–]/).map((p) => p.trim());
  let endMinutes = 11 * 60;
  let crossedMidnight = false;

  const startStr = parts[0] || "09:00";
  const [startH, startM] = startStr.split(":").map(Number);
  const startMinutes = (Number.isFinite(startH) ? startH : 9) * 60 + (Number.isFinite(startM) ? startM : 0);

  if (parts.length >= 2 && parts[1]) {
    const [h, m] = parts[1].split(":").map(Number);
    if (Number.isFinite(h)) {
      endMinutes = h * 60 + (Number.isFinite(m) ? m : 0);
      if (endMinutes <= startMinutes) {
        crossedMidnight = true;
      }
    }
  } else {
    const duration = durationHours || 2;
    const totalEnd = startMinutes + Math.round(duration * 60);
    if (totalEnd >= 24 * 60) {
      crossedMidnight = true;
    }
    endMinutes = totalEnd % (24 * 60);
  }

  const ukNow = getUkNowParts();
  const targetDayUtc = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)) + (crossedMidnight ? 1 : 0),
  );
  const nowDayUtc = Date.UTC(
    Number(ukNow.dateStr.slice(0, 4)),
    Number(ukNow.dateStr.slice(5, 7)) - 1,
    Number(ukNow.dateStr.slice(8, 10)),
  );
  const dayDiffMinutes = Math.round((targetDayUtc - nowDayUtc) / 60000);
  return dayDiffMinutes + endMinutes <= ukNow.totalMinutes;
}

export const DEFAULT_MIN_BOOKING_LEAD_HOURS = 5;
export const DEFAULT_CANCELLATION_LATE_HOURS = 3;
export const DEFAULT_CANCELLATION_LATE_REFUND_PERCENT = 75;

export interface CancellationRefundCalculation {
  eligibleAmount: number;
  refundPercent: number;
  feeAmount: number;
  feePercent: number;
  isLate: boolean;
  hoursUntilStart: number | null;
}

/**
 * Authoritative cancellation refund calculation.
 * If cancelled within lateWindowHours (default 3h), refundPercent (default 75%) is returned.
 * If cancelled earlier than lateWindowHours, 100% full refund is returned.
 */
export function calculateCancellationRefund(params: {
  bookingPrice: number;
  alreadyRefunded?: number;
  hoursUntilStart: number | null;
  lateWindowHours?: number;
  lateRefundPercent?: number;
}): CancellationRefundCalculation {
  const price = Number.isFinite(params.bookingPrice) && params.bookingPrice > 0 ? params.bookingPrice : 0;
  const alreadyRefunded = Number.isFinite(params.alreadyRefunded) && (params.alreadyRefunded ?? 0) > 0 ? (params.alreadyRefunded ?? 0) : 0;
  const remainingBalance = Math.round(Math.max(0, price - alreadyRefunded) * 100) / 100;

  const lateHours = Number.isFinite(params.lateWindowHours) && (params.lateWindowHours ?? 0) >= 0
    ? (params.lateWindowHours ?? DEFAULT_CANCELLATION_LATE_HOURS)
    : DEFAULT_CANCELLATION_LATE_HOURS;

  const latePct = Number.isFinite(params.lateRefundPercent) && (params.lateRefundPercent ?? 0) >= 0 && (params.lateRefundPercent ?? 0) <= 100
    ? (params.lateRefundPercent ?? DEFAULT_CANCELLATION_LATE_REFUND_PERCENT)
    : DEFAULT_CANCELLATION_LATE_REFUND_PERCENT;

  const hours = params.hoursUntilStart;
  const isLate = hours !== null && hours <= lateHours;
  const refundPercent = isLate ? latePct : 100;
  const feePercent = 100 - refundPercent;

  const eligibleAmount = Math.round(remainingBalance * (refundPercent / 100) * 100) / 100;
  const feeAmount = Math.round((remainingBalance - eligibleAmount) * 100) / 100;

  return {
    eligibleAmount,
    refundPercent,
    feeAmount,
    feePercent,
    isLate,
    hoursUntilStart: hours,
  };
}

