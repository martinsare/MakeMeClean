import { useSettings } from "@/hooks/useSettings";

export default function ServiceTerms() {
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Service Terms & Standards
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Our Service Standards
            </h2>
            <p className="text-gray-600 leading-relaxed">
              MakeMeClean is committed to delivering professional, reliable
              cleaning services across Wales. This document outlines the
              standards you can expect and the terms of our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Service Scope
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our cleaners will perform the service as specified in your
              booking:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Cleaning of agreed rooms and areas only</li>
              <li>Removal of general household dust and debris</li>
              <li>Surface cleaning, vacuuming, and mopping</li>
              <li>Bathroom and kitchen cleaning</li>
              <li>Organising of clutter as agreed</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4 text-sm">
              <strong>Exclusions:</strong> Carpets, deep cleaning,
              post-construction cleaning, large furniture moving, and specialist
              treatments are available as separate services. We also do not
              clean: outside windows, gutters, or hazardous materials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Cleaner Conduct & Professionalism
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Cleaners arrive in MakeMeClean uniform</li>
              <li>All cleaners are background-checked and insured</li>
              <li>Respectful, professional behaviour at all times</li>
              <li>Punctuality — arrive within 30 minutes of scheduled time</li>
              <li>Respect your privacy and property</li>
              <li>Protective shoe covers provided and worn</li>
              <li>
                All personal data and property details held confidentially
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Before Your Cleaner Arrives
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">Please ensure:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>An adult client or designated representative (18+) is present to grant access</li>
              <li>Valuables and sensitive items are securely stored or removed</li>
              <li>Pets are in a safe, separate area (advise us of any pets in advance)</li>
              <li>Any fragile items are removed or protected</li>
              <li>A clear, uncluttered path is available for the cleaner</li>
              <li>Adequate lighting and running water/electricity are available in all areas to be cleaned</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Access & Presence Requirement
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>
                <strong>On-site presence required:</strong> For the security of your home and the safety and peace of mind of our cleaning professionals, someone (the client or an authorised adult representative) must always be on the premises to admit the cleaner and remain present during the service.
              </li>
              <li>
                <strong>No unaccompanied entry:</strong> MakeMeClean does not enter unattended properties alone or access lockboxes/hidden keys without an adult present. This protects both client property and our staff against disputed claims or missing item allegations.
              </li>
              <li>You must provide access at the agreed booking start time.</li>
              <li>
                If entry is delayed by more than 20 minutes due to no representative being available, the appointment will be deemed a customer no-show and cancelled under our late cancellation policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Charges & Payment
            </h2>
            <div className="space-y-3 text-gray-600">
              <p>
                <strong className="text-gray-900">Service fees:</strong> As
                quoted at booking time and confirmed via email
              </p>
              <p>
                <strong className="text-gray-900">Payment methods:</strong>{" "}
                Credit/debit card and digital wallets (Apple Pay / Google Pay)
                processed securely online via Stripe
              </p>
              <p>
                <strong className="text-gray-900">Booking confirmation:</strong>{" "}
                Payment required to confirm your booking
              </p>
              <p>
                <strong className="text-gray-900">
                  Cancellation & refund policy:
                </strong>{" "}
                75% refund for cancellations within 3 hours of start time (see Cancellation Policy); 100% full refund when cancelled more than 3 hours in advance
              </p>
              <p>
                <strong className="text-gray-900">Additional time:</strong> If
                service extends beyond booked duration, charges are £15 per 15
                minutes
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Quality Guarantee
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you are not satisfied with our service:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Report issues within 24 hours of service completion</li>
              <li>We will arrange a free re-clean promptly at a mutually convenient time</li>
              <li>
                If a re-clean does not resolve the issue, you may be eligible for a
                partial or full refund
              </li>
              <li>Photographic evidence may be requested to help us put things right</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4 text-sm">
              <strong>Note:</strong> Reasonable wear, existing marks, and
              pre-existing damage are excluded from quality guarantees.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Customer Responsibilities
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>
                Inform us of any hazards (sharp objects, aggressive pets, wet
                floors)
              </li>
              <li>Ensure the home is safe and reasonably clutter-free</li>
              <li>
                Not request tasks outside our service scope (e.g., dangerous
                work)
              </li>
              <li>Provide accurate access instructions and contact numbers</li>
              <li>
                Respect cleaner working hours ({settings.business_hours || "24/7"}; booking start slots available 24/7 round the clock)
              </li>
              <li>Report any accidents or property damage immediately</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Health & Safety
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              MakeMeClean operates in compliance with UK health and safety law:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>
                All cleaners are fully insured for public liability and
                employers' liability
              </li>
              <li>
                We use safe, approved cleaning products unless you specify
                otherwise
              </li>
              <li>Cleaners are trained in safe working practices</li>
              <li>All equipment is regularly maintained and checked</li>
              <li>
                We will not clean if the property is unsafe or conditions pose a
                risk
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Liability & Insurance
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>What we are liable for:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
              <li>
                Damage caused directly by our cleaner's negligence, covered
                under our public liability policy
              </li>
              <li>Injury caused by our cleaner during service provision</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>What we are not liable for:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Loss of or damage to your personal items</li>
              <li>Valuables not secured before the service</li>
              <li>Existing damage or wear to your property</li>
              <li>Damage caused by customer instruction or request</li>
              <li>
                Accidents or incidents outside our control (weather, third
                parties)
              </li>
              <li>Cleaning of items not disclosed as hazardous</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Right to Refuse Service
            </h2>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to refuse or terminate service if:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 mt-2">
              <li>The property is unsafe or poses a health risk</li>
              <li>Access is not provided as agreed</li>
              <li>The customer is abusive or threatening</li>
              <li>The property contains hazardous materials not disclosed</li>
              <li>The customer requests tasks outside our scope</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Changes & Amendments
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Booking changes can be made up to 24 hours before service</li>
              <li>Same-day changes may incur additional charges</li>
              <li>Changes are subject to staff availability</li>
              <li>Confirmation email will be sent for all amendments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Recurring Bookings
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Recurring bookings auto-renew unless cancelled by you</li>
              <li>You can change frequency, date, or time anytime</li>
              <li>Prices are fixed for 12 months from the booking date</li>
              <li>We may notify you of price changes with 4 weeks' notice</li>
              <li>
                Either party may terminate recurring bookings with 7 days'
                notice
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Questions or Concerns?
            </h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about these terms, please contact us at{" "}
              <a
                href={`mailto:${settings.contact_email}`}
                className="text-green-600 font-semibold hover:underline"
              >
                {settings.contact_email}
              </a>
              {settings.business_phone && (
                <>
                  {" "}
                  or{" "}
                  <a
                    href={`tel:${settings.business_phone.replace(/\s/g, "")}`}
                    className="text-green-600 font-semibold hover:underline"
                  >
                    {settings.business_phone}
                  </a>
                </>
              )}
              .
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4 border-t">
            Last updated: 18 November 2026
          </p>
        </div>
      </div>
    </div>
  );
}
