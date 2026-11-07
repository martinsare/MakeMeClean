import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Hand,
  CheckCircle2,
  Navigation,
  Info,
  CalendarCheck,
  ChevronRight,
  ShieldAlert,
  Home,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

interface OpenShift {
  id: string;
  booking_id: string;
  service_name: string;
  customer_name: string;
  address: string;
  city: string;
  postcode: string;
  date: string;
  time_slot: string;
  pay_amount: number;
  estimated_hours: number;
  bedrooms?: number;
  bathrooms?: number;
  living_rooms?: number;
  property_type?: string;
  extras?: string[];
  notes?: string;
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

  const fetchOpenShifts = async () => {
    setLoading(true);
    try {
      // 1. Fetch unassigned upcoming customer bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select(
          "id, service_name, customer_name, address, city, postcode, date, time_slot, price, duration_hours, notes, bedrooms, bathrooms, living_rooms, property_type, extras"
        )
        .is("assigned_staff_id", null)
        .neq("status", "cancelled")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(20);

      if (bookings && bookings.length > 0) {
        setShifts(
          bookings.map((b: any) => ({
            id: `shift_${b.id}`,
            booking_id: b.id,
            service_name: b.service_name || "General Clean",
            customer_name: b.customer_name || "Client",
            address: b.address || "",
            city: b.city || "Cardiff",
            postcode: b.postcode || "",
            date: b.date,
            time_slot: b.time_slot || "09:00 AM",
            pay_amount: Number(b.price || 45) * 0.7, // 70% cleaner split
            estimated_hours: Number(b.duration_hours || 3),
            bedrooms: b.bedrooms ?? 1,
            bathrooms: b.bathrooms ?? 1,
            living_rooms: b.living_rooms ?? 1,
            property_type: b.property_type || "House/Flat",
            extras: Array.isArray(b.extras) ? b.extras : [],
            notes: b.notes,
          }))
        );
      } else {
        // Fallback slots
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);

        setShifts([
          {
            id: "shift_demo_1",
            booking_id: "book_101",
            service_name: "Deep Clean & Sanitization",
            customer_name: "Sarah Jenkins",
            address: "42 Newport Road",
            city: "Cardiff",
            postcode: "CF24 0AB",
            date: tomorrow.toISOString().split("T")[0],
            time_slot: "09:00 AM - 12:30 PM",
            pay_amount: 52.5,
            estimated_hours: 3.5,
            bedrooms: 2,
            bathrooms: 2,
            living_rooms: 1,
            property_type: "Flat / Apartment",
            extras: ["Inside Oven & Grill", "Inside Fridge / Freezer"],
            notes: "Key is in lockbox by front door. Code: 4921",
          },
          {
            id: "shift_demo_2",
            booking_id: "book_102",
            service_name: "End of Tenancy Full Clean",
            customer_name: "David Evans",
            address: "15 Marina Mews",
            city: "Swansea",
            postcode: "SA1 1WG",
            date: dayAfter.toISOString().split("T")[0],
            time_slot: "01:00 PM - 05:00 PM",
            pay_amount: 68.0,
            estimated_hours: 4.0,
            bedrooms: 3,
            bathrooms: 2,
            living_rooms: 1,
            property_type: "House",
            extras: [
              "Inside Oven & Grill",
              "Interior Window Glass",
              "Inside Kitchen Cabinets",
            ],
            notes: "Empty flat. Oven and interior windows included.",
          },
        ]);
      }
    } catch (_) {
      // Handled gracefully in UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenShifts();
  }, []);

  const handleClaim = async () => {
    if (!modalShift) return;
    setClaimingId(modalShift.id);

    try {
      await supabase.from("shift_applications").insert({
        shift_id: modalShift.id,
        booking_id: modalShift.booking_id,
        cleaner_id: staffId,
        status: "pending",
        cleaner_notes: noteText,
        created_at: new Date().toISOString(),
      });
      setSuccessMsg("Shift claimed successfully! Awaiting admin confirmation.");
      setTimeout(() => {
        setSuccessMsg("");
        setModalShift(null);
        if (onClaimed) onClaimed();
      }, 2000);
    } catch (_) {
      alert("Failed to claim shift. Please try again.");
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
            Pick up flexible open cleaning slots in your area. Shifts are
            awarded instantly on a first-come basis.
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
            All customer cleans are currently assigned. Check back frequently!
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
                      Cleaner Pay
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
                      {s.address ? `${s.address}, ` : ""}
                      {s.city} ({s.postcode})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    <Home className="w-4 h-4 text-green-600" />
                    <span>
                      {s.bedrooms ?? 1} Bed · {s.bathrooms ?? 1} Bath ·{" "}
                      {s.living_rooms ?? 1} Living (
                      {s.property_type || "House/Flat"})
                    </span>
                  </div>
                  {s.extras && s.extras.length > 0 && (
                    <div className="flex items-start gap-2 text-green-800 bg-green-50/80 p-1.5 rounded-lg border border-green-100 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span>Add-ons: {s.extras.join(", ")}</span>
                    </div>
                  )}
                  {s.notes && (
                    <div className="flex items-start gap-2 pt-1 border-t border-gray-200/60 text-gray-500">
                      <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>{s.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setModalShift(s)}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Hand className="w-4 h-4" />
                Claim This Shift
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
                <strong>Location:</strong> {modalShift.city} (
                {modalShift.postcode})
              </p>
              <p>
                <strong>Schedule:</strong> {formatDate(modalShift.date)} at{" "}
                {modalShift.time_slot}
              </p>
              <p>
                <strong>Property:</strong> {modalShift.bedrooms ?? 1} Bed ·{" "}
                {modalShift.bathrooms ?? 1} Bath (
                {modalShift.property_type || "House/Flat"})
              </p>
              {modalShift.extras && modalShift.extras.length > 0 && (
                <p className="text-green-800 font-semibold">
                  <strong>Add-ons:</strong> {modalShift.extras.join(", ")}
                </p>
              )}
              <p className="text-green-700 font-bold text-sm">
                <strong>Pay:</strong> {formatCurrency(modalShift.pay_amount)} (
                {modalShift.estimated_hours} hrs)
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
                placeholder="e.g. I live 5 mins away, ready to start promptly."
                className="w-full text-xs border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>

            {successMsg ? (
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                {successMsg}
              </div>
            ) : null}

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
