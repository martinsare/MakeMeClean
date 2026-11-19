// Edge function: ai-chat
// Rate-limited AI customer support widget backed by Groq.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Lightweight per-isolate fallback rate limiter in addition to DB-backed check_rate_limit
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || now >= entry.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

function corsHeaders(req?: Request) {
  const configured = Deno.env.get("ALLOWED_ORIGIN");
  const reqOrigin = req?.headers.get("Origin") ?? "";
  let allowOrigin = configured || "https://makemeclean.co.uk";
  if (
    reqOrigin &&
    (reqOrigin === "https://makemeclean.co.uk" ||
      reqOrigin === "https://www.makemeclean.co.uk" ||
      reqOrigin.startsWith("http://localhost:") ||
      reqOrigin.startsWith("http://127.0.0.1:") ||
      (configured && reqOrigin === configured))
  ) {
    allowOrigin = reqOrigin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

const SYSTEM_PROMPT = `You are a helpful, friendly customer support assistant for MakeMeClean, a professional cleaning company based in Wales, UK.

About MakeMeClean:
- We provide professional domestic and commercial cleaning services across Wales
- Services include: regular house cleaning, deep cleaning, Airbnb turnover cleaning, ironing & laundry, and office cleaning
- We are fully insured and our staff are DBS checked
- We accept online bookings 24/7 through our website
- Payment is taken securely online via Stripe when confirming your booking
- Free cancellation or rescheduling with at least 24 hours' notice; cancellations between 3 and 24 hours incur a 30% fee; cancellations under 3 hours before start time are non-refundable

Your role:
- Answer questions about our cleaning services, pricing, and booking process
- Guide customers to book online or contact us
- Be warm, professional, and use British English spelling
- Keep responses concise — ideally 2–4 sentences
- Never make up specific prices — direct customers to the booking calculator on /book
- Admin-only info: do not reveal admin page URLs or internal operational details
- Only share URLs from the Site pages list below

If asked about something unrelated to cleaning or the company, politely steer the conversation back.`;

const SITE_BASE_URL = "https://makemeclean.co.uk";

const SITE_LINKS = `Site pages:
- ${SITE_BASE_URL}/ (homepage)
- ${SITE_BASE_URL}/services (cleaning services overview)
- ${SITE_BASE_URL}/book (online booking wizard)
- ${SITE_BASE_URL}/login (sign in)
- ${SITE_BASE_URL}/register (create an account)
- ${SITE_BASE_URL}/bookings (manage bookings, reschedules, cancellations, refunds)
- ${SITE_BASE_URL}/plans (manage recurring plans)
- ${SITE_BASE_URL}/contact (contact form & support)
- ${SITE_BASE_URL}/careers (jobs & applications)
- ${SITE_BASE_URL}/terms (Terms & Conditions)
- ${SITE_BASE_URL}/privacy (Privacy Policy)
- ${SITE_BASE_URL}/cancellation (Cancellation Policy)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  try {
    // Rate limit per IP: max 20 chat turns per 10 minutes
    const clientIp = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    let allowed = checkMemoryRateLimit(`ai-chat:${clientIp}`, 20, 10 * 60 * 1000);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (allowed && supabaseUrl && serviceKey) {
      try {
        const db = createClient(supabaseUrl, serviceKey);
        const { data: dbAllowed } = await db.rpc("check_rate_limit", {
          p_key: `ai-chat:${clientIp}`,
          p_max_requests: 20,
          p_window_seconds: 600,
        });
        if (dbAllowed === false) allowed = false;
      } catch {
        // Keep memory rate-limit result if RPC not yet deployed
      }
    }

    if (!allowed) {
      return json(
        429,
        {
          reply:
            "You've sent quite a few messages in a short time. Please wait a few minutes or contact our team directly on the Contact page.",
        },
        req,
      );
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      return json(
        200,
        {
          reply:
            "Hi! I'm the MakeMeClean virtual assistant. Our live chat is temporarily unavailable, but you can reach us directly via the Contact page or phone number in the footer.",
        },
        req,
      );
    }

    const rawText = await req.text();
    if (rawText.length > 16_000) {
      return json(413, { error: "Payload too large" }, req);
    }

    const body = JSON.parse(rawText);
    const messages: { role: "user" | "assistant"; content: string }[] = Array.isArray(body?.messages)
      ? body.messages
          .filter(
            (message: unknown): message is { role: "user" | "assistant"; content: string } =>
              typeof message === "object" &&
              message !== null &&
              "role" in message &&
              "content" in message &&
              typeof (message as any).role === "string" &&
              ["user", "assistant"].includes((message as any).role) &&
              typeof (message as any).content === "string",
          )
          .slice(-8)
          .map((message) => ({
            role: message.role,
            content: message.content.trim().slice(0, 1000),
          }))
      : [];

    if (!messages.length || messages[messages.length - 1]?.role !== "user" || !messages[messages.length - 1]?.content) {
      return json(400, { error: "No message provided" }, req);
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\n${SITE_LINKS}` }, ...messages],
        max_tokens: 300,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq error:", { status: res.status, body: String(err).slice(0, 1000) });
      return json(
        200,
        {
          reply:
            "I'm having a little trouble right now. Please try again in a moment, or contact us directly — our details are in the footer.",
        },
        req,
      );
    }

    const data = await res.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "I'm not sure about that — please get in touch with us directly and we'll be happy to help!";

    return json(200, { reply }, req);
  } catch (err) {
    console.error("ai-chat error:", err);
    return json(500, { error: "Internal server error" }, req);
  }
});
