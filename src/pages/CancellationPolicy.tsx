import { useSettings } from "@/hooks/useSettings";

export default function CancellationPolicy() {
  const settings = useSettings();
  const lateHours = Number(settings.cancellation_late_hours) || 3;
  const lateRefundPercent = Number(settings.cancellation_late_refund_percent) || 75;
  const minLeadHours = Number(settings.min_booking_lead_hours) || 5;

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Cancellation & Refund Policy</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Cancellation & Notice Policy</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We understand that plans change. This policy outlines our cancellation terms, refund percentages, and booking notice requirements for all MakeMeClean cleaning services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Advance Booking Lead Time & Emergency Shifts</h2>
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-5 text-sm text-amber-950 space-y-2">
              <p className="font-bold text-amber-950">
                Standard Online Booking: Minimum {minLeadHours} Hours in Advance
              </p>
              <p className="text-amber-800 leading-relaxed">
                To guarantee high service standards and vetted cleaner allocation, all online self-service appointments must be booked at least <strong>{minLeadHours} hours</strong> before the requested start time.
              </p>
              <p className="text-amber-900 font-semibold pt-1">
                Emergency or Immediate Shift (Within {minLeadHours} Hours):
              </p>
              <p className="text-amber-800 leading-relaxed">
                If you require urgent same-day cleaning within the next {minLeadHours} hours, please do not book online — contact our dispatch team immediately by phone at{" "}
                <a
                  href={`tel:${(settings.business_phone || "+44 7362 068202").replace(/\s/g, "")}`}
                  className="font-bold text-amber-950 underline hover:text-black"
                >
                  {settings.business_phone || "+44 7362 068202"}
                </a>. Emergency bookings are prioritized and coordinated directly with on-duty staff.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cancellation Timeline & Refunds</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-600 pl-4 py-2 bg-blue-50/50 rounded-r-xl">
                <p className="font-semibold text-gray-900">Unpaid Bookings</p>
                <p className="text-gray-600 text-sm">
                  If you have not yet completed payment for your booking, you can cancel online at any time before the scheduled start time directly from your dashboard with zero charge, no cancellation fee, and no penalty.
                </p>
              </div>
              <div className="border-l-4 border-green-600 pl-4 py-2 bg-green-50/50 rounded-r-xl">
                <p className="font-semibold text-gray-900">Paid Bookings: More than {lateHours} hours before start time</p>
                <p className="text-gray-600 text-sm">
                  Eligible for a <strong>full 100% refund</strong>. A cancellation and refund request is submitted for swift administrative approval and returned directly to your payment card via Stripe.
                </p>
              </div>
              <div className="border-l-4 border-yellow-600 pl-4 py-2 bg-yellow-50/50 rounded-r-xl">
                <p className="font-semibold text-gray-900">Paid Bookings: Within {lateHours} hours of service start time</p>
                <p className="text-gray-600 text-sm">
                  Eligible for a <strong>{lateRefundPercent}% refund</strong>. A {100 - lateRefundPercent}% late cancellation fee is retained to cover allocated cleaner time, travel preparation, and short-notice schedule disruption.
                </p>
              </div>
              <div className="border-l-4 border-red-600 pl-4 py-2 bg-red-50/50 rounded-r-xl">
                <p className="font-semibold text-gray-900">After scheduled start time or Customer No-show</p>
                <p className="text-gray-600 text-sm">No refund. Full payment is retained to compensate dispatched cleaners who attend the address.</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 leading-relaxed">
              <strong>UK Consumer Rights & Legal Exemption:</strong> In accordance with Regulation 28(1)(h) of the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, domestic services booked for a specific date and performance time are exempt from the standard statutory 14-day cancellation cooling-off right. Reasonable late cancellation fees covering operational commitments and allocated staff are fully lawful and enforceable.
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">How to Cancel & Refund Approvals</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Log in to your MakeMeClean account.</li>
              <li>Go to &ldquo;My Bookings&rdquo; and click on your appointment.</li>
              <li>Click &ldquo;Cancel Booking&rdquo; and confirm the cancellation prompt.</li>
              <li>
                <strong>Unpaid bookings:</strong> Cancelled immediately on your account with no action required.
              </li>
              <li>
                <strong>Paid bookings:</strong> Our system calculates your eligible refund tier ({lateRefundPercent}% if within {lateHours} hours, 100% if more than {lateHours} hours in advance) and submits a refund request for administrator approval.
              </li>
              <li>
                <strong>Stripe Processing:</strong> Once approved by our team, refunds are issued directly to your original payment card via Stripe and typically appear on your statement within 3–5 business days.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Rescheduling</h2>
            <p className="text-gray-600 leading-relaxed">
              If you need to reschedule rather than cancel, you can request a new date and time for your booking at no additional charge, provided the new appointment satisfies our {minLeadHours}-hour advance notice requirement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Exceptions & Special Cases</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              In the following circumstances, a full refund may be issued regardless of cancellation timing:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>We cancel the booking (staff emergency, extreme weather)</li>
              <li>Cleaner does not arrive within 30 minutes of scheduled time</li>
              <li>Service quality standard is not met (see our Service Standards guarantee)</li>
              <li>Medical emergency (documentation may be requested)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recurring Bookings</h2>
            <p className="text-gray-600 leading-relaxed">
              You can cancel a recurring booking plan at any time. Future bookings will be cancelled immediately with zero charges. For the next upcoming booking, our standard {lateHours}-hour cancellation window ({lateRefundPercent}% refund) applies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment & Refunds</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              All payments are processed securely online via Stripe. Approved refunds are returned to your original payment method:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Credit/Debit card (via Stripe): typically 3–5 business days (up to 10 days depending on your card issuer)</li>
              <li>Digital wallets (Apple Pay / Google Pay via Stripe): typically 1–5 business days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Questions?</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about this policy, please contact us at <a href={`mailto:${settings.contact_email}`} className="text-green-600 font-semibold hover:underline">{settings.contact_email}</a>{settings.business_phone && <> or call <a href={`tel:${settings.business_phone.replace(/\s/g, "")}`} className="text-green-600 font-semibold hover:underline">{settings.business_phone}</a></>}.
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4 border-t">Last updated: 19 November 2026</p>
        </div>
      </div>
    </div>
  );
}
