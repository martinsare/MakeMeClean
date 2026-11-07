import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Calendar,
  Clock,
  MapPin,
  LogOut,
  CalendarDays,
  CheckCircle2,
  Banknote,
  Layers,
  XCircle,
  Home,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRecord } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import {
  cn,
  formatCurrency,
  formatDate,
  sanitizeCleanNotes,
} from "@/lib/utils";
import StaffLayout from "@/components/staff/StaffLayout";
import StaffShiftMarketplace from "@/components/staff/StaffShiftMarketplace";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 10;

interface AssignedBooking {
  id: string;
  assignmentId: string;
  acceptanceStatus: "pending" | "accepted" | "declined";
  declineReason: string | null;
  service_name: string;
  service_type: string;
  date: string;
  time_slot: string;
  address: string;
  city: string;
  postcode: string;
  price: number;
  status: string;
  payment_status: string | null;
  bedrooms?: number;
  bathrooms?: number;
  living_rooms?: number;
  property_type?: string;
  duration_hours?: number;
  extras?: string[] | any;
  notes?: string | null;
}

export default function StaffDashboard() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { staff, loading: staffLoading } = useStaffRecord(user?.id);

  const [activeTab, setActiveTab] = useState<"roster" | "marketplace">(
    "roster"
  );
  const [fetching, setFetching] = useState(false);
  const [bookings, setBookings] = useState<AssignedBooking[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>(
    {}
  );
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineText, setDeclineText] = useState("");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  const fetchAssigned = async (staffId: string) => {
    setFetching(true);
    const [{ data }, { data: servicesData }] = await Promise.all([
      supabase
        .from("booking_assignments")
        .select(
          "id, acceptance_status, decline_reason, bookings(id, service_name, service_type, date, time_slot, address, city, postcode, price, status, payment_status, bedrooms, bathrooms, living_rooms, property_type, duration_hours, extras, notes)"
        )
        .eq("staff_id", staffId)
        .order("assigned_at", { ascending: false }),
      supabase.from("services").select("id, image_url"),
    ]);

    const rows = (data as any[] | null) ?? [];
    setBookings(
      rows
        .map((r) => ({
          ...(r.bookings as any),
          assignmentId: r.id,
          acceptanceStatus: r.acceptance_status ?? "pending",
          declineReason: r.decline_reason ?? null,
        }))
        .filter((b) => b.id)
    );
    const imgMap: Record<string, string> = {};
    for (const s of servicesData ?? []) {
      if (s.image_url) imgMap[s.id] = s.image_url;
    }
    setServiceImages(imgMap);
    setFetching(false);
  };

  useEffect(() => {
    if (staff?.id) fetchAssigned(staff.id);
  }, [staff?.id]);

  const upcoming = useMemo(
    () => bookings.filter((b) => b.status === "upcoming"),
    [bookings]
  );
  const completed = useMemo(
    () => bookings.filter((b) => b.status === "completed"),
    [bookings]
  );
  const paginated = upcoming.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const acceptShift = async (assignmentId: string, bookingId: string) => {
    setActionId(bookingId);
    await supabase
      .from("booking_assignments")
      .update({ acceptance_status: "accepted" })
      .eq("id", assignmentId);
    setBookings((prev) =>
      prev.map((b) =>
        b.assignmentId === assignmentId
          ? { ...b, acceptanceStatus: "accepted" }
          : b
      )
    );
    setActionId(null);
  };

  const declineShift = async (assignmentId: string, bookingId: string) => {
    if (!decliningId) return;
    setActionId(bookingId);
    await supabase
      .from("booking_assignments")
      .update({
        acceptance_status: "declined",
        decline_reason: declineText || null,
      })
      .eq("id", assignmentId);
    setBookings((prev) =>
      prev.map((b) =>
        b.assignmentId === assignmentId
          ? {
              ...b,
              acceptanceStatus: "declined",
              declineReason: declineText || null,
            }
          : b
      )
    );
    setDecliningId(null);
    setDeclineText("");
    setActionId(null);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "bg-green-50 text-green-700 border-green-200";
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (loading || staffLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-7 h-7 text-gray-400" />
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">
            No staff profile found
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            Your account isn't linked to a staff profile yet.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Ask an admin to assign your account.
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <StaffLayout
      title="My Shifts"
      subtitle={`Welcome back, ${staff.first_name}`}
    >
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Total assigned",
            value: bookings.length,
            icon: Layers,
            color: "bg-slate-100 text-slate-600",
          },
          {
            label: "Upcoming shifts",
            value: upcoming.length,
            icon: CalendarDays,
            color: "bg-green-100 text-green-700",
          },
          {
            label: "Completed",
            value: completed.length,
            icon: CheckCircle2,
            color: "bg-emerald-100 text-emerald-700",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5"
          >
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
                color
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs font-medium text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* View Switcher Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("roster")}
          className={cn(
            "px-5 py-3 text-sm font-black border-b-2 transition-all",
            activeTab === "roster"
              ? "border-green-600 text-green-700 bg-green-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          My Assigned Roster ({upcoming.length})
        </button>
        <button
          onClick={() => setActiveTab("marketplace")}
          className={cn(
            "px-5 py-3 text-sm font-black border-b-2 transition-all",
            activeTab === "marketplace"
              ? "border-green-600 text-green-700 bg-green-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          Open Shifts Marketplace
        </button>
      </div>

      {activeTab === "marketplace" ? (
        <StaffShiftMarketplace
          staffId={staff.id}
          onClaimed={() => fetchAssigned(staff.id)}
        />
      ) : (
        <>
          {fetching ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
              <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Loading your shifts…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-black text-gray-900 mb-1">
                No upcoming shifts
              </h2>
              <p className="text-sm text-gray-400">
                You're all clear! New assignments will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginated.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:border-green-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Service icon */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-green-50 border border-green-100 shrink-0">
                      {serviceImages[b.service_type] ? (
                        <img
                          src={serviceImages[b.service_type]}
                          alt={b.service_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          🧹
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {b.service_name}
                          </p>
                          <span
                            className={cn(
                              "inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-1",
                              statusColor(b.status)
                            )}
                          >
                            {b.status.charAt(0).toUpperCase() +
                              b.status.slice(1)}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-gray-900">
                            {formatCurrency(b.price)}
                          </p>
                          {(() => {
                            const paymentLabel =
                              (b.payment_status ?? "pending") === "paid"
                                ? "Paid"
                                : (b.payment_status ?? "pending") === "refunded"
                                ? "Refunded"
                                : (b.payment_status ?? "pending") === "disputed"
                                ? "Disputed"
                                : "Unpaid";
                            const paymentClass =
                              (b.payment_status ?? "pending") === "paid"
                                ? "text-emerald-600"
                                : (b.payment_status ?? "pending") === "refunded"
                                ? "text-slate-500"
                                : (b.payment_status ?? "pending") === "disputed"
                                ? "text-red-600"
                                : "text-gray-400";
                            return (
                              <div
                                className={cn(
                                  "text-xs font-semibold mt-0.5 flex items-center justify-end gap-1",
                                  paymentClass
                                )}
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                {paymentLabel}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4 text-green-600 shrink-0" />
                          {formatDate(b.date)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4 text-green-600 shrink-0" />
                          {b.time_slot} ({b.duration_hours || 2} hours)
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-500">
                          <MapPin className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                          {b.address}, {b.city}, {b.postcode}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700 pt-1 font-medium">
                          <Home className="w-4 h-4 text-green-600 shrink-0" />
                          {b.bedrooms ?? 1} Bed · {b.bathrooms ?? 1} Bath ·{" "}
                          {b.living_rooms ?? 1} Living (
                          {b.property_type || "House/Flat"})
                        </div>
                        {Array.isArray(b.extras) && b.extras.length > 0 && (
                          <div className="flex items-start gap-2 text-xs text-green-800 bg-green-50 p-2 rounded-lg border border-green-100 font-semibold mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                            <span>Add-ons: {b.extras.join(", ")}</span>
                          </div>
                        )}
                        {sanitizeCleanNotes(b.notes) && (
                          <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg border border-gray-100 mt-1">
                            Note: "{sanitizeCleanNotes(b.notes)}"
                          </p>
                        )}
                      </div>

                      {/* Accept / Decline */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {b.acceptanceStatus === "accepted" ? (
                          <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                            <CheckCircle2 className="w-4 h-4" /> You accepted
                            this shift
                          </div>
                        ) : b.acceptanceStatus === "declined" ? (
                          <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-red-500">
                              <XCircle className="w-4 h-4" /> You declined this
                              shift
                            </div>
                            {b.declineReason && (
                              <p className="text-xs text-gray-400 mt-0.5 ml-6">
                                Reason: {b.declineReason}
                              </p>
                            )}
                          </div>
                        ) : decliningId === b.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Reason for declining (optional)"
                              value={declineText}
                              onChange={(e) => setDeclineText(e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setDecliningId(null);
                                  setDeclineText("");
                                }}
                                className="flex-1 text-xs font-semibold border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() =>
                                  declineShift(b.assignmentId, b.id)
                                }
                                disabled={actionId === b.id}
                                className="flex-1 text-xs font-semibold bg-red-500 text-white rounded-xl py-2 hover:bg-red-600 transition-colors disabled:opacity-50"
                              >
                                {actionId === b.id
                                  ? "Declining…"
                                  : "Confirm Decline"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-700 mb-2">
                              Confirm this shift?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  acceptShift(b.assignmentId, b.id)
                                }
                                disabled={actionId === b.id}
                                className="flex-1 text-xs font-semibold bg-green-600 text-white rounded-xl py-2 hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {actionId === b.id ? "…" : "Accept"}
                              </button>
                              <button
                                onClick={() => {
                                  setDecliningId(b.id);
                                  setDeclineText("");
                                }}
                                disabled={actionId === b.id}
                                className="flex-1 text-xs font-semibold border border-red-200 text-red-500 rounded-xl py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Pagination
                page={page}
                total={upcoming.length}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </StaffLayout>
  );
}
