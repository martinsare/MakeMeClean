import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  Star,
  CheckCircle2,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate, cn } from "@/lib/utils";
import { Booking } from "@/types";

function StarRow({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm font-medium text-gray-700 min-w-0">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={cn(
                "w-7 h-7 transition-colors",
                n <= (hovered || value)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-gray-200"
              )}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-1.5 text-xs font-semibold text-gray-400 w-5">
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
}

const LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Okay",
  4: "Good",
  5: "Excellent",
};

export default function ReviewPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [overall, setOverall] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [quality, setQuality] = useState(0);
  const [friendliness, setFriendliness] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.bookingId) return;
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, service_name, date, status")
          .eq("id", params.bookingId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", params.bookingId)
          .maybeSingle(),
      ]);
      setBooking((b as Booking) ?? null);
      setAlreadyReviewed(!!r);
      setFetching(false);
    })();
  }, [user, params.bookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !booking) return;
    if (overall === 0) {
      setError("Please give an overall rating.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.from("reviews").insert({
      booking_id: booking.id,
      user_id: user.id,
      overall_rating: overall,
      punctuality: punctuality || null,
      quality: quality || null,
      friendliness: friendliness || null,
      value_for_money: valueForMoney || null,
      would_recommend: recommend,
      comments: comments.trim() || null,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking || booking.status !== "completed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <p className="text-gray-500 text-lg font-medium mb-4">
            {!booking
              ? "Booking not found."
              : "Reviews are only available for completed bookings."}
          </p>
          <Link href="/bookings" className="btn-primary">
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  if (alreadyReviewed || submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
            {submitted
              ? "Thank you for your feedback!"
              : "Review already submitted"}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {submitted
              ? "Your review helps us keep improving our service."
              : "You've already left a review for this booking."}
          </p>
          {overall > 0 && submitted && (
            <div className="flex justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "w-6 h-6",
                    n <= overall
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-gray-200"
                  )}
                />
              ))}
            </div>
          )}
          <Link href="/bookings" className="btn-primary">
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <Link
          href={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to booking
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">
            How did we do?
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {booking.service_name} · {formatDate(booking.date)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Overall rating — prominent */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 text-center">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Overall satisfaction
            </p>
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOverall(n)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "w-10 h-10 transition-colors",
                      n <= overall
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-gray-200"
                    )}
                  />
                </button>
              ))}
            </div>
            {overall > 0 && (
              <p className="text-sm font-semibold text-amber-600 mt-1">
                {LABELS[overall]}
              </p>
            )}
          </div>

          {/* Category ratings */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-3 pb-1">
              Rate each area
            </p>
            <StarRow
              label="Punctuality"
              value={punctuality}
              onChange={setPunctuality}
            />
            <StarRow
              label="Quality of clean"
              value={quality}
              onChange={setQuality}
            />
            <StarRow
              label="Staff friendliness"
              value={friendliness}
              onChange={setFriendliness}
            />
            <StarRow
              label="Value for money"
              value={valueForMoney}
              onChange={setValueForMoney}
            />
          </div>

          {/* Recommend */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Would you recommend us to a friend?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRecommend(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all",
                  recommend === true
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                <ThumbsUp className="w-4 h-4" /> Yes, definitely
              </button>
              <button
                type="button"
                onClick={() => setRecommend(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all",
                  recommend === false
                    ? "border-red-400 bg-red-50 text-red-600"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                <ThumbsDown className="w-4 h-4" /> Not really
              </button>
            </div>
          </div>

          {/* Cleaner Tip (Wecasa Standard) */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                Leave an optional tip for your cleaner?
              </label>
              <span className="text-xs text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                100% goes to cleaner
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Reward great service. Tips are added directly to your cleaner's
              verified payout.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[2, 3, 5, 10].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setTipAmount(tipAmount === amt ? null : amt);
                    setCustomTip("");
                  }}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-bold border transition-all",
                    tipAmount === amt
                      ? "border-green-600 bg-green-50 text-green-700 ring-1 ring-green-600"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  )}
                >
                  +£{amt}
                </button>
              ))}
            </div>
            {tipAmount !== null && (
              <p className="text-xs text-green-700 font-bold animate-fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Thank you! £
                {tipAmount.toFixed(2)} tip will be rewarded to your cleaner.
              </p>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Any comments?{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Tell us what we did well or what we could improve…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || overall === 0}
            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
