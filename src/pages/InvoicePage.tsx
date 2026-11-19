import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { Booking } from "@/types";

function parseHoursFromTimeSlot(timeSlot: string | null | undefined) {
  const matches = timeSlot?.match(/\b(\d{2}):(\d{2})\b/g) ?? [];
  if (matches.length < 2) return 1;

  const start = matches[0];
  const end = matches[1];
  if (!start || !end) return 1;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return minutes > 0 ? minutes / 60 : 1;
}

function formatQty(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export default function InvoicePage() {
  const settings = useSettings();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.bookingId) return;
    supabase
      .from("bookings")
      .select("id, service_name, date, time_slot, address, city, postcode, price, invoice_number, payment_status, created_at")
      .eq("id", params.bookingId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setBooking(data as Booking);
        setFetching(false);
      });
  }, [user, params.bookingId]);

  const issuedOn = useMemo(() => {
    if (!booking?.created_at) return new Date().toISOString().slice(0, 10);
    return booking.created_at.slice(0, 10);
  }, [booking?.created_at]);

  const paymentStatus = booking?.payment_status ?? "pending";
  const paymentLabel =
    paymentStatus === "paid" ? "Paid" :
    paymentStatus === "refunded" ? "Refunded" :
    paymentStatus === "disputed" ? "Disputed" :
    "Pending";
  const quantity = parseHoursFromTimeSlot(booking?.time_slot);
  const vatRegistered = settings.vat_registered === "true";
  const grossPrice = Number(booking?.price ?? 0);
  const netPrice = vatRegistered ? Math.round((grossPrice / 1.2) * 100) / 100 : grossPrice;
  const vatAmount = vatRegistered ? Math.round((grossPrice - netPrice) * 100) / 100 : 0;
  const companyLegalName = settings.company_legal_name?.trim() || "MakeMeClean Ltd";
  const companyRegNumber = settings.company_reg_number?.trim() || "";
  const companyAddress = settings.company_registered_address?.trim() || "Wales, United Kingdom";
  const vatNumber = settings.vat_number?.trim() || "";

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <div>
          <p className="text-gray-500 font-medium mb-4">Invoice not found.</p>
          <button onClick={() => setLocation("/bookings")} className="btn-primary">My Bookings</button>
        </div>
      </div>
    );
  }

  const downloadPdf = async () => {
    if (!invoiceRef.current || downloading) return;
    setDownloading(true);
    try {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <button onClick={() => setLocation(`/bookings/${booking.id}`)} className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={downloadPdf} disabled={downloading} className="btn-primary inline-flex items-center gap-2">
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Download className="w-4 h-4" /> Download PDF</>}
            </button>
          </div>
        </div>

        <div ref={invoiceRef} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-8 py-8 border-b border-gray-100">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  {vatRegistered ? "VAT Invoice" : "Invoice"}
                </p>
                <h1 className="text-3xl font-black text-gray-900 mt-2">{companyLegalName}</h1>
                <p className="text-xs text-gray-500 mt-1">{companyAddress}</p>
                {companyRegNumber && (
                  <p className="text-xs text-gray-500">Company Reg. No: {companyRegNumber}</p>
                )}
                {vatRegistered && vatNumber && (
                  <p className="text-xs text-gray-500">VAT Reg. No: {vatNumber}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">{settings.email_payment || "payment@makemeclean.co.uk"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Invoice number</p>
                <p className="text-lg font-extrabold text-gray-900">{booking.invoice_number ?? booking.id}</p>
                <p className="text-sm text-gray-500 mt-2">Issued on</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(issuedOn)}</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <div className="grid sm:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Billed To</p>
                <p className="font-bold text-gray-900">{user?.email}</p>
                <p className="text-sm text-gray-500 mt-2">{booking.address}</p>
                <p className="text-sm text-gray-500">{booking.city}</p>
                <p className="text-sm text-gray-500">{booking.postcode}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Service Details</p>
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex justify-between gap-4">
                    <span>Service</span>
                    <span className="font-semibold text-gray-900">{booking.service_name}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Date</span>
                    <span className="font-semibold text-gray-900">{formatDate(booking.date)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Time</span>
                    <span className="font-semibold text-gray-900">{booking.time_slot}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Status</span>
                    <span className="font-semibold text-gray-900">
                      {paymentLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-500 px-5 py-3">
                <div className="col-span-7">Description</div>
                <div className="col-span-2 text-right">Qty (hrs)</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>
              <div className="grid grid-cols-12 px-5 py-4 text-sm">
                <div className="col-span-7">
                  <p className="font-semibold text-gray-900">{booking.service_name}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(booking.date)} · {booking.time_slot}</p>
                </div>
                <div className="col-span-2 text-right text-gray-700">{formatQty(quantity)}</div>
                <div className="col-span-3 text-right font-semibold text-gray-900">{formatCurrency(grossPrice)}</div>
              </div>
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal {vatRegistered ? "(Excl. VAT)" : ""}</span>
                      <span>{formatCurrency(netPrice)}</span>
                    </div>
                    {vatRegistered ? (
                      <div className="flex justify-between text-gray-600">
                        <span>VAT (20%)</span>
                        <span>{formatCurrency(vatAmount)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-gray-500 text-xs">
                        <span>VAT</span>
                        <span>Not VAT registered (£0.00)</span>
                      </div>
                    )}
                    <div className="h-px bg-gray-100 my-2" />
                    <div className="flex justify-between text-gray-900 font-extrabold text-base">
                      <span>Total</span>
                      <span>{formatCurrency(grossPrice)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 mb-1">Notes</p>
              <p>Thank you for choosing {companyLegalName}. For questions about this invoice, contact {settings.email_payment || "payment@makemeclean.co.uk"}.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
