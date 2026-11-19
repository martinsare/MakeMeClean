export const COOKIE_CONSENT_KEY = "makemeclean_cookie_consent";
const GTM_ID = "GTM-N4R8ZXHZ";

let gtmLoaded = false;

export function hasAnalyticsConsent(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function loadAnalyticsIfConsented() {
  if (!hasAnalyticsConsent() || gtmLoaded || typeof document === "undefined") return;
  gtmLoaded = true;
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push({
    "gtm.start": new Date().getTime(),
    event: "gtm.js",
  });
  const script = document.createElement("script");
  script.async = true;
  script.id = "mmc-gtm-script";
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

export function initializeAnalytics() {
  if (hasAnalyticsConsent()) {
    loadAnalyticsIfConsented();
  }
}

export function trackPageView(path: string, title: string) {
  if (!hasAnalyticsConsent()) return;
  if ((window as any).dataLayer) {
    (window as any).dataLayer.push({
      event: "page_view",
      page_path: path,
      page_title: title,
    });
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  if (!hasAnalyticsConsent()) return;
  if ((window as any).dataLayer) {
    (window as any).dataLayer.push({
      event: eventName,
      ...(eventData ?? {}),
    });
  }
}

// Track booking events
export function trackBookingStarted() {
  trackEvent("booking_started");
}

export function trackBookingCompleted(bookingId: string, amount: number) {
  trackEvent("booking_completed", {
    booking_id: bookingId,
    amount: amount,
  });
}

// Track sign up
export function trackSignUp() {
  trackEvent("sign_up");
}

// Track sign in
export function trackSignIn() {
  trackEvent("login");
}
