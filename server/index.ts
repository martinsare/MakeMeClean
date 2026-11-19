import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleCors,
  sendError,
  sendSuccess,
  getClientIp,
  checkServerRateLimit,
} from './_lib/server.js';
import { handleConfig } from './_handlers/config.js';
import { handleServices } from './_handlers/services.js';
import { handleSettings } from './_handlers/settings.js';
import { handleServiceCities } from './_handlers/service-cities.js';
import { handleBookingOptions } from './_handlers/booking-options.js';
import { handleDashboard } from './_handlers/dashboard.js';
import { handleBookings } from './_handlers/bookings.js';
import { handlePlans } from './_handlers/plans.js';
import { handleLoyalty } from './_handlers/loyalty.js';
import { handleContact } from './_handlers/contact.js';
import { handleNotifications } from './_handlers/notifications.js';
import { handleStaff } from './_handlers/staff.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // Extract clean subpath
  let path = '';

  if (typeof req.query?.path === 'string') {
    path = req.query.path;
  } else if (Array.isArray(req.query?.path)) {
    path = req.query.path.join('/');
  } else {
    const rawUrl = req.url || '';
    const cleanUrl = rawUrl.split('?')[0];
    path = cleanUrl.replace(/^\/api(\/|$)/, '').replace(/\/$/, '');
  }

  path = path.replace(/^\/+/, '');
  const segments = path.split('/').filter(Boolean);
  const route = segments[0] || '';
  const subPath = segments.slice(1).join('/');

  try {
    switch (route) {
      case 'health':
        return res.status(200).json({ status: 'ok', time: new Date().toISOString() });
      case 'client-error': {
        if (req.method !== 'POST') return sendError(res, 'Method not allowed', 405);
        const ip = getClientIp(req);
        const allowed = await checkServerRateLimit(`client_error:${ip}`, 10, 300);
        if (!allowed) return sendError(res, 'Too many error reports', 429);
        const body = req.body || {};
        console.error('[Client ErrorBoundary Report]', {
          ip,
          url: String(body.url || '').slice(0, 300),
          message: String(body.message || '').slice(0, 500),
          stack: String(body.stack || '').slice(0, 1500),
          componentStack: String(body.componentStack || '').slice(0, 1500),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
        });
        return sendSuccess(res, { received: true });
      }
      case 'config':
        return await handleConfig(req, res);
      case 'services':
        return await handleServices(req, res);
      case 'settings':
        return await handleSettings(req, res);
      case 'service-cities':
        return await handleServiceCities(req, res);
      case 'booking-options':
        return await handleBookingOptions(req, res);
      case 'dashboard':
        return await handleDashboard(req, res);
      case 'bookings':
        return await handleBookings(req, res, subPath);
      case 'plans':
        return await handlePlans(req, res, subPath);
      case 'loyalty':
        return await handleLoyalty(req, res);
      case 'contact':
        return await handleContact(req, res);
      case 'notifications':
        return await handleNotifications(req, res);
      case 'staff':
        return await handleStaff(req, res, subPath);
      default:
        return sendError(res, `API route not found: /api/${path}`, 404);
    }
  } catch (err: any) {
    console.error(`[API Error] /api/${path}:`, err);
    return sendError(res, 'Internal server error', 500);
  }
}

