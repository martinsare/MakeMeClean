import {
  VercelRequest,
  VercelResponse,
  verifyAuth,
  sendSuccess,
  sendError,
  calcTimeSlot,
  calculateDurationHours,
  generateInvoiceNumber,
  resolveServiceImageUrl,
  getEnv,
  BOOKING_PROPERTY_TYPES,
  calculateRecommendedHours,
  MAX_ROOM_COUNTS,
  MAX_DURATION_HOURS,
  MIN_DURATION_HOURS,
  parseBookingExtras,
  parseDurationMultipliers,
  isBookingStartTimePassed,
  isBookingEndTimePassed,
} from '../_lib/server';

const ACCEPTED_PROPERTY_TYPES: readonly string[] = [
  ...BOOKING_PROPERTY_TYPES,
  'House',
  'Flat / Apartment',
  'House/Flat',
  'Studio / HMO',
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
  if (!supabase || !user) return sendError(res, 'Authentication required', 401);
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

      // Identify unpaid bookings whose scheduled start time has passed and update them
      const expiredUnpaidIds = (data || [])
        .filter(
          (b) =>
            b.status === 'upcoming' &&
            b.payment_status !== 'paid' &&
            isBookingStartTimePassed(b.date, b.time_slot)
        )
        .map((b) => b.id);

      if (expiredUnpaidIds.length > 0) {
        void supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .in('id', expiredUnpaidIds);
      }

      const items = (data || []).map((b) => ({
        ...b,
        status: expiredUnpaidIds.includes(b.id) ? 'cancelled' : b.status,
        imageUrl: resolveServiceImageUrl(b.service_type, null),
      }));
      return sendSuccess(res, items);
    }

    if (method === 'POST') {
      // Check if bookings are currently paused/disabled by admin
      const { data: bookingEnabledSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_enabled')
        .maybeSingle();

      if (bookingEnabledSetting?.value === 'false') {
        const { data: bookingMessageSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'booking_disabled_message')
          .maybeSingle();

        const disabledMsg =
          bookingMessageSetting?.value?.trim() ||
          'We are currently fully booked and temporarily not accepting new bookings. Please try again later.';
        return sendError(res, disabledMsg, 403);
      }

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
      if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) ||
        new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
      ) {
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
      const parsedBedrooms = parseRoomCount(bedrooms, MAX_ROOM_COUNTS.bedrooms);
      const parsedBathrooms = parseRoomCount(bathrooms, MAX_ROOM_COUNTS.bathrooms);
      const parsedLivingRooms = parseRoomCount(
        livingRooms,
        MAX_ROOM_COUNTS.livingAreas,
      );
      if (
        parsedBedrooms == null ||
        parsedBathrooms == null ||
        parsedLivingRooms == null
      ) {
        return sendError(
          res,
          'Room counts must be whole numbers within the allowed range, including zero when a room type is absent.',
          400,
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

      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('id, name, price, discount_percent, active')
        .eq('id', serviceId)
        .eq('active', true)
        .single();

      if (svcErr || !service) {
        return sendError(res, 'Selected service is unavailable.', 400);
      }

      const bookingSettingKeys = [
        'booking_extras',
        'room_calc_base_hours',
        'room_calc_bed_hours',
        'room_calc_bath_hours',
        'room_calc_living_hours',
        'discount_weekly',
        'discount_biweekly',
        'discount_monthly',
      ];
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', bookingSettingKeys);
      if (settingsError) {
        return sendError(
          res,
          'Unable to verify the cleaning estimate. Please try again.',
          503,
        );
      }

      const settingsMap: Record<string, unknown> = {};
      for (const setting of settingsData || []) {
        settingsMap[setting.key] = setting.value;
      }
      const estimateMultipliers = parseDurationMultipliers(settingsMap);
      const configuredExtras = parseBookingExtras(settingsMap['booking_extras']);
      if (!estimateMultipliers || !configuredExtras) {
        return sendError(
          res,
          'The cleaning estimate settings are invalid. Please contact us.',
          503,
        );
      }

      const configuredExtraIds = new Set(configuredExtras.map((extra) => extra.id));
      const unknownExtra = selectedExtraIds.find(
        (extraId) => !configuredExtraIds.has(extraId),
      );
      if (unknownExtra) {
        return sendError(res, 'One or more selected extras are unavailable.', 400);
      }

      const minimumDurationHours = calculateRecommendedHours(
        parsedBedrooms,
        parsedBathrooms,
        parsedLivingRooms,
        selectedExtraIds,
        estimateMultipliers,
        configuredExtras,
      );
      if (minimumDurationHours > MAX_DURATION_HOURS) {
        return sendError(
          res,
          `This property needs at least ${minimumDurationHours} hours, which is over the ${MAX_DURATION_HOURS}-hour online booking limit. Please contact us for a tailored quote.`,
          400,
          { minimumDurationHours },
        );
      }

      let durationHours = rawDuration == null ? 2 : Number(rawDuration);
      let timeSlot = rawTimeSlot;
      if (!Number.isFinite(durationHours)) {
        return sendError(res, 'Booking duration must be a valid number.', 400);
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

      if (durationHours < MIN_DURATION_HOURS || durationHours > MAX_DURATION_HOURS) {
        return sendError(
          res,
          `Booking duration must be between ${MIN_DURATION_HOURS} and ${MAX_DURATION_HOURS} hours.`,
          400,
        );
      }
      // Allow customers to adjust up to 30 mins lower than recommendation (minimum MIN_DURATION_HOURS)
      const allowedFloorHours = Math.max(MIN_DURATION_HOURS, minimumDurationHours - 0.5);
      if (durationHours < allowedFloorHours) {
        return sendError(
          res,
          `The selected rooms and extras require at least ${allowedFloorHours} hours.`,
          400,
          { minimumDurationHours, allowedFloorHours },
        );
      }
      const baseHourlyRate = Number(service.price) || 20.0;
      const basePrice = baseHourlyRate * durationHours;

      let discountPercent = Number(service.discount_percent) || 0;
      let recurringDiscountPercent = 0;

      if (recurringFreq && recurringFreq !== 'none' && recurringFreq !== 'one_off') {
        if (recurringFreq === 'weekly') recurringDiscountPercent = Number(settingsMap['discount_weekly']) || 15;
        else if (recurringFreq === 'biweekly' || recurringFreq === 'fortnightly') recurringDiscountPercent = Number(settingsMap['discount_biweekly']) || 10;
        else if (recurringFreq === 'monthly') recurringDiscountPercent = Number(settingsMap['discount_monthly']) || 5;
      }

      const totalDiscountPercent = Math.min(50, discountPercent + recurringDiscountPercent);
      const finalPrice = Math.round(basePrice * (1 - totalDiscountPercent / 100) * 100) / 100;
      const invoiceNumber = generateInvoiceNumber();

      // Ensure profile row exists to prevent foreign key violations
      try {
        await supabase
          .from('profiles')
          .upsert({ id: user.id }, { onConflict: 'id' });
      } catch (_) {}

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
      };

      const { data: booking, error: insertErr } = await supabase
        .from('bookings')
        .insert(bookingInsert)
        .select()
        .single();

      if (insertErr || !booking) {
        return sendError(res, insertErr?.message || 'Failed to create booking', 500);
      }

      if (recurringFreq && recurringFreq !== 'none' && recurringFreq !== 'one_off') {
        const normalizedFreq = recurringFreq === 'biweekly' ? 'fortnightly' : recurringFreq;
        if (['weekly', 'fortnightly', 'monthly'].includes(normalizedFreq)) {
          const { error: planErr } = await supabase.from('recurring_plans').insert({
            user_id: user.id,
            service_type: service.id,
            service_name: service.name,
            frequency: normalizedFreq,
            start_time: startHour || timeSlot.split(' - ')[0] || '09:00',
            duration_hours: durationHours,
            address: address.trim(),
            city: (city || 'South Wales').trim(),
            postcode: postcode.trim().toUpperCase(),
            price_per_visit: finalPrice,
            discount_percent: recurringDiscountPercent,
            status: 'active',
            notes: notes ? String(notes).trim() : null,
            bedrooms: parsedBedrooms,
            bathrooms: parsedBathrooms,
            living_rooms: parsedLivingRooms,
            extras: selectedExtraIds,
            property_type: normalizedPropertyType,
            access_method: accessMethod || 'home',
            supplies_option: suppliesOption || 'cleaner',
            parking_option: parkingOption || 'free',
            has_pets: Boolean(hasPets),
          });
          if (planErr) {
            console.error('[Recurring Plan Insert Warning]:', planErr);
          }
        }
      }

      // Telegram notification
      try {
        const botToken = getEnv('TELEGRAM_BOT_TOKEN');
        const chatId = getEnv('TELEGRAM_ADMIN_CHAT_ID') || getEnv('TELEGRAM_CHAT_ID');
        if (botToken && chatId) {
          const msg = `🧹 *New Booking Created*\n*ID:* \`${booking.id}\`\n*Service:* ${service.name}\n*Date:* ${date} (${timeSlot})\n*Address:* ${booking.address}, ${booking.postcode}\n*Price:* £${finalPrice.toFixed(2)}`;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
          });
        }
      } catch (_) {}

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
      .select('id')
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
      .select('id, user_id, status, date, time_slot')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);
    if (booking.payment_status === 'paid') return sendError(res, 'Booking is already paid', 400);

    // If scheduled time has already arrived or passed, block payment and require rebooking/rescheduling
    if (isBookingStartTimePassed(booking.date, booking.time_slot)) {
      void supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
      return sendError(
        res,
        'This appointment scheduled start time has already passed. Please reschedule or place a new booking.',
        400,
        { expired: true, requiresReschedule: true }
      );
    }
    if (booking.status === 'cancelled') return sendError(res, 'Booking is already cancelled', 400);

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

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

    // If scheduled time has already arrived or passed, block payment and require rebooking/rescheduling
    if (isBookingStartTimePassed(booking.date, booking.time_slot)) {
      void supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
      return sendError(
        res,
        'This appointment scheduled start time has already passed. Please reschedule or place a new booking.',
        400,
        { expired: true, requiresReschedule: true }
      );
    }

    const siteUrl = getEnv('SITE_URL', 'https://makemeclean.co.uk');
    const successUrl = `${siteUrl}/booking-detail/${booking.id}?payment=success`;
    const cancelUrl = `${siteUrl}/booking-detail/${booking.id}?payment=cancelled`;

    const stripeSecretKey = getEnv('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return sendSuccess(res, {
        checkoutUrl: `${siteUrl}/payment/${booking.id}`,
        mode: 'fallback_web',
      });
    }

    try {
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: user.email || '',
          'client_reference_id': booking.id,
          'metadata[booking_id]': booking.id,
          'metadata[user_id]': user.id,
          'line_items[0][price_data][currency]': 'gbp',
          'line_items[0][price_data][unit_amount]': String(Math.round(booking.price * 100)),
          'line_items[0][price_data][product_data][name]': `MakeMeClean - ${booking.service_name}`,
          'line_items[0][price_data][product_data][description]': `Cleaning on ${booking.date} (${booking.time_slot})`,
          'line_items[0][quantity]': '1',
        }).toString(),
      });

      const session = await stripeRes.json();
      if (!stripeRes.ok || !session.url) {
        return sendSuccess(res, { checkoutUrl: `${siteUrl}/payment/${booking.id}` });
      }
      return sendSuccess(res, { checkoutUrl: session.url, sessionId: session.id });
    } catch (_) {
      return sendSuccess(res, { checkoutUrl: `${siteUrl}/payment/${booking.id}` });
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

      const { data, error } = await supabase
        .from('reschedule_requests')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          requested_date: requestedDate,
          requested_time: requestedTime,
          reason: reason ? String(reason).trim() : null,
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

    // If unpaid and the scheduled start time has passed, auto-cancel it
    let currentStatus = booking.status;
    if (
      booking.status === 'upcoming' &&
      booking.payment_status !== 'paid' &&
      isBookingStartTimePassed(booking.date, booking.time_slot)
    ) {
      currentStatus = 'cancelled';
      void supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);
    }

    const netAmount = Math.round((booking.price / 1.2) * 100) / 100;
    const vatAmount = Math.round((booking.price - netAmount) * 100) / 100;

    return sendSuccess(res, {
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      date: booking.date,
      customerName: user.email?.split('@')[0] || 'Valued Customer',
      customerEmail: user.email,
      serviceName: booking.service_name,
      address: booking.address,
      city: booking.city,
      postcode: booking.postcode,
      grossAmount: booking.price,
      netAmount,
      vatAmount,
      currency: 'GBP',
      paymentStatus: booking.payment_status,
      company: {
        name: 'MakeMeClean Ltd',
        country: 'United Kingdom',
        email: 'support@makemeclean.co.uk',
        phone: '+44 7700 900077',
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
      return sendSuccess(res, data || []);
    }

    if (method === 'POST') {
      const { storagePath, photoType = 'after' } = req.body || {};
      if (!storagePath) return sendError(res, 'storagePath is required', 400);

      const { data, error } = await supabase
        .from('booking_photos')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          storage_path: storagePath,
          photo_type: photoType,
        })
        .select()
        .single();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }

    if (method === 'DELETE') {
      const { photoId, storagePath } = req.body || {};
      if (!photoId) return sendError(res, 'photoId is required', 400);

      if (storagePath) {
        await supabase.storage.from('booking-photos').remove([storagePath]);
      }
      const { error } = await supabase
        .from('booking_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', user.id);

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, { message: 'Photo deleted' });
    }
  }

  // ─── 7. /api/bookings/:id/refund ───────────────────────────────────────────
  if (action === 'refund') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { reason, amount } = req.body || {};
    if (!reason) return sendError(res, 'Refund reason is required', 400);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, user_id, price, status')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);
    if (booking.payment_status === 'paid') return sendError(res, 'Booking is already paid', 400);

    // If scheduled time has already arrived or passed, block payment and require rebooking/rescheduling
    if (isBookingStartTimePassed(booking.date, booking.time_slot)) {
      void supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
      return sendError(
        res,
        'This appointment scheduled start time has already passed. Please reschedule or place a new booking.',
        400,
        { expired: true, requiresReschedule: true }
      );
    }

    const refundAmount = amount === undefined ? Number(booking.price) : Number(amount);
    if (
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0 ||
      refundAmount > Number(booking.price)
    ) {
      return sendError(res, 'Refund amount must be greater than zero and no more than the booking total.', 400);
    }

    const { data, error } = await supabase
      .from('refund_requests')
      .insert({
        booking_id: bookingId,
        user_id: user.id,
        reason: String(reason).trim(),
        amount: refundAmount,
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

    // If unpaid and the scheduled start time has passed, auto-cancel it
    let currentStatus = booking.status;
    if (
      booking.status === 'upcoming' &&
      booking.payment_status !== 'paid' &&
      isBookingStartTimePassed(booking.date, booking.time_slot)
    ) {
      currentStatus = 'cancelled';
      void supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);
    }

    let cleaner = null;
    if (booking.staff_id) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name, phone, rating, avatar_url')
        .eq('id', booking.staff_id)
        .maybeSingle();
      cleaner = staffData;
    }

    const { data: reschedule } = await supabase
      .from('reschedule_requests')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return sendSuccess(res, {
      ...booking,
      status: currentStatus,
      imageUrl: resolveServiceImageUrl(booking.service_type, null),
      cleaner,
      rescheduleRequest: reschedule || null,
      refundRequest: refund || null,
    });
  }

  return sendError(res, 'Endpoint not found', 404);
}

