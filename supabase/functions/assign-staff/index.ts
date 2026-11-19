// Supabase Edge Function: assign-staff
// Admin-only: validates booking payment/status, checks staff active status & time-slot
// overlap conflicts, assigns atomically, and emails the cleaner shift details.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

function mustGetEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(raw: string) {
  try {
    return new Date(`${raw}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

function parseSlotRangeMinutes(timeSlot: string | null | undefined, durationHours?: number | null): [number, number] {
  const parts = String(timeSlot || "09:00 - 11:00")
    .split(/[-–]/)
    .map((p) => p.trim());
  const [sh, sm] = (parts[0] || "09:00").split(":").map(Number);
  const start = (Number.isFinite(sh) ? sh : 9) * 60 + (Number.isFinite(sm) ? sm : 0);
  if (parts.length >= 2 && parts[1]) {
    const [eh, em] = parts[1].split(":").map(Number);
    if (Number.isFinite(eh)) {
      const end = eh * 60 + (Number.isFinite(em) ? em : 0);
      if (end > start) return [start, end];
    }
  }
  const durMins = Math.round((Number(durationHours) || 2) * 60);
  return [start, start + durMins];
}

function slotsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function buildAssignmentEmail(args: {
  staffFirstName: string;
  serviceName: string;
  date: string;
  timeSlot: string;
  address: string;
  city: string;
  postcode: string;
  customerName: string;
  propertyLayout: string;
  extras: string;
  duration: string;
  notes: string | null;
  portalUrl: string;
}) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const bg = "#f6f7fb";
  const border = "#e5e7eb";
  const divider = "#eef2f7";
  const safe = (v: string | null | undefined) => escapeHtml(String(v ?? ""));

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;border-top:1px solid ${divider};font-family:${font};font-weight:700;font-size:13px;line-height:1.6;color:#6b7280">${label}</td>
      <td style="padding:10px 14px;border-top:1px solid ${divider};font-family:${font};font-weight:900;font-size:13px;line-height:1.6;color:#111827;text-align:right">${value}</td>
    </tr>`;

  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "info@makemeclean.co.uk";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Shift assignment — MakeMeClean</title>
  </head>
  <body style="margin:0;padding:0;background:${bg}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:640px;background:#ffffff;border:1px solid ${border};border-radius:20px;overflow:hidden">
          <tr><td style="padding:22px 22px 16px;border-bottom:1px solid ${divider}">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#111827">MakeMe<span style="color:#16a34a">Clean</span></p>
            <p style="margin:6px 0 0;font-family:${font};font-weight:600;font-size:12px;color:#6b7280">Shift assignment notification</p>
          </td></tr>
          <tr><td style="padding:20px 22px;font-family:${font}">
            <h2 style="margin:0 0 10px;font-weight:900;font-size:18px;color:#111827">You have been assigned a shift</h2>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">
              Dear ${safe(args.staffFirstName)},<br /><br />
              You have been assigned to the following cleaning job. Please log in to your staff portal to accept the shift and view full access instructions.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                   style="border:1px solid ${border};border-radius:16px;overflow:hidden">
              <tr>
                <td colspan="2" style="background:#f9fafb;padding:12px 14px;font-family:${font};font-weight:800;font-size:12px;color:#111827;text-transform:uppercase;letter-spacing:.05em">
                  Shift details
                </td>
              </tr>
              ${row("Service", safe(args.serviceName))}
              ${row("Date", safe(formatDate(args.date)))}
              ${row("Time", safe(args.timeSlot))}
              ${row("Duration", safe(args.duration))}
              ${row("Property Layout", safe(args.propertyLayout))}
              ${row("Specialist Add-Ons", safe(args.extras))}
              ${row("Address", safe(args.address))}
              ${row("City", safe(args.city))}
              ${row("Postcode", safe(args.postcode))}
              ${args.customerName ? row("Customer", safe(args.customerName)) : ""}
            </table>
            <p style="margin:20px 0 0">
              <a href="${safe(args.portalUrl)}"
                 style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-family:${font};font-weight:900;font-size:14px;line-height:1;padding:12px 20px;border-radius:12px">
                View my shifts
              </a>
            </p>
            <div style="height:1px;background:${divider};margin:20px 0"></div>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;font-family:${font}">
              Questions about this assignment? Contact <a href="mailto:${safe(supportEmail)}" style="color:#16a34a">${safe(supportEmail)}</a>.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? mustGetEnv("ANON_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json(401, { ok: false, error: "Unauthorised" }, req);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Forbidden" }, req);

    const { bookingId, staffId } = (await req.json()) as { bookingId?: string; staffId?: string | null };
    if (!bookingId) return json(400, { ok: false, error: "Missing bookingId" }, req);

    const { data: booking, error: bErr } = await adminClient
      .from("bookings")
      .select(
        "id, service_name, date, time_slot, address, city, postcode, notes, status, payment_status, user_id, bedrooms, bathrooms, living_rooms, property_type, duration_hours, extras, profiles(full_name)",
      )
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return json(404, { ok: false, error: "Booking not found" }, req);

    // Explicit unassign
    if (!staffId) {
      await adminClient.from("booking_assignments").delete().eq("booking_id", bookingId);
      return json(200, { ok: true, action: "unassigned" }, req);
    }

    // Enforce business rules server-side
    if (booking.status !== "upcoming") {
      return json(409, { ok: false, error: `Cannot assign staff to a ${booking.status} booking.` }, req);
    }
    if (booking.payment_status !== "paid") {
      return json(409, { ok: false, error: "Staff cannot be assigned until customer payment is confirmed." }, req);
    }

    const { data: staffRow, error: sErr } = await adminClient
      .from("staff")
      .select("id, first_name, last_name, email, active")
      .eq("id", staffId)
      .single();
    if (sErr || !staffRow) return json(404, { ok: false, error: "Staff member not found" }, req);
    if (!staffRow.active) {
      return json(409, { ok: false, error: "Cannot assign an inactive staff member." }, req);
    }

    // Check for double-booking / overlapping shifts for this cleaner on the same date
    const { data: existingShifts } = await adminClient
      .from("booking_assignments")
      .select("booking_id, bookings!inner(id, date, time_slot, duration_hours, status)")
      .eq("staff_id", staffId)
      .eq("bookings.date", booking.date)
      .neq("booking_id", bookingId);

    const targetRange = parseSlotRangeMinutes(booking.time_slot, booking.duration_hours);
    for (const shift of (existingShifts ?? []) as any[]) {
      const other = shift.bookings;
      if (!other || other.status === "cancelled") continue;
      const otherRange = parseSlotRangeMinutes(other.time_slot, other.duration_hours);
      if (slotsOverlap(targetRange, otherRange)) {
        return json(
          409,
          {
            ok: false,
            error: `${staffRow.first_name} ${staffRow.last_name} is already assigned to an overlapping shift (${other.time_slot}) on ${booking.date}.`,
          },
          req,
        );
      }
    }

    // Update existing assignment in-place or insert new (avoids losing assignment on insert failure)
    const { data: currentAssignment } = await adminClient
      .from("booking_assignments")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (currentAssignment) {
      const { error: updateErr } = await adminClient
        .from("booking_assignments")
        .update({
          staff_id: staffId,
          assigned_at: new Date().toISOString(),
          status: "assigned",
          acceptance_status: "pending",
          decline_reason: null,
        })
        .eq("id", currentAssignment.id);
      if (updateErr) return json(500, { ok: false, error: updateErr.message }, req);
    } else {
      const { error: insertErr } = await adminClient.from("booking_assignments").insert({
        booking_id: bookingId,
        staff_id: staffId,
        assigned_at: new Date().toISOString(),
        status: "assigned",
        acceptance_status: "pending",
      });
      if (insertErr) return json(500, { ok: false, error: insertErr.message }, req);
    }

    // Resolve any pending Open Shifts Marketplace applications for this booking
    try {
      await adminClient
        .from("shift_applications")
        .update({ status: "approved" })
        .eq("booking_id", bookingId)
        .eq("cleaner_id", staffId);
      await adminClient
        .from("shift_applications")
        .update({ status: "rejected" })
        .eq("booking_id", bookingId)
        .neq("cleaner_id", staffId)
        .eq("status", "pending");
    } catch (appErr) {
      console.error("[assign-staff] shift_applications sync warning:", appErr);
    }

    // Send email notification via Brevo (entry notes kept inside authenticated staff portal, not email)
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && staffRow.email) {
      const siteUrl = (Deno.env.get("SITE_URL") ?? "https://makemeclean.co.uk").replace(/\/$/, "");
      const portalUrl = `${siteUrl}/staff`;
      const customerName = (booking.profiles as any)?.full_name ?? "";
      const extrasList = Array.isArray(booking.extras) ? booking.extras.map((x: unknown) => String(x)) : [];
      const extrasStr = extrasList.length > 0 ? extrasList.join(", ") : "None";
      const layoutStr = `${booking.bedrooms || 1} Bed · ${booking.bathrooms || 1} Bath · ${booking.living_rooms || 1} Living (${booking.property_type || "House/Flat"})`;

      const html = buildAssignmentEmail({
        staffFirstName: staffRow.first_name,
        serviceName: booking.service_name,
        date: booking.date,
        timeSlot: booking.time_slot,
        address: booking.address,
        city: booking.city,
        postcode: booking.postcode,
        customerName,
        propertyLayout: layoutStr,
        extras: extrasStr,
        duration: `${booking.duration_hours || 2} Hours`,
        notes: null,
        portalUrl,
      });

      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoKey,
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { email: "staffing@makemeclean.co.uk", name: "MakeMeClean Staffing" },
            to: [{ email: staffRow.email, name: `${staffRow.first_name} ${staffRow.last_name}` }],
            subject: `Shift assigned — ${booking.service_name} on ${booking.date}`,
            htmlContent: html,
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`[assign-staff] Brevo error (${res.status}): ${errText}`);
        }
      } catch (emailErr) {
        console.error("[assign-staff] Failed to send email via Brevo:", emailErr);
      }
    }

    return json(
      200,
      {
        ok: true,
        assignment: { bookingId, staffId, staffName: `${staffRow.first_name} ${staffRow.last_name}` },
      },
      req,
    );
  } catch (e) {
    console.error("[assign-staff]", e);
    return json(500, { ok: false, error: "Failed to save assignment" }, req);
  }
});
