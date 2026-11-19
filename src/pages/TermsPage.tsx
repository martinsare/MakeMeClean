import { Link } from "wouter";
import { FileText } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

const UPDATED = "18 November 2026";

const sections = [
  {
    id: "about",
    title: "1. About Us",
    content: [
      `MakeMeClean Ltd ("we", "us", "our") is a professional cleaning services company operating across Wales, United Kingdom. By booking a service or using our website at makemeclean.co.uk (the "Site"), you agree to be bound by these Terms and Conditions.`,
      `If you have any questions, you can contact us at the details shown in the footer of our website.`,
    ],
  },
  {
    id: "services",
    title: "2. Our Services",
    content: [
      `We provide domestic and commercial cleaning services including, but not limited to: standard cleaning, deep cleaning, end of tenancy cleaning, Airbnb/holiday let cleaning, ironing, window cleaning, and spring cleaning.`,
      `All services are performed by vetted, insured, and referenced cleaning professionals. We reserve the right to modify or discontinue any service at any time, with reasonable notice where possible.`,
      `Our services are available to residential and business customers in Wales, UK. We do not guarantee availability in all areas at all times; please confirm coverage when booking.`,
    ],
  },
  {
    id: "booking",
    title: "3. Booking & Confirmation",
    content: [
      `A booking is confirmed once you receive a written confirmation from us (by email or through the Site). Until confirmation is received, no contract exists between you and MakeMeClean Ltd.`,
      `You must provide accurate information when booking, including your name, address, contact details, and any relevant access instructions. We accept no liability for errors arising from inaccurate information provided by you.`,
      `We reserve the right to refuse or cancel any booking at our discretion, including where the property presents health and safety concerns, or where a prior relationship with the customer has broken down.`,
    ],
  },
  {
    id: "cancellation",
    title: "4. Cancellation & Rescheduling",
    content: [
      `You may cancel or reschedule a booking free of charge with at least 24 hours' notice before the scheduled start time for a full refund.`,
      `Cancellations made between 3 and 24 hours before the service incur a 30% fee (70% refund) to cover cleaner schedule disruption and administration.`,
      `Cancellations made less than 3 hours before the scheduled clean or no-shows are non-refundable as the cleaning professional has already been dispatched.`,
      `We reserve the right to cancel or reschedule appointments due to circumstances beyond our control (e.g. staff illness, extreme weather). In such cases, you will be offered an alternative appointment or a full refund.`,
    ],
  },
  {
    id: "consumer-cancellation",
    title: "5. Your Right to Cancel (Consumer Contracts Regulations 2013)",
    content: [
      `If you book online as a consumer (i.e. not in the course of business), you have a statutory right to cancel your order within 14 calendar days of booking, without giving any reason ("cooling-off period").`,
      `However, if you have requested that the service begin within the 14-day cooling-off period and you cancel after the service has commenced, you are liable to pay for any part of the service already performed.`,
      `If you request the service to begin immediately and it is completed within the cooling-off period, you acknowledge that you lose your right to cancel once the service is fully performed.`,
      `To exercise your right to cancel, please contact us in writing (email is sufficient) before the cooling-off period expires.`,
    ],
  },
  {
    id: "pricing",
    title: "6. Pricing & Payment",
    content: [
      `All prices quoted are in pounds sterling (GBP) and are inclusive of VAT where applicable. We reserve the right to adjust prices at any time; changes will not affect confirmed bookings.`,
      `Payment is due at the time of booking unless otherwise agreed. We accept payment by card via our secure online payment system.`,
      `For recurring bookings, payment is charged per visit as agreed at the time of setup. You may cancel a recurring plan at any time; charges will not be applied after a confirmed cancellation.`,
      `Discounts for recurring bookings (weekly, fortnightly, monthly) are applied at the rate shown on our website at the time of booking and are subject to change for future bookings. Existing confirmed visits are not affected.`,
      `Where an invoice is issued and payment is not received within 14 days of the invoice date, we reserve the right to charge interest at 8% per annum above the Bank of England base rate, in accordance with the Late Payment of Commercial Debts (Interest) Act 1998.`,
    ],
  },
  {
    id: "access",
    title: "7. Access to Your Property",
    content: [
      `You are responsible for ensuring our team has safe and unobstructed access to the property at the agreed time. If our cleaner cannot gain access, this will be treated as a late cancellation and may incur a fee.`,
      `You confirm that you have the right to authorise our team to enter and clean the property. Where you are a tenant, you confirm you have the relevant permission from your landlord.`,
      `We ask that pets are kept in a separate room or secure area during the clean, where possible, to ensure the safety of both the animal and our staff.`,
    ],
  },
  {
    id: "liability",
    title: "8. Liability & Insurance",
    content: [
      `We carry full public liability insurance for our cleaning services. In the event of damage or loss caused directly by our negligence, please notify us within 24 hours of the clean so we can investigate promptly.`,
      `Claims reported after 24 hours may be more difficult to substantiate and, at our discretion, may not be accepted. We are not liable for pre-existing damage, wear and tear, or fragile items not declared prior to the clean.`,
      `Our liability is limited to the cost of the service booked. We are not liable for any indirect loss, including loss of earnings or consequential damage.`,
      `Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be limited by law.`,
      `Under the Consumer Rights Act 2015, we are required to provide services with reasonable care and skill, within a reasonable time, and at a reasonable price. These rights are not affected by these terms.`,
    ],
  },
  {
    id: "your-responsibilities",
    title: "9. Your Responsibilities",
    content: [
      `You must inform us in advance of any known hazards at the property, including but not limited to: asbestos, mould, pest infestations, or structural issues.`,
      `Please ensure that valuables are secured or removed prior to our arrival. We recommend removing jewellery, cash, and small high-value items from surfaces to be cleaned.`,
      `You agree not to engage or solicit any MakeMeClean cleaner directly, outside of our platform, during the term of any booking and for a period of six months thereafter.`,
    ],
  },
  {
    id: "complaints",
    title: "10. Complaints & Re-Cleans",
    content: [
      `If you are not satisfied with the standard of cleaning, please contact us within 24 hours of the service. We will investigate promptly and, where reasonable, arrange a complimentary re-clean of the affected areas.`,
      `Complaints should be directed to our contact email (shown on the Site). We aim to acknowledge complaints within 1 working day and resolve them within 7 working days.`,
      `If your complaint is not resolved to your satisfaction, you may refer the matter to an Alternative Dispute Resolution (ADR) scheme or seek redress through the courts of England and Wales.`,
    ],
  },
  {
    id: "data",
    title: "11. Data Protection",
    content: [
      `We take your privacy seriously. Please refer to our Privacy Policy for full details of how we collect, use, and protect your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.`,
    ],
  },
  {
    id: "intellectual-property",
    title: "12. Intellectual Property",
    content: [
      `All content on this Site, including text, images, logos, and software, is owned by or licensed to MakeMeClean Ltd. You may not reproduce, copy, distribute, or commercially exploit any content without our prior written consent.`,
    ],
  },
  {
    id: "changes",
    title: "13. Changes to These Terms",
    content: [
      `We may update these Terms and Conditions from time to time. The current version is always published on this page with the date last updated. Continued use of our services after any changes constitutes your acceptance of the revised terms.`,
    ],
  },
  {
    id: "governing-law",
    title: "14. Governing Law",
    content: [
      `These Terms and Conditions are governed by the laws of England and Wales. Any disputes arising from these terms or our services shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
    ],
  },
];

export default function TermsPage() {
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600/20 border border-green-600/40 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">
              Legal
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Terms &amp; Conditions
          </h1>
          <p className="text-gray-400 text-sm">
            Last updated:{" "}
            <span className="text-gray-300 font-semibold">{UPDATED}</span>
            <span className="mx-3 text-gray-700">·</span>
            Applies to all bookings made via makemeclean.co.uk
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sticky TOC */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-6 bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Contents
              </p>
              <nav className="space-y-0.5">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Intro box */}
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 space-y-2">
              <p className="text-sm text-green-900 leading-relaxed">
                Please read these Terms and Conditions carefully before using
                our services. By booking a clean or using our website, you agree
                to these terms. If you have any questions, email us at{" "}
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="font-semibold underline"
                >
                  {settings.contact_email}
                </a>
                .
              </p>
              <p className="text-xs text-green-800/80">
                Operator: <strong>{settings.company_legal_name || "MakeMeClean Ltd"}</strong>
                {settings.company_reg_number ? ` · Company Reg. No: ${settings.company_reg_number}` : ""}
                {settings.company_registered_address ? ` · ${settings.company_registered_address}` : ""}
                {settings.vat_registered === "true" && settings.vat_number ? ` · VAT No: ${settings.vat_number}` : ""}
              </p>
            </div>

            {sections.map((s) => (
              <div
                key={s.id}
                id={s.id}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 scroll-mt-20"
              >
                <h2 className="text-base font-black text-gray-900 mb-4">
                  {s.title}
                </h2>
                <div className="space-y-3">
                  {s.content.map((para, i) => (
                    <p
                      key={i}
                      className="text-sm text-gray-600 leading-relaxed"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-gray-100 rounded-2xl p-5 text-sm text-gray-500">
              <p>
                Questions about these Terms?{" "}
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="text-green-600 font-semibold hover:underline"
                >
                  {settings.contact_email}
                </a>
                {settings.business_phone && (
                  <>
                    {" "}
                    or call{" "}
                    <a
                      href={`tel:${settings.business_phone.replace(/\s/g, "")}`}
                      className="text-green-600 font-semibold hover:underline"
                    >
                      {settings.business_phone}
                    </a>
                    .
                  </>
                )}{" "}
                You may also wish to read our{" "}
                <Link
                  href="/privacy"
                  className="text-green-600 font-semibold hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
