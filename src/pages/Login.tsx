import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

async function getPostLoginRedirect(userId: string) {
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminRow) return "/admin";

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (staffRow) return "/staff";

  return "/dashboard";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    if (user) {
      getPostLoginRedirect(user.id)
        .then((target) => {
          if (!cancelled) setLocation(target);
        })
        .catch(() => {
          if (!cancelled) setLocation("/dashboard");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password }
    );

    if (signInError) {
      setError(signInError.message || "Sign in failed. Please try again.");
    } else if (data.user) {
      try {
        setLocation(await getPostLoginRedirect(data.user.id));
      } catch {
        setLocation("/dashboard");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5">
            <img
              src="/logo.png"
              alt="MakeMeClean"
              className="w-10 h-10 rounded-xl object-cover shadow"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span
              className="text-2xl font-black text-gray-900 tracking-tight"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Make<span className="text-green-600">Me</span>Clean
            </span>
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Welcome back
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Sign in to manage your bookings
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                data-testid="input-email"
              />
            </div>
            <div>
              <label className="label flex items-center justify-between">
                <span>Password</span>
                <Link
                  href="/forgot-password"
                  className="text-xs text-green-600 font-semibold hover:underline"
                >
                  Forgot?
                </Link>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-11"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="button-login"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-green-600 font-semibold hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
