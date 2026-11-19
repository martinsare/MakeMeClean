import {
  VercelRequest,
  VercelResponse,
  verifyAuth,
  getAdminSupabase,
  sendSuccess,
  sendError,
  calcTimeSlot,
  calculateDurationHours,
  calculateBookingPrice,
  generateInvoiceNumberAsync,
  resolveServiceImageUrl,
  getEnv,
  escapeTelegramMarkdown,
  BOOKING_PROPERTY_TYPES,
  calculateRecommendedHoursForService,
  getServiceFieldLimits,
  getAllowedExtrasForService,
  MAX_DURATION_HOURS,
  MIN_DURATION_HOURS,
  parseBookingExtras,
  parseDurationMultipliers,
  getHoursUntilBookingStart,
  isBookingStartTimePassed,
  parseWeeklyAvailability,
  getDayKeyFromDateStr,
  START_HOURS,
} from '../_lib/server.js';

const ACCEPTED_PROPERTY_TYPES: readonly string[] = [
  ...BOOKING_PROPERTY_TYPES,
  'House',
  'Flat / Apartment',
  'Apartment / Flat',
  'House / Flat',
  'House/Flat',
  'Studio / HMO',
  'Studio',
  'HMO / Shared House',
  'House / Cottage',
  'Studio / Pod',
  'Private Residence',
  'Shared House / Flat',
  'Business / Boutique',
  'Private Office',
  'Open Plan / Coworking',
  'Retail / Studio',
  'Clinic / Practice',
];

function parseRoomCount(value: unknown, maximum: number): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  ) {
    return null;
  }

  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= maximum
    ? count
    : null;
}

function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = Date.parse(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === dateStr;
}

function calculateNextRecurringDate(currentDateStr: string, frequency: string): string {
  const [y, m, d] = currentDateStr.split('-').map(Number);
  if (frequency === 'weekly') {
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'fortnightly' || frequency === 'biweekly') {
    const next = new Date(Date.UTC(y, m - 1, d + 14));
    return next.toISOString().slice(0, 10);
  }
  // Monthly with month-end clamping (e.g. Jan 31 -> Feb 28/29)
  const targetYear = m === 12 ? y + 1 : y;
  const targetMonth = m === 12 ? 1 : m + 1;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  const next = new Date(Date.UTC(targetYear, targetMonth - 1, clampedDay));
  return next.toISOString().slice(0, 10);
}

export async function handleBookings(
  req: VercelRequest,
  res: VercelResponse,
  subPath: string,
  params: Record<string, string> = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const auth = await verifyAuth(req);
  if (!auth.user || !auth.supabase) {
    return sendError(res, 'Authentication required', 401);
  }

  const { supabase, user } = auth;
  const admin = getAdminSupabase();
  const segments = subPath.split('/').filter(Boolean);

  // ─── 1. /api/bookings (List & Create) ──────────────────────────────────────
  if (segments.length === 0) {
    if (method === 'GET') {
      const statusFilter = (req.query?.status as string) || '';
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'upcoming') {
          query = query.in('status', ['upcoming', 'pending', 'confirmed']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const { data, error } = await query;
      if (error) return sendError(res, error.message, 500);

      // Auto-cancel unpaid bookings whose UK scheduled start time has passed
      const expiredUnpaidIds = (data || [])
        .filter(
          (b) =>
            b.status === 'upcoming' &&
            b.payment_status !== 'paid' &&
            isBookingStartTimePassed(b.date, b.time_slot)
        )
        .map((b) => b.id);

      if (expiredUnpaidIds.length > 0) {
        const { error: expireErr } = await admin
          .from('bookings')
          .update({ status: 'cancelled' })
          .in('id', expiredUnpaidIds)
          .eq('user_id', user.id);
        if (expireErr) {
          console.error('[bookings GET] expire unpaid error:', expireErr);
        }
      }

      const items = (data || []).map((b) => ({
        ...b,
        status: expiredUnpaidIds.includes(b.id) ? 'cancelled' : b.status,
        imageUrl: resolveServiceImageUrl(b.service_type, null),
      }));
      return sendSuccess(res, items);
    }

    if (method === 'POST') {
      const bookingSettingKeys = [
        'booking_enabled',
        'booking_disabled_message',
        'booking_availability_schedule',
        'booking_extras',
        'room_calc_base_hours',
        'room_calc_bed_hours',
        'room_calc_bath_hours',
        'room_calc_living_hours',
        'discount_weekly',
        'discount_fortnightly',
        'discount_biweekly',
        'discount_monthly',
        'max_bookings_per_slot',
      ];
      const { data: settingsData, error: settingsError } = await admin
        .from('settings')
        .select('key, value')
        .in('key', bookingSettingKeys);
      if (settingsError) {
        return sendError(
          res,
          'Unable to verify the cleaning estimate. Please try again.',
          503
        );
      }

      const settingsMap: Record<string, string> = {};
      for (const setting of settingsData || []) {
        settingsMap[setting.key] = setting.value;
      }

      if (settingsMap['booking_enabled'] === 'false') {
        const disabledMsg =
          settingsMap['booking_disabled_message']?.trim() ||
          'We are currently fully booked and temporarily not accepting new bookings. Please try again later.';
        return sendError(res, disabledMsg, 403);
      }

      const weeklySchedule = parseWeeklyAvailability(settingsMap['booking_availability_schedule']);

      const body = req.body || {};
      const {
        serviceId,
        date,
        timeSlot: rawTimeSlot,
        startHour,
        durationHours: rawDuration,
        address,
        city,
        postcode,
        notes,
        recurringFreq = 'none',
        bedrooms = 2,
        bathrooms = 1,
        livingRooms = 1,
        extras = [],
        propertyType = 'House / Flat',
        accessMethod = 'home',
        suppliesOption = 'cleaner',
        parkingOption = 'free',
        hasPets = false,
      } = body;

      if (!serviceId || !date || !address || !postcode) {
        return sendError(res, 'Missing required booking fields (serviceId, date, address, postcode).', 400);
      }
      if (typeof date !== 'string' || !isValidIsoDate(date)) {
        return sendError(res, 'A valid booking date is required.', 400);
      }
      if (
        typeof address !== 'string' ||
        !address.trim() ||
        address.trim().length > 500 ||
        typeof postcode !== 'string' ||
        !postcode.trim() ||
        postcode.trim().length > 24 ||
        (city != null && (typeof city !== 'string' || city.trim().length > 160)) ||
        (notes != null && (typeof notes !== 'string' || notes.length > 2000))
      ) {
        return sendError(res, 'One or more booking fields are invalid.', 400);
      }
      if (
        recurringFreq &&
        !['none', 'one_off', 'weekly', 'biweekly', 'fortnightly', 'monthly'].includes(recurringFreq)
      ) {
        return sendError(res, 'Invalid recurring booking frequency.', 400);
      }

      const { data: service, error: svcErr } = await admin
        .from('services')
        .select('id, name, price, discount_percent, active')
        .eq('id', serviceId)
        .eq('active', true)
        .single();

      if (svcErr || !service) {
        return sendError(res, 'Selected service is unavailable.', 400);
      }

      const serviceKey = service.id || service.name;
      const fieldLimits = getServiceFieldLimits(serviceKey);
      const parsedBedrooms = parseRoomCount(bedrooms, fieldLimits.field1Max);
      const parsedBathrooms = parseRoomCount(bathrooms, fieldLimits.field2Max);
      const parsedLivingRooms = parseRoomCount(livingRooms, fieldLimits.field3Max);
      if (
        parsedBedrooms == null ||
        parsedBathrooms == null ||
        parsedLivingRooms == null
      ) {
        return sendError(
          res,
          'Property/load counts must be whole numbers within the allowed range for this service.',
          400
        );
      }
      if (
        typeof propertyType !== 'string' ||
        !ACCEPTED_PROPERTY_TYPES.includes(propertyType.trim())
      ) {
        return sendError(res, 'Select a valid property type.', 400);
      }
      const normalizedPropertyType = propertyType.trim();
      if (
        !Array.isArray(extras) ||
        extras.length > 20 ||
        extras.some((extra: unknown) => typeof extra !== 'string')
      ) {
        return sendError(res, 'Selected extras are invalid.', 400);
      }
      const selectedExtraIds = [
        ...new Set((extras as string[]).map((extra) => extra.trim())),
      ];
      if (selectedExtraIds.some((extraId) => !extraId)) {
        return sendError(res, 'Selected extras are invalid.', 400);
      }

      const estimateMultipliers = parseDurationMultipliers(settingsMap);
      const configuredExtras = parseBookingExtras(settingsMap['booking_extras']);
      if (!estimateMultipliers || !configuredExtras) {
        return sendError(
          res,
          'The cleaning estimate settings are invalid. Please contact us.',
          503
        );
      }

      const allowedExtrasForService = getAllowedExtrasForService(serviceKey, configuredExtras);
      const allowedExtraIds = new Set(allowedExtrasForService.map((extra) => extra.id));
      const unknownExtra = selectedExtraIds.find(
        (extraId) => !allowedExtraIds.has(extraId)
      );
      if (unknownExtra) {
        return sendError(res, 'One or more selected extras are unavailable.', 400);
      }

      const minimumDurationHours = calculateRecommendedHoursForService(
        serviceKey,
        parsedBedrooms,
        parsedBathrooms,
        parsedLivingRooms,
        selectedExtraIds,
        estimateMultipliers,
        configuredExtras
      );
      if (minimumDurationHours > MAX_DURATION_HOURS) {
        return sendError(
          res,
          `This property needs at least ${minimumDurationHours} hours, which is over the ${MAX_DURATION_HOURS}-hour online booking limit. Please contact us for a tailored quote.`,
          400,
          { minimumDurationHours }
        );
      }

      let durationHours = rawDuration == null ? 2 : Number(rawDuration);
      let timeSlot = rawTimeSlot;
      if (!Number.isFinite(durationHours)) {
        return sendError(res, 'Booking duration must be a valid number.', 400);
      }

      // Validate availability for the requested day and time slot
      const dayKey = getDayKeyFromDateStr(String(date));
      const dayConfig = weeklySchedule[dayKey];
      if (!dayConfig || !dayConfig.enabled) {
        return sendError(
          res,
          'We are not accepting bookings on this day. Please select an available day.',
          400
        );
      }

      const bookingStartHour =
        (typeof startHour === 'string' && startHour.trim()) ||
        (typeof timeSlot === 'string' && timeSlot.split(/[-–]/)[0]?.trim()) ||
        '09:00';

      if (dayConfig.slots && dayConfig.slots.length > 0 && !dayConfig.slots.includes(bookingStartHour)) {
        return sendError(
          res,
          `The selected time slot (${bookingStartHour}) is not available for bookings on this day. Available slots: ${dayConfig.slots.join(', ')}.`,
          400
        );
      }

      if (startHour != null && (typeof startHour !== 'string' || !/^(0[7-9]|1[0-7]):(00|30)$/.test(startHour))) {
        return sendError(res, 'Booking start time is invalid.', 400);
      }
      if (!timeSlot && startHour) {
        timeSlot = calcTimeSlot(startHour, durationHours);
      } else if (timeSlot) {
        if (
          typeof timeSlot !== 'string' ||
          !/^(0[7-9]|1[0-7]):(00|30)\s*[-–]\s*(0\d|1\d|2[0-9]):(00|30)$/.test(timeSlot)
        ) {
          return sendError(res, 'Booking time slot is invalid.', 400);
        }
        durationHours = calculateDurationHours(timeSlot);
      } else {
        timeSlot = '09:00 - 11:00';
        durationHours = 2.0;
      }

      if (isBookingStartTimePassed(date, timeSlot)) {
        return sendError(res, 'Cannot book a date and start time in the past.', 400);
      }

      if (durationHours < MIN_DURATION_HOURS || durationHours > MAX_DURATION_HOURS) {
        return sendError(
          res,
          `Booking duration must be between ${MIN_DURATION_HOURS} and ${MAX_DURATION_HOURS} hours.`,
          400
        );
      }
      const allowedFloorHours = Math.max(MIN_DURATION_HOURS, minimumDurationHours - 0.5);
      if (durationHours < allowedFloorHours) {
        return sendError(
          res,
          `The selected rooms and extras require at least ${allowedFloorHours} hours.`,
          400,
          { minimumDurationHours, allowedFloorHours }
        );
      }

      // Check slot capacity against configured maximum simultaneous bookings
      const maxPerSlotRaw = Number(settingsMap['max_bookings_per_slot']);
      const maxPerSlot = Number.isFinite(maxPerSlotRaw) && maxPerSlotRaw > 0 ? maxPerSlotRaw : 10;
      const { count: slotBookingCount, error: capErr } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('date', date)
        .neq('status', 'cancelled')
        .like('time_slot', `${bookingStartHour}%`);

      if (!capErr && typeof slotBookingCount === 'number' && slotBookingCount >= maxPerSlot) {
        return sendError(
          res,
          `Sorry, the ${bookingStartHour} slot on ${date} is now fully booked. Please select another time or date.`,
          409
        );
      }

      const baseHourlyRate = Number(service.price) || 20.0;
      const serviceDiscountPercent = Number(service.discount_percent) || 0;
      let recurringDiscountPercent = 0;
      let normalizedFreq: string | null = null;

      if (recurringFreq && recurringFreq !== 'none' && recurringFreq !== 'one_off') {
        normalizedFreq = recurringFreq === 'biweekly' ? 'fortnightly' : recurringFreq;
        if (normalizedFreq === 'weekly') {
          recurringDiscountPercent = Number(settingsMap['discount_weekly'] ?? 15);
        } else if (normalizedFreq === 'fortnightly') {
          recurringDiscountPercent = Number(
            settingsMap['discount_fortnightly'] ?? settingsMap['discount_biweekly'] ?? 10
          );
        } else if (normalizedFreq === 'monthly') {
          recurringDiscountPercent = Number(settingsMap['discount_monthly'] ?? 5);
        }
      }

      const pricing = calculateBookingPrice({
        baseHourlyRate,
        durationHours,
        serviceDiscountPercent,
        recurringDiscountPercent,
      });
      const finalPrice = pricing.finalPrice;
      const invoiceNumber = await generateInvoiceNumberAsync(admin);

      // Ensure profile row exists and fetch customer contact details for alerts
      let profile: { full_name?: string | null; phone?: string | null } | null = null;
      try {
        await admin.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
        const { data: profData } = await admin
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .maybeSingle();
        profile = profData;
      } catch (_) {}

      // Create recurring plan FIRST so the booking links directly to recurring_plan_id
      let createdPlanId: string | null = null;
      if (normalizedFreq && ['weekly', 'fortnightly', 'monthly'].includes(normalizedFreq)) {
        const nextBookingDate = calculateNextRecurringDate(date, normalizedFreq);
        const { data: planRow, error: planErr } = await admin
          .from('recurring_plans')
          .insert({
            user_id: user.id,
            service_type: service.id,
            service_name: service.name,
            frequency: normalizedFreq,
            start_time: bookingStartHour,
            duration_hours: durationHours,
            address: address.trim(),
            city: (city || 'South Wales').trim(),
            postcode: postcode.trim().toUpperCase(),
            price_per_visit: finalPrice,
            discount_percent: recurringDiscountPercent,
            status: 'active',
            next_booking_date: nextBookingDate,
            notes: notes && String(notes).trim() ? String(notes).trim() : null,
            bedrooms: parsedBedrooms,
            bathrooms: parsedBathrooms,
            living_rooms: parsedLivingRooms,
            extras: selectedExtraIds,
            property_type: normalizedPropertyType,
            access_method: accessMethod || 'home',
            supplies_option: suppliesOption || 'cleaner',
            parking_option: parkingOption || 'free',
            has_pets: Boolean(hasPets),
          })
          .select('id')
          .single();

        if (planErr || !planRow) {
          console.error('[Recurring Plan Insert Error]:', planErr);
          return sendError(res, 'Failed to set up recurring cleaning plan. Please try again.', 500);
        }
        createdPlanId = planRow.id;
      }

      const bookingInsert = {
        user_id: user.id,
        service_type: service.id,
        service_name: service.name,
        date,
        time_slot: timeSlot,
        address: address.trim(),
        city: (city || 'South Wales').trim(),
        postcode: postcode.trim().toUpperCase(),
        price: finalPrice,
        status: 'upcoming',
        payment_status: 'pending',
        notes: notes && String(notes).trim() ? String(notes).trim() : null,
        invoice_number: invoiceNumber,
        bedrooms: parsedBedrooms,
        bathrooms: parsedBathrooms,
        living_rooms: parsedLivingRooms,
        extras: selectedExtraIds,
        property_type: normalizedPropertyType,
        duration_hours: durationHours,
        access_method: accessMethod || 'home',
        supplies_option: suppliesOption || 'cleaner',
        parking_option: parkingOption || 'free',
        has_pets: Boolean(hasPets),
        recurring_plan_id: createdPlanId,
        recurring_freq: normalizedFreq || 'none',
      };

      const { data: booking, error: insertErr } = await admin
        .from('bookings')
        .insert(bookingInsert)
        .select()
        .single();

      if (insertErr || !booking) {
        if (createdPlanId) {
          await admin.from('recurring_plans').delete().eq('id', createdPlanId);
        }
        return sendError(res, insertErr?.message || 'Failed to create booking', 500);
      }

      // Redacted & escaped Telegram alert (no street address or lockbox codes in non-E2EE Telegram)
      try {
        const botToken = getEnv('TELEGRAM_BOT_TOKEN');
        const chatId = getEnv('TELEGRAM_ADMIN_CHAT_ID') || getEnv('TELEGRAM_CHAT_ID');
        const siteUrl = getEnv('SITE_URL', 'https://makemeclean.co.uk').replace(/\/$/, '');
        if (botToken && chatId) {
          const customerName = (profile?.full_name || user.email?.split('@')[0] || 'Customer').trim();
          const customerPhone = profile?.phone || 'Not provided';
          const extrasLabel = selectedExtraIds.length > 0 ? selectedExtraIds.join(', ') : 'None';
          const recurringLabel = normalizedFreq ? `${normalizedFreq} (Active plan)` : 'One-off';
          const accessLabel =
            accessMethod === 'home'
              ? 'Customer at home'
              : accessMethod === 'key_safe'
                ? 'Key safe / Lockbox'
                : accessMethod === 'concierge'
                  ? 'Concierge'
                  : accessMethod === 'hidden_key'
                    ? 'Hidden key'
                    : String(accessMethod || 'Customer at home');
          const suppliesLabel = suppliesOption === 'customer' ? 'Customer provides supplies' : 'Cleaner brings eco supplies';
          const parkingLabel =
            parkingOption === 'paid'
              ? 'Paid parking meter nearby'
              : parkingOption === 'none'
                ? 'No parking (public transport only)'
                : 'Free on-street/driveway';
          const petsLabel = hasPets ? 'Yes 🐾' : 'No';
          const postcodeOutward = String(booking.postcode || '').trim().split(/\s+/)[0];

          const lines = [
            `🧹 *New Booking Created*`,
            ``,
            `*Service:* ${escapeTelegramMarkdown(service.name)}`,
            `*Date:* ${escapeTelegramMarkdown(date)}`,
            `*Time Slot:* ${escapeTelegramMarkdown(`${timeSlot} (${durationHours}h)`)}`,
            `*Price:* £${finalPrice.toFixed(2)}${pricing.effectiveDiscountPercent > 0 ? ` (${pricing.effectiveDiscountPercent}% off)` : ''}`,
            `*Recurring:* ${escapeTelegramMarkdown(recurringLabel)}`,
            `*Invoice #:* \`${String(invoiceNumber).replace(/`/g, '')}\``,
            ``,
            `👤 *Customer:*`,
            `*Name:* ${escapeTelegramMarkdown(customerName)}`,
            `*Email:* ${escapeTelegramMarkdown(user.email || 'N/A')}`,
            `*Phone:* ${escapeTelegramMarkdown(customerPhone)}`,
            ``,
            `📍 *Property Summary:*`,
            `*Type:* ${escapeTelegramMarkdown(normalizedPropertyType)}`,
            `*Layout:* ${parsedBedrooms} Bed · ${parsedBathrooms} Bath · ${parsedLivingRooms} Living`,
            `*Area:* ${escapeTelegramMarkdown(booking.city)}${postcodeOutward ? ` (${escapeTelegramMarkdown(postcodeOutward)})` : ''}`,
            `*Access:* ${escapeTelegramMarkdown(accessLabel)}`,
            `*Supplies:* ${escapeTelegramMarkdown(suppliesLabel)}`,
            `*Parking:* ${escapeTelegramMarkdown(parkingLabel)}`,
            `*Pets:* ${escapeTelegramMarkdown(petsLabel)}`,
            `*Add-Ons:* ${escapeTelegramMarkdown(extrasLabel)}`,
            notes && String(notes).trim() ? `_Special notes attached — view securely in Admin Portal_` : null,
            ``,
            `*Booking ID:* \`${String(booking.id).replace(/`/g, '')}\``,
            `Admin Portal: ${siteUrl}/admin`,
          ].filter(Boolean);

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: lines.join('\n'),
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
            signal: controller.signal,
          }).finally(() => clearTimeout(timer));
        }
      } catch (tgErr) {
        console.error('[Telegram notification error]:', tgErr);
      }

      return sendSuccess(res, { booking }, 201);
    }
  }

  // Booking ID is the first segment
  const bookingId = segments[0] || params.id;
  if (!bookingId) {
    return sendError(res, 'Booking ID is required', 400);
  }

  const action = segments[1] || '';

  if (action === 'reschedule' || action === 'photos') {
    const { data: ownedBooking, error: ownedBookingError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownedBookingError || !ownedBooking) {
      return sendError(res, 'Booking not found', 404);
    }
  }

  // ─── 2. /api/bookings/:id/cancel ───────────────────────────────────────────
  if (action === 'cancel') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, user_id, status, payment_status, date, time_slot')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);
    if (booking.status === 'cancelled') return sendError(res, 'Booking is already cancelled', 400);
    if (booking.status === 'completed') return sendError(res, 'Completed bookings cannot be cancelled', 400);
    if (booking.payment_status === 'paid') {
      return sendError(
        res,
        'Paid bookings cannot be cancelled directly. Please submit a refund request so our team can process your refund according to our cancellation policy.',
        400
      );
    }

    if (isBookingStartTimePassed(booking.date, booking.time_slot)) {
      await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('user_id', user.id);
      return sendError(
        res,
        'This appointment scheduled start time has already passed. Please place a new booking.',
        400,
        { expired: true, requiresReschedule: true }
      );
    }

    const hoursUntil = getHoursUntilBookingStart(booking.date, booking.time_slot);
    if (hoursUntil !== null && hoursUntil <= 3) {
      return sendError(
        res,
        'Cancellations are not permitted within 3 hours of the scheduled start time. Please contact our support team.',
        400
      );
    }

    const { error: updateErr } = await admin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', user.id);

    if (updateErr) return sendError(res, updateErr.message, 500);
    return sendSuccess(res, { message: 'Booking cancelled successfully' });
  }

  // ─── 3. /api/bookings/:id/checkout ─────────────────────────────────────────
  if (action === 'checkout') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);
    if (booking.payment_status === 'paid') return sendError(res, 'Booking is already paid', 400);
    if (['refunded', 'disputed'].includes(booking.payment_status)) {
      return sendError(res, `Booking payment status is ${booking.payment_status} and cannot be paid again.`, 400);
    }
    if (['cancelled', 'completed'].includes(booking.status)) {
      return sendError(res, `Cannot pay for a ${booking.status} booking.`, 400);
    }

    if (isBookingStartTimePassed(booking.date, booking.time_slot)) {
      await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('user_id', user.id);
      return sendError(
        res,
        'This appointment scheduled start time has already passed. Please reschedule or place a new booking.',
        400,
        { expired: true, requiresReschedule: true }
      );
    }

    const siteUrl = getEnv('SITE_URL', 'https://makemeclean.co.uk').replace(/\/$/, '');
    const successUrl = `${siteUrl}/pay/${booking.id}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/bookings/${booking.id}`;

    const stripeSecretKey = getEnv('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return sendError(res, 'Payment gateway is temporarily unavailable. Please try again later.', 503);
    }

    const amountPence = Math.round(Number(booking.price) * 100);
    if (!Number.isFinite(amountPence) || amountPence < 50) {
      return sendError(res, 'Invalid booking amount for checkout.', 400);
    }

    const isRecurring = Boolean(
      booking.recurring_plan_id ||
        (booking.recurring_freq && !['none', 'one_off'].includes(booking.recurring_freq))
    );

    try {
      // Reuse or create Stripe customer so off-session recurring billing works reliably
      let stripeCustomerId: string | undefined;
      if (user.email) {
        const { data: profileRow } = await admin
          .from('profiles')
          .select('stripe_customer_id, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profileRow?.stripe_customer_id) {
          stripeCustomerId = profileRow.stripe_customer_id;
        } else {
          const custParams = new URLSearchParams({
            email: user.email,
            'metadata[supabase_user_id]': user.id,
          });
          if (profileRow?.full_name) custParams.set('name', profileRow.full_name);

          const custRes = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': `stripe-customer-${user.id}`,
            },
            body: custParams.toString(),
          });
          const custJson = (await custRes.json().catch(() => null)) as { id?: string } | null;
          if (custRes.ok && custJson?.id) {
            stripeCustomerId = custJson.id;
            await admin
              .from('profiles')
              .update({ stripe_customer_id: custJson.id })
              .eq('id', user.id);
          }
        }
      }

      const checkoutParams = new URLSearchParams({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: booking.id,
        'metadata[booking_id]': booking.id,
        'metadata[user_id]': user.id,
        'metadata[invoice_number]': booking.invoice_number || booking.id,
        'metadata[recurring_plan_id]': booking.recurring_plan_id || '',
        'payment_intent_data[metadata][booking_id]': booking.id,
        'payment_intent_data[metadata][user_id]': user.id,
        'payment_intent_data[metadata][invoice_number]': booking.invoice_number || booking.id,
        'payment_intent_data[metadata][recurring_plan_id]': booking.recurring_plan_id || '',
        'line_items[0][price_data][currency]': 'gbp',
        'line_items[0][price_data][unit_amount]': String(amountPence),
        'line_items[0][price_data][product_data][name]': `MakeMeClean - ${booking.service_name}`,
        'line_items[0][price_data][product_data][description]': `Cleaning on ${booking.date} (${booking.time_slot})${isRecurring ? ' (Recurring Plan)' : ''}`,
        'line_items[0][quantity]': '1',
      });

      if (stripeCustomerId) {
        checkoutParams.set('customer', stripeCustomerId);
      } else if (user.email) {
        checkoutParams.set('customer_email', user.email);
      }
      if (isRecurring) {
        checkoutParams.set('payment_intent_data[setup_future_usage]', 'off_session');
      }

      const minuteBucket = Math.floor(Date.now() / 60000);
      const idempotencyKey = `checkout-${booking.id}-${amountPence}-${minuteBucket}`;
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': idempotencyKey,
        },
        body: checkoutParams.toString(),
      });

      const session = (await stripeRes.json().catch(() => null)) as { id?: string; url?: string } | null;
      if (!stripeRes.ok || !session?.url) {
        console.error('[bookings checkout] Stripe error:', session);
        return sendError(res, 'Unable to start Stripe checkout session. Please try again.', 502);
      }
      return sendSuccess(res, { checkoutUrl: session.url, sessionId: session.id });
    } catch (err) {
      console.error('[bookings checkout] network error:', err);
      return sendError(res, 'Unable to connect to payment provider. Please try again.', 502);
    }
  }

  // ─── 4. /api/bookings/:id/reschedule ───────────────────────────────────────
  if (action === 'reschedule') {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data);
    }

    if (method === 'POST') {
      const { requestedDate, requestedTime, reason } = req.body || {};
      if (!requestedDate || !requestedTime) {
        return sendError(res, 'Requested date and time are required', 400);
      }
      if (typeof requestedDate !== 'string' || !isValidIsoDate(requestedDate)) {
        return sendError(res, 'Requested date must be a valid YYYY-MM-DD date.', 400);
      }
      const cleanTime = String(requestedTime).trim();
      const startPart = cleanTime.split(/[-–]/)[0]?.trim() || '';
      if (!(START_HOURS as readonly string[]).includes(startPart)) {
        return sendError(res, 'Requested start time is not a valid booking slot.', 400);
      }
      if (isBookingStartTimePassed(requestedDate, cleanTime)) {
        return sendError(res, 'Requested reschedule date/time cannot be in the past.', 400);
      }

      const { data: booking } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('id', bookingId)
        .eq('user_id', user.id)
        .single();
      if (!booking || ['cancelled', 'completed'].includes(booking.status)) {
        return sendError(res, 'Only active upcoming bookings can be rescheduled.', 400);
      }

      // Check weekly schedule for requested date & slot
      const { data: scheduleSetting } = await admin
        .from('settings')
        .select('value')
        .eq('key', 'booking_availability_schedule')
        .maybeSingle();
      const weeklySchedule = parseWeeklyAvailability(scheduleSetting?.value);
      const dayConfig = weeklySchedule[getDayKeyFromDateStr(requestedDate)];
      if (!dayConfig || !dayConfig.enabled) {
        return sendError(res, 'We are not accepting bookings on the requested day.', 400);
      }
      if (dayConfig.slots && dayConfig.slots.length > 0 && !dayConfig.slots.includes(startPart)) {
        return sendError(res, `The ${startPart} time slot is not available on that day.`, 400);
      }

      // Prevent duplicate pending reschedule requests
      const { data: existingPending } = await admin
        .from('reschedule_requests')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('status', 'pending')
        .maybeSingle();
      if (existingPending) {
        return sendError(res, 'A reschedule request is already pending review for this booking.', 409);
      }

      const { data, error } = await admin
        .from('reschedule_requests')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          requested_date: requestedDate,
          requested_time: cleanTime,
          reason: reason ? String(reason).trim().slice(0, 1000) : null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }
  }

  // ─── 5. /api/bookings/:id/invoice ──────────────────────────────────────────
  if (action === 'invoice') {
    if (method !== 'GET') return sendError(res, 'Method not allowed', 405);

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    if (
      booking.status === 'upcoming' &&
      booking.payment_status !== 'paid' &&
      isBookingStartTimePassed(booking.date, booking.time_slot)
    ) {
      await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('user_id', user.id);
    }

    const [{ data: settingRows }, { data: profileRow }] = await Promise.all([
      admin
        .from('settings')
        .select('key, value')
        .in('key', [
          'vat_registered',
          'vat_number',
          'company_legal_name',
          'company_reg_number',
          'company_registered_address',
          'business_phone',
          'email_payment',
        ]),
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ]);

    const cfg: Record<string, string> = {};
    for (const row of settingRows || []) cfg[row.key] = row.value;

    const vatRegistered = cfg['vat_registered'] === 'true';
    const grossAmount = Number(booking.price);
    const netAmount = vatRegistered ? Math.round((grossAmount / 1.2) * 100) / 100 : grossAmount;
    const vatAmount = vatRegistered ? Math.round((grossAmount - netAmount) * 100) / 100 : 0;

    return sendSuccess(res, {
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      date: booking.date,
      customerName: profileRow?.full_name || user.email?.split('@')[0] || 'Valued Customer',
      customerEmail: user.email,
      serviceName: booking.service_name,
      address: booking.address,
      city: booking.city,
      postcode: booking.postcode,
      grossAmount,
      netAmount,
      vatAmount,
      vatRegistered,
      vatRate: vatRegistered ? 20 : 0,
      currency: 'GBP',
      paymentStatus: booking.payment_status,
      company: {
        name: cfg['company_legal_name'] || 'MakeMeClean Ltd',
        registrationNumber: cfg['company_reg_number'] || null,
        registeredAddress: cfg['company_registered_address'] || 'Wales, United Kingdom',
        vatNumber: vatRegistered ? cfg['vat_number'] || null : null,
        country: 'United Kingdom',
        email: cfg['email_payment'] || 'payment@makemeclean.co.uk',
        phone: cfg['business_phone'] || '+44 7362 068202',
      },
    });
  }

  // ─── 6. /api/bookings/:id/photos ───────────────────────────────────────────
  if (action === 'photos') {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('booking_photos')
        .select('*')
        .eq('booking_id', bookingId)
        .order('uploaded_at', { ascending: false });

      if (error) return sendError(res, error.message, 500);

      const photosWithSignedUrls = await Promise.all(
        (data || []).map(async (photo) => {
          let signedUrl = photo.photo_url || null;
          if (photo.storage_path) {
            const { data: signed } = await admin.storage
              .from('booking-photos')
              .createSignedUrl(photo.storage_path, 3600);
            if (signed?.signedUrl) signedUrl = signed.signedUrl;
          }
          return {
            ...photo,
            photo_url: signedUrl,
            signed_url: signedUrl,
          };
        })
      );

      return sendSuccess(res, photosWithSignedUrls);
    }

    if (method === 'POST') {
      const { storagePath, photoUrl, photoType = 'after' } = req.body || {};
      const cleanPath = typeof storagePath === 'string' ? storagePath.trim() : '';
      const cleanUrl = typeof photoUrl === 'string' ? photoUrl.trim() : '';
      if (!cleanPath && !cleanUrl) {
        return sendError(res, 'storagePath is required', 400);
      }
      if (cleanPath && (cleanPath.includes('..') || cleanPath.startsWith('/'))) {
        return sendError(res, 'Invalid storagePath', 400);
      }
      const allowedTypes = ['before', 'after', 'issue', 'general'];
      const cleanType = allowedTypes.includes(String(photoType)) ? String(photoType) : 'after';

      const { data, error } = await admin
        .from('booking_photos')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          storage_path: cleanPath || null,
          photo_url: cleanUrl || null,
          photo_type: cleanType,
        })
        .select()
        .single();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }

    if (method === 'DELETE') {
      const photoId =
        (typeof req.query?.photoId === 'string' && req.query.photoId.trim()) ||
        (typeof req.body?.photoId === 'string' && req.body.photoId.trim()) ||
        '';
      if (!photoId) return sendError(res, 'photoId is required', 400);

      // Verify ownership from DB before deleting storage object (prevents IDOR storage deletion)
      const { data: photoRow, error: lookupErr } = await admin
        .from('booking_photos')
        .select('id, storage_path')
        .eq('id', photoId)
        .eq('booking_id', bookingId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (lookupErr || !photoRow) {
        return sendError(res, 'Photo not found', 404);
      }

      if (photoRow.storage_path) {
        await admin.storage.from('booking-photos').remove([photoRow.storage_path]);
      }

      const { error } = await admin
        .from('booking_photos')
        .delete()
        .eq('id', photoRow.id)
        .eq('user_id', user.id);

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, { message: 'Photo deleted' });
    }
  }

  // ─── 7. /api/bookings/:id/refund ───────────────────────────────────────────
  if (action === 'refund') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { reason, amount } = req.body || {};
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (!cleanReason) return sendError(res, 'Refund reason is required', 400);
    if (cleanReason.length > 2000) return sendError(res, 'Refund reason is too long.', 400);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, user_id, price, status, payment_status, refunded_amount')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);
    if (booking.payment_status !== 'paid') {
      return sendError(res, 'Only paid bookings are eligible for a refund request.', 400);
    }

    const totalPrice = Number(booking.price);
    const alreadyRefunded = Number(booking.refunded_amount || 0);
    const remainingBalance = Math.round(Math.max(0, totalPrice - alreadyRefunded) * 100) / 100;
    if (remainingBalance <= 0) {
      return sendError(res, 'This booking has already been fully refunded.', 400);
    }

    const refundAmount = amount === undefined ? remainingBalance : Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > remainingBalance) {
      return sendError(
        res,
        `Refund amount must be between £0.01 and £${remainingBalance.toFixed(2)}.`,
        400
      );
    }

    const { data: existingPending } = await admin
      .from('refund_requests')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingPending) {
      return sendError(res, 'A refund request is already pending for this booking.', 409);
    }

    const { data, error } = await admin
      .from('refund_requests')
      .insert({
        booking_id: bookingId,
        user_id: user.id,
        reason: cleanReason,
        refund_amount: refundAmount,
        source: 'user',
        status: 'pending',
      })
      .select()
      .single();

    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data, 201);
  }

  // ─── 8. /api/bookings/:id (Get Single Detail) ──────────────────────────────
  if (segments.length === 1 && method === 'GET') {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    let currentStatus = booking.status;
    if (
      booking.status === 'upcoming' &&
      booking.payment_status !== 'paid' &&
      isBookingStartTimePassed(booking.date, booking.time_slot)
    ) {
      currentStatus = 'cancelled';
      await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('user_id', user.id);
    }

    let cleaner: { id: string; full_name: string; role: string } | null = null;
    const { data: assignment } = await admin
      .from('booking_assignments')
      .select('staff_id, staff:staff_id(id, first_name, last_name, role)')
      .eq('booking_id', bookingId)
      .maybeSingle();

    const assignedStaff = (assignment as any)?.staff;
    if (assignedStaff) {
      cleaner = {
        id: assignedStaff.id,
        full_name: `${assignedStaff.first_name || ''} ${assignedStaff.last_name || ''}`.trim() || 'Assigned Cleaner',
        role: assignedStaff.role || 'Cleaner',
      };
    }

    const [{ data: reschedule }, { data: refund }] = await Promise.all([
      supabase
        .from('reschedule_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('refund_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return sendSuccess(res, {
      ...booking,
      status: currentStatus,
      imageUrl: resolveServiceImageUrl(booking.service_type, null),
      cleaner,
      rescheduleRequest: reschedule || null,
      active_reschedule: reschedule || null,
      refundRequest: refund || null,
    });
  }

  return sendError(res, 'Endpoint not found', 404);
}
