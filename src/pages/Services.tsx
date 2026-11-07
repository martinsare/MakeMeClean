import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Search,
  Shield,
  CheckCircle2,
  Clock,
  ArrowRight,
  Leaf,
  Layers,
  Home as HomeIcon,
  Building,
  Key,
  Check,
  Star,
  Award,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { buildServiceCatalogFromDb } from "@/lib/serviceCatalog";
import { formatCurrency } from "@/lib/utils";

// Category tabs are now dynamically populated from database services

export default function Services() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { services, loading } = useServices();

  const catalogCards = useMemo(() => {
    return buildServiceCatalogFromDb(services);
  }, [services]);

  const categoryTabs = useMemo(() => {
    const tabs = [{ id: "all", label: "All Services" }];
    const seen = new Set<string>();
    catalogCards.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        tabs.push({ id: c.id, label: c.name });
      }
    });
    return tabs;
  }, [catalogCards]);

  const filteredCards = useMemo(() => {
    return catalogCards.filter((card) => {
      const matchesSearch =
        card.name.toLowerCase().includes(search.toLowerCase()) ||
        card.tagline.toLowerCase().includes(search.toLowerCase()) ||
        card.description.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedCategory === "all") return true;
      return card.id === selectedCategory;
    });
  }, [catalogCards, search, selectedCategory]);

  return (
    <div className="min-h-screen bg-gray-50/70">
      {/* ── Page Hero Header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 relative">
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200/80 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              Transparent, Professional Cleaning Across Wales
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
              Our Cleaning Services & Rates
            </h1>

            <p className="text-gray-600 text-base sm:text-lg mb-8 leading-relaxed">
              Clear, transparent hourly pricing with no surprise charges. Every
              booking includes DBS-checked cleaners, full public liability
              insurance, eco supplies, and our 100% satisfaction re-clean
              guarantee.
            </p>

            {/* Search Input & Category Filters */}
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by category, ironing, deep clean..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  data-testid="input-service-search"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {categoryTabs.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-green-600 text-white shadow-sm"
                          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust Reassurance Badges ──────────────────────────────── */}
      <div className="bg-gray-900 text-white py-4 border-b border-gray-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span>Fully Insured & Public Liability Covered</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>100% DBS-Checked Cleaners</span>
          </div>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-400" />
            <span>Non-Toxic Eco-Friendly Products Included</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            <span>Available 7 Days a Week Across Wales</span>
          </div>
        </div>
      </div>

      {/* ── Clean Category Cards Grid ─────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400 font-medium">
              Loading service catalog...
            </p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 max-w-lg mx-auto p-8 shadow-xs">
            <p className="text-base font-bold text-gray-900 mb-1">
              No services found matching "{search}"
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Try searching for "Domestic", "Ironing", or clear your filter.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
              }}
              className="btn-primary text-xs py-2 px-4"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map((card) => {
              return (
                <div
                  key={card.id}
                  className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-green-300 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Icon, Badge, Price */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                        {card.icon}
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        {card.badge && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
                            {card.badge}
                          </span>
                        )}
                        <p className="text-xl font-black text-gray-900">
                          {card.hourlyRateRange}
                        </p>
                      </div>
                    </div>

                    <h2 className="text-xl font-black text-gray-900 mb-1 group-hover:text-green-700 transition-colors">
                      {card.name}
                    </h2>
                    <p className="text-xs font-semibold text-green-700 mb-3">
                      {card.tagline}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-6">
                      {card.description}
                    </p>
                  </div>

                  {/* Actions: View Details + Book Now */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/services/${card.primaryServiceId}`}
                      className="text-xs font-bold text-gray-600 hover:text-green-700 transition-colors inline-flex items-center gap-1"
                    >
                      Learn more
                    </Link>
                    <Link
                      href={`/book?service=${card.primaryServiceId}`}
                      className="btn-primary text-xs font-bold py-2 px-4 flex items-center gap-1.5 shadow-xs"
                    >
                      Book this clean <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Standard Inclusions & Extras Transparency Section ────────── */}
      <div className="bg-white border-t border-gray-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="section-eyebrow">
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete Transparency
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                What's included in every standard clean
              </h2>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                We believe in straightforward pricing with zero hidden fees.
                Every standard clean covers all main living areas, kitchen
                surfaces, bathrooms, and floor care.
              </p>

              <div className="space-y-3">
                {[
                  "All work surfaces, counters & hobs degreased & sanitized",
                  "Complete bathroom scrubbing, limescale removal & disinfection",
                  "Dusting all reachable surfaces, skirting boards & mirrors",
                  "Full vacuuming of carpets, rugs & deep mopping of hard floors",
                  "Emptying bins & disposing of household rubbish",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-6 sm:p-8 rounded-3xl border border-gray-200">
              <h3 className="font-bold text-gray-900 text-base mb-2">
                Popular Optional Extras
              </h3>
              <p className="text-xs text-gray-500 mb-5">
                Add any of these specialist tasks directly inside our booking
                form:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Deep Oven & Grill Clean", time: "+ 45 mins" },
                  { name: "Inside Fridge & Freezer", time: "+ 30 mins" },
                  { name: "Interior Window Buffing", time: "+ 30 mins" },
                  { name: "Carpet Stain Extraction", time: "+ 60 mins" },
                  { name: "Inside Kitchen Cabinets", time: "+ 45 mins" },
                  { name: "Ironing & Laundry Service", time: "+ 60 mins" },
                ].map((extra, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-gray-200/80"
                  >
                    <div className="font-bold text-xs text-gray-900">
                      {extra.name}
                    </div>
                    <div className="text-[10px] text-green-700 font-semibold">
                      {extra.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Welsh Coverage Banner ─────────────────────────────────── */}
      <div className="green-gradient text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">
            Covering Every Corner of Wales
          </h2>
          <p className="text-green-100 text-sm sm:text-base max-w-xl mx-auto mb-6">
            Serving Cardiff, Newport, Swansea, Pontypridd, Bridgend, Barry,
            Penarth, Caerphilly, and surrounding areas 7 days a week.
          </p>
          <Link
            href="/book"
            className="bg-white text-green-800 font-bold px-8 py-3.5 rounded-xl hover:bg-green-50 transition-all inline-flex items-center gap-2 text-sm shadow-md"
            data-testid="link-services-book"
          >
            Book Your Cleaner Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
