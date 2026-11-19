import { useState } from "react";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { useSettings } from "@/hooks/useSettings";

export default function UnsubscribePage() {
  const settings = useSettings();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setStatus("idle");

    try {
      const { error } = await supabase.rpc("unsubscribe_newsletter", {
        p_email: email.trim().toLowerCase(),
      });

      if (error) {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setMessage("You've been unsubscribed. We won't send you any more marketing emails.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage("Error processing your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-green-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Newsletter Unsubscribe
        </h1>
        <p className="text-gray-500 text-center mb-8 text-sm">
          Enter your email address to unsubscribe from our newsletter
        </p>

        {status === "success" && (
          <div className="mb-6 flex gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900 text-sm">{message}</p>
              <p className="text-xs text-green-700 mt-1">
                You may take up to 7 days to stop receiving emails from our systems.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-900 text-sm font-semibold">{message}</p>
          </div>
        )}

        <form onSubmit={handleUnsubscribe} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || status === "success"}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors text-sm disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Unsubscribe"}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center mb-4">
            Your privacy is important to us. See how we handle your data:
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/privacy" className="text-xs text-green-600 hover:text-green-700 font-semibold">
              Privacy Policy
            </Link>
            <span className="text-gray-300">·</span>
            <a href={`mailto:${settings.contact_email}`} className="text-xs text-green-600 hover:text-green-700 font-semibold">
              Contact Us
            </a>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          UK GDPR compliant • Instant processing
        </p>
      </div>
    </div>
  );
}
