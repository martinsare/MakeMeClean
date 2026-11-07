import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Leaf,
  Layers,
  Award,
  Lock,
  Phone,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useSettings } from "@/hooks/useSettings";
import { formatCurrency } from "@/lib/utils";
import { getServiceDetailConfig } from "@/lib/serviceDetailsData";
import { fetchActiveCities, walesCities } from "@/lib/services";

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const settings = useSettings();
  const { services, loading } = useServices();
  const [activeCities, setActiveCities] = useState<string[]>(walesCities);

  useEffect(() => {
    fetchActiveCities().then((cities) => {
      if (cities && cities.length > 0) {
        setActiveCities(cities);
      }
    });
  }, []);

  const service = useMemo(() => {
    if (!services || services.length === 0) return null;
    return (
      services.find((s) => s.id === id) ||
      services.find((s) => s.name.toLowerCase().replace(/\s+/g, "-") === id) ||
      services[0]
    );
  }, [services, id]);

  const config = useMemo(() => {
    if (!service) return null;
    return getServiceDetailConfig(service.name, service.description);
  }, [service]);

  const [selectedPropIndex, setSelectedPropIndex] = useState(1);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-medium">
          Loading service details...
        </p>
      </div>
    );
  }

  if (!service || !config) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Service Not Found
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          The cleaning service you are looking for does not exist or has been
          updated.
        </p>
        <Link href="/services" className="btn-primary">
          Browse All Services
        </Link>
      </div>
    );
  }

  const discount = Math.max(
    0,
    Math.min(100, Number(service.discount_percent ?? 0))
  );
  const hasDiscount = discount > 0;
  const hourlyRate = hasDiscount
    ? service.price * (1 - discount / 100)
    : service.price;

  const currentDurationObj =
    config.durationGuide[selectedPropIndex] || config.durationGuide[0];
  const approxHours =
    currentDurationObj?.approxHours ??
    (selectedPropIndex === 0
      ? 2
      : selectedPropIndex === 1
      ? 3
      : selectedPropIndex === 2
      ? 4
      : 5);
  const estimatedCost = hourlyRate * approxHours;
  const bookingParams = new URLSearchParams();
  if (currentDurationObj?.bedrooms != null)
    bookingParams.set("bedrooms", String(currentDurationObj.bedrooms));
  if (currentDurationObj?.bathrooms != null)
    bookingParams.set("bathrooms", String(currentDurationObj.bathrooms));
  if (currentDurationObj?.living != null)
    bookingParams.set("livingRooms", String(currentDurationObj.living));
  if (currentDurationObj?.propertyType)
    bookingParams.set("propertyType", currentDurationObj.propertyType);
  const bookUrl = `/book/${service.id}${
    bookingParams.toString() ? `?${bookingParams.toString()}` : ""
  }`;

  return (
    <div className="min-h-screen bg-gray-50/60 pb-20">
      {/* ── Breadcrumbs ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-gray-500 flex items-center gap-2">
          <Link href="/" className="hover:text-green-600">
            Home
          </Link>
          <span>/</span>
          <Link href="/services" className="hover:text-green-600">
            Services
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-semibold">{service.name}</span>
        </div>
      </div>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200/80 pt-8 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                {config.badge || "Verified Welsh Service"}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-4 tracking-tight">
                {service.name}
              </h1>

              <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-6">
                {service.description || config.tagline}
              </p>

              {/* Reassurance Row */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-gray-600 mb-8 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Award className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-gray-900">
                    100% Satisfaction Guaranteed
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-700">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>Fully Insured</span>
                </div>
                <div className="flex items-center gap-1 text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>DBS Checked</span>
                </div>
              </div>

              {/* Price & Immediate Booking Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-medium">
                    Starting from
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-green-700">
                      {formatCurrency(hourlyRate)}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-gray-400 line-through font-bold">
                        {formatCurrency(service.price)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-medium">
                      / hour
                    </span>
                  </div>
                </div>

                <Link
                  href={bookUrl}
                  className="btn-primary py-4 px-8 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 w-full sm:w-auto"
                >
                  Book This Clean <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-gray-100 relative">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="w-full h-72 sm:h-96 object-cover"
                  />
                ) : (
                  <div className="w-full h-80 flex items-center justify-center text-gray-400">
                    Cleaning Image
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-900 shadow-sm flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-green-600" />
                  100% Eco-Friendly Supplies
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Duration Guide / Property Size Selector (Wecasa style) ─── */}
      <section className="py-12 bg-white border-b border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <p className="section-eyebrow">
              <Clock className="w-3.5 h-3.5" /> Time Estimation Guide
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
              Recommended Cleaning Duration
            </h2>
            <p className="text-sm text-gray-600">
              Select your property type below to see recommended hours and
              estimated total cost.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {config.durationGuide.map((item, idx) => {
              const isSelected = selectedPropIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedPropIndex(idx)}
                  className={`p-5 rounded-2xl text-left border transition-all ${
                    isSelected
                      ? "border-green-600 bg-green-50/60 shadow-md ring-2 ring-green-600/20"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-900">
                      {item.property}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-green-700 mb-2">
                    {item.hours}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Instant Estimate Banner */}
          <div className="mt-8 p-5 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Estimated for {currentDurationObj.property} (~{approxHours} hrs)
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">
                Approx. {formatCurrency(estimatedCost)}{" "}
                <span className="text-xs font-normal text-gray-500">
                  (Includes all standard room tasks & products)
                </span>
              </div>
            </div>
            <Link
              href={bookUrl}
              className="btn-primary text-xs py-3 px-6 shrink-0"
            >
              Continue to Booking
            </Link>
          </div>
        </div>
      </section>

      {/* ── Inclusions vs Exclusions Checklist (Wecasa style) ──────── */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="section-eyebrow justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" /> Scope of Work
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            What is Included & What is Not
          </h2>
          <p className="text-sm text-gray-500">
            Clear, transparent expectations so you know exactly what your
            cleaner will deliver.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Included */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Included in this clean
                </h3>
                <p className="text-xs text-gray-500">
                  Standard checklist performed on every visit
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              {config.inclusions.map((inc, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm text-gray-700 font-medium">
                    {inc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Not Included */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Not included by default
                </h3>
                <p className="text-xs text-gray-500">
                  Available as optional booking add-ons
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              {config.exclusions.map((exc, i) => (
                <div key={i} className="flex items-start gap-3">
                  <XCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm text-gray-600">
                    {exc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Supplies & Equipment ───────────────────────────────────── */}
      <section className="py-12 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <p className="section-eyebrow">
              <Leaf className="w-3.5 h-3.5" /> Products & Tools
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
              Equipment & Eco-Supplies
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-green-50/50 border border-green-200">
              <h3 className="font-bold text-sm text-green-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-700" />
                What your cleaner brings:
              </h3>
              <ul className="space-y-2 text-xs text-gray-700">
                {config.suppliesInfo.cleanerBrings.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200">
              <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-gray-500" />
                What you need to provide:
              </h3>
              <ul className="space-y-2 text-xs text-gray-600">
                {config.suppliesInfo.customerProvides.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Service Specific FAQs ──────────────────────────────────── */}
      <section className="py-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="section-eyebrow justify-center">
            <Shield className="w-3.5 h-3.5" /> FAQ
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            Questions about {service.name}?
          </h2>
        </div>

        <div className="space-y-3.5">
          {config.faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-xs"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-sm sm:text-base text-gray-900 hover:bg-gray-50/80 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-green-600 shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Welsh Coverage Link Bar ───────────────────────────────── */}
      <section className="py-8 bg-gray-100/70 border-t border-gray-200 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 mb-3">
            <MapPin className="w-3.5 h-3.5 inline text-green-600 mr-1" />
            {service.name} available throughout:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {activeCities.map((city) => (
              <Link
                key={city}
                href={`/book/${service.id}?city=${encodeURIComponent(city)}`}
                className="bg-white px-3 py-1 rounded-lg border border-gray-200 text-gray-700 hover:border-green-500 hover:text-green-700 transition-colors"
              >
                {city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sticky/Floating Booking CTA ────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 py-3.5 px-4 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-sm text-gray-900">
              {service.name}
            </div>
            <div className="text-xs text-green-700 font-bold">
              {formatCurrency(hourlyRate)}/hr · Fully Insured · DBS Vetted
            </div>
          </div>
          <Link
            href={`/book/${service.id}`}
            className="btn-primary py-2.5 px-6 text-sm font-bold flex items-center gap-2 shrink-0 shadow-md"
          >
            Book Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
