import { useState } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/apiClient";

const faqs = [
  {
    q: "What areas of Wales do you cover?",
    a: "We cover all major cities and towns across Wales including Cardiff, Swansea, Newport, Wrexham, Barry, Bridgend, Neath, Llanelli, and the surrounding areas.",
  },
  {
    q: "How do I book a cleaning service?",
    a: "Click 'Book Now' in the navigation, select your service, choose a date and time, enter your address, and confirm. The whole process takes less than 3 minutes. You'll need a free account first.",
  },
  {
    q: "Can I cancel or reschedule my booking?",
    a: "Yes. Unpaid bookings can be cancelled directly up to 3 hours before the start time from 'My Bookings'. For paid bookings, use 'Request Refund' on your booking detail page so our team can cancel and process your Stripe refund in line with our Cancellation Policy. To reschedule, use 'Request Reschedule' and an admin will confirm your new slot.",
  },
  {
    q: "Are your cleaners fully insured?",
    a: "Yes. All MakeMeClean cleaners are fully insured, DBS-checked, and referenced before joining our team. We never send untested staff into your home.",
  },
  {
    q: "What cleaning products do you use?",
    a: "We use eco-friendly, plant-based products that are safe for children, pets, and the environment. If you have specific preferences or allergies, add them in the Special Instructions field when booking.",
  },
  {
    q: "Do I need to be home during the clean?",
    a: "Not necessarily. Many customers leave a key or set up safe-entry. Just add your instructions in the Special Instructions field when booking.",
  },
  {
    q: "What if I'm not happy with the clean?",
    a: "We have a satisfaction guarantee. If you're not happy with any part of the service, contact us within 24 hours and we'll send a cleaner back at no extra charge.",
  },
  {
    q: "How does payment work?",
    a: "Payment is taken securely online by card or digital wallet via Stripe. You can pay immediately after booking or from your bookings page before your scheduled start time — unpaid bookings automatically expire once the start time passes.",
  },
  {
    q: "Can I set up a regular recurring clean?",
    a: "Yes. When booking you can choose weekly, fortnightly, or monthly. Recurring bookings come with an automatic discount of up to 15% off every visit.",
  },
  {
    q: "How quickly can you get someone to me?",
    a: "For same-day cleaning we usually have availability within a few hours, subject to staff availability in your area. Planned bookings can be made weeks in advance.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <p className="text-sm font-bold text-gray-900 pr-4">{q}</p>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-50">
          <p className="text-sm text-gray-500 leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function ContactPage() {
  const settings = useSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.sendContactMessage({
        name,
        email,
        phone: phone || undefined,
        subject: subject || undefined,
        message,
      });
      setDone(true);
    } catch (err: any) {
      setError(
        err?.message || "Failed to send your message. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">
              Contact Us
            </p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">
            Get in touch
          </h1>
          <p className="text-gray-500 max-w-lg text-sm">
            We're here to help. Send us a message and we'll get back to you as
            soon as possible — usually within a few hours.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid lg:grid-cols-3 gap-8 mb-14">
          {/* Contact info */}
          <div className="space-y-3">
            {[
              {
                icon: Phone,
                label: "Phone",
                value: settings.business_phone,
                sub: settings.business_hours || "7 days a week, 8am–8pm",
              },
              {
                icon: Mail,
                label: "Email",
                value: settings.contact_email,
                sub: "We reply within 24 hours",
              },
              {
                icon: MapPin,
                label: "Based in",
                value: "Wales, UK",
                sub: "Serving all major Welsh cities",
              },
              {
                icon: Clock,
                label: "Working hours",
                value: settings.business_hours,
                sub: "Standard booking start slots 7am–5pm",
              },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div
                key={label}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4"
              >
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">
                    {value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            {done ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">
                  Message sent!
                </h3>
                <p className="text-gray-500 text-sm">
                  We'll get back to you at{" "}
                  <span className="font-semibold">{email}</span> within a few
                  hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-base font-black text-gray-900 mb-1">
                  Send us a message
                </h2>

                {error && (
                  <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Your name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="label">Email address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone (optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field"
                      placeholder="+44 7700 000000"
                    />
                  </div>
                  <div>
                    <label className="label">Subject</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select a subject</option>
                      <option>General enquiry</option>
                      <option>Booking help</option>
                      <option>Complaint</option>
                      <option>Feedback</option>
                      <option>Partnership</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Message</label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="input-field resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            Frequently asked questions
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Can't find your answer?{" "}
            <a
              href={`mailto:${settings.contact_email}`}
              className="text-green-600 font-semibold hover:underline"
            >
              Email us directly.
            </a>
          </p>
          <div className="space-y-2">
            {faqs.map((faq) => (
              <FAQItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
