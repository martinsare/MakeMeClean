import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
export {
  BOOKING_PROPERTY_TYPES,
  ACCESS_METHODS,
  CLEANING_SUPPLIES_OPTIONS,
  calculateRecommendedHours,
  calculateDurationHours,
  calcTimeSlot,
  DEFAULT_BOOKING_EXTRAS,
  DEFAULT_DURATION_MULTIPLIERS,
  DURATION_STEP_HOURS,
  MAX_DURATION_HOURS,
  MAX_ROOM_COUNTS,
  MIN_DURATION_HOURS,
  parseDurationMultipliers,
  parseBookingExtras,
  isBookingStartTimePassed,
  isBookingEndTimePassed,
  START_HOURS,
  BOOKING_DAYS,
  DEFAULT_WEEKLY_AVAILABILITY,
  parseWeeklyAvailability,
  getDayKeyFromDateStr,
} from '../../shared/booking.js';
export type {
  BookingDurationMultipliers,
  BookingExtra,
  BookingDayKey,
  DayAvailabilityConfig,
  WeeklyAvailabilitySchedule,
} from '../../shared/booking.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

export interface ApiHandlerContext {
  req: VercelRequest;
  res: VercelResponse;
  supabase: SupabaseClient;
  user?: AuthenticatedUser;
}

// ─── Environment Variables ──────────────────────────────────────────────────
export function getEnv(name: string, fallback = ''): string {
  const aliases: Record<string, string[]> = {
    SUPABASE_URL: ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'ANON_KEY', 'VITE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY'],
    TELEGRAM_BOT_TOKEN: ['TELEGRAM_BOT_TOKEN', 'BOT_TOKEN'],
    TELEGRAM_CHAT_ID: ['TELEGRAM_CHAT_ID', 'TELEGRAM_ADMIN_CHAT_ID'],
    TELEGRAM_ADMIN_CHAT_ID: ['TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_CHAT_ID'],
    SITE_URL: ['SITE_URL', 'VITE_SITE_URL', 'NEXT_PUBLIC_SITE_URL'],
    STRIPE_SECRET_KEY: ['STRIPE_SECRET_KEY'],
    STRIPE_WEBHOOK_SECRET: ['STRIPE_WEBHOOK_SECRET'],
    GROQ_API_KEY: ['GROQ_API_KEY'],
  };

  const keysToCheck = aliases[name] || [name, `VITE_${name}`, `NEXT_PUBLIC_${name}`];
  for (const k of keysToCheck) {
    if (process.env[k]) return process.env[k] as string;
  }
  return fallback;
}

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
export const SITE_URL = getEnv('SITE_URL', 'https://makemeclean.co.uk').replace(/\/$/, '');
export const STRIPE_SECRET_KEY = getEnv('STRIPE_SECRET_KEY', '');
export const TELEGRAM_BOT_TOKEN = getEnv('TELEGRAM_BOT_TOKEN', '');
export const TELEGRAM_CHAT_ID = getEnv('TELEGRAM_CHAT_ID', '');

// ─── Supabase Client Factory ────────────────────────────────────────────────
export function getServerSupabase(token?: string): SupabaseClient {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY');
  if (!url || !key) {
    throw new Error('Supabase URL or Key missing in server environment variables.');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

// ─── CORS & Response Utilities ──────────────────────────────────────────────
function isOriginAllowed(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    // 1. Production site & local testing
    if (
      host === 'makemeclean.co.uk' ||
      host.endsWith('.makemeclean.co.uk') ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0'
    ) {
      return true;
    }

    // 2. Vercel deployments (*.vercel.app)
    if (host.endsWith('.vercel.app')) {
      return true;
    }

    // 3. Replit deployments (*.replit.dev, *.replit.app)
    if (host.endsWith('.replit.dev') || host.endsWith('.replit.app')) {
      return true;
    }

    // 4. Configured environment variables (SITE_URL, CORS_ALLOWED_ORIGINS, REPLIT_DOMAINS)
    const configured = [
      getEnv('SITE_URL'),
      ...getEnv('CORS_ALLOWED_ORIGINS').split(','),
      ...getEnv('REPLIT_DOMAINS').split(','),
    ];
    for (const entry of configured) {
      if (!entry.trim()) continue;
      try {
        if (new URL(entry.trim().startsWith('http') ? entry.trim() : 'https://' + entry.trim()).origin === url.origin) {
          return true;
        }
      } catch (_) {}
    }
  } catch (_) {
    return false;
  }
  return false;
}

export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    if (isOriginAllowed(requestOrigin)) {
      try {
        const originUrl = new URL(requestOrigin).origin;
        res.setHeader('Access-Control-Allow-Origin', originUrl);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      } catch (_) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    } else {
      // If origin is not recognized, still allow standard API access rather than hard 403 on standard public queries
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function sendJson(res: VercelResponse, status: number, data: unknown) {
  return res.status(status).json(data);
}

export function sendSuccess(res: VercelResponse, data: unknown, status = 200) {
  return sendJson(res, status, { ok: true, data });
}

export function sendError(res: VercelResponse, message: string, status = 400, details?: unknown) {
  return sendJson(res, status, { ok: false, error: message, ...(details ? { details } : {}) });
}

// ─── Authentication Verification ────────────────────────────────────────────
export function extractBearerToken(req: VercelRequest): string | null {
  const header = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function verifyAuth(req: VercelRequest): Promise<{
  user: AuthenticatedUser | null;
  supabase: SupabaseClient | null;
  error?: string;
}> {
  const token = extractBearerToken(req);
  if (!token) {
    return { user: null, supabase: null, error: 'Missing or invalid Authorization header' };
  }

  try {
    const supabase = getServerSupabase(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { user: null, supabase, error: error?.message || 'Unauthorized' };
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
      },
      supabase,
    };
  } catch {
    return { user: null, supabase: null, error: 'Authentication failed' };
  }
}

// ─── Business Rules & Pricing Calculations ──────────────────────────────────
export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}${month}${day}-${randomSuffix}`;
}

export function resolveServiceImageUrl(serviceId: string, dbImageUrl: string | null | undefined): string {
  if (dbImageUrl && dbImageUrl.startsWith('http')) {
    return dbImageUrl;
  }

  const fallbacks: Record<string, string> = {
    'standard-cleaning': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80',
    'regular-cleaning': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&auto=format&fit=crop&q=80',
    'one-off-cleaning': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80',
    'deep-cleaning': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&auto=format&fit=crop&q=80',
    'spring-cleaning': 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&auto=format&fit=crop&q=80',
    'same-day-cleaning': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80',
    'airbnb-cleaning': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
    'ironing-service': 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800&auto=format&fit=crop&q=80',
    'cleaning-and-ironing': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80',
    'housekeeping': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
    'office-cleaning': 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80',
  };

  const normalized = serviceId.toLowerCase().trim().replace(/[ _]/g, '-');
  if (fallbacks[normalized]) {
    return fallbacks[normalized];
  }

  if (dbImageUrl && dbImageUrl.trim()) {
    if (dbImageUrl.startsWith('/')) {
      return `${SITE_URL}${dbImageUrl}`;
    }
    return dbImageUrl;
  }

  return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80';
}

