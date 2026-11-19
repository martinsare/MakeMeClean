import { useSettings } from "@/hooks/useSettings";

export default function ComplaintsProcedure() {
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Complaints Procedure</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Raise a Complaint</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We are committed to delivering excellent service. If you are unhappy with any aspect of our service, we want to hear from you. We will investigate your complaint promptly and fairly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Stage 1: Informal Resolution (5 business days)</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Please contact us immediately to discuss your concern. Most issues are resolved at this stage.
            </p>
            <div className="bg-gray-50 p-6 rounded-lg space-y-2">
              <p><strong className="text-gray-900">Email:</strong> <a href={`mailto:${settings.contact_email}`} className="text-green-600 font-semibold hover:underline">{settings.contact_email}</a></p>
              {settings.business_phone && <p><strong className="text-gray-900">Phone:</strong> <a href={`tel:${settings.business_phone.replace(/\s/g, "")}`} className="text-green-600 font-semibold hover:underline">{settings.business_phone}</a></p>}
              <p><strong className="text-gray-900">Contact Form:</strong> <a href="/contact" className="text-green-600 font-semibold hover:underline">Use our contact page</a></p>
              <p className="text-sm text-gray-500 pt-2">Please include your booking reference, service date, and details of the issue.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Stage 2: Formal Complaint (within 7 working days)</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you&apos;re not satisfied with the initial response, submit a formal written complaint within 14 days of the incident:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-600"><strong className="text-gray-900">Send to:</strong></p>
              <p className="text-gray-600">{settings.company_legal_name || "MakeMeClean"} Complaints Team<br />
              Email: <a href={`mailto:${settings.contact_email}`} className="text-green-600 font-semibold hover:underline">{settings.contact_email}</a></p>
              <p className="text-sm text-gray-500 mt-4">Include:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-500 mt-2">
                <li>Booking reference</li>
                <li>Service date and cleaner name</li>
                <li>Detailed description of the issue</li>
                <li>How we can resolve it</li>
                <li>Any supporting evidence (photos, correspondence)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Our Response</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4 py-2">
                <p className="font-semibold text-gray-900">Acknowledgement (within 1 working day)</p>
                <p className="text-gray-600 text-sm">We&apos;ll confirm receipt and assign a reference number</p>
              </div>
              <div className="border-l-4 border-green-600 pl-4 py-2">
                <p className="font-semibold text-gray-900">Investigation (2–5 working days)</p>
                <p className="text-gray-600 text-sm">We&apos;ll investigate thoroughly and contact you with findings</p>
              </div>
              <div className="border-l-4 border-green-600 pl-4 py-2">
                <p className="font-semibold text-gray-900">Resolution (within 7 working days)</p>
                <p className="text-gray-600 text-sm">We&apos;ll provide a full explanation and any remedies offered</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">What We Consider</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Service quality issues (cleanliness standards not met)</li>
              <li>Professionalism and conduct of staff</li>
              <li>Billing and payment disputes</li>
              <li>Cancellation and refund disputes</li>
              <li>Booking errors or miscommunication</li>
              <li>Privacy and data handling concerns</li>
              <li>Website accessibility issues</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Possible Outcomes</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Depending on our investigation, we may offer:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Full or partial refund</li>
              <li>Free re-clean or replacement service</li>
              <li>Account credit</li>
              <li>Discount on future services</li>
              <li>Explanation of actions taken</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Taking Your Complaint Further</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you remain unhappy after our investigation, you may refer the complaint to:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-600"><strong className="text-gray-900">Trading Standards</strong> (UK Consumer Rights Act 2015)</p>
              <p className="text-gray-600 text-sm mt-2">
                Citizens Advice Consumer Service<br />
                <a href="https://www.citizensadvice.org.uk/consumer" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">www.citizensadvice.org.uk/consumer</a>
              </p>
            </div>
            <p className="text-gray-600 leading-relaxed mt-4">
              You also have the right to pursue the matter through small claims court if applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confidentiality</h2>
            <p className="text-gray-600 leading-relaxed">
              All complaints are treated confidentially. We will not disclose details to third parties except where required by law (e.g., trading standards investigations).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Complaints We Cannot Investigate</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We cannot investigate complaints:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Made more than 6 months after the incident</li>
              <li>About events outside our control (road closures, extreme weather)</li>
              <li>Already resolved through another formal process</li>
              <li>That are vexatious or abusive in nature</li>
            </ul>
          </section>

          <p className="text-xs text-gray-500 pt-4 border-t">Last updated: 18 November 2026</p>
        </div>
      </div>
    </div>
  );
}
