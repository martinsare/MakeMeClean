import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Users,
  CalendarDays,
  AlertCircle,
  Download,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  calculatePayslip,
  parseShiftHours,
  UK_NLW_2026,
  UK_TAX_YEAR,
} from "@/lib/payroll";
import { StaffMember, Payslip, PayrollSettings } from "@/types";
import Spinner from "@/components/Spinner";

interface PeriodOption {
  start: string;
  end: string;
  label: string;
}

function sanitizeCsvCell(value: unknown): string {
  const s = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

/** Last `n` completed Mon–Sun weeks (most recent first) */
function getWeekOptions(n: number): PeriodOption[] {
  const options: PeriodOption[] = [];
  const today = new Date();
  const dow = today.getDay() === 0 ? 7 : today.getDay();
  const baseMon = new Date(today);
  baseMon.setDate(today.getDate() - dow - 6);
  baseMon.setHours(0, 0, 0, 0);

  for (let i = 0; i < n; i++) {
    const mon = new Date(baseMon);
    mon.setDate(baseMon.getDate() - i * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const start = mon.toISOString().slice(0, 10);
    const end = sun.toISOString().slice(0, 10);
    options.push({ start, end, label: formatPeriod(start, end) });
  }
  return options;
}

/** Last `n` completed calendar months (most recent first) */
function getMonthOptions(n: number): PeriodOption[] {
  const options: PeriodOption[] = [];
  const today = new Date();
  for (let i = 1; i <= n; i++) {
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const last = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const start = first.toISOString().slice(0, 10);
    const end = last.toISOString().slice(0, 10);
    const label = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    options.push({ start, end, label });
  }
  return options;
}

export default function AdminPayroll() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [settings, setSettings] = useState<PayrollSettings>({
    pay_period: "monthly",
    hourly_rate: UK_NLW_2026,
    default_tax_code: "1257L",
    ni_category: "A",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [fetching, setFetching] = useState(true);

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genSuccess, setGenSuccess] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState("all");

  const periodOptions = useMemo<PeriodOption[]>(
    () => (settings.pay_period === "weekly" ? getWeekOptions(12) : getMonthOptions(12)),
    [settings.pay_period]
  );

  useEffect(() => {
    setSelectedPeriod(periodOptions[0] ?? null);
  }, [periodOptions]);

  const fetchAll = async () => {
    setFetching(true);
    const [{ data: sData }, { data: stData }, { data: pData }] = await Promise.all([
      supabase.from("payroll_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("staff").select("id, first_name, last_name, email").eq("active", true).order("first_name"),
      supabase.from("payslips").select("*").order("period_start", { ascending: false }).limit(500),
    ]);
    if (sData) setSettings(sData as PayrollSettings);
    setStaff((stData as StaffMember[]) ?? []);
    setPayslips((pData as Payslip[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const saveSettings = async () => {
    setSavingSettings(true);
    await supabase
      .from("payroll_settings")
      .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() });
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const generatePayslips = async () => {
    if (!selectedPeriod) {
      setGenError("Please select a pay period.");
      return;
    }
    const { start: periodStart, end: periodEnd } = selectedPeriod;

    setGenerating(true);
    setGenError("");
    setGenSuccess("");

    try {
      // Paginated !inner join ensures filtering happens in Postgres and handles >1,000 rows safely
      const allAssignments: any[] = [];
      const batchSize = 1000;
      for (let from = 0; from < 20000; from += batchSize) {
        const { data: batch, error: fetchErr } = await supabase
          .from("booking_assignments")
          .select("staff_id, bookings!inner(id, date, time_slot, status)")
          .eq("bookings.status", "completed")
          .gte("bookings.date", periodStart)
          .lte("bookings.date", periodEnd)
          .range(from, from + batchSize - 1);

        if (fetchErr) throw new Error(fetchErr.message);
        if (!batch || batch.length === 0) break;
        allAssignments.push(...batch);
        if (batch.length < batchSize) break;
      }

      const byStaff: Record<string, { shifts: number; hours: number; gross: number }> = {};
      for (const a of allAssignments) {
        const b = Array.isArray(a.bookings) ? a.bookings[0] : a.bookings;
        if (!b || b.status !== "completed") continue;
        const hrs = parseShiftHours(b.time_slot ?? "", 0);
        const gross = hrs * settings.hourly_rate;
        if (!byStaff[a.staff_id]) byStaff[a.staff_id] = { shifts: 0, hours: 0, gross: 0 };
        byStaff[a.staff_id].shifts += 1;
        byStaff[a.staff_id].hours += hrs;
        byStaff[a.staff_id].gross += gross;
      }

      if (Object.keys(byStaff).length === 0) {
        setGenError("No completed shifts found for this period.");
        setGenerating(false);
        return;
      }

      // Do not overwrite already-finalised payslips for this period
      const { data: existingRows } = await supabase
        .from("payslips")
        .select("staff_id, status")
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);

      const finalisedStaffIds = new Set(
        (existingRows ?? [])
          .filter((r: any) => r.status === "finalised")
          .map((r: any) => r.staff_id)
      );

      const rows = Object.entries(byStaff)
        .filter(([staffId]) => !finalisedStaffIds.has(staffId))
        .map(([staff_id, d]) => {
          const calc = calculatePayslip(d.gross, settings.pay_period, settings.default_tax_code);
          return {
            staff_id,
            period_start: periodStart,
            period_end: periodEnd,
            shifts_count: d.shifts,
            gross_hours: Math.round(d.hours * 100) / 100,
            gross_pay: calc.grossPay,
            tax_code: settings.default_tax_code,
            paye_tax: calc.payeTax,
            ni_employee: calc.niEmployee,
            ni_employer: calc.niEmployer,
            net_pay: calc.netPay,
            status: "draft" as const,
            generated_at: new Date().toISOString(),
          };
        });

      if (rows.length === 0) {
        setGenError("All staff payslips for this period are already finalised.");
        setGenerating(false);
        return;
      }

      const { error: upsertErr } = await supabase
        .from("payslips")
        .upsert(rows, { onConflict: "staff_id,period_start,period_end" });
      if (upsertErr) throw new Error(upsertErr.message);

      const skippedMsg =
        finalisedStaffIds.size > 0
          ? ` (${finalisedStaffIds.size} already finalised skipped)`
          : "";
      setGenSuccess(
        `Generated/updated ${rows.length} draft payslip${rows.length !== 1 ? "s" : ""} for ${selectedPeriod.label}${skippedMsg}.`
      );
      await fetchAll();
    } catch (e: any) {
      setGenError(e?.message ?? String(e));
    }
    setGenerating(false);
  };

  const finalise = async (id: string) => {
    await supabase.from("payslips").update({ status: "finalised" }).eq("id", id);
    setPayslips((p) => p.map((x) => (x.id === id ? { ...x, status: "finalised" } : x)));
  };

  const exportPayrollCsv = () => {
    const staffLookup = Object.fromEntries(staff.map((s) => [s.id, s]));
    const rowsToExport = staffFilter === "all" ? payslips : payslips.filter((p) => p.staff_id === staffFilter);
    const headers = [
      "Staff Name",
      "Staff Email",
      "Period Start",
      "Period End",
      "Shifts",
      "Hours Worked",
      "Tax Code",
      "NI Category",
      "Gross Pay (GBP)",
      "Est. PAYE Tax (GBP)",
      "Est. Employee NI (GBP)",
      "Est. Employer NI (GBP)",
      "Est. Net Pay (GBP)",
      "Status",
    ];
    const csvRows = [
      headers,
      ...rowsToExport.map((p) => {
        const s = staffLookup[p.staff_id];
        return [
          s ? `${s.first_name} ${s.last_name}` : p.staff_id,
          s?.email ?? "",
          p.period_start,
          p.period_end,
          p.shifts_count,
          p.gross_hours.toFixed(2),
          p.tax_code,
          settings.ni_category,
          p.gross_pay.toFixed(2),
          p.paye_tax.toFixed(2),
          p.ni_employee.toFixed(2),
          p.ni_employer.toFixed(2),
          p.net_pay.toFixed(2),
          p.status,
        ];
      }),
    ];
    const csv = csvRows.map((r) => r.map(sanitizeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `makemeclean-payroll-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || roleLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user || !isAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Admin access required.
      </div>
    );

  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]));
  const filteredPayslips =
    staffFilter === "all" ? payslips : payslips.filter((p) => p.staff_id === staffFilter);

  return (
    <AdminLayout
      title="Payroll"
      subtitle="Configure pay settings, generate payslip estimates, and export for HMRC RTI software"
      actions={
        <button
          onClick={exportPayrollCsv}
          disabled={filteredPayslips.length === 0}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV (Xero / BrightPay)
        </button>
      }
    >
      {/* HMRC RTI Compliance Notice */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-bold">HMRC RTI Compliance Notice ({UK_TAX_YEAR} Estimates)</p>
          <p className="mt-0.5">
            PAYE and National Insurance figures below are period estimates using {UK_TAX_YEAR} UK rates (Employer NI 15% above £5,000/yr; UK NLW £{UK_NLW_2026.toFixed(2)}/hr for 21+). This tool does not submit Real Time Information (FPS/EPS) to HMRC or calculate cumulative YTD tax, workplace pension auto-enrolment, or student loan deductions. Export the CSV above into HMRC-recognised payroll software (e.g., Xero, BrightPay, Sage, FreeAgent) before paying staff.
          </p>
        </div>
      </div>

      {/* ── Settings ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Payroll Settings</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pay period</label>
            <select
              value={settings.pay_period}
              onChange={(e) => setSettings((s) => ({ ...s, pay_period: e.target.value as "weekly" | "monthly" }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Controls which periods appear when generating payslips</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hourly rate (£)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={settings.hourly_rate}
              onChange={(e) => setSettings((s) => ({ ...s, hourly_rate: parseFloat(e.target.value) || 0 }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">UK National Living Wage (21+, {UK_TAX_YEAR}) is £{UK_NLW_2026.toFixed(2)}/hr</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Default tax code</label>
            <input
              type="text"
              value={settings.default_tax_code}
              onChange={(e) => setSettings((s) => ({ ...s, default_tax_code: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">NI category</label>
            <select
              value={settings.ni_category}
              onChange={(e) => setSettings((s) => ({ ...s, ni_category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {["A", "B", "C", "D", "F", "H", "I", "J", "L", "M", "S", "V", "X", "Z"].map((c) => (
                <option key={c} value={c}>Category {c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
              settingsSaved
                ? "bg-emerald-100 text-emerald-700"
                : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            )}
          >
            {savingSettings ? (
              <>
                <Spinner /> Saving…
              </>
            ) : settingsSaved ? (
              <>
                <CheckCircle className="w-4 h-4" /> Saved
              </>
            ) : (
              "Save Settings"
            )}
          </button>
          <p className="text-xs text-gray-400">
            UK {UK_TAX_YEAR} · PAYE 20%/40% · Employee NI 8%/2% · Employer NI 15% (&gt;£5,000/yr)
          </p>
        </div>
      </div>

      {/* ── Generate ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Generate Payslips</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Scans all <strong>completed</strong> shifts for each active staff member in the selected period. Hours are calculated from the shift's booked time slot only — duplicate runs safely update draft payslips without duplicating records.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Select {settings.pay_period === "weekly" ? "week" : "month"}
            </label>
            <select
              value={selectedPeriod ? `${selectedPeriod.start}|${selectedPeriod.end}` : ""}
              onChange={(e) => {
                const [start, end] = e.target.value.split("|");
                const opt = periodOptions.find((o) => o.start === start && o.end === end) ?? null;
                setSelectedPeriod(opt);
                setGenError("");
                setGenSuccess("");
              }}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {periodOptions.map((o) => (
                <option key={o.start} value={`${o.start}|${o.end}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generatePayslips}
            disabled={generating || !selectedPeriod}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {generating ? (
              <>
                <Spinner /> Generating…
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4" /> Generate for All Staff
              </>
            )}
          </button>
        </div>

        {selectedPeriod && (
          <p className="text-xs text-gray-400 mt-3">
            Period: <strong className="text-gray-700">{selectedPeriod.label}</strong>
            &nbsp;({selectedPeriod.start} → {selectedPeriod.end})
          </p>
        )}

        {genError && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{genError}</p>
          </div>
        )}
        {genSuccess && (
          <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700">{genSuccess}</p>
          </div>
        )}
      </div>

      {/* ── Payslip history ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Payslip History</h2>
          </div>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400">No payslips yet</p>
            <p className="text-xs text-gray-400 mt-1">Generate payslips above once completed shifts exist.</p>
          </div>
        ) : (
          filteredPayslips.map((p, i) => {
            const s = staffMap[p.staff_id];
            const isOpen = expandedId === p.id;
            return (
              <div key={p.id} className={cn(i !== 0 && "border-t border-gray-50")}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">
                        {s ? `${s.first_name} ${s.last_name}` : "Unknown"}
                      </p>
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          p.status === "finalised"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {p.status === "finalised" ? "Finalised" : "Draft"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatPeriod(p.period_start, p.period_end)} · {p.shifts_count} shift
                      {p.shifts_count !== 1 ? "s" : ""} · {p.gross_hours.toFixed(1)} hrs
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-gray-900">{formatCurrency(p.net_pay)}</p>
                    <p className="text-xs text-gray-400">gross {formatCurrency(p.gross_pay)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === "draft" && (
                      <button
                        onClick={() => finalise(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                      >
                        Finalise
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isOpen ? null : p.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50 pt-4 grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-gray-600">
                        <span>Gross pay</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(p.gross_pay)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Hours worked</span>
                        <span className="font-semibold text-gray-900">{p.gross_hours.toFixed(1)} hrs</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Tax code</span>
                        <span className="font-semibold text-gray-900">{p.tax_code}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-gray-600">
                        <span>Est. PAYE tax</span>
                        <span className="font-semibold text-red-500">−{formatCurrency(p.paye_tax)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Est. NI (employee)</span>
                        <span className="font-semibold text-red-500">−{formatCurrency(p.ni_employee)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Est. NI (employer, 15%)</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(p.ni_employer)}</span>
                      </div>
                      <div className="h-px bg-gray-100" />
                      <div className="flex justify-between font-bold text-base">
                        <span className="text-gray-900">Est. Net pay</span>
                        <span className="text-green-600">{formatCurrency(p.net_pay)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}
