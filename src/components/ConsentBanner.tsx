import { useEffect, useState } from "react";
import { COOKIE_CONSENT_KEY, loadAnalyticsIfConsented } from "@/lib/analytics";

type Consent = "accepted" | "rejected" | null;

export const OPEN_COOKIE_SETTINGS_EVENT = "mmc:open-cookie-settings";

export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
  }
}

export default function ConsentBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [forceVisible, setForceVisible] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY) as Consent;
    const valid = stored === "accepted" || stored === "rejected" ? stored : null;
    setConsent(valid);
    setAnalytics(valid !== "rejected");
    if (valid === "accepted") {
      loadAnalyticsIfConsented();
    }
    setReady(true);

    const onOpenSettings = () => {
      const current = window.localStorage.getItem(COOKIE_CONSENT_KEY) as Consent;
      setAnalytics(current === "accepted");
      setOpen(true);
      setForceVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpenSettings);
  }, []);

  const save = (value: Exclude<Consent, null>) => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setConsent(value);
    setOpen(false);
    setForceVisible(false);
    if (value === "accepted") {
      loadAnalyticsIfConsented();
    }
  };

  if (!ready || (consent && !forceVisible)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60]">
      <div className="max-w-5xl mx-auto bg-gray-900 text-white rounded-2xl shadow-2xl border border-gray-800 p-4 sm:p-5">
        {!open ? (
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">We use cookies</p>
              <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                We use essential cookies for login and site functionality, and optional analytics cookies (Google Tag Manager) only if you accept.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setOpen(true)} className="btn-ghost bg-white/5 text-white hover:bg-white/10 px-4 py-2">
                Customize
              </button>
              <button onClick={() => save("rejected")} className="btn-secondary px-4 py-2 border-gray-600 text-white bg-transparent hover:bg-white/10">
                Reject all
              </button>
              <button onClick={() => save("accepted")} className="btn-primary px-4 py-2">
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Cookie preferences</p>
              <p className="text-sm text-gray-300 mt-1">Choose which cookies you allow. Essential cookies are always on.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-gray-700 bg-white/5 p-4 flex items-start gap-3">
                <input checked disabled type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-500 text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Essential cookies</p>
                    <span className="text-xs text-green-400 font-medium">(required)</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">Needed for login, checkout security, and core site features.</p>
                </div>
              </label>
              <label className="rounded-xl border border-gray-700 bg-white/5 p-4 flex items-start gap-3 cursor-pointer">
                <input checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-500 text-green-600 focus:ring-green-500" />
                <div>
                  <p className="font-semibold text-sm">Analytics cookies</p>
                  <p className="text-xs text-gray-300 mt-1">Help us understand page visits and improve the site (only loaded when enabled).</p>
                </div>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {consent ? (
                <button onClick={() => { setOpen(false); setForceVisible(false); }} className="btn-ghost bg-white/5 text-white hover:bg-white/10 px-4 py-2">
                  Cancel
                </button>
              ) : (
                <button onClick={() => setOpen(false)} className="btn-ghost bg-white/5 text-white hover:bg-white/10 px-4 py-2">
                  Back
                </button>
              )}
              <button onClick={() => save("rejected")} className="btn-secondary px-4 py-2 border-gray-600 text-white bg-transparent hover:bg-white/10">
                Reject all
              </button>
              <button onClick={() => save(analytics ? "accepted" : "rejected")} className="btn-primary px-4 py-2">
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
