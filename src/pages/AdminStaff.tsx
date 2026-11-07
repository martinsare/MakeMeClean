import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, X, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import Pagination from "@/components/Pagination";
import { useScrollLock } from "@/hooks/useScrollLock";
import { StaffRecord } from "@/types";
import { PAGE_SIZE } from "@/lib/constants";
import Spinner from "@/components/Spinner";

type Staff = StaffRecord;

interface ApplicantLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
}

export default function AdminStaff() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [applicants, setApplicants] = useState<ApplicantLite[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  useScrollLock(addOpen);
  const [addMode, setAddMode] = useState<"applicant" | "manual">("manual");
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    email: string;
    pass: string;
  } | null>(null);
  const [manualForm, setManualForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "Cardiff",
    postcode: "",
    role: "Cleaner",
    createLogin: true,
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchStaff = async () => {
    const { data, error: err } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      return [];
    }
    const rows = (data as Staff[]) ?? [];

    // profiles is the single source of truth — batch-fetch for all staff with a user_id
    const userIds = rows.map((s) => s.user_id).filter(Boolean) as string[];
    const profileMap = new Map<
      string,
      { city: string | null; postcode: string | null; phone: string | null }
    >();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, city, postcode, phone")
        .in("id", userIds);
      for (const p of profs ?? [])
        profileMap.set(p.id, {
          city: p.city,
          postcode: p.postcode,
          phone: p.phone,
        });
    }

    return rows.map((s) => {
      const prof = s.user_id ? profileMap.get(s.user_id) : null;
      return {
        ...s,
        // profiles wins → fall back to staff table copy
        _city: prof?.city ?? s.city ?? null,
        _postcode: prof?.postcode ?? s.postcode ?? null,
        _phone: prof?.phone ?? s.phone ?? null,
      };
    });
  };

  const fetchApplicants = async (currentStaff: Staff[]) => {
    const { data } = await supabase
      .from("job_applications")
      .select("id, first_name, last_name, email, role, status")
      .in("status", ["hired", "shortlisted"]);
    const alreadyAdded = new Set(
      currentStaff.map((s) => s.application_id).filter(Boolean)
    );
    setApplicants(
      ((data as any[]) ?? [])
        .filter((r) => !alreadyAdded.has(r.id))
        .map((r) => ({
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          role: r.role,
          status: r.status,
        }))
    );
  };

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setFetching(true);
      const loaded = await fetchStaff();
      setStaff(loaded);
      setFetching(false);
      await fetchApplicants(loaded);
    })();
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(
      (s) =>
        q === "" ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.role ?? "").toLowerCase().includes(q)
    );
  }, [staff, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createFromApplicant = async () => {
    if (!selectedId) return;
    setCreating(true);
    const { data: app, error: appErr } = await supabase
      .from("job_applications")
      .select("*")
      .eq("id", selectedId)
      .single();
    if (appErr || !app) {
      setError("Applicant not found");
      setCreating(false);
      return;
    }

    // Fall back to the user's profile for any missing contact/location fields
    let profileCity = null;
    let profilePostcode = null;
    let profileAddress = null;
    let profilePhone = null;
    if (app.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("city, postcode, address, phone")
        .eq("id", app.user_id)
        .maybeSingle();
      if (prof) {
        profileCity = prof.city ?? null;
        profilePostcode = prof.postcode ?? null;
        profileAddress = prof.address ?? null;
        profilePhone = prof.phone ?? null;
      }
    }

    const { error: err } = await supabase.from("staff").insert({
      application_id: app.id,
      user_id: app.user_id,
      first_name: app.first_name,
      last_name: app.last_name,
      email: app.email,
      phone: app.phone ?? profilePhone,
      city: app.city ?? profileCity,
      postcode: app.postcode ?? profilePostcode,
      role: app.role,
      active: true,
    });
    if (err) {
      setError(err.message);
      setCreating(false);
      return;
    }
    setAddOpen(false);
    setSelectedId("");
    setCreating(false);
    const updatedStaff = await fetchStaff();
    setStaff(updatedStaff);
    await fetchApplicants(updatedStaff);
  };

  const createManualStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (
      !manualForm.firstName.trim() ||
      !manualForm.lastName.trim() ||
      !manualForm.email.trim()
    ) {
      setError("Please fill in first name, last name, and email.");
      return;
    }

    setCreating(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          first_name: manualForm.firstName,
          last_name: manualForm.lastName,
          email: manualForm.email,
          phone: manualForm.phone || null,
          city: manualForm.city || null,
          postcode: manualForm.postcode || null,
          role: manualForm.role || "Cleaner",
          create_login: manualForm.createLogin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create staff member");
      }

      setAddOpen(false);
      setManualForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        city: "Cardiff",
        postcode: "",
        role: "Cleaner",
        createLogin: true,
      });

      if (data.tempPassword) {
        setTempPasswordModal({
          email: manualForm.email,
          pass: data.tempPassword,
        });
      }

      const updated = await fetchStaff();
      setStaff(updated);
    } catch (err: any) {
      setError(err?.message || "Failed to create staff member");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("staff").update({ active }).eq("id", id);
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)));
  };

  const deleteStaff = async (id: string) => {
    await supabase.from("staff").delete().eq("id", id);
    const updated = staff.filter((s) => s.id !== id);
    setStaff(updated);
    setConfirmDeleteId(null);
    await fetchApplicants(updated);
  };

  const getCity = (s: Staff) =>
    s._city ?? (s._postcode ? s._postcode.toUpperCase() : "—");
  const getPhone = (s: Staff) => s._phone ?? "—";

  const activeCount = staff.filter((s) => Boolean(s.active)).length;
  const inactiveCount = staff.filter((s) => !Boolean(s.active)).length;

  if (loading || roleLoading || fetching)
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
      title="Staff"
      subtitle="Manage cleaners and internal team members"
      actions={
        <button
          onClick={() => setAddOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <UserPlus className="w-4 h-4" /> Add staff
        </button>
      }
    >
      {/* Add staff modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !creating && setAddOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">
                Add staff member
              </p>
              <button
                onClick={() => setAddOpen(false)}
                disabled={creating}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/50 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAddMode("manual");
                  setError("");
                }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                  addMode === "manual"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Add Directly
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode("applicant");
                  setError("");
                }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                  addMode === "applicant"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                From Job Applicant ({applicants.length})
              </button>
            </div>

            {addMode === "manual" ? (
              <form onSubmit={createManualStaff}>
                <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        First name *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualForm.firstName}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            firstName: e.target.value,
                          })
                        }
                        placeholder="e.g. Sarah"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Last name *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualForm.lastName}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            lastName: e.target.value,
                          })
                        }
                        placeholder="e.g. Jenkins"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Email address *
                    </label>
                    <input
                      type="email"
                      required
                      value={manualForm.email}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, email: e.target.value })
                      }
                      placeholder="cleaner@example.co.uk"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Phone number
                      </label>
                      <input
                        type="tel"
                        value={manualForm.phone}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            phone: e.target.value,
                          })
                        }
                        placeholder="+44 7..."
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Role
                      </label>
                      <select
                        value={manualForm.role}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, role: e.target.value })
                        }
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="Cleaner">Cleaner</option>
                        <option value="Lead Cleaner">Lead Cleaner</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Inspector">Inspector</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        City / Town
                      </label>
                      <input
                        type="text"
                        value={manualForm.city}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, city: e.target.value })
                        }
                        placeholder="e.g. Cardiff, Swansea"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={manualForm.postcode}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            postcode: e.target.value,
                          })
                        }
                        placeholder="e.g. CF10 1AA"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualForm.createLogin}
                      onChange={(e) =>
                        setManualForm({
                          ...manualForm,
                          createLogin: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-gray-800">
                        Generate Staff Login Portal Access
                      </p>
                      <p className="text-gray-500">
                        Automatically creates login credentials so cleaner can
                        access their dashboard and shifts
                      </p>
                    </div>
                  </label>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}
                </div>

                <div className="px-6 pb-6 pt-3 flex justify-end gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Spinner /> Creating staff...
                      </>
                    ) : (
                      "Create Staff Member"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select shortlisted applicant
                    </label>
                    {applicants.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">
                        No shortlisted or hired applicants available to add.
                      </p>
                    ) : (
                      <select
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        disabled={creating}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">
                          Choose a shortlisted or hired applicant…
                        </option>
                        {applicants.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.first_name} {a.last_name} — {a.role} ({a.status})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}
                </div>
                <div className="px-6 pb-6 flex justify-end gap-3">
                  <button
                    onClick={() => setAddOpen(false)}
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createFromApplicant}
                    disabled={!selectedId || creating}
                    className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Spinner /> Adding...
                      </>
                    ) : (
                      "Add to staff"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Temporary Password Modal for Direct Staff Creation */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Staff Login Created!
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              A staff login account was created for{" "}
              <strong>{tempPasswordModal.email}</strong>. Please provide them
              with these temporary credentials:
            </p>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 font-mono text-sm mb-5 space-y-1">
              <div>
                <span className="text-gray-500">Email:</span>{" "}
                <span className="text-gray-900 font-bold">
                  {tempPasswordModal.email}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Temp Password:</span>{" "}
                <span className="text-green-700 font-bold">
                  {tempPasswordModal.pass}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              They will be prompted to change this temporary password upon their
              first login.
            </p>
            <button
              onClick={() => setTempPasswordModal(null)}
              className="w-full py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total staff", value: staff.length },
          { label: "Active", value: activeCount },
          { label: "Inactive", value: inactiveCount },
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

      {error && !addOpen && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff name, email, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <p className="text-gray-400 font-medium">No staff members found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {paginated.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "grid md:grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-gray-50 transition-colors",
                i !== 0 && "border-t border-gray-50"
              )}
            >
              <div className="md:col-span-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-green-700">
                    {s.first_name[0]}
                    {s.last_name[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {getPhone(s)}
                  </p>
                </div>
              </div>
              <div className="md:col-span-3 text-sm text-gray-500 truncate">
                {s.email}
              </div>
              <div className="md:col-span-2 text-sm text-gray-600">
                {s.role ?? "—"}
              </div>
              <div className="md:col-span-2 text-sm text-gray-500">
                {getCity(s)}
              </div>
              <div className="md:col-span-2 flex md:justify-end items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    s.active ? "text-emerald-600" : "text-gray-400"
                  )}
                >
                  {s.active ? "Active" : "Inactive"}
                </span>
                <button
                  role="switch"
                  aria-checked={Boolean(s.active)}
                  onClick={() => toggleActive(s.id, !Boolean(s.active))}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500",
                    s.active ? "bg-emerald-500" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                      s.active ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
                {confirmDeleteId === s.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteStaff(s.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Remove staff member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
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
