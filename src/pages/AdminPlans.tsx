import { useEffect, useState } from "react";
import { RefreshCw, Users, Repeat, X, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";
import { RecurringPlan } from "@/types";
import { FREQ_LABELS_SHORT, PLAN_STATUS_STYLES } from "@/lib/constants";

type Tab = "plans" | "discounts";
type Discounts = { weekly: number; fortnightly: number; monthly: number };

const FREQ_LABELS = FREQ_LABELS_SHORT;
const STATUS_STYLES = PLAN_STATUS_STYLES;

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPlans() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [tab, setTab]           = useState<Tab>("plans");
  const [plans, setPlans]       = useState<RecurringPlan[]>([]);
  const [fetching, setFetching] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Discount settings — loaded from database, no hardcoded defaults
  const [discounts, setDiscounts]     = useState<Discounts>({ weekly: 0, fortnightly: 0, monthly: 0 });
  const [draft, setDraft]             = useState<Discounts>({ weekly: 0, fortnightly: 0, monthly: 0 });
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState("");

  const loadPlans = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("recurring_plans")
      .select("*")
      .order("created_at", { ascending: false });
    
    // Fetch user details separately (deduplicated & guarded against empty IN list)
    const userIds = [...new Set((data ?? []).map((p: any) => p.user_id).filter(Boolean))];
    const { data: profiles } =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : { data: [] as any[] };
    const pfMap: Record<string, any> = {};
    for (const p of profiles ?? []) pfMap[p.id] = p;

    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      profiles: pfMap[p.user_id],
    }));
    
    setPlans((mapped as RecurringPlan[]) ?? []);
    setFetching(false);
  };

  const loadDiscounts = async () => {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["discount_weekly", "discount_fortnightly", "discount_monthly"]);
    if (data && data.length > 0) {
      const map: Record<string, number> = {};
      for (const row of data) map[row.key] = Number(row.value) || 0;
      const d: Discounts = {
        weekly:      map["discount_weekly"]      ?? 0,
        fortnightly: map["discount_fortnightly"] ?? 0,
        monthly:     map["discount_monthly"]     ?? 0,
      };
      setDiscounts(d);
      setDraft(d);
    }
  };

  useEffect(() => {
    if (!loading && !roleLoading && isAdmin) {
      loadPlans();
      loadDiscounts();
    }
  }, [loading, roleLoading, isAdmin]);

  const cancelPlan = async (id: string, customerName?: string | null) => {
    const confirmed = window.confirm(
      `Cancel this recurring plan${customerName ? ` for ${customerName}` : ""}? Future automatic bookings will stop immediately.`
    );
    if (!confirmed) return;
    setCancelling(id);
    setSaveError("");
    const { error } = await supabase
      .from("recurring_plans")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      setSaveError(`Failed to cancel plan: ${error.message}`);
    } else {
      setPlans((prev) => prev.map((p) => p.id === id ? { ...p, status: "cancelled" } : p));
    }
    setCancelling(null);
  };

  const saveDiscounts = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const rows = [
      { key: "discount_weekly",      value: String(Math.max(0, Math.min(100, draft.weekly)))      },
      { key: "discount_fortnightly", value: String(Math.max(0, Math.min(100, draft.fortnightly))) },
      { key: "discount_monthly",     value: String(Math.max(0, Math.min(100, draft.monthly)))     },
    ];
    const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
    if (error) {
      setSaveError(error.message);
    } else {
      setDiscounts({ weekly: draft.weekly, fortnightly: draft.fortnightly, monthly: draft.monthly });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading || roleLoading) return null;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  const activePlans    = plans.filter((p) => p.status === "active").length;
  const pausedPlans    = plans.filter((p) => p.status === "paused").length;
  const cancelledPlans = plans.filter((p) => p.status === "cancelled").length;

  return (
    <AdminLayout
      title="Recurring Plans"
      subtitle={`${activePlans} active · ${pausedPlans} paused · ${cancelledPlans} cancelled`}
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setTab("plans")}
            className={cn("px-4 py-2.5 rounded-xl text-sm font-bold transition-colors",
              tab === "plans" ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}
          >
            All Plans
          </button>
          <button
            onClick={() => setTab("discounts")}
            className={cn("px-4 py-2.5 rounded-xl text-sm font-bold transition-colors",
              tab === "discounts" ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}
          >
            Discount Settings
          </button>
        </div>
      }
    >
      {/* ── All Plans tab ── */}
      {tab === "plans" && (
        <>
          {saveError && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
          )}
          {fetching ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Repeat className="w-7 h-7 text-gray-400" />
              </div>
              <p className="font-black text-gray-900 text-lg">No recurring plans yet</p>
              <p className="text-sm text-gray-400 mt-1">Plans created by customers during booking will appear here.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Service</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Frequency</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Price / visit</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Discount</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Created</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-xs">
                              {plan.profiles?.full_name ?? "Unknown"}
                            </p>
                            <p className="text-xs text-gray-400">{plan.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700 font-medium max-w-[140px] truncate">{plan.service_name}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-700">
                          <Repeat className="w-3 h-3 text-gray-400" />
                          {FREQ_LABELS[plan.frequency] ?? plan.frequency}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{plan.duration_hours}h · {plan.start_time}</p>
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-900">{formatCurrency(plan.price_per_visit)}</td>
                      <td className="px-4 py-4">
                        {plan.discount_percent > 0
                          ? <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-full">−{plan.discount_percent}%</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("text-xs font-bold px-2 py-1 rounded-full border capitalize", STATUS_STYLES[plan.status] ?? STATUS_STYLES.active)}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-400 whitespace-nowrap">{fmtDate(plan.created_at)}</td>
                      <td className="px-4 py-4">
                        {plan.status !== "cancelled" && (
                          <button
                            onClick={() => cancelPlan(plan.id, plan.profiles?.full_name)}
                            disabled={cancelling === plan.id}
                            title="Cancel plan"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            {cancelling === plan.id
                              ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <X className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Discount Settings tab ── */}
      {tab === "discounts" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-black text-gray-900">Recurring Discount Rates</h2>
              <p className="text-sm text-gray-400 mt-1">
                These percentages are shown to customers when they choose a recurring booking schedule.
                Changes take effect on the next booking — existing plans are not affected.
              </p>
            </div>

            {[
              { key: "weekly",      label: "Weekly",      sub: "Every week"    },
              { key: "fortnightly", label: "Fortnightly", sub: "Every 2 weeks" },
              { key: "monthly",     label: "Monthly",     sub: "Every month"   },
            ].map(({ key, label, sub }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={draft[key as keyof Discounts]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-sm font-bold text-gray-500">%</span>
                </div>
                <div className="w-24 text-right">
                  {draft[key as keyof Discounts] !== discounts[key as keyof Discounts] && (
                    <span className="text-xs text-orange-500 font-semibold">unsaved</span>
                  )}
                </div>
              </div>
            ))}

            {saveError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{saveError}</p>
              </div>
            )}
            {saveSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm font-semibold text-green-800">Discount rates saved successfully.</p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={saveDiscounts}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-xs font-bold text-blue-700 mb-1">How discounts work</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              When a customer selects a recurring schedule (Weekly / Fortnightly / Monthly) at checkout,
              the corresponding discount is applied to their booking price. The discounted price is also
              saved to their recurring plan record.
              Setting a discount to <strong>0%</strong> effectively disables it and shows no badge.
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
