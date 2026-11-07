import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Download,
  AlertTriangle,
  CreditCard,
  CheckCircle,
  XCircle,
  Star,
  Receipt,
  RefreshCw,
  Image as ImageIcon,
  DollarSign,
  Home,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  cn,
  formatDate,
  formatCurrency,
  sanitizeCleanNotes,
} from "@/lib/utils";
import { START_HOURS } from "@/lib/services";
import { Booking, RescheduleRequest } from "@/types";
import {
  BOOKING_STATUS_STYLES,
  isBookingStartTimePassed,
} from "@/lib/constants";
import { api } from "@/lib/apiClient";
import { getServiceBookingConfig } from "@/lib/serviceBookingConfigs";

const STATUS_STYLES = BOOKING_STATUS_STYLES;

function canCancelBooking(booking: Booking): {
  allowed: boolean;
  reason?: string;
} {
  if (booking.status !== "upcoming")
    return { allowed: false, reason: "Booking is not upcoming." };
  const startHour = booking.time_slot.split("–")[0].trim().split(" ")[0].trim();
  const bookingDateTime = new Date(`${booking.date}T${startHour}:00`);
  const hoursUntil =
    (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil <= 3) {
    return {
      allowed: false,
      reason: `Cancellations must be made at least 3 hours before the booking. Yours starts at ${startHour} on ${booking.date}.`,
    };
  }
  return { allowed: true };
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-green-600" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <div className="text-sm font-semibold text-gray-900 mt-0.5">
          {value}
        </div>
      </div>
    </div>
  );
}

const minDate = new Date();
minDate.setDate(minDate.getDate() + 1);
const minDateStr = minDate.toISOString().split("T")[0];

export default function BookingDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [serviceImage, setServiceImage] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasReview, setHasReview] = useState(false);

  // Reschedule state
  const [existingRequest, setExistingRequest] =
    useState<RescheduleRequest | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.id) return;
    Promise.all([
      api.getBooking(params.id),
      supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", params.id)
        .maybeSingle(),
    ])
      .then(([bk, { data: r }]) => {
        setBooking(bk as Booking | null);
        setHasReview(!!r);
        if (bk?.active_reschedule) {
          setExistingRequest({
            id: bk.active_reschedule.id,
            booking_id: bk.id,
            user_id: user.id,
            created_at: bk.active_reschedule.created_at,
            requested_date: bk.active_reschedule.requested_date,
            requested_time: bk.active_reschedule.requested_time_slot,
            status: bk.active_reschedule.status,
          });
        }
        if (bk?.service_type) {
          supabase
            .from("services")
            .select("image_url")
            .eq("id", bk.service_type)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.image_url) setServiceImage(data.image_url);
            });
        }
        setFetching(false);
      })
      .catch(() => {
        setFetching(false);
      });
  }, [user, params.id]);

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await api.cancelBooking(booking.id);
      setBooking({ ...booking, status: "cancelled" });
    } catch (_) {}
    setCancelling(false);
    setShowConfirm(false);
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !user) return;
    setRescheduling(true);
    try {
      const res = await api.requestReschedule(booking.id, {
        requestedDate: rescheduleDate,
        requestedTime: rescheduleTime,
        reason: rescheduleReason,
      });
      setExistingRequest({
        id: res?.id || "",
        booking_id: booking.id,
        user_id: user.id,
        created_at: new Date().toISOString(),
        requested_date: rescheduleDate,
        requested_time: rescheduleTime,
        status: "pending",
      });
      setShowReschedule(false);
    } catch (_) {}
    setRescheduling(false);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <div>
          <p className="text-gray-500 font-semibold mb-4">Booking not found.</p>
          <Link href="/bookings" className="btn-primary">
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = booking.payment_status === "paid";
  const isExpiredUnpaid =
    !isPaid && isBookingStartTimePassed(booking.date, booking.time_slot);
  const effectiveStatus =
    isExpiredUnpaid && booking.status === "upcoming"
      ? "cancelled"
      : booking.status;
  const paymentLabel =
    booking.payment_status === "paid"
      ? "Paid"
      : isExpiredUnpaid
      ? "Payment expired"
      : booking.payment_status === "refunded"
      ? "Refunded"
      : booking.payment_status === "disputed"
      ? "Disputed"
      : "Payment pending";
  const paymentClass =
    booking.payment_status === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : isExpiredUnpaid
      ? "bg-red-100 text-red-700"
      : booking.payment_status === "refunded"
      ? "bg-slate-100 text-slate-600"
      : booking.payment_status === "disputed"
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-700";
  const cancelCheck = canCancelBooking({ ...booking, status: effectiveStatus });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Back */}
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to bookings
        </Link>

        {/* Hero card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">
          {serviceImage && (
            <div className="h-32 w-full overflow-hidden">
              <img
                src={serviceImage}
                alt={booking.service_name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                {!serviceImage && (
                  <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center shrink-0 text-2xl">
                    🧹
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-gray-900 tracking-tight">
                    {booking.service_name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {(effectiveStatus !== "upcoming" || isPaid) && (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full",
                          STATUS_STYLES[effectiveStatus] ??
                            "bg-gray-100 text-gray-600"
                        )}
                      >
                        {effectiveStatus.charAt(0).toUpperCase() +
                          effectiveStatus.slice(1)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full",
                        paymentClass
                      )}
                    >
                      {paymentLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  Amount
                </p>
                <p className="text-2xl font-black text-green-600">
                  {formatCurrency(booking.price)}
                </p>
              </div>
            </div>

            <div className="h-px bg-gray-100 my-5" />

            <div className="grid sm:grid-cols-2 gap-4">
              <InfoRow
                icon={Calendar}
                label="Date"
                value={formatDate(booking.date)}
              />
              <InfoRow icon={Clock} label="Time" value={booking.time_slot} />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={
                  <span>
                    {booking.address}
                    <br />
                    {booking.city}, {booking.postcode}
                  </span>
                }
              />
              {(booking.bedrooms != null ||
                booking.bathrooms != null ||
                booking.living_rooms != null) && (
                <InfoRow
                  icon={Home}
                  label={
                    getServiceBookingConfig(
                      booking.service_type || booking.service_name
                    ).propertyTypeLabel
                  }
                  value={getServiceBookingConfig(
                    booking.service_type || booking.service_name
                  ).formatLayout(
                    booking.bedrooms,
                    booking.bathrooms,
                    booking.living_rooms,
                    booking.property_type
                  )}
                />
              )}
              {Array.isArray(booking.extras) && booking.extras.length > 0 && (
                <InfoRow
                  icon={CheckCircle}
                  label="Specialist Extras"
                  value={booking.extras.join(", ")}
                />
              )}
              {sanitizeCleanNotes(booking.notes) && (
                <InfoRow
                  icon={FileText}
                  label="Special Instructions"
                  value={sanitizeCleanNotes(booking.notes)}
                />
              )}
            </div>

            {booking.invoice_number && (
              <p className="text-xs text-gray-400 mt-4">
                Invoice:{" "}
                <span className="font-semibold text-gray-600">
                  {booking.invoice_number}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Expired Unpaid Alert */}
        {isExpiredUnpaid && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-red-900 text-sm">
                  Booking expired & cancelled
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  The scheduled booking time has passed and payment was not
                  completed. Payment is closed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/book"
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                Book New Clean
              </Link>
            </div>
          </div>
        )}

        {/* Payment pending alert */}
        {!isExpiredUnpaid &&
          booking.status === "upcoming" &&
          !isPaid &&
          booking.payment_status !== "refunded" &&
          booking.payment_status !== "disputed" && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-900 text-sm">
                    Payment pending
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Complete your payment to confirm this booking.
                  </p>
                </div>
              </div>
              <Link
                href={`/pay/${booking.id}`}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shrink-0"
              >
                Pay {formatCurrency(booking.price)}
              </Link>
            </div>
          )}

        {/* Payment confirmed */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-800">
              Payment confirmed — {formatCurrency(booking.price)}
            </p>
          </div>
        )}

        {/* Invoice */}
        {booking.invoice_number && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Invoice</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {booking.invoice_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLocation(`/invoice/${booking.id}`)}
                className="flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:underline shrink-0"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <div className="h-px bg-gray-100 my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Service</span>
                <span className="font-semibold text-gray-900">
                  {booking.service_name}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Date</span>
                <span className="font-semibold text-gray-900">
                  {formatDate(booking.date)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Time</span>
                <span className="font-semibold text-gray-900">
                  {booking.time_slot}
                </span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-black text-green-600 text-base">
                  {formatCurrency(booking.price)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Photo upload (completed only) */}
        {booking.status === "completed" && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-bold text-purple-900 text-sm">
                  Share your photos
                </p>
                <p className="text-xs text-purple-700 mt-0.5">
                  Show us your clean home and help us build trust with future
                  customers.
                </p>
              </div>
            </div>
            <Link
              href={`/bookings/${booking.id}/photos`}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shrink-0"
            >
              Upload Photos
            </Link>
          </div>
        )}

        {/* Review card */}
        {booking.status === "completed" && (
          <div
            className={cn(
              "rounded-2xl border p-5 mb-4 flex items-center justify-between gap-4 flex-wrap",
              hasReview
                ? "bg-amber-50 border-amber-200"
                : "bg-green-50 border-green-200"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  hasReview ? "bg-amber-100" : "bg-green-100"
                )}
              >
                <Star
                  className={cn(
                    "w-5 h-5",
                    hasReview
                      ? "fill-amber-400 text-amber-400"
                      : "text-green-600"
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    "font-bold text-sm",
                    hasReview ? "text-amber-900" : "text-green-900"
                  )}
                >
                  {hasReview ? "Review submitted" : "How did we do?"}
                </p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    hasReview ? "text-amber-700" : "text-green-700"
                  )}
                >
                  {hasReview
                    ? "Thank you for your feedback."
                    : "Share your experience — it takes less than a minute."}
                </p>
              </div>
            </div>
            {!hasReview && (
              <Link
                href={`/review/${booking.id}`}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shrink-0"
              >
                Leave a Review
              </Link>
            )}
          </div>
        )}

        {/* Refund request */}
        {isPaid &&
          (booking.status === "upcoming" || booking.status === "completed") && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-blue-900 text-sm">
                    Need a refund?
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Submit a refund request and we'll review it promptly.
                  </p>
                </div>
              </div>
              <Link
                href={`/bookings/${booking.id}/refund`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shrink-0"
              >
                Request Refund
              </Link>
            </div>
          )}

        {/* Cancel section */}
        {!isExpiredUnpaid &&
          booking.status === "upcoming" &&
          (!cancelCheck.allowed ? (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm text-gray-500 shadow-sm mb-3">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-gray-300" />
              <span>
                {cancelCheck.reason ?? "This booking cannot be cancelled."}
              </span>
            </div>
          ) : !showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full border border-red-200 text-red-500 font-semibold py-3 rounded-2xl hover:bg-red-50 transition-colors text-sm mb-3"
            >
              Cancel Booking
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-3">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-red-800 text-sm">
                    Cancel this booking?
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 border border-gray-200 bg-white text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {cancelling ? "Cancelling…" : "Yes, Cancel"}
                </button>
              </div>
            </div>
          ))}

        {/* ── Reschedule section ── */}
        {booking.status === "upcoming" &&
          (existingRequest?.status === "pending" ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-blue-900 text-sm">
                    Reschedule requested
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    New date: {formatDate(existingRequest.requested_date)} at{" "}
                    {existingRequest.requested_time}
                  </p>
                  <p className="text-xs text-blue-400 mt-0.5">
                    Awaiting admin confirmation.
                  </p>
                </div>
              </div>
            </div>
          ) : existingRequest?.status === "approved" ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900 text-sm">
                    Reschedule approved
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Your booking date and time have been updated.
                  </p>
                </div>
              </div>
            </div>
          ) : !showReschedule ? (
            <button
              onClick={() => setShowReschedule(true)}
              className="w-full border border-blue-200 text-blue-600 font-semibold py-3 rounded-2xl hover:bg-blue-50 transition-colors text-sm"
            >
              Request to Reschedule
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <form onSubmit={handleReschedule} className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-blue-900 text-sm">
                      Request a new time
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      We'll confirm your new slot as soon as possible.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      New date
                    </label>
                    <input
                      type="date"
                      required
                      min={minDateStr}
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      New start time
                    </label>
                    <select
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {START_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="e.g. Work commitment changed"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReschedule(false)}
                    className="flex-1 border border-gray-200 bg-white text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rescheduling}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {rescheduling ? "Sending…" : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          ))}
      </div>
    </div>
  );
}
