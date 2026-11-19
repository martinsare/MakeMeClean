import { useSettings } from "@/hooks/useSettings";

export default function AccessibilityStatement() {
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Accessibility Statement</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Commitment</h2>
            <p className="text-gray-600 leading-relaxed">
              {settings.company_legal_name || "MakeMeClean"} is committed to ensuring digital accessibility for all users, regardless of ability. We continuously work to improve the accessibility of our website and services in line with the UK Equality Act 2010 and the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Standards & Compliance</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our website aims to meet WCAG 2.1 Level AA standards for accessibility. This includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Clear navigation and logical page structure</li>
              <li>Keyboard accessibility for all interactive elements</li>
              <li>Sufficient colour contrast (minimum 4.5:1 for text)</li>
              <li>Alternative text (alt text) for all meaningful images</li>
              <li>Resizable text without loss of functionality</li>
              <li>Video and audio content with captions and transcripts (where applicable)</li>
              <li>Accessible forms with proper labels and error messaging</li>
              <li>Focus indicators visible on interactive elements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Accessibility Features</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li><strong>Screen Reader Compatibility:</strong> Our website works with popular screen readers including NVDA and JAWS</li>
              <li><strong>Zoom & Text Resizing:</strong> You can zoom to 200% without horizontal scrolling or loss of functionality</li>
              <li><strong>Keyboard Navigation:</strong> All features are accessible via keyboard (Tab, Enter, Arrow keys)</li>
              <li><strong>Skip Links:</strong> Jump directly to main content, bypassing repetitive navigation</li>
              <li><strong>Readable Fonts:</strong> We use clear, sans-serif fonts at appropriate sizes</li>
              <li><strong>Simple Language:</strong> Content is written in plain English to aid comprehension</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Known Accessibility Issues</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We are aware of the following areas that may present challenges:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Third-party hosted checkout pages (Stripe) are managed externally, though Stripe maintains WCAG 2.1 AA accessibility practices</li>
              <li>Some complex admin data tables and print-formatted invoices may require horizontal scrolling on very small viewports</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              We are working to address these issues and welcome your feedback.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Accessibility Tools</h2>
            <p className="text-gray-600 leading-relaxed">
              Most browsers include built-in accessibility features. You can typically access these via:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 mt-2">
              <li><strong>Firefox:</strong> Settings → Privacy → Browsing → Accessibility options</li>
              <li><strong>Chrome:</strong> Settings → Accessibility → manage accessibility features</li>
              <li><strong>Safari:</strong> System Preferences → Accessibility</li>
              <li><strong>Windows:</strong> Settings → Ease of Access</li>
              <li><strong>macOS:</strong> System Preferences → Accessibility</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Getting Help</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you experience accessibility barriers on our website, please let us know:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li><strong>Email:</strong> <a href={`mailto:${settings.contact_email}`} className="text-green-600 font-semibold hover:underline">{settings.contact_email}</a></li>
              {settings.business_phone && <li><strong>Phone:</strong> <a href={`tel:${settings.business_phone.replace(/\s/g, "")}`} className="text-green-600 font-semibold hover:underline">{settings.business_phone}</a></li>}
              <li><strong>Contact form:</strong> Use our <a href="/contact" className="text-green-600 font-semibold hover:underline">contact page</a></li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              We will investigate your report and aim to resolve the issue within 10 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Alternative Access</h2>
            <p className="text-gray-600 leading-relaxed">
              If you are unable to use our website, you can arrange bookings and manage your account by phone or email. We will provide equal service and support through these alternative channels.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Feedback & Further Support</h2>
            <p className="text-gray-600 leading-relaxed">
              If you&apos;re dissatisfied with our response to an accessibility concern, you can seek independent advice from the <a href="https://www.equalityadvisoryservice.com" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">Equality Advisory and Support Service (EASS)</a> regarding your rights under the UK Equality Act 2010.
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4 border-t">Last updated: 18 November 2026</p>
        </div>
      </div>
    </div>
  );
}
