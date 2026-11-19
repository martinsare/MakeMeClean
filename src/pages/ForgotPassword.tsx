import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Mail, CheckCircle, RefreshCw } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { sendOtp, verifyOtp } from "@/lib/otp";

type Stage = "email" | "verify" | "reset" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const normalizedEmail = email.trim().toLowerCase();

  const readFunctionError = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (typeof body?.error === "string") return body.error;
        if (typeof body?.message === "string") return body.message;
      } catch {
        try {
          const text = await error.context.text();
          if (text) return text;
        } catch {
          // ignore and fall through
        }
      }
    }
    return error instanceof Error ? error.message : "Failed to reset password";
  };

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await sendOtp(normalizedEmail, "password_reset");
    if (!result.ok) {
      setError(result.error ?? "Failed to send code");
      setLoading(false);
      return;
    }
    setStage("verify");
    startCooldown();
    setLoading(false);
  };

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (next.every((d) => d !== "")) {
      verifyCode(next.join(""));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(""));
      verifyCode(digits);
    }
  };

  const verifyCode = async (code: string) => {
    setVerifying(true);
    setError("");
    const result = await verifyOtp(normalizedEmail, code, "password_reset");
    if (!result.ok || !result.verified || !result.resetToken) {
      const msg =
        result.reason === "too_many_attempts"
          ? "Too many incorrect attempts. Please request a new code."
          : result.reason === "expired_or_not_found"
            ? "Code expired or not found. Please request a new one."
            : "Incorrect code. Please try again.";
      setError(msg);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setVerifying(false);
      return;
    }
    setResetToken(result.resetToken);
    setStage("reset");
    setVerifying(false);
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError("");
    setOtp(["", "", "", "", "", ""]);
    const result = await sendOtp(normalizedEmail, "password_reset");
    if (!result.ok) setError(result.error ?? "Failed to resend code");
    else startCooldown();
    setResending(false);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 8 characters and include a letter and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!resetToken) {
      setError("Reset session expired. Please request a new code.");
      setStage("email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await supabase.functions.invoke("reset-password", {
        body: { email: normalizedEmail, password, resetToken },
      });
      if (res.error) {
        setError(await readFunctionError(res.error));
        setLoading(false);
        return;
      }
      if (!res.data?.ok) {
        setError(res.data?.error || "Failed to reset password");
        setLoading(false);
        return;
      }
      setStage("done");
      setLoading(false);
      setTimeout(() => setLocation("/login"), 2000);
    } catch (err) {
      setError("Failed to reset password. Please try again.");
      setLoading(false);
    }
  };

  if (stage === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Password Reset
          </h2>
          <p className="text-gray-500 text-sm">
            Your password has been updated. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

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
            {stage === "email" && "Reset your password"}
            {stage === "verify" && "Check your email"}
            {stage === "reset" && "Create new password"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {stage === "email" && "Enter your email address to get started"}
            {stage === "verify" && `We sent a 6-digit code to ${email}`}
            {stage === "reset" && "Enter your new password"}
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          {stage === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending code..." : "Send Reset Code"}
              </button>
            </form>
          )}

          {stage === "verify" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center">
                  <Mail className="w-7 h-7 text-green-600" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 text-center mb-4 uppercase tracking-wide">
                  Enter verification code
                </p>
                <div
                  className="flex gap-2 justify-center"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpInput(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={verifying}
                      className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all disabled:opacity-50 bg-white"
                    />
                  ))}
                </div>
                {verifying && (
                  <p className="text-center text-xs text-gray-400 mt-3">
                    Verifying...
                  </p>
                )}
              </div>

              <div className="text-center space-y-2">
                <button
                  onClick={resendCode}
                  disabled={resendCooldown > 0 || resending}
                  className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resending
                    ? "Sending..."
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {stage === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 chars (letter + number)"
                    className="input-field pr-11"
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
              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="input-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPw ? (
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
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-5">
            <Link
              href="/login"
              className="text-green-600 font-semibold hover:underline"
            >
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
