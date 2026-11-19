import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { User, Phone, MapPin, Mail, Save, Download, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { walesCities } from "@/lib/services";
import { useSettings } from "@/hooks/useSettings";

interface Profile {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

export default function Profile() {
  const settings = useSettings();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", address: "", city: "", postcode: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "", address: data.address ?? "", city: data.city ?? "", postcode: data.postcode ?? "" });
        setFetchingProfile(false);
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    // profiles is the master — update it first
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...profile });
    if (profileErr) {
      setSaveError(profileErr.message || "Failed to save profile. Please try again.");
      setSaving(false);
      return;
    }
    // propagate contact/location to every table that mirrors this user's personal data
    const contactPatch = {
      phone:    profile.phone    || null,
      address:  profile.address  || null,
      city:     profile.city     || null,
      postcode: profile.postcode || null,
    };
    // staff table has no address column — sync only the fields it supports
    await Promise.all([
      supabase.from("staff").update({ phone: contactPatch.phone, city: contactPatch.city, postcode: contactPatch.postcode }).eq("user_id", user.id),
      supabase.from("job_applications").update(contactPatch).eq("user_id", user.id),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExportMyData = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const [bookingsRes, plansRes, reviewsRes, loyaltyRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", user.id),
        supabase.from("recurring_plans").select("*").eq("user_id", user.id),
        supabase.from("reviews").select("*").eq("user_id", user.id),
        supabase.from("loyalty_points").select("*").eq("user_id", user.id),
      ]);
      const exportPayload = {
        exported_at: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
        profile,
        bookings: bookingsRes.data ?? [],
        recurring_plans: plansRes.data ?? [],
        reviews: reviewsRes.data ?? [],
        loyalty_points: loyaltyRes.data ?? [],
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `makemeclean-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading || fetchingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">Manage your personal details and address.</p>
        </div>

        {/* Avatar */}
        <div className="card mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center shadow">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{profile.full_name || "Your Name"}</p>
            <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {user?.email}
            </div>
          </div>
        </div>

        <div className="card">
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              {saveError}
            </div>
          )}
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
              <Save className="w-4 h-4" /> Profile saved successfully!
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="label flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Full Name</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Jane Smith"
                className="input-field"
                data-testid="input-fullname"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Number</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+44 7700 000000"
                className="input-field"
                data-testid="input-phone"
              />
            </div>
            <hr className="border-gray-100" />
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Address Details</p>
            <div>
              <label className="label">Postcode</label>
              <input
                type="text"
                value={profile.postcode}
                onChange={(e) => setProfile({ ...profile, postcode: e.target.value.toUpperCase() })}
                placeholder="CF10 1AB"
                className="input-field"
                data-testid="input-postcode"
              />
            </div>
            <div>
              <label className="label">Street Address</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="12 High Street"
                className="input-field"
                data-testid="input-address"
              />
            </div>
            <div>
              <label className="label">City</label>
              <select
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="input-field"
                data-testid="select-city"
              >
                <option value="">Select city</option>
                {walesCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="button-save-profile"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        {/* UK GDPR Data & Privacy Controls */}
        <div className="card mt-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Your Data &amp; UK GDPR Rights</h2>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Download a machine-readable copy of your personal profile, bookings, recurring plans, and reviews, or request permanent account deletion.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportMyData}
              disabled={exporting}
              className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Preparing Export..." : "Export My Data (JSON)"}
            </button>
            <a
              href={`mailto:${settings.email_info || "info@makemeclean.co.uk"}?subject=${encodeURIComponent("UK GDPR Account Deletion Request")}&body=${encodeURIComponent(`Please permanently delete my MakeMeClean account and personal data (subject to statutory HMRC invoice retention).\n\nAccount email: ${user?.email || ""}\nUser ID: ${user?.id || ""}`)}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold transition-colors text-center"
            >
              Request Account Deletion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
