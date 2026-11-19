import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Booking } from "@/types";
import { api } from "@/lib/apiClient";
import { calculateCancellationRefund } from "@/lib/services";
import { getHoursUntilBookingStart } from "@/lib/constants";

export default function BookingRefundRequest() {
  const { user, loading } = useAuth();
  const settings = useSettings();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.bookingId) return;
    supabase
      .from("bookings")
      .select("*")
      .eq("id", params.bookingId)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error: err }) => {
        if (!err) setBooking(data as Booking);
        setFetching(false);
      });
  }, [user, params.bookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !user || !reason.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      await api.requestRefund(booking.id, { reason: reason.trim() });
      setSuccess(true);
      setReason("");
      setTimeout(() => setLocation(`/bookings/${booking.id}`), 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to submit refund request");
    } finally {
      setSubmitting(false);
    }
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 font-semibold mb-4">Booking not found</p>
          <Link
            href="/bookings"
            className="text-green-600 hover:underline font-semibold"
          >
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  if ((booking.payment_status ?? "pending") !== "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Refunds are only available for paid bookings
          </h1>
          <p className="text-gray-600 mb-6">
            This booking has not been paid yet, or it has already been refunded
            or disputed.
          </p>
          <Link
            href={`/bookings/${booking.id}`}
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Back to Booking
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Booking
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          {success ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">
                Request Submitted
              </h2>
              <p className="text-gray-600 mb-6">
                We've received your refund request. Our team will review it and
                contact you within 3-5 business days.
              </p>
              <Link
                href="/bookings"
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                Back to Bookings
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Request a Refund
              </h1>
              <p className="text-gray-600 mb-8">
                Tell us why you'd like a refund and we'll review your request.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Service
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {booking.service_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Date
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(booking.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Amount
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(booking.price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Status
                    </p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">
                      {booking.status}
                    </p>
                  </div>
                </div>
              </div>

              {(() => {
                const lateHours = Number(settings.cancellation_late_hours) || 3;
                const lateRefundPercent = Number(settings.cancellation_late_refund_percent) || 75;
                const hoursUntil = getHoursUntilBookingStart(booking.date, booking.time_slot);
                const refundCalc = calculateCancellationRefund({
                  bookingPrice: Number(booking.price),
                  alreadyRefunded: Number(booking.refunded_amount || 0),
                  hoursUntilStart: hoursUntil,
                  lateWindowHours: lateHours,
                  lateRefundPercent: lateRefundPercent,
                });

                return (
                  <div
                    className={`p-4 rounded-2xl border mb-8 text-xs leading-relaxed ${
                      refundCalc.isLate
                        ? "bg-amber-50/90 border-amber-200 text-amber-950"
                        : "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <AlertCircle
                        className={`w-4 h-4 shrink-0 ${
                          refundCalc.isLate ? "text-amber-600" : "text-emerald-600"
                        }`}
                      />
                      <span>
                        {refundCalc.isLate
                          ? `Late Cancellation Notice (${refundCalc.refundPercent}% Refund)`
                          : `Eligible for Full Refund (${refundCalc.refundPercent}%)`}
                      </span>
                    </div>
                    <p className="mt-1">
                      {refundCalc.isLate ? (
                        <>
                          This clean is scheduled to start in{" "}
                          <strong>
                            {Math.max(0, refundCalc.hoursUntilStart || 0).toFixed(1)} hours
                          </strong>{" "}
                          (within our {lateHours}-hour cancellation window). Per our cancellation policy, you are eligible for a{" "}
                          <strong>
                            {refundCalc.refundPercent}% refund ({formatCurrency(refundCalc.eligibleAmount)})
                          </strong>
                          . A {refundCalc.feePercent}% late fee applies to cover reserved cleaner time.
                        </>
                      ) : (
                        <>
                          This appointment is scheduled more than {lateHours} hours in advance. You are eligible for a{" "}
                          <strong>
                            100% full refund ({formatCurrency(refundCalc.eligibleAmount)})
                          </strong>{" "}
                          upon cancellation review.
                        </>
                      )}
                    </p>
                  </div>
                );
              })()}

              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Reason for Refund
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please explain why you're requesting a refund..."
                    rows={5}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {error && (
                  <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-center"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting || !reason.trim()}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
