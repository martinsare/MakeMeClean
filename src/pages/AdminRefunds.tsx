import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface RefundRequest {
  id: string;
  booking_id: string;
  user_id: string;
  reason: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  source?: "user" | "stripe_dispute";
  admin_notes: string | null;
  refund_amount: number | null;
  processed_at: string | null;
  stripe_refund_id?: string | null;
  booking?: { service_name: string; price: number; date: string };
  profile?: { full_name: string; email: string };
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

export default function AdminRefunds() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchRefunds = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("refund_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    const bookingIds = [...new Set((data ?? []).map((r: any) => r.booking_id).filter(Boolean))];
    const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];

    const [{ data: bookings }, { data: profiles }] = await Promise.all([
      bookingIds.length > 0
        ? supabase.from("bookings").select("id, service_name, price, date").in("id", bookingIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const bkMap: Record<string, any> = {};
    for (const b of bookings ?? []) bkMap[b.id] = b;
    const pfMap: Record<string, any> = {};
    for (const p of profiles ?? []) pfMap[p.id] = p;

    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      booking: bkMap[r.booking_id] || null,
      profile: pfMap[r.user_id] || null,
    }));

    setRefunds((mapped as RefundRequest[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && !roleLoading && isAdmin) fetchRefunds();
  }, [loading, roleLoading, isAdmin]);

  const approve = async (refundId: string, notes: string) => {
    setApproving(refundId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke("process-stripe-refund", {
        body: { refundRequestId: refundId, adminNotes: notes.trim() || undefined },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (fnErr || !data?.ok) throw new Error(data?.error ?? fnErr?.message ?? "Failed to process refund");
      await fetchRefunds();
      setExpandedId(null);
    } catch (e) {
      alert((e as Error).message ?? "Failed to process refund");
    } finally {
      setApproving(null);
    }
  };

  const reject = async (refundId: string, notes: string) => {
    setApproving(refundId);
    const { error } = await supabase
      .from("refund_requests")
      .update({
        status: "rejected",
        admin_notes: notes,
        processed_at: new Date().toISOString(),
      })
      .eq("id", refundId);

    if (!error) {
      await fetchRefunds();
      setExpandedId(null);
    }
    setApproving(null);
  };

  if (loading || roleLoading) return null;
  if (!user || !isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  const counts = {
    all: refunds.length,
    pending: refunds.filter((r) => r.status === "pending").length,
    approved: refunds.filter((r) => r.status === "approved").length,
    rejected: refunds.filter((r) => r.status === "rejected").length,
  };

  return (
    <AdminLayout title="Refund Requests" subtitle="Review and process customer refund requests">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: counts.all },
          { label: "Pending", value: counts.pending },
          { label: "Approved", value: counts.approved },
          { label: "Rejected", value: counts.rejected },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
            <p className="text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : refunds.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <p className="text-gray-400 font-medium">No refund requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map((refund) => {
            const isOpen = expandedId === refund.id;
            return (
              <div
                key={refund.id}
                className={cn(
                  "bg-white border rounded-2xl shadow-sm overflow-hidden transition-all",
                  isOpen ? "border-green-200" : "border-gray-100"
                )}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : refund.id)}
                  className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <DollarSign className="w-4.5 h-4.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-black text-gray-900">{refund.profile?.full_name}</p>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", STATUS_STYLES[refund.status])}>
                        {refund.status}
                      </span>
                      {refund.source === "stripe_dispute" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700">
                          Stripe dispute
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {refund.booking?.service_name} • Requested {formatCurrency(refund.refund_amount ?? refund.booking?.price ?? 0)}
                      {refund.refund_amount != null && refund.booking?.price != null && refund.refund_amount < refund.booking.price
                        ? ` (of ${formatCurrency(refund.booking.price)})`
                        : ""}
                    </p>
                    <p className="text-sm text-gray-600 font-semibold mt-1">{refund.reason}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(refund.requested_at)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Request Details</p>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700"><strong>Reason:</strong> {refund.reason}</p>
                        <p className="text-sm text-gray-700"><strong>Booking Date:</strong> {refund.booking?.date}</p>
                        <p className="text-sm text-gray-700">
                          <strong>Requested Refund:</strong>{" "}
                          {formatCurrency(refund.refund_amount ?? refund.booking?.price ?? 0)}
                          {refund.booking?.price != null ? ` (Booking total: ${formatCurrency(refund.booking.price)})` : ""}
                        </p>
                        {refund.admin_notes && <p className="text-sm text-gray-700"><strong>Admin Notes:</strong> {refund.admin_notes}</p>}
                      </div>
                    </div>

                    {refund.status === "pending" && (
                      <RefundDecisionForm
                        refundId={refund.id}
                        onApprove={approve}
                        onReject={reject}
                        isProcessing={approving === refund.id}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

function RefundDecisionForm({
  refundId,
  onApprove,
  onReject,
  isProcessing,
}: {
  refundId: string;
  onApprove: (id: string, notes: string) => Promise<void>;
  onReject: (id: string, notes: string) => Promise<void>;
  isProcessing: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4 p-5 bg-green-50 border border-green-200 rounded-xl">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">Admin Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isProcessing}
          rows={3}
          placeholder="Reason for decision..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onApprove(refundId, notes)}
          disabled={isProcessing}
          className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
        >
          {isProcessing ? "Processing..." : "Approve"}
        </button>
        <button
          onClick={() => onReject(refundId, notes)}
          disabled={isProcessing}
          className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
