import { useSettings } from "@/hooks/useSettings";

export default function CancellationPolicy() {
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Cancellation & Refund Policy</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Cancellation</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We understand that plans change. This policy outlines our cancellation and refund terms for all MakeMeClean cleaning services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cancellation Timeline & Refunds</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4 py-2">
                <p className="font-semibold text-gray-900">More than 24 hours before service</p>
                <p className="text-gray-600">Full refund of booking payment. No charges apply.</p>
              </div>
              <div className="border-l-4 border-yellow-600 pl-4 py-2">
                <p className="font-semibold text-gray-900">3 to 24 hours before service</p>
                <p className="text-gray-600">70% refund. 30% cancellation fee applies (covers staff scheduling and administrative costs).</p>
              </div>
              <div className="border-l-4 border-red-600 pl-4 py-2">
                <p className="font-semibold text-gray-900">Less than 3 hours before service</p>
                <p className="text-gray-600">No refund. Full payment retained (cleaner is already scheduled and cannot reallocate).</p>
              </div>
              <div className="border-l-4 border-gray-400 pl-4 py-2">
                <p className="font-semibold text-gray-900">No-show (did not cancel)</p>
                <p className="text-gray-600">No refund. Full payment retained and service marked as completed.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">How to Cancel</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Log in to your MakeMeClean account</li>
              <li>Go to &ldquo;My Bookings&rdquo;</li>
              <li>Select the booking you wish to cancel</li>
              <li>For unpaid bookings, click &ldquo;Cancel Booking&rdquo; (available until 3 hours before service). For paid bookings, click &ldquo;Request Refund&rdquo; so our team can cancel and process your Stripe refund in line with the tiers above.</li>
              <li>Approved refunds are returned to your original payment method within 3–5 business days</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Rescheduling</h2>
            <p className="text-gray-600 leading-relaxed">
              If you need to reschedule rather than cancel, you can request a new date and time for your booking at no additional charge, provided the request is made more than 24 hours before the original appointment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Exceptions & Special Cases</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              In the following circumstances, a full refund may be issued regardless of cancellation timing:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>We cancel the booking (staff unavailable, emergency)</li>
              <li>Cleaner does not arrive within 30 minutes of scheduled time</li>
              <li>Service quality is not met (see our Service Standards)</li>
              <li>Medical emergency or death in family (documentation may be required)</li>
              <li>Severe weather making travel unsafe (as per Met Office warnings)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recurring Bookings</h2>
            <p className="text-gray-600 leading-relaxed">
              You can cancel a recurring booking at any time. Future bookings will be cancelled immediately, but the current booking (if scheduled within 3 hours) will proceed and be charged in full.
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

          <p className="text-xs text-gray-500 pt-4 border-t">Last updated: 18 November 2026</p>
        </div>
      </div>
    </div>
  );
}
