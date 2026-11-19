import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

const UPDATED = "18 November 2026";

const sections = [
  {
    id: "who-we-are",
    title: "1. Who We Are",
    content: [
      `MakeMeClean Ltd ("we", "us", "our") is the data controller for personal data collected through our website makemeclean.co.uk and in connection with our cleaning services. We are registered in Wales, United Kingdom.`,
      `We are committed to protecting your personal data and complying with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. This Privacy Policy explains what data we collect, why we collect it, how we use it, and your rights.`,
      `If you have any questions about this policy or wish to exercise your data rights, please contact us at the details provided in Section 12.`,
    ],
  },
  {
    id: "what-we-collect",
    title: "2. Personal Data We Collect",
    content: [
      `When you use our website or book a service, we may collect the following categories of personal data:`,
      `Identity & contact data: first name, last name, email address, telephone number, billing and service address.`,
      `Booking data: service type, preferred date and time, property access instructions, notes, and booking history.`,
      `Payment data: payment card details are processed securely by our payment provider and are not stored by us. We retain only a transaction reference and payment status.`,
      `Account data: email address and encrypted password if you create an account; profile preferences; saved addresses.`,
      `Communications data: messages you send us via our contact form, email, or telephone, including the content and date of correspondence.`,
      `Technical data: IP address, browser type and version, device information, pages visited, and cookie data (see Section 9).`,
      `Recruitment data: if you apply for a role via our Careers page, we collect your CV, identification documents, references, and application details. This is covered separately in Section 6.`,
    ],
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Data & Legal Bases",
    content: [
      `We rely on the following legal bases under UK GDPR to process your personal data:`,
      `Contract performance (Article 6(1)(b)): to confirm and manage bookings, send booking confirmations and invoices, process payments, and provide our cleaning services.`,
      `Legitimate interests (Article 6(1)(f)): to respond to enquiries, send service-related communications, improve our website, detect and prevent fraud, and manage our business operations. We always balance these interests against your rights.`,
      `Legal obligation (Article 6(1)(c)): to comply with tax, accounting, and regulatory obligations.`,
      `Consent (Article 6(1)(a)): to send you marketing emails, where you have opted in. You can withdraw consent at any time by clicking "unsubscribe" in any marketing email or by contacting us.`,
    ],
  },
  {
    id: "sharing",
    title: "4. Who We Share Your Data With",
    content: [
      `We do not sell your personal data. We share it only with trusted third-party sub-processors who process data on our behalf under data processing agreements, including:`,
      `Stripe Payments UK Ltd / Stripe Inc.: processes all payment cards, refunds, and recurring billing in compliance with PCI-DSS Level 1 standards. We never store full card numbers.`,
      `Supabase Inc.: our cloud database, authentication, and private encrypted file storage provider used to store your account, booking records, and uploaded photos/documents.`,
      `Brevo (Sendinblue): our transactional and marketing email provider, used to send verification codes, booking confirmations, receipts, invoices, and (where opted in) newsletters.`,
      `Vercel Inc.: our web application and serverless API hosting provider.`,
      `Groq Inc.: powers our optional website AI chat assistant. Messages you type into the chat widget are processed to generate responses; please avoid sharing sensitive personal details or payment card numbers in chat.`,
      `Telegram (internal operational alerts): used to send redacted booking summary notifications (service type, date, town/outward postcode, and booking ID — excluding street addresses and key-safe/lockbox codes) to our dispatch administrators.`,
      `Google Tag Manager / Google Analytics (only with consent): optional site analytics scripts are strictly blocked unless you explicitly accept analytics cookies via our cookie banner.`,
      `We may also disclose personal data if required by law, court order, or where necessary to protect the rights, property, or safety of MakeMeClean Ltd, our staff, or the public.`,
    ],
  },
  {
    id: "retention",
    title: "5. Data Retention",
    content: [
      `We retain your personal data only for as long as necessary for the purposes set out in this policy, or as required by law.`,
      `Booking and customer data: retained for 6 years after your last transaction, in line with HMRC requirements for financial records.`,
      `Account data: retained for as long as your account is active, plus 2 years thereafter unless you request deletion.`,
      `Contact form messages: retained for up to 2 years.`,
      `Technical/log data: typically retained for up to 12 months.`,
      `When data is no longer required, we securely delete or anonymise it.`,
    ],
  },
  {
    id: "recruitment",
    title: "6. Recruitment Data",
    content: [
      `If you apply for a position with us, we collect and process your application data (CV, identification documents, references, and personal details) for the purpose of assessing your suitability for the role.`,
      `The legal basis is legitimate interests and, where sensitive data is involved (e.g. health declarations, right to work), explicit consent.`,
      `Unsuccessful applicants' data is retained for up to 12 months after the decision, in case of any challenge to the selection process, and is then securely deleted. Successful applicants' data is transferred to their employee record.`,
      `You may withdraw your application at any time by contacting our recruitment team.`,
    ],
  },
  {
    id: "your-rights",
    title: "7. Your Rights Under UK GDPR",
    content: [
      `Under UK GDPR, you have the following rights regarding your personal data:`,
      `Right of access: you may request a copy of all personal data we hold about you (a Subject Access Request or SAR). We will respond within one calendar month.`,
      `Right to rectification: you may ask us to correct inaccurate or incomplete data.`,
      `Right to erasure ("right to be forgotten"): you may ask us to delete your data where there is no overriding legal reason to keep it.`,
      `Right to restriction: you may ask us to pause processing your data in certain circumstances (e.g. while accuracy is disputed).`,
      `Right to data portability: you may ask us to provide your data in a structured, machine-readable format for transfer to another provider, where processing is based on consent or contract and carried out by automated means.`,
      `Right to object: you may object to processing based on legitimate interests or for direct marketing at any time.`,
      `Rights related to automated decision-making: we do not make solely automated decisions that produce significant legal or similarly significant effects.`,
      `To exercise any of these rights, please email us at the address shown in Section 12. We will verify your identity before processing any request.`,
    ],
  },
  {
    id: "children",
    title: "8. Children's Privacy",
    content: [
      `Our website and services are not directed at children under the age of 16. We do not knowingly collect personal data from children. If you believe we have inadvertently collected data from a child, please contact us and we will delete it promptly.`,
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies",
    content: [
      `We use cookies and similar tracking technologies on our website. Cookies are small text files stored on your device that help us provide and improve our service.`,
      `Essential cookies: necessary for the website to function (e.g. authentication session). These cannot be disabled.`,
      `Analytics cookies: help us understand how visitors use our site (e.g. pages visited, time on site). These may be provided by third-party analytics tools. We only use these where you have consented.`,
      `You can control cookies through your browser settings. Disabling non-essential cookies will not affect your ability to use our core services, but some features may be limited.`,
      `Our website may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to read their privacy policies.`,
    ],
  },
  {
    id: "security",
    title: "10. Data Security",
    content: [
      `We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, destruction, or disclosure. These include encrypted data storage, secure HTTPS connections, and restricted access controls.`,
      `Despite these measures, no transmission over the internet is completely secure. If you have reason to believe your data has been compromised, please contact us immediately.`,
      `In the event of a data breach likely to result in a risk to your rights and freedoms, we will notify the Information Commissioner's Office (ICO) within 72 hours and, where required, inform affected individuals without undue delay.`,
    ],
  },
  {
    id: "transfers",
    title: "11. International Data Transfers",
    content: [
      `Some of our third-party processors (e.g. Supabase, Brevo) may process data outside the UK or EEA. Where this occurs, we ensure appropriate safeguards are in place, such as the UK Addendum to the EU Standard Contractual Clauses or equivalent adequacy arrangements recognised under UK law.`,
    ],
  },
  {
    id: "contact",
    title: "12. Contact Us & Complaints",
    content: [
      `To exercise your data rights, ask questions about this policy, or raise a concern, please contact us by email or telephone (details shown in the footer of our website).`,
      `If you are not satisfied with our response, or believe we are processing your personal data unlawfully, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):`,
      `ICO helpline: 0303 123 1113 · Website: ico.org.uk · Address: Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF`,
    ],
  },
  {
    id: "changes",
    title: "13. Changes to This Policy",
    content: [
      `We may update this Privacy Policy from time to time to reflect changes in law, technology, or our business practices. The current version is always published on this page with the date last updated. We encourage you to review this page periodically.`,
    ],
  },
];

export default function PrivacyPage() {
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600/20 border border-green-600/40 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-gray-400 text-sm">
            Last updated: <span className="text-gray-300 font-semibold">{UPDATED}</span>
            <span className="mx-3 text-gray-700">·</span>
            Compliant with UK GDPR &amp; the Data Protection Act 2018
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-6 bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Contents</p>
              <nav className="space-y-0.5">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="block text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 transition-colors">
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-8">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 space-y-2">
              <p className="text-sm text-green-900 leading-relaxed">
                Your privacy matters to us. This policy explains exactly what personal data {settings.company_legal_name || "MakeMeClean Ltd"} collects, why we collect it, and how you can exercise your rights under UK data protection law.
              </p>
              <p className="text-xs text-green-800/80">
                Data Controller: <strong>{settings.company_legal_name || "MakeMeClean Ltd"}</strong>
                {settings.company_reg_number ? ` · Company Reg. No: ${settings.company_reg_number}` : ""}
                {settings.company_registered_address ? ` · ${settings.company_registered_address}` : ""}
              </p>
            </div>

            {sections.map((s) => (
              <div key={s.id} id={s.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 scroll-mt-20">
                <h2 className="text-base font-black text-gray-900 mb-4">{s.title}</h2>
                <div className="space-y-3">
                  {s.content.map((para, i) => (
                    <p key={i} className="text-sm text-gray-600 leading-relaxed">{para}</p>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-gray-100 rounded-2xl p-5 text-sm text-gray-500">
              <p>
                Questions about this policy?{" "}
                <a href={`mailto:${settings.contact_email}`} className="text-green-600 font-semibold hover:underline">
                  {settings.contact_email}
                </a>
                {settings.business_phone && <>{" "}or call{" "}<a href={`tel:${settings.business_phone.replace(/\s/g, "")}`} className="text-green-600 font-semibold hover:underline">{settings.business_phone}</a>.</>}
                {" "}You may also wish to read our{" "}
                <Link href="/terms" className="text-green-600 font-semibold hover:underline">Terms &amp; Conditions</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
