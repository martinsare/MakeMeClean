import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { cn, formatDate } from "@/lib/utils";
import { RescheduleRequest } from "@/types";

function calcNewTimeSlot(originalTimeSlot: string, newStartTime: string): string {
  const match = originalTimeSlot.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return newStartTime;
  const [, sh, sm, eh, em] = match.map(Number);
  const durationMins = (eh * 60 + em) - (sh * 60 + sm);
  const [nh, nm] = newStartTime.split(":").map(Number);
  const endMins = nh * 60 + nm + durationMins;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${newStartTime} – ${pad(Math.floor(endMins / 60))}:${pad(endMins % 60)}`;
}

const STATUS_CONFIG = {
  pending:  { label: "Pending",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved", cls: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-600 border-red-200" },
};

export default function AdminReschedules() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchRequests = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("reschedule_requests")
      .select("*, bookings(service_name, date, time_slot, address, city, postcode, profiles(full_name, phone))")
      .order("created_at", { ascending: false });
    setRequests((data as RescheduleRequest[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) fetchRequests(); }, [isAdmin]);

  const approve = async (req: RescheduleRequest) => {
    if (!req.bookings) return;
    setActionId(req.id);
    setActionError("");
    const newTimeSlot = calcNewTimeSlot(req.bookings.time_slot, req.requested_time);
    const { error: bkErr } = await supabase
      .from("bookings")
      .update({ date: req.requested_date, time_slot: newTimeSlot, reminder_sent: false })
      .eq("id", req.booking_id);
    if (bkErr) {
      setActionError(`Failed to update booking schedule: ${bkErr.message}`);
      setActionId(null);
      return;
    }
    const { error: reqErr } = await supabase
      .from("reschedule_requests")
      .update({ status: "approved", admin_note: adminNotes[req.id] || null })
      .eq("id", req.id);
    if (reqErr) {
      setActionError(`Booking updated, but failed to mark request approved: ${reqErr.message}`);
      setActionId(null);
      return;
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, status: "approved", admin_note: adminNotes[req.id] || null }
          : r
      )
    );
    setActionId(null);
  };

  const reject = async (req: RescheduleRequest) => {
    setActionId(req.id);
    setActionError("");
    const { error: reqErr } = await supabase
      .from("reschedule_requests")
      .update({ status: "rejected", admin_note: adminNotes[req.id] || null })
      .eq("id", req.id);
    if (reqErr) {
      setActionError(`Failed to reject reschedule request: ${reqErr.message}`);
      setActionId(null);
      return;
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, status: "rejected", admin_note: adminNotes[req.id] || null }
          : r
      )
    );
    setActionId(null);
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user || !isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  return (
    <AdminLayout
      title="Reschedule Requests"
      subtitle="Review and action customer reschedule requests"
    >
      {actionError && (
        <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
              filter === f ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pendingCount > 0 && (
              <span className="bg-white text-green-700 text-xs font-black px-1.5 rounded-full leading-4">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No reschedule requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const sc = STATUS_CONFIG[req.status];
            const isLoading = actionId === req.id;
            return (
              <div key={req.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-black text-gray-900">{req.bookings?.service_name ?? "—"}</p>
                        <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", sc.cls)}>{sc.label}</span>
                      </div>
                      {req.bookings?.profiles?.full_name && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Users className="w-3.5 h-3.5" />
                          {req.bookings.profiles.full_name}
                          {req.bookings.profiles.phone && <span className="text-gray-300 mx-1">·</span>}
                          {req.bookings.profiles.phone && <span>{req.bookings.profiles.phone}</span>}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    {/* Current booking */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Current booking</p>
                      <div className="space-y-1.5 text-sm text-gray-600">
                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-400" />{formatDate(req.bookings?.date ?? "")}</div>
                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-gray-400" />{req.bookings?.time_slot}</div>
                        <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" />{req.bookings?.city}</div>
                      </div>
                    </div>

                    {/* Requested */}
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">Requested change</p>
                      <div className="space-y-1.5 text-sm text-gray-700">
                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-green-500" /><strong>{formatDate(req.requested_date)}</strong></div>
                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-green-500" /><strong>{calcNewTimeSlot(req.bookings?.time_slot ?? "", req.requested_time)}</strong></div>
                      </div>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 mb-4">
                      <span className="font-semibold">Reason: </span>{req.reason}
                    </div>
                  )}

                  {req.status === "pending" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admin note (optional)</label>
                        <input
                          type="text"
                          value={adminNotes[req.id] ?? ""}
                          onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          placeholder="e.g. New time confirmed with cleaner"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => reject(req)}
                          disabled={isLoading}
                          className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-500 font-semibold py-2.5 rounded-xl hover:bg-red-50 transition-colors text-sm disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                        <button
                          onClick={() => approve(req)}
                          disabled={isLoading}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve & Update Booking
                        </button>
                      </div>
                    </div>
                  )}

                  {req.status !== "pending" && req.admin_note && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5">
                      <span className="font-semibold">Admin note: </span>{req.admin_note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
