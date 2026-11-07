import { useEffect, useState } from "react";
import { Plus, X, Upload, Trash2, AlertTriangle } from "lucide-react";
import type { DbService } from "@/lib/services";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import AdminLayout from "@/components/admin/AdminLayout";
import { useScrollLock } from "@/hooks/useScrollLock";

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
  );
}

export default function AdminServices() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [services, setServices] = useState<DbService[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  useScrollLock(!!editingId);
  const [draft, setDraft] = useState<Partial<DbService>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const slugify = (s: string) =>
    (s ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 64);

  const fetchServices = async () => {
    setFetching(true);
    setError("");
    const { data, error: err } = await supabase
      .from("services")
      .select("*")
      .order("name", { ascending: true });
    if (err) {
      setError(err.message);
      setServices([]);
    } else setServices((data as DbService[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchServices();
  }, [isAdmin]);

  const openEdit = (s?: DbService) => {
    setEditingId(s?.id ?? "__new__");
    setDraft(
      s
        ? { ...s }
        : {
            name: "",
            description: "",
            price: 0,
            image_url: null,
            discount_percent: 0,
            popular: false,
            active: true,
            category: "domestic",
            badge: "",
            tagline: "",
            icon: "🧹",
            sort_order: 0,
          }
    );
    setError("");
  };

  const closeEdit = () => {
    setEditingId(null);
    setError("");
  };

  const confirmDelete = (s: DbService) => {
    setDeletingId(s.id);
    setDeletingName(s.name);
    setError("");
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    setError("");
    try {
      const { error: err } = await supabase
        .from("services")
        .delete()
        .eq("id", deletingId);
      if (err) throw err;
      setDeletingId(null);
      setDeletingName("");
      await fetchServices();
    } catch (e: any) {
      setError(e?.message || "Failed to delete service");
    } finally {
      setIsDeleting(false);
    }
  };

  const save = async () => {
    if (!draft.name?.trim() || !draft.description?.trim()) {
      setError("Name and description are required.");
      return;
    }
    const computedId =
      editingId === "__new__"
        ? slugify(String(draft.name))
        : String((draft as DbService).id);
    if (!computedId) {
      setError("Service name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      id: computedId,
      name: String(draft.name),
      description: String(draft.description),
      price: Number(String(draft.price ?? "").replace(/[^\d.]/g, "")) || 0,
      image_url: draft.image_url ? String(draft.image_url) : null,
      discount_percent:
        Number(String(draft.discount_percent ?? "").replace(/[^\d.]/g, "")) ||
        0,
      popular: Boolean(draft.popular),
      active: Boolean(draft.active),
      category: String(draft.category || "domestic"),
      badge: draft.badge ? String(draft.badge).trim() : null,
      tagline: draft.tagline ? String(draft.tagline).trim() : null,
      icon: String(draft.icon || "🧹"),
      sort_order: Number(draft.sort_order ?? 0) || 0,
    };
    const { error: err } = await supabase
      .from("services")
      .upsert(payload, { onConflict: "id" });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditingId(null);
    await fetchServices();
  };

  const uploadImage = async (file: File) => {
    const serviceId =
      editingId === "__new__"
        ? slugify(String(draft.name ?? ""))
        : String((draft as DbService).id ?? "");
    if (!serviceId) {
      setError("Enter a service name before uploading an image.");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext)
        ? ext
        : "jpg";
      const path = `services/${serviceId}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("service-images")
        .upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage
        .from("service-images")
        .getPublicUrl(path);
      setDraft((p) => ({ ...p, image_url: data.publicUrl }));
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading || roleLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  if (!user || !isAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {!user ? "Please log in." : "Admin access required."}
      </div>
    );

  const activeCount = services.filter((s) => Boolean(s.active)).length;
  const popularCount = services.filter((s) => Boolean(s.popular)).length;
  const inactiveCount = services.filter((s) => !Boolean(s.active)).length;

  return (
    <AdminLayout
      title="Services"
      subtitle="Manage cleaning services and pricing"
      actions={
        <button
          onClick={() => openEdit()}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> New service
        </button>
      }
    >
      {/* Edit / New panel */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && closeEdit()}
          />
          <div className="relative bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <p className="text-base font-bold text-gray-900">
                {editingId === "__new__" ? "Add new service" : "Edit service"}
              </p>
              <button
                onClick={closeEdit}
                disabled={saving}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-5">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Service name
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g. Deep Clean"
                    value={draft.name ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={draft.description ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price per hour (£)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={
                      draft.price === undefined || draft.price === null
                        ? ""
                        : String(draft.price)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw.trim() === "") {
                        setDraft((p) => ({
                          ...p,
                          price: "" as unknown as number,
                        }));
                        return;
                      }
                      setDraft((p) => ({
                        ...p,
                        price: raw.replace(/[^\d.]/g, "") as unknown as number,
                      }));
                    }}
                    onBlur={() => {
                      const n = Number(
                        String(draft.price ?? "").replace(/[^\d.]/g, "")
                      );
                      setDraft((p) => ({
                        ...p,
                        price: Number.isFinite(n) ? n : 0,
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={draft.category ?? "domestic"}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    <option value="domestic">Classic Domestic Cleaning</option>
                    <option value="deep">Deep Cleaning & Spring Reset</option>
                    <option value="airbnb">Holiday Rental & Airbnb</option>
                    <option value="ironing">Ironing & Laundry Service</option>
                    <option value="commercial">Office & Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tagline / Short Hook
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Day-to-day routine housekeeping & maintenance"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={draft.tagline ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, tagline: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Badge (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Most Popular, Host Special, Intensive"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={draft.badge ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, badge: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Icon / Emoji
                    </label>
                    <input
                      type="text"
                      placeholder="🧹, 🧽, 🏨, 🧺, 🏢"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={draft.icon ?? "🧹"}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, icon: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      placeholder="1"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={draft.sort_order ?? 0}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          sort_order: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discount (%)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={
                      draft.discount_percent === undefined ||
                      draft.discount_percent === null
                        ? ""
                        : String(draft.discount_percent)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw.trim() === "") {
                        setDraft((p) => ({
                          ...p,
                          discount_percent: "" as unknown as number,
                        }));
                        return;
                      }
                      setDraft((p) => ({
                        ...p,
                        discount_percent: raw.replace(
                          /[^\d.]/g,
                          ""
                        ) as unknown as number,
                      }));
                    }}
                    onBlur={() => {
                      const n = Number(
                        String(draft.discount_percent ?? "").replace(
                          /[^\d.]/g,
                          ""
                        )
                      );
                      setDraft((p) => ({
                        ...p,
                        discount_percent: Number.isFinite(n)
                          ? Math.max(0, Math.min(100, n))
                          : 0,
                      }));
                    }}
                  />
                </div>

                {/* Image */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Service image
                  </label>
                  <div className="grid sm:grid-cols-2 gap-4 items-start">
                    <label
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-sm",
                        uploadingImage
                          ? "border-green-300 bg-green-50 text-green-600"
                          : "border-gray-200 text-gray-500 hover:border-green-300 hover:bg-green-50"
                      )}
                    >
                      <Upload className="w-4 h-4 shrink-0" />
                      {uploadingImage ? "Uploading..." : "Upload image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f);
                        }}
                      />
                    </label>
                    <div
                      className={cn(
                        "rounded-2xl overflow-hidden border bg-gray-50 h-36",
                        draft.image_url
                          ? "border-gray-200"
                          : "border-dashed border-gray-200"
                      )}
                    >
                      {draft.image_url ? (
                        <img
                          src={String(draft.image_url)}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-gray-300">
                          No image
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Flags */}
                <div className="sm:col-span-2 flex gap-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-green-600 rounded"
                      checked={Boolean(draft.popular)}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, popular: e.target.checked }))
                      }
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Mark as popular
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-green-600 rounded"
                      checked={Boolean(draft.active)}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, active: e.target.checked }))
                      }
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Active (visible on site)
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={closeEdit}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Spinner /> Saving...
                  </>
                ) : editingId === "__new__" ? (
                  "Create service"
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total services", value: services.length },
          { label: "Active", value: activeCount },
          { label: "Popular", value: popularCount },
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

      {/* Service list */}
      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <p className="text-gray-400 font-medium">
            No services yet. Add your first service.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className={cn(
                "bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all",
                s.active ? "border-gray-100" : "border-gray-100 opacity-60"
              )}
            >
              {/* Image */}
              <div className="h-36 bg-gray-50 overflow-hidden">
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🧹
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-base font-bold text-gray-900 leading-snug">
                      {s.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        {s.category === "domestic" && "Classic Domestic"}
                        {s.category === "deep" && "Deep Cleaning"}
                        {s.category === "airbnb" && "Airbnb Turnover"}
                        {s.category === "ironing" && "Ironing & Laundry"}
                        {s.category === "commercial" && "Commercial & Office"}
                        {![
                          "domestic",
                          "deep",
                          "airbnb",
                          "ironing",
                          "commercial",
                        ].includes(s.category ?? "") &&
                          (s.category || "General")}
                      </span>
                      {s.badge && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                          {s.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {s.popular && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Popular
                      </span>
                    )}
                    {!s.active && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                  {s.description}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-black text-gray-900">
                      {formatCurrency(Number(s.price))}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">/ hr</span>
                    {Number(s.discount_percent ?? 0) > 0 && (
                      <span className="ml-2 text-xs font-bold text-green-600">
                        {s.discount_percent}% off
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(s)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:border-green-200 hover:text-green-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(s)}
                      title="Delete service"
                      className="p-1.5 rounded-xl border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete Service?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-bold text-gray-900">"{deletingName}"</span>?
              This service will be permanently removed from the booking catalog
              and client pages.
            </p>
            <div className="flex justify-end gap-3">
              <button
                disabled={isDeleting}
                onClick={() => {
                  setDeletingId(null);
                  setDeletingName("");
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Spinner /> Deleting...
                  </>
                ) : (
                  "Delete Service"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
