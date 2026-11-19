import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Hand,
  CheckCircle2,
  CalendarCheck,
  Home,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { UK_NLW_2026 } from "@/lib/payroll";
import { getServiceBookingConfig } from "@/lib/serviceBookingConfigs";

interface OpenShift {
  id: string;
  booking_id: string;
  service_name: string;
  city: string;
  outward_postcode: string;
  date: string;
  time_slot: string;
  pay_amount: number;
  hourly_rate: number;
  estimated_hours: number;
  bedrooms?: number;
  bathrooms?: number;
  living_rooms?: number;
  property_type?: string;
  extras?: string[];
  already_applied?: boolean;
}

export default function StaffShiftMarketplace({
  staffId,
  onClaimed,
}: {
  staffId: string;
  onClaimed?: () => void;
}) {
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [modalShift, setModalShift] = useState<OpenShift | null>(null);
  const [noteText, setNoteText] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchOpenShifts = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // Fetch redacted open paid shifts via SECURITY DEFINER RPC (active staff only — no street addresses/lockbox notes)
      const [
        { data: openRows, error: shiftsErr },
        { data: myApps },
      ] = await Promise.all([
        supabase.rpc("get_open_marketplace_shifts"),
        supabase
          .from("shift_applications")
          .select("booking_id")
          .eq("cleaner_id", staffId),
      ]);

      if (shiftsErr) {
        setShifts([]);
        return;
      }

      const appliedIds = new Set((myApps || []).map((a: any) => a.booking_id));

      setShifts(
        ((openRows as any[]) || []).map((b: any) => {
          const hours = Number(b.duration_hours || 2);
          const hourlyRate = Number(b.hourly_rate) || UK_NLW_2026;
          return {
            id: `shift_${b.id}`,
            booking_id: b.id,
            service_name: b.service_name || "Cleaning Service",
            city: b.city || "Wales",
            outward_postcode: String(b.outward_postcode || "").trim(),
            date: b.date,
            time_slot: b.time_slot || "09:00 - 11:00",
            hourly_rate: hourlyRate,
            pay_amount: Math.round(hourlyRate * hours * 100) / 100,
            estimated_hours: hours,
            bedrooms: b.bedrooms ?? 1,
            bathrooms: b.bathrooms ?? 1,
            living_rooms: b.living_rooms ?? 1,
            property_type: b.property_type || "House/Flat",
            extras: Array.isArray(b.extras) ? b.extras : [],
            already_applied: appliedIds.has(b.id),
          };
        })
      );
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenShifts();
  }, [staffId]);

  const handleClaim = async () => {
    if (!modalShift) return;
    setClaimingId(modalShift.id);
    setErrorMsg("");

    try {
      const { error } = await supabase.from("shift_applications").insert({
        shift_id: modalShift.id,
        booking_id: modalShift.booking_id,
        cleaner_id: staffId,
        status: "pending",
        cleaner_notes: noteText.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          setErrorMsg("You have already applied for this shift.");
        } else {
          setErrorMsg(error.message || "Failed to apply for shift. Please try again.");
        }
        return;
      }

      setSuccessMsg("Application submitted! Awaiting admin assignment confirmation.");
      setNoteText("");
      setTimeout(() => {
        setSuccessMsg("");
        setModalShift(null);
        fetchOpenShifts();
        if (onClaimed) onClaimed();
      }, 1600);
    } catch {
      setErrorMsg("Failed to apply for shift. Please try again.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-green-800 to-green-600 rounded-3xl p-6 text-white flex items-center justify-between shadow-lg">
        <div>
          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Cleaner Marketplace
          </span>
          <h2 className="text-xl font-black mt-2">Available Customer Cleans</h2>
          <p className="text-xs text-green-100 max-w-md mt-1">
            Apply for open, paid shifts in your area. Full address and entry instructions are shared once an admin confirms your assignment.
          </p>
        </div>
        <div className="hidden sm:flex w-12 h-12 bg-white/10 rounded-2xl items-center justify-center">
          <CalendarCheck className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading open shifts…</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-gray-900">
            No Open Shifts Right Now
          </p>
          <p className="text-xs text-gray-400 mt-1">
            All upcoming paid customer cleans are currently assigned. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-green-200 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2.5 py-0.5 rounded-md">
                      {s.city}
                    </span>
                    <h3 className="text-base font-black text-gray-900 mt-1.5">
                      {s.service_name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-green-600">
                      {formatCurrency(s.pay_amount)}
                    </p>
                    <p className="text-xs text-gray-400 font-medium">
                      Est. Pay ({formatCurrency(s.hourly_rate)}/hr)
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{formatDate(s.date)}</span>
                    <span className="text-gray-300">•</span>
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>
                      {s.time_slot} ({s.estimated_hours} hrs)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>
                      {s.city}
                      {s.outward_postcode ? ` (${s.outward_postcode} area)` : ""} — Full address revealed on assignment
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    <Home className="w-4 h-4 text-green-600" />
                    <span>
                      {getServiceBookingConfig(s.service_name).formatLayout(
                        s.bedrooms,
                        s.bathrooms,
                        s.living_rooms,
                        s.property_type
                      )}
                    </span>
                  </div>
                  {s.extras && s.extras.length > 0 && (
                    <div className="flex items-start gap-2 text-green-800 bg-green-50/80 p-1.5 rounded-lg border border-green-100 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span>Add-ons: {s.extras.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setErrorMsg("");
                  setSuccessMsg("");
                  setModalShift(s);
                }}
                disabled={s.already_applied}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-500 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:cursor-not-allowed"
              >
                <Hand className="w-4 h-4" />
                {s.already_applied ? "Application Pending" : "Apply for This Shift"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Claim Modal */}
      {modalShift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                <Hand className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Apply for Shift Slot
                </h3>
                <p className="text-xs text-gray-500">
                  {modalShift.service_name}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs text-gray-700 mb-4">
              <p>
                <strong>Area:</strong> {modalShift.city}
                {modalShift.outward_postcode ? ` (${modalShift.outward_postcode})` : ""}
              </p>
              <p>
                <strong>Schedule:</strong> {formatDate(modalShift.date)} at{" "}
                {modalShift.time_slot}
              </p>
              <p>
                <strong>Scope:</strong>{" "}
                {getServiceBookingConfig(modalShift.service_name).formatLayout(
                  modalShift.bedrooms,
                  modalShift.bathrooms,
                  modalShift.living_rooms,
                  modalShift.property_type
                )}
              </p>
              {modalShift.extras && modalShift.extras.length > 0 && (
                <p className="text-green-800 font-semibold">
                  <strong>Add-ons:</strong> {modalShift.extras.join(", ")}
                </p>
              )}
              <p className="text-green-700 font-bold text-sm">
                <strong>Est. Pay:</strong> {formatCurrency(modalShift.pay_amount)} (
                {modalShift.estimated_hours} hrs @ {formatCurrency(modalShift.hourly_rate)}/hr)
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Optional note to admin:
              </label>
              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. I live nearby and am ready to start promptly."
                className="w-full text-xs border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                {successMsg}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setModalShift(null)}
                disabled={!!claimingId}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClaim}
                disabled={!!claimingId}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {claimingId ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Confirm Application"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
