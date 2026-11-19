import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Lock, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function ChangePassword() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [loading, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Use at least 10 characters including at least one letter and one number.");
      return;
    }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { ...(user?.user_metadata ?? {}), must_change_password: false },
    });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    let destination = "/dashboard";
    if (user?.id) {
      const [{ data: adminRow }, { data: staffRow }] = await Promise.all([
        supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("staff").select("id").eq("user_id", user.id).eq("active", true).maybeSingle(),
      ]);
      if (adminRow) destination = "/admin";
      else if (staffRow) destination = "/staff";
    }
    setDone(true);
    setSubmitting(false);
    setTimeout(() => setLocation(destination), 900);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full card">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-green-600" />
          <h1 className="text-2xl font-extrabold text-gray-900">Change password</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">For security, please set a new password before continuing.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
        {done && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Updated. Redirecting…
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? "Saving..." : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}

