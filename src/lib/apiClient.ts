import { supabase } from './supabase';
import {
  DURATION_STEP_HOURS,
  MAX_DURATION_HOURS,
  MIN_DURATION_HOURS,
  START_HOURS,
} from "../../shared/booking";

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status = 400, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function canUseSupabaseFallback(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && error.status === 404)
  );
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json().catch(() => ({
    ok: false,
    error: `HTTP Error ${res.status}: ${res.statusText}`,
  }));

  if (!res.ok || json.ok === false) {
    throw new ApiError(json.error || `Request failed with status ${res.status}`, res.status, json.details);
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  // ─── Config & System ──────────────────────────────────────────────────────
  getConfig: async () => {
    try {
      return await request('/api/config');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      return {
        apiVersion: '2.2.0',
        siteUrl: window.location.origin,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
        supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      };
    }
  },

  getSettings: async () => {
    try {
      return await request<Record<string, string>>('/api/settings');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data, error: queryError } = await supabase.from('settings').select('key, value');
      if (queryError) throw new ApiError(queryError.message, 500);
      const settingsMap: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        if (row.key) settingsMap[row.key] = row.value || '';
      });
      return settingsMap;
    }
  },

  getServiceCities: async () => {
    try {
      return await request<string[]>('/api/service-cities');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data, error: queryError } = await supabase
        .from('service_cities')
        .select('name')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (queryError) throw new ApiError(queryError.message, 500);
      return (data || []).map((c: any) => c.name);
    }
  },

  getServices: async () => {
    try {
      return await request<any[]>('/api/services');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data, error: queryError } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('price', { ascending: true });
      if (queryError) throw new ApiError(queryError.message, 500);
      return data || [];
    }
  },

  // ─── Dashboard ────────────────────────────────────────────────────────────
  getDashboard: async () => {
    try {
      return await request<{
        profile: any;
        counts: { total: number; upcoming: number; in_progress: number; completed: number; cancelled: number };
        recent_bookings: any[];
        services: any[];
        loyalty: { points: number; tier: string; discount_percent: number; next_tier_points: number };
        unread_notifications_count: number;
      }>('/api/dashboard');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('Unauthorized', 401);

      const [profileRes, bookingsRes, servicesRes, notifsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('services').select('*').eq('active', true),
        supabase.from('notifications').select('*').eq('user_id', user.id).eq('read', false),
      ]);
      const queryError = [profileRes, bookingsRes, servicesRes, notifsRes].find(
        (result) => result.error,
      )?.error;
      if (queryError) throw new ApiError(queryError.message, 500);

      const bookings = bookingsRes.data || [];
      const counts = {
        total: bookings.length,
        upcoming: bookings.filter(b => ['upcoming', 'pending', 'confirmed'].includes(b.status)).length,
        in_progress: bookings.filter(b => b.status === 'in_progress').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
      };

      const { data: ledgerRows } = await supabase
        .from('loyalty_points')
        .select('points')
        .eq('user_id', user.id);
      const points = Math.max(
        0,
        (ledgerRows || []).reduce((sum: number, row: any) => sum + Number(row.points || 0), 0)
      );
      let tier = 'Bronze';
      let discount_percent = 0;
      let next_tier_points = 500;
      if (points >= 2500) {
        tier = 'Platinum';
        discount_percent = 15;
        next_tier_points = 2500;
      } else if (points >= 1000) {
        tier = 'Gold';
        discount_percent = 10;
        next_tier_points = 2500;
      } else if (points >= 500) {
        tier = 'Silver';
        discount_percent = 5;
        next_tier_points = 1000;
      }

      return {
        profile: profileRes.data || { id: user.id, email: user.email },
        counts,
        recent_bookings: bookings.slice(0, 5),
        services: servicesRes.data || [],
        loyalty: { points, tier, discount_percent, next_tier_points },
        unread_notifications_count: notifsRes.data?.length || 0,
      };
    }
  },

  // ─── Booking Options & Creation ───────────────────────────────────────────
  getBookingOptions: async () => {
    try {
      return await request<{
        services: any[];
        cities: string[];
        discounts: Record<string, number>;
        startHours: string[];
        minDurationHours: number;
        maxDurationHours: number;
        durationStepHours: number;
      }>('/api/booking-options');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const [servicesRes, settingsRes, citiesRes] = await Promise.all([
        supabase.from('services').select('*').eq('active', true).order('price', { ascending: true }),
        supabase.from('settings').select('key, value'),
        supabase.from('service_cities').select('name').eq('is_active', true).order('name', { ascending: true }),
      ]);
      const queryError = [servicesRes, settingsRes, citiesRes].find(
        (result) => result.error,
      )?.error;
      if (queryError) throw new ApiError(queryError.message, 500);

      const discounts: Record<string, number> = {};
      (settingsRes.data || []).forEach((row: any) => {
        if (row.key?.startsWith('discount_')) {
          discounts[row.key.replace('discount_', '')] = parseFloat(row.value) || 0;
        }
      });

      return {
        services: servicesRes.data || [],
        cities: (citiesRes.data || []).map((c: any) => c.name),
        discounts,
        startHours: [...START_HOURS],
        minDurationHours: MIN_DURATION_HOURS,
        maxDurationHours: MAX_DURATION_HOURS,
        durationStepHours: DURATION_STEP_HOURS,
      };
    }
  },

  createBooking: async (payload: {
    serviceId: string;
    date: string;
    startHour?: string;
    durationHours?: number;
    timeSlot?: string;
    address: string;
    city: string;
    postcode: string;
    notes?: string;
    recurringFreq?: string;
    bedrooms?: number;
    bathrooms?: number;
    livingRooms?: number;
    extras?: string[];
    propertyType?: string;
    accessMethod?: string;
    suppliesOption?: string;
    parkingOption?: string;
    hasPets?: boolean;
  }) => {
    return request<{ booking: any; invoiceNumber: string }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ─── Bookings Management ──────────────────────────────────────────────────
  getBookings: async (status?: string) => {
    try {
      return await request<any[]>(
        status && status !== 'all' ? `/api/bookings?status=${encodeURIComponent(status)}` : '/api/bookings'
      );
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('Unauthorized', 401);

      let query = supabase.from('bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      const { data, error: queryError } = await query;
      if (queryError) throw new ApiError(queryError.message, 500);
      return data || [];
    }
  },

  getBooking: async (id: string) => {
    try {
      return await request<any>(`/api/bookings/${id}`);
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data, error: queryError } = await supabase.from('bookings').select('*').eq('id', id).single();
      if (queryError) throw new ApiError(queryError.message, 404);
      return data;
    }
  },

  cancelBooking: (id: string) =>
    request<any>(`/api/bookings/${id}/cancel`, {
      method: 'POST',
    }),

  // ─── Reschedules ──────────────────────────────────────────────────────────
  getReschedule: (bookingId: string) => request<any>(`/api/bookings/${bookingId}/reschedule`),

  requestReschedule: (bookingId: string, payload: {
    requestedDate: string;
    requestedTime: string;
    reason?: string;
  }) =>
    request<any>(`/api/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Checkout & Payments ──────────────────────────────────────────────────
  createCheckoutSession: (bookingId: string, payload?: { returnUrl?: string }) =>
    request<{ sessionId: string; checkoutUrl: string; bookingId: string; amount: number }>(
      `/api/bookings/${bookingId}/checkout`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    ),

  // ─── Invoices ─────────────────────────────────────────────────────────────
  getInvoice: (bookingId: string) => request<any>(`/api/bookings/${bookingId}/invoice`),

  // ─── Photos ───────────────────────────────────────────────────────────────
  getBookingPhotos: (bookingId: string) =>
    request<any[]>(`/api/bookings/${bookingId}/photos`),

  addBookingPhoto: (
    bookingId: string,
    payload: { storagePath?: string; photoUrl?: string; photoType?: 'before' | 'after' | 'issue' }
  ) =>
    request<any>(`/api/bookings/${bookingId}/photos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteBookingPhoto: (bookingId: string, photoId: string) =>
    request<any>(`/api/bookings/${bookingId}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    }),

  // ─── Admin Staff & Loyalty Helpers ────────────────────────────────────────
  deleteStaff: (staffId: string) =>
    request<{ ok: boolean; success: boolean; authRevoked?: boolean; message?: string }>(
      `/api/staff/${encodeURIComponent(staffId)}`,
      { method: 'DELETE' }
    ),

  awardLoyaltyPoints: (payload: { email?: string; userId?: string; points: number; reason?: string }) =>
    request<any>('/api/loyalty', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Refunds ──────────────────────────────────────────────────────────────
  requestRefund: (bookingId: string, payload: { reason: string; amount?: number }) =>
    request<any>(`/api/bookings/${bookingId}/refund`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Recurring Plans ──────────────────────────────────────────────────────
  getPlans: async () => {
    try {
      return await request<any[]>('/api/plans');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('Unauthorized', 401);
      const { data, error: queryError } = await supabase
        .from('recurring_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (queryError) throw new ApiError(queryError.message, 500);
      return data || [];
    }
  },

  updatePlanStatus: (planId: string, status: 'active' | 'paused' | 'cancelled') =>
    request<any>(`/api/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // ─── Contact, Loyalty, Notifications ──────────────────────────────────────
  sendContactMessage: async (payload: { name: string; email: string; phone?: string; subject?: string; message: string }) => {
    try {
      return await request<any>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { error: insertError } = await supabase.from('contact_messages').insert({
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        subject: payload.subject || 'Website Inquiry',
        message: payload.message,
        status: 'new',
      });
      if (insertError) throw new ApiError(insertError.message, 500);
      return { success: true };
    }
  },

  getLoyalty: async () => {
    try {
      return await request<any>('/api/loyalty');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('Unauthorized', 401);
      const { data: ledgerRows, error: ledgerError } = await supabase
        .from('loyalty_points')
        .select('points')
        .eq('user_id', user.id);
      if (ledgerError) throw new ApiError(ledgerError.message, 500);
      const points = Math.max(
        0,
        (ledgerRows || []).reduce((sum: number, row: any) => sum + Number(row.points || 0), 0)
      );
      let tier = 'Bronze';
      let discount_percent = 0;
      let next_tier_points = 500;
      if (points >= 2500) {
        tier = 'Platinum';
        discount_percent = 15;
        next_tier_points = 2500;
      } else if (points >= 1000) {
        tier = 'Gold';
        discount_percent = 10;
        next_tier_points = 2500;
      } else if (points >= 500) {
        tier = 'Silver';
        discount_percent = 5;
        next_tier_points = 1000;
      }
      return {
        points,
        tier,
        discount_percent,
        next_tier_points,
        points_to_next_tier: Math.max(0, next_tier_points - points),
        history: [],
      };
    }
  },

  getNotifications: async () => {
    try {
      return await request<any[]>('/api/notifications');
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('Unauthorized', 401);
      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (queryError) throw new ApiError(queryError.message, 500);
      return data || [];
    }
  },

  markNotificationsRead: async (notificationId?: string) => {
    try {
      return await request<any>('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ notificationId }),
      });
    } catch (error) {
      if (!canUseSupabaseFallback(error)) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('Unauthorized', 401);
      let query = supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
      if (notificationId) {
        query = query.eq('id', notificationId);
      }
      const { error: queryError } = await query;
      if (queryError) throw new ApiError(queryError.message, 500);
      return { success: true };
    }
  },
};
