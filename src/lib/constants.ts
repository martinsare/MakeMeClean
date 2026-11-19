// ─── Pagination ───────────────────────────────────────────────────────────────

export const PAGE_SIZE = 15;

// ─── Booking status badge styles ──────────────────────────────────────────────

export const BOOKING_STATUS_STYLES: Record<string, string> = {
  upcoming:  "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

// ─── Payment status badge styles ──────────────────────────────────────────────

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700",
  unpaid:  "bg-red-100 text-red-600",
  pending: "bg-amber-100 text-amber-700",
};

// ─── Application status badge styles ─────────────────────────────────────────

export const APPLICATION_STATUS_STYLES: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-700",
  reviewing:   "bg-blue-100 text-blue-700",
  shortlisted: "bg-purple-100 text-purple-700",
  hired:       "bg-emerald-100 text-emerald-700",
  rejected:    "bg-red-100 text-red-700",
};

// ─── Recurring plan status badge styles ───────────────────────────────────────

export const PLAN_STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-50 text-green-700 border-green-200",
  paused:    "bg-yellow-50 text-yellow-700 border-yellow-200",
  cancelled: "bg-gray-50 text-gray-400 border-gray-200",
};

// ─── Contact message status badge styles ──────────────────────────────────────

export const MESSAGE_STATUS_STYLES: Record<string, string> = {
  new:     "bg-blue-50 text-blue-700 border-blue-200",
  read:    "bg-gray-50 text-gray-500 border-gray-200",
  replied: "bg-green-50 text-green-700 border-green-200",
};

// ─── Reschedule request status badge styles ───────────────────────────────────

export const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

// ─── Recurring frequency labels ───────────────────────────────────────────────

export const FREQ_LABELS: Record<string, string> = {
  weekly:      "Every week",
  fortnightly: "Every 2 weeks",
  monthly:     "Every month",
};

export const FREQ_LABELS_SHORT: Record<string, string> = {
  weekly:      "Weekly",
  fortnightly: "Fortnightly",
  monthly:     "Monthly",
};

export {
  BOOKING_PROPERTY_TYPES,
  ACCESS_METHODS,
  CLEANING_SUPPLIES_OPTIONS,
  calculateRecommendedHours,
  DEFAULT_BOOKING_EXTRAS,
  DEFAULT_DURATION_MULTIPLIERS,
  MAX_ROOM_COUNTS,
  MIN_DURATION_HOURS,
  MAX_DURATION_HOURS,
  DURATION_STEP_HOURS,
  parseDurationMultipliers,
  parseBookingExtras,
  getHoursUntilBookingStart,
  isBookingStartTimePassed,
  isBookingEndTimePassed,
} from "../../shared/booking";
export type {
  BookingDurationMultipliers,
  BookingExtra,
} from "../../shared/booking";
