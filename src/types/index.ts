// ─── Booking ─────────────────────────────────────────────────────────────────

export interface Booking {
  id: string;
  service_name: string;
  service_type: string;
  date: string;
  time_slot: string;
  address?: string;
  city: string;
  postcode?: string;
  status: string;
  payment_status?: string | null;
  price: number;
  notes?: string | null;
  invoice_number?: string | null;
  refunded_amount?: number | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  created_at: string;
  user_id?: string;
  recurring_freq?: string | null;
  recurring_plan_id?: string | null;
  profiles?: { full_name: string | null; phone: string | null } | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  living_rooms?: number | null;
  extras?: string[] | null;
  property_type?: string | null;
  duration_hours?: number | null;
  access_method?: string | null;
  supplies_option?: string | null;
  parking_option?: string | null;
  has_pets?: boolean | null;
}

// ─── Applications ─────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "shortlisted"
  | "rejected"
  | "hired";

export interface JobApplication {
  id: string;
  role: string;
  employment_type: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  available_days?: string[] | null;
  available_hours?: string | null;
  earliest_start?: string | null;
  rtw_eligible?: string | null;
  rtw_type?: string | null;
  ni_number?: string | null;
  years_experience?: string | null;
  experience_types?: string[] | null;
  own_equipment?: string | null;
  driving_licence?: string | null;
  cv_url?: string | null;
  id_proof_url?: string | null;
  rtw_doc_url?: string | null;
  dbs_cert_url?: string | null;
  [key: string]: unknown;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

export interface StaffRecord {
  id: string;
  user_id: string | null;
  application_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  role: string | null;
  active: boolean | null;
  created_at: string;
  _city: string | null;
  _postcode: string | null;
  _phone: string | null;
}

// ─── Payslip ──────────────────────────────────────────────────────────────────

export interface Payslip {
  id: string;
  staff_id: string;
  period_start: string;
  period_end: string;
  shifts_count: number;
  gross_hours: number;
  gross_pay: number;
  tax_code: string;
  paye_tax: number;
  ni_employee: number;
  ni_employer: number;
  net_pay: number;
  notes?: string | null;
  status: "draft" | "finalised";
  generated_at: string;
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

export interface PayrollSettings {
  pay_period: "weekly" | "monthly";
  hourly_rate: number;
  default_tax_code: string;
  ni_category: string;
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

export interface RescheduleRequest {
  id: string;
  booking_id: string;
  user_id: string;
  requested_date: string;
  requested_time: string;
  reason?: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note?: string | null;
  created_at: string;
  bookings?: {
    service_name: string;
    date: string;
    time_slot: string;
    address: string;
    city: string;
    postcode: string;
    profiles: { full_name: string | null; phone: string | null } | null;
  } | null;
}

// ─── Recurring Plans ──────────────────────────────────────────────────────────

export interface RecurringPlan {
  id: string;
  user_id?: string;
  service_name: string;
  service_type?: string;
  frequency: "weekly" | "fortnightly" | "monthly";
  start_time: string;
  duration_hours: number;
  address?: string;
  city: string;
  postcode?: string;
  price_per_visit: number;
  discount_percent: number;
  notes?: string | null;
  status: "active" | "paused" | "cancelled";
  created_at: string;
  next_booking_date?: string | null;
  last_booked_at?: string | null;
  last_booking_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
  failure_count?: number | null;
  last_failure_reason?: string | null;
  profiles?: { full_name: string | null; email?: string | null } | null;
}

// ─── Contact Messages ─────────────────────────────────────────────────────────

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string | null;
  created_at: string;
  replied_at?: string | null;
  admin_reply?: string | null;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  created_at?: string;
}
