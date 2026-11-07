import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  Users2,
  Clock3,
  CheckCircle2,
  XCircle,
  ChevronRight,
  History,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import Pagination from "@/components/Pagination";
import { ApplicationStatus, JobApplication } from "@/types";
import { APPLICATION_STATUS_STYLES, PAGE_SIZE } from "@/lib/constants";
import Spinner from "@/components/Spinner";

interface RecruitmentRound {
  id: string;
  title: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
}

const STATUS_STYLES = APPLICATION_STATUS_STYLES;

export default function AdminApplicants() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const [, setLocation] = useLocation();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all"
  );
  const [recruitmentFilter, setRecruitmentFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [recruitments, setRecruitments] = useState<RecruitmentRound[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [recruitmentTitle, setRecruitmentTitle] = useState(() => {
    const t = new Date();
    return `Domestic Cleaner ${String(t.getDate()).padStart(2, "0")}/${String(
      t.getMonth() + 1
    ).padStart(2, "0")}/${t.getFullYear()}`;
  });
  const [recruitmentSaving, setRecruitmentSaving] = useState(false);
  const [showRecruit, setShowRecruit] = useState(false);

  const activeRecruitment = useMemo(
    () => recruitments.find((r) => r.status === "active") ?? null,
    [recruitments]
  );

  const pastRecruitments = useMemo(
    () => recruitments.filter((r) => r.status === "closed"),
    [recruitments]
  );

  const fetchRecruitments = async () => {
    const { data, error: err } = await supabase
      .from("recruitments")
      .select("id, title, status, created_at, closed_at")
      .order("created_at", { ascending: false });
    if (!err && data) {
      setRecruitments(data as RecruitmentRound[]);
    }
  };

  const fetchApplicants = async () => {
    setFetching(true);
    const { data, error: err } = await supabase
      .from("job_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setApplications([]);
    } else {
      setApplications((data as JobApplication[]) ?? []);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchApplicants();
      fetchRecruitments();
    }
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, recruitmentFilter]);

  const startRecruitment = async () => {
    setRecruitmentSaving(true);
    setError("");
    try {
      if (activeRecruitment?.id) {
        await supabase
          .from("recruitments")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", activeRecruitment.id);
      }
      const { error: err } = await supabase.from("recruitments").insert({
        title: recruitmentTitle.trim() || "Recruitment",
        status: "active",
      });
      if (err) throw new Error(err.message);
      await fetchRecruitments();
      setShowRecruit(false);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const closeRecruitment = async () => {
    if (!activeRecruitment?.id) return;
    setRecruitmentSaving(true);
    setError("");
    try {
      await supabase
        .from("recruitments")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", activeRecruitment.id);
      await fetchRecruitments();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const matchQ =
        q === "" ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.role ?? "").toLowerCase().includes(q);

      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      const matchRecruitment =
        recruitmentFilter === "all" ||
        (recruitmentFilter === "unassigned" && !a.recruitment_id) ||
        a.recruitment_id === recruitmentFilter;

      return matchQ && matchStatus && matchRecruitment;
    });
  }, [applications, search, statusFilter, recruitmentFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const rows = [
      [
        "Date",
        "Status",
        "Role",
        "Name",
        "Email",
        "Phone",
        "City",
        "Recruitment Campaign",
      ],
      ...filtered.map((a) => {
        const round = recruitments.find((r) => r.id === a.recruitment_id);
        return [
          a.created_at,
          a.status,
          a.role,
          `${a.first_name} ${a.last_name}`,
          a.email,
          a.phone,
          a.city ?? "",
          round ? round.title : "Unassigned",
        ];
      }),
    ];
    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = "applicants.csv";
    el.click();
  };

  const counts = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    hired: applications.filter((a) => a.status === "hired").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  if (loading || roleLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Please log in.
      </div>
    );
  if (!isAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        No admin access.
      </div>
    );

  return (
    <AdminLayout
      title="Applicants & Recruitment"
      subtitle="Recruitment pipeline, campaign history, and candidate applications"
      actions={
        <button
          onClick={exportCSV}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      }
    >
      {/* Active Recruitment Status Card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full shrink-0",
                activeRecruitment
                  ? "bg-emerald-500 animate-pulse ring-4 ring-emerald-50"
                  : "bg-gray-300"
              )}
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {activeRecruitment
                    ? activeRecruitment.title
                    : "No active recruitment campaign"}
                </p>
                {activeRecruitment ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wide">
                    Closed
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeRecruitment
                  ? `Opened ${new Date(
                      activeRecruitment.created_at
                    ).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })} — accepting candidate applications via Careers page.`
                  : "Start a campaign whenever you need more cleaners; candidates can only apply when a campaign is active."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pastRecruitments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-gray-500" />
                <span>History ({pastRecruitments.length})</span>
                {showHistory ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>
            )}
            {!showRecruit && (
              <button
                onClick={() => setShowRecruit(true)}
                disabled={!!activeRecruitment || recruitmentSaving}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                Start recruitment
              </button>
            )}
            {activeRecruitment && (
              <button
                onClick={closeRecruitment}
                disabled={recruitmentSaving}
                className="px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {recruitmentSaving ? "Closing..." : "Close recruitment"}
              </button>
            )}
          </div>
        </div>

        {showRecruit && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              New campaign title
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={recruitmentTitle}
                onChange={(e) => setRecruitmentTitle(e.target.value)}
                placeholder="e.g. Domestic Cleaner Spring 2026"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <div className="flex gap-2">
                <button
                  onClick={startRecruitment}
                  disabled={recruitmentSaving}
                  className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                >
                  {recruitmentSaving ? "Starting..." : "Launch Campaign"}
                </button>
                <button
                  onClick={() => setShowRecruit(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Starting a new recruitment will automatically close any active
              campaign.
            </p>
          </div>
        )}

        {/* Recruitment Campaign History Accordion */}
        {showHistory && pastRecruitments.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Past Recruitment Campaigns
              </h4>
              {recruitmentFilter !== "all" && (
                <button
                  onClick={() => setRecruitmentFilter("all")}
                  className="text-xs font-semibold text-green-600 hover:underline"
                >
                  Reset campaign filter
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pastRecruitments.map((round) => {
                const roundApps = applications.filter(
                  (a) => a.recruitment_id === round.id
                );
                const isSelected = recruitmentFilter === round.id;
                return (
                  <div
                    key={round.id}
                    onClick={() =>
                      setRecruitmentFilter(isSelected ? "all" : round.id)
                    }
                    className={cn(
                      "p-3.5 rounded-xl border cursor-pointer transition-all text-left flex flex-col justify-between gap-2",
                      isSelected
                        ? "border-green-500 bg-green-50/50 shadow-sm"
                        : "border-gray-200 bg-gray-50/60 hover:bg-white hover:border-gray-300"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {round.title}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 uppercase">
                          Closed
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>
                          {new Date(round.created_at).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                          {round.closed_at
                            ? ` — ${new Date(
                                round.closed_at
                              ).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 text-xs">
                      <span className="text-gray-500 font-medium">
                        {roundApps.length}{" "}
                        {roundApps.length === 1 ? "applicant" : "applicants"}
                      </span>
                      <span
                        className={cn(
                          "font-semibold text-xs",
                          isSelected ? "text-green-700" : "text-gray-400"
                        )}
                      >
                        {isSelected ? "Filtered ✓" : "Click to filter"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: counts.total, icon: Users2 },
          { label: "Pending", value: counts.pending, icon: Clock3 },
          { label: "Hired", value: counts.hired, icon: CheckCircle2 },
          { label: "Rejected", value: counts.rejected, icon: XCircle },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {label}
            </p>
            <p className="text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters & Active Campaign Pill */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6 flex flex-col gap-3">
        {recruitmentFilter !== "all" && (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 text-green-900">
              <Layers className="w-3.5 h-3.5 text-green-700" />
              <span>
                Filtered by campaign:{" "}
                <strong>
                  {recruitments.find((r) => r.id === recruitmentFilter)
                    ?.title || "Selected Campaign"}
                </strong>
              </span>
            </div>
            <button
              onClick={() => setRecruitmentFilter("all")}
              className="font-bold text-green-700 hover:text-green-900 underline ml-2"
            >
              Clear filter
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                "all",
                "pending",
                "reviewing",
                "shortlisted",
                "hired",
                "rejected",
              ] as const
            ).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                  statusFilter === s
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No applicants found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {paginated.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setLocation(`/admin/applicants/${a.id}`)}
              className={cn(
                "w-full text-left flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group",
                i !== 0 && "border-t border-gray-50"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-green-700">
                  {a.first_name[0]}
                  {a.last_name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">
                    {a.first_name} {a.last_name}
                  </p>
                  <span
                    className={cn(
                      "text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide",
                      STATUS_STYLES[a.status]
                    )}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {a.role}
                  {a.employment_type ? ` · ${a.employment_type}` : ""}
                </p>
                <p className="text-xs text-gray-400">
                  {a.email} · {a.phone}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {a.city && (
                  <p className="text-xs text-gray-300 mt-0.5">{a.city}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        <Pagination
          page={page}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </div>
    </AdminLayout>
  );
}
