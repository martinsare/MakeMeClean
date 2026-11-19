import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Lock, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, isBookingStartTimePassed } from "@/lib/utils";
import { Booking } from "@/types";
import { flushPaymentConfirmations, queuePaymentConfirmation } from "@/lib/paymentConfirmations";

export default function PaymentPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);
  const [step, setStep] = useState<"form" | "processing" | "success" | "error">("form");
  const [message, setMessage] = useState("");
  const sessionId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session_id") : null;

  const isFutureBooking = (candidate: Booking | null) => {
    if (!candidate) return false;
    return !isBookingStartTimePassed(candidate.date, candidate.time_slot);
  };

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.bookingId) return;
    supabase
      .from("bookings")
      .select("id, service_name, date, time_slot, city, price, invoice_number, status, payment_status")
      .eq("id", params.bookingId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setBooking(data as Booking);
        setFetching(false);
      });
  }, [user, params.bookingId]);

  useEffect(() => {
    if (!booking || booking.payment_status === "paid") {
      return;
    }

    if (!sessionId) return;

    let cancelled = false;
    setStep("processing");
    setMessage("We're confirming your Stripe payment...");
    queuePaymentConfirmation(params.bookingId, sessionId);
    void flushPaymentConfirmations();

    const refresh = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, service_name, date, time_slot, city, price, invoice_number, status, payment_status")
        .eq("id", params.bookingId)
        .eq("user_id", user?.id ?? "")
        .single();

      if (cancelled || !data) return;
      setBooking(data as Booking);
      if ((data as Booking).payment_status === "paid") {
        setStep("success");
        return;
      }

      if (sessionId) {
        const { data: confirmData } = await supabase.functions.invoke("confirm-stripe-checkout", {
          body: { bookingId: params.bookingId, sessionId },
        });
        if (confirmData?.paid) {
          setBooking({ ...(data as Booking), payment_status: "paid" });
          setStep("success");
          void flushPaymentConfirmations();
        }
      }
    };

    refresh();
    const timer = setInterval(refresh, 2500);
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setMessage("Payment may have succeeded, but we could not confirm it automatically. Please check My Bookings or contact support.");
      setStep("error");
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [booking?.id, booking?.payment_status, sessionId, params.bookingId, user?.id]);

  const readFunctionError = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (typeof body?.error === "string") return body.error;
        if (typeof body?.message === "string") return body.message;
      } catch {
        try {
          const text = await error.context.text();
          if (text) return text;
        } catch {
          // ignore
        }
      }
    }
    return error instanceof Error ? error.message : "Failed to start payment";
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    if (!isFutureBooking(booking)) {
      setMessage("This booking date and time has already passed.");
      setStep("error");
      return;
    }

    setStep("processing");
    setMessage("Redirecting to Stripe Checkout...");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setMessage("Please sign in again before paying.");
      setStep("error");
      return;
    }

    const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
      body: { bookingId: booking.id, origin: window.location.origin },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      setMessage(await readFunctionError(error));
      setStep("error");
      return;
    }

    if (!data?.ok || !data?.url) {
      setMessage(data?.error ?? "Failed to start payment");
      setStep("error");
      return;
    }

    window.location.href = data.url;
  };

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
      <div>
        <p className="text-gray-500 font-medium mb-4">Booking not found.</p>
        <button onClick={() => setLocation("/bookings")} className="btn-primary">My Bookings</button>
      </div>
    </div>
  );

  if (booking.payment_status === "refunded" || booking.payment_status === "disputed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
            {booking.payment_status === "refunded" ? "This booking was refunded" : "This booking is under dispute"}
          </h1>
          <p className="text-gray-500 mb-6">
            {booking.payment_status === "refunded"
              ? "You do not need to pay for this booking again."
              : "Payment is on hold while the dispute is being resolved."}
          </p>
          <button onClick={() => setLocation(`/bookings/${booking.id}`)} className="btn-primary">Back to booking</button>
        </div>
      </div>
    );
  }

  // Check paid / success BEFORE checking expired/cancelled so paid past bookings never show "Booking Expired"
  if (booking.payment_status === "paid" || step === "success") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Payment Successful</h1>
        <p className="text-gray-500 mb-1">Your payment has been confirmed.</p>
        {booking.invoice_number && <p className="text-sm text-gray-400 mb-8">Invoice: {booking.invoice_number}</p>}
        <div className="card mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Service</span><span className="font-semibold">{booking.service_name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="font-semibold">{booking.date}</span></div>
          <hr className="border-gray-100" />
          <div className="flex justify-between"><span className="font-bold text-gray-900">Amount Paid</span><span className="font-bold text-green-600 text-lg">{formatCurrency(booking.price)}</span></div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => setLocation(`/invoice/${booking.id}`)} className="btn-secondary">Invoice</button>
          <button onClick={() => setLocation(`/bookings/${booking.id}`)} className="btn-primary">View Booking</button>
          <button onClick={() => setLocation("/dashboard")} className="btn-secondary">Dashboard</button>
        </div>
      </div>
    </div>
  );

  if (booking.status === "cancelled" || !isFutureBooking(booking)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
            Booking Expired
          </h1>
          <p className="text-gray-500 mb-6">
            The scheduled appointment time for this booking has passed, so payment is no longer accepted. Please reschedule or book a new clean.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setLocation(`/bookings/${booking.id}`)} className="btn-secondary">View Booking</button>
            <button onClick={() => setLocation("/book")} className="btn-primary">Book New Clean</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-500 mb-6">{message || "Something went wrong. Please try again."}</p>
        <button onClick={() => setStep("form")} className="btn-primary">Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => setLocation(`/bookings/${booking.id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to booking
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900">Secure Payment</h1>
          <p className="text-gray-500 mt-1">Complete your payment securely with Stripe Checkout.</p>
        </div>

        {/* Booking Summary */}
        <div className="card border-green-200 bg-green-50 mb-6">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">Booking Summary</p>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-gray-900">{booking.service_name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{formatDate(booking.date)} · {booking.time_slot}</p>
              <p className="text-sm text-gray-500">{booking.city}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-green-600">{formatCurrency(booking.price)}</div>
              {booking.invoice_number && <p className="text-xs text-gray-400 mt-0.5">{booking.invoice_number}</p>}
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-700">Stripe Checkout</span>
            <div className="ml-auto">
              <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">CARD</span>
            </div>
          </div>

          {step === "processing" ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-semibold text-gray-700">{message || "Processing payment..."}</p>
              <p className="text-sm text-gray-400 mt-1">Please do not close this page.</p>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-4">
              <div className="pt-2">
                <button
                  type="submit"
                  className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3.5"
                  data-testid="button-pay"
                >
                  <Lock className="w-4 h-4" />
                  Pay with Stripe - {formatCurrency(booking.price)}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5 pt-1">
                <Lock className="w-3 h-3" />
                Your payment is handled by Stripe on a secure hosted page
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
