import { Link } from "wouter";
import {
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
  Briefcase,
} from "lucide-react";
import logoUrl from "/logo.png";
import { useSettings } from "@/hooks/useSettings";
import { useServices } from "@/hooks/useServices";
import { buildServiceCatalogFromDb } from "@/lib/serviceCatalog";

export default function Footer() {
  const settings = useSettings();
  const { services } = useServices();

  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              <img
                src="/logo-dark.png"
                alt="MakeMeClean"
                className="h-10 md:h-11 w-auto max-w-[240px] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = logoUrl;
                }}
              />
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 mb-6">
              Trusted cleaning services across Wales. Vetted, insured, and
              available seven days a week.
            </p>
            <div className="flex gap-2">
              {[
                { icon: Facebook, label: "Facebook" },
                { icon: Instagram, label: "Instagram" },
                { icon: Twitter, label: "Twitter" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 bg-gray-800 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors duration-150"
                >
                  <Icon className="w-3.5 h-3.5 text-gray-300" />
                </a>
              ))}
            </div>
          </div>

          {/* Services — live from DB */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-5">
              Services
            </p>
            <ul className="space-y-3 text-sm">
              {buildServiceCatalogFromDb(services).map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/services/${cat.primaryServiceId}`}
                    className="hover:text-green-400 transition-colors duration-100 flex flex-col group py-0.5"
                  >
                    <span className="text-gray-300 group-hover:text-green-400 leading-snug">
                      {cat.name}
                    </span>
                    <span className="text-xs text-emerald-400/80 font-medium">
                      {cat.hourlyRateRange}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-5">
              Company
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/"
                  className="hover:text-green-400 transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/services"
                  className="hover:text-green-400 transition-colors"
                >
                  All Services
                </Link>
              </li>
              <li>
                <Link
                  href="/book"
                  className="hover:text-green-400 transition-colors"
                >
                  Book a Clean
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="hover:text-green-400 transition-colors flex items-center gap-1.5"
                >
                  <Briefcase className="w-3 h-3" /> Careers — We're hiring!
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-green-400 transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="hover:text-green-400 transition-colors"
                >
                  Create Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-5">
              Get in Touch
            </p>
            <ul className="space-y-4 text-sm">
              {settings.business_phone && (
                <li>
                  <a
                    href={`tel:${settings.business_phone.replace(/\s/g, "")}`}
                    className="flex items-start gap-3 hover:text-green-400 transition-colors group"
                  >
                    <div className="w-7 h-7 bg-gray-800 group-hover:bg-green-600/20 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    {settings.business_phone}
                  </a>
                </li>
              )}
              {settings.contact_email && (
                <li>
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="flex items-start gap-3 hover:text-green-400 transition-colors group"
                  >
                    <div className="w-7 h-7 bg-gray-800 group-hover:bg-green-600/20 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    {settings.contact_email}
                  </a>
                </li>
              )}
              <li>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <span>Serving all of Wales, UK</span>
                </div>
              </li>
            </ul>
            {settings.business_hours && (
              <div className="mt-6 p-3 bg-green-950/60 border border-green-900/50 rounded-xl">
                <p className="text-xs text-green-300 font-semibold">
                  Available 7 days a week
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {settings.business_hours}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-3">
                Policies
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Terms &amp; Conditions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cancellation"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Cancellation Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/unsubscribe"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Unsubscribe
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-3">
                Legal
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>
                  <Link
                    href="/service-terms"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Service Terms
                  </Link>
                </li>
                <li>
                  <Link
                    href="/accessibility"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Accessibility
                  </Link>
                </li>
                <li>
                  <Link
                    href="/complaints"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Complaints
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-3">
                Support
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-gray-300 transition-colors"
                  >
                    FAQ & Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/blog"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Blog & Tips
                  </Link>
                </li>
                {settings.business_phone && (
                  <li>
                    <a
                      href={`tel:${settings.business_phone.replace(/\s/g, "")}`}
                      className="hover:text-gray-300 transition-colors"
                    >
                      {settings.business_phone}
                    </a>
                  </li>
                )}
                {settings.contact_email && (
                  <li>
                    <a
                      href={`mailto:${settings.contact_email}`}
                      className="hover:text-gray-300 transition-colors"
                    >
                      {settings.contact_email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-3">
                Location
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>Serving all of Wales</li>
                {settings.business_hours && <li>{settings.business_hours}</li>}
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} MakeMeClean Ltd. All rights
              reserved.
            </p>
            <p className="text-xs text-gray-600">
              Professional cleaning services across Wales, UK
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
