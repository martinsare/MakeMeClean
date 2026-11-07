import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Star,
  Shield,
  Clock,
  Phone,
  ArrowRight,
  Zap,
  Leaf,
  Award,
  CheckCircle2,
  MapPin,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Lock,
  Utensils,
  Bath,
  Bed,
  Layers,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import ServiceCard from "@/components/ServiceCard";
import { useServices } from "@/hooks/useServices";
import { buildServiceCatalogFromDb } from "@/lib/serviceCatalog";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/lib/supabase";
import {
  fetchActiveServiceLocations,
  ServiceCityLocation,
} from "@/lib/services";

interface Testimonial {
  name: string;
  city: string;
  rating: number;
  text: string;
  service: string;
  date?: string;
}

const trustBadges = [
  {
    icon: Shield,
    title: "Fully Insured",
    desc: "Vetted cleaning professionals with full public liability protection.",
  },
  {
    icon: CheckCircle2,
    title: "100% DBS Vetted",
    desc: "Strict ID & background checks on all cleaning professionals.",
  },
  {
    icon: Lock,
    title: "Cashless & Secure",
    desc: "Pay safely online only after your clean is completed.",
  },
  {
    icon: Award,
    title: "100% Satisfaction",
    desc: "Not fully satisfied? We re-clean within 24h for free.",
  },
];

const checklistTabs = [
  {
    id: "kitchen",
    label: "Kitchen",
    icon: Utensils,
    title: "Sparkling clean kitchen & dining areas",
    items: [
      "Hobs, burners & splashbacks degreased and sanitized",
      "Exterior & handles of all cupboards, drawers and cabinets",
      "Worktops, countertops and chopping boards disinfected",
      "Sink and taps descaled, polished and buffed dry",
      "Microwave cleaned inside and outside",
      "Exterior of oven, fridge, dishwasher and small appliances",
      "Kitchen tables, breakfast bars & chairs wiped down",
      "Bins emptied, sanitized and lined with fresh bin bags",
      "Hard floors swept, vacuumed and thoroughly mopped",
    ],
  },
  {
    id: "bathroom",
    label: "Bathrooms",
    icon: Bath,
    title: "Hygienic, limescale-free bathroom sanctuaries",
    items: [
      "Toilet bowl, seat, rim and cistern fully disinfected",
      "Shower enclosure, screen and showerhead descaled",
      "Bathtub, tiles and grout lines scrubbed and rinsed",
      "Basin, taps, plughole and vanity unit deep sanitized",
      "Mirrors, glass fixtures and chrome taps buffed streak-free",
      "Towel rails, radiator panels and shelves wiped clean",
      "Skirting boards and door handles sanitized",
      "Bathroom bins emptied and sanitized",
      "Tiled or vinyl floors swept, vacuumed and mopped with germicide",
    ],
  },
  {
    id: "bedroom",
    label: "Bedrooms & Living",
    icon: Bed,
    title: "Dust-free, fresh living rooms & restful bedrooms",
    items: [
      "All surfaces, coffee tables, desks & side tables dusted",
      "Beds made neatly with hospital corners (linen change on request)",
      "High & low dusting including light switches and door frames",
      "Picture frames, ornaments, mirrors and lamps dusted",
      "Skirting boards, window sills and radiators wiped down",
      "Sofas, cushions and soft furnishings vacuumed and straightened",
      "Accessible areas under and behind furniture vacuumed",
      "Carpets vacuumed edge-to-edge / hard floors vacuumed & mopped",
      "Wastepaper baskets emptied and relined",
    ],
  },
  {
    id: "hallway",
    label: "Hallways & Stairs",
    icon: Layers,
    title: "Welcoming entrances & spotless common spaces",
    items: [
      "Front door frame, porch area and welcome mats vacuumed",
      "Staircases vacuumed thoroughly including stair risers",
      "Banisters, handrails, spindles and newel posts sanitized",
      "Hallway console tables, mirrors and coat racks dusted",
      "Light switches, socket covers and thermostats wiped",
      "Under-stair storage doors and entry closets dusted",
      "Hardwood or tiled hallways mopped with pleasant natural scent",
      "Internal glass doors wiped streak-free",
    ],
  },
];

const serviceMatrix = [
  {
    feature: "Surface dusting, wiping & polishing",
    regular: true,
    deep: true,
    tenancy: true,
    airbnb: true,
  },
  {
    feature: "Kitchen & bathroom sanitation",
    regular: true,
    deep: true,
    tenancy: true,
    airbnb: true,
  },
  {
    feature: "Floors vacuumed & mopped throughout",
    regular: true,
    deep: true,
    tenancy: true,
    airbnb: true,
  },
  {
    feature: "Skirting boards, switches & high reachable dusting",
    regular: "Standard",
    deep: "Intensive",
    tenancy: "Intensive",
    airbnb: "Standard",
  },
  {
    feature: "Limescale & soap scum removal treatment",
    regular: "Light",
    deep: "Heavy duty",
    tenancy: "Heavy duty",
    airbnb: "Standard",
  },
  {
    feature: "Inside oven, fridge & deep appliance degrease",
    regular: "Optional add-on",
    deep: "Available add-on",
    tenancy: "Included / Full",
    airbnb: "Standard check",
  },
  {
    feature: "Fresh linen change & toiletries staging",
    regular: "On request",
    deep: "N/A",
    tenancy: "N/A",
    airbnb: "Included standard",
  },
  {
    feature: "Inventory & 100% Deposit Return Checklist",
    regular: "N/A",
    deep: "N/A",
    tenancy: "Guaranteed pass",
    airbnb: "Turnover check",
  },
];

const defaultCoverageTowns: ServiceCityLocation[] = [
  {
    name: "Cardiff",
    postcode_prefix: "CF10 - CF24",
    region: "Capital & South",
  },
  { name: "Swansea", postcode_prefix: "SA1 - SA7", region: "South West" },
  { name: "Newport", postcode_prefix: "NP10 - NP20", region: "Gwent" },
  {
    name: "Pontypridd",
    postcode_prefix: "CF37 - CF38",
    region: "Rhondda Cynon Taf",
  },
  {
    name: "Bridgend",
    postcode_prefix: "CF31 - CF35",
    region: "Bridgend County",
  },
  {
    name: "Barry",
    postcode_prefix: "CF62 - CF64",
    region: "Vale of Glamorgan",
  },
  { name: "Caerphilly", postcode_prefix: "CF83", region: "Caerphilly County" },
  { name: "Cwmbran", postcode_prefix: "NP44", region: "Torfaen" },
  {
    name: "Llanelli",
    postcode_prefix: "SA14 - SA15",
    region: "Carmarthenshire",
  },
  {
    name: "Merthyr Tydfil",
    postcode_prefix: "CF47 - CF48",
    region: "Merthyr Tydfil",
  },
  { name: "Neath", postcode_prefix: "SA10 - SA11", region: "West Glamorgan" },
  {
    name: "Port Talbot",
    postcode_prefix: "SA12 - SA13",
    region: "West Glamorgan",
  },
];

const faqs = [
  {
    q: "Do I need to be at home while the cleaner is working?",
    a: "No, you don't have to be home! Many of our clients leave a key in a key safe, with a neighbour, or let the cleaner in before heading to work. All our cleaners are fully DBS-checked, vetted, and covered by public liability insurance.",
  },
  {
    q: "Do the cleaners bring their own cleaning products and equipment?",
    a: "For regular domestic cleaning, cleaners can use your preferred products and vacuum, or bring eco-friendly supplies upon request. For End of Tenancy, Deep Cleans, and Carpet Cleans, our teams bring heavy-duty professional equipment and professional eco-friendly cleaning supplies.",
  },
  {
    q: "How does the payment work? When am I charged?",
    a: "We operate a 100% secure, cashless booking system. You enter your payment details at booking, but funds are only processed after the clean is successfully completed and verified.",
  },
  {
    q: "What if I need to cancel or reschedule my booking?",
    a: "You can reschedule or cancel your clean free of charge with at least 24 hours' notice directly through your customer dashboard or by calling our friendly support team.",
  },
  {
    q: "What is your 100% Satisfaction Guarantee?",
    a: "We take immense pride in our quality standards. If you are not completely satisfied with any area cleaned, let us know within 24 hours with photos, and we will send a cleaner back to re-clean the disputed area completely free of charge.",
  },
  {
    q: "Are your cleaning products safe for pets and children?",
    a: "Yes! We prioritize plant-based, eco-certified, non-toxic cleaning solutions that leave no harsh chemical residues or fumes, keeping your furry friends and little ones safe.",
  },
];

export default function Home() {
  const settings = useSettings();
  const [, setLocation] = useLocation();
  const { services } = useServices();
  const popularServices = services.filter((s) => s.popular).slice(0, 6);

  const [activeChecklistTab, setActiveChecklistTab] = useState("kitchen");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [heroService, setHeroService] = useState("");
  const [heroPostcode, setHeroPostcode] = useState("");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [reviewStats, setReviewStats] = useState<{
    count: number;
    avg: number;
  } | null>(null);
  const [coverageTowns, setCoverageTowns] =
    useState<ServiceCityLocation[]>(defaultCoverageTowns);

  useEffect(() => {
    // Fetch active service coverage locations dynamically from database
    fetchActiveServiceLocations().then((cities) => {
      if (cities && cities.length > 0) {
        setCoverageTowns(cities);
      }
    });

    // Fetch real customer reviews from Supabase
    supabase
      .from("reviews")
      .select(
        `
        overall_rating,
        comments,
        created_at,
        bookings:booking_id ( service_name, city )
      `
      )
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const validReviews = data.filter(
            (r: any) => r.comments && r.comments.trim().length > 0
          );
          const totalRating = data.reduce(
            (acc: number, r: any) => acc + (r.overall_rating || 5),
            0
          );
          const avg = Number((totalRating / data.length).toFixed(1));
          setReviewStats({ count: data.length, avg });

          const mapped: Testimonial[] = validReviews.map((r: any) => ({
            name: "Verified Customer",
            city: r.bookings?.city ?? "Wales",
            rating: r.overall_rating ?? 5,
            text: r.comments,
            service: r.bookings?.service_name ?? "Domestic Clean",
          }));
          setTestimonials(mapped);
        } else {
          setTestimonials([]);
          setReviewStats(null);
        }
      });
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();
    if (heroService) queryParams.set("service", heroService);
    if (heroPostcode) queryParams.set("postcode", heroPostcode.trim());
    const targetUrl = queryParams.toString()
      ? `/book?${queryParams.toString()}`
      : "/book";
    setLocation(targetUrl);
  };

  const currentChecklist =
    checklistTabs.find((t) => t.id === activeChecklistTab) || checklistTabs[0];

  return (
    <div className="overflow-x-hidden">
      {/* ── 1. Hero with Instant Wecasa-Style Quick Booking Bar ─────── */}
      <section className="relative bg-white pt-8 md:pt-14 pb-12 md:pb-18 border-b border-gray-100 overflow-hidden">
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200/80 text-green-800 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5 tracking-wide shadow-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {reviewStats
                  ? `${reviewStats.avg}/5 Customer Satisfaction · Available 7 Days`
                  : "100% Satisfaction Guarantee · Available 7 Days"}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.08] mb-5 tracking-tight">
                Professional home cleaning across{" "}
                <span className="text-gradient">Wales</span>, on your terms.
              </h1>

              <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-xl">
                Book vetted, DBS-checked domestic cleaners in under 2 minutes.
                Fixed upfront rates, full insurance protection, and a 100%
                satisfaction guarantee.
              </p>

              {/* Instant Postcode & Service Finder Bar */}
              <form
                onSubmit={handleHeroSearch}
                className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-xl border border-gray-200/80 max-w-xl mb-6 flex flex-col sm:flex-row gap-2.5 transition-all hover:shadow-2xl"
              >
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <select
                    value={heroService}
                    onChange={(e) => setHeroService(e.target.value)}
                    className="w-full pl-9 pr-8 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select a service...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full sm:w-44">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. CF10"
                    value={heroPostcode}
                    onChange={(e) => setHeroPostcode(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all uppercase"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Find Cleaner <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Social Proof / Badges */}
              <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-xs text-gray-600">
                {reviewStats ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex text-amber-400 text-sm">
                      {"★".repeat(Math.round(reviewStats.avg))}
                    </div>
                    <span className="font-bold text-gray-900">
                      {reviewStats.avg} / 5
                    </span>
                    <span className="text-gray-400">
                      ({reviewStats.count}{" "}
                      {reviewStats.count === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <Award className="w-4 h-4 text-green-600" />
                    <span>100% Satisfaction Re-clean</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>Fully Insured Cover</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Free Cancellation 24h</span>
                </div>
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="lg:col-span-5 animate-fade-in-scale">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-gray-100 group">
                <img
                  src="/images/home-hero-before.jpg"
                  alt="Professional Welsh cleaner with eco-friendly supplies"
                  className="w-full h-80 sm:h-96 lg:h-[460px] object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-100 shadow-lg flex items-center justify-between animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-black text-sm shadow-xs">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        100% Eco-Friendly Cleaners
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Cardiff · Swansea · Newport · Valleys
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/book"
                    className="text-xs font-bold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg border border-green-200 flex items-center gap-1 transition-colors"
                  >
                    Book now <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Trust Reassurance Bar (Wecasa Standard) ──────────────── */}
      <section className="bg-gray-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustBadges.map(({ icon: Icon, title, desc }, idx) => (
              <div
                key={title}
                className={`flex items-start gap-4 p-4 rounded-xl bg-gray-800/60 border border-gray-700/60 hover:border-green-500/40 hover:bg-gray-800/90 transition-all duration-300 hover:-translate-y-1 stagger-${
                  idx + 1
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white mb-1">{title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Popular Services Grid ────────────────────────────── */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-14">
            <div>
              <p className="section-eyebrow">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tailored For Your Home
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight">
                Popular Cleaning Services
              </h2>
            </div>
            <p className="text-gray-500 max-w-md text-sm sm:text-base">
              Transparent hourly rates, no hidden management fees, and the
              flexibility to book one-off or recurring cleans.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildServiceCatalogFromDb(services).map((card, idx) => (
              <div
                key={card.id}
                className={`animate-fade-in-up stagger-${(idx % 6) + 1}`}
              >
                <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-green-300 transition-all flex flex-col justify-between h-full group">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                        {card.icon}
                      </div>
                      <div className="text-right">
                        {card.badge && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full mb-1">
                            {card.badge}
                          </span>
                        )}
                        <p className="text-lg font-black text-gray-900">
                          {card.hourlyRateRange}
                        </p>
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-gray-900 mb-1 group-hover:text-green-700 transition-colors">
                      {card.name}
                    </h3>
                    <p className="text-xs font-semibold text-green-700 mb-2">
                      {card.tagline}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-6">
                      {card.description}
                    </p>
                  </div>

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
                      Book Now <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/services"
              className="btn-secondary inline-flex items-center gap-2 px-8 py-3.5"
            >
              View Full Pricing & Service Scope{" "}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. Interactive Room-by-Room Cleaning Checklist (Wecasa feature) ── */}
      <section className="py-14 md:py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
            <p className="section-eyebrow justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" /> What Gets Cleaned
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Room-by-Room Cleaning Scope
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              Every clean follows an exhaustive checklist designed to leave your
              home immaculately hygienic and fresh.
            </p>
          </div>

          {/* Checklist Navigation Tabs */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-8">
            {checklistTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeChecklistTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveChecklistTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-green-600 text-white shadow-md shadow-green-600/20 scale-[1.02]"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Checklist Items Display */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-200/80 shadow-sm max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <currentChecklist.icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {currentChecklist.title}
              </h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {currentChecklist.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/70 border border-gray-100"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm text-gray-700 font-medium">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500 text-center sm:text-left">
                Need extra attention on inside ovens, windows, or fridges? Add
                them during booking in 1 click.
              </p>
              <Link
                href="/book"
                className="btn-primary text-xs py-2.5 px-5 shrink-0"
              >
                Book This Checklist
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Detailed Service Comparison Matrix (Wecasa style) ─────── */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
            <p className="section-eyebrow justify-center">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Transparent
              Comparison
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Which Service Fits Your Needs?
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              Compare our cleaning tiers at a glance so you pick the perfect
              option for your home.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-xs">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-bold">
                  <th className="p-4 sm:p-5">Cleaning Inclusions</th>
                  <th className="p-4 sm:p-5 text-center text-gray-900">
                    Regular Domestic
                  </th>
                  <th className="p-4 sm:p-5 text-center text-green-700 bg-green-50/60 font-black">
                    One-Off Deep Clean
                  </th>
                  <th className="p-4 sm:p-5 text-center text-gray-900">
                    End of Tenancy
                  </th>
                  <th className="p-4 sm:p-5 text-center text-gray-900">
                    Airbnb Turnover
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm text-gray-700">
                {serviceMatrix.map((row, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                  >
                    <td className="p-4 sm:p-5 font-medium text-gray-900">
                      {row.feature}
                    </td>

                    {/* Regular */}
                    <td className="p-4 sm:p-5 text-center">
                      {typeof row.regular === "boolean" ? (
                        row.regular ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-gray-600">
                          {row.regular}
                        </span>
                      )}
                    </td>

                    {/* Deep Clean */}
                    <td className="p-4 sm:p-5 text-center bg-green-50/30">
                      {typeof row.deep === "boolean" ? (
                        row.deep ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="font-bold text-green-700">
                          {row.deep}
                        </span>
                      )}
                    </td>

                    {/* Tenancy */}
                    <td className="p-4 sm:p-5 text-center">
                      {typeof row.tenancy === "boolean" ? (
                        row.tenancy ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-gray-800">
                          {row.tenancy}
                        </span>
                      )}
                    </td>

                    {/* Airbnb */}
                    <td className="p-4 sm:p-5 text-center">
                      {typeof row.airbnb === "boolean" ? (
                        row.airbnb ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-gray-600">
                          {row.airbnb}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 6. How It Works: 3 Simple Steps ────────────────────────── */}
      <section className="py-14 md:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <p className="section-eyebrow justify-center">
              <Clock className="w-3.5 h-3.5" /> Effortless Booking
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-3">
              How MakeMeClean Works
            </h2>
            <p className="text-gray-500 text-sm sm:text-base max-w-md mx-auto">
              From online booking to sparkling home in 3 simple, hassle-free
              steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-7 left-[20%] right-[20%] h-0.5 bg-green-200" />

            {[
              {
                step: "01",
                title: "Choose Clean & Customise",
                desc: "Pick your service, select the number of rooms, and choose optional add-ons like oven or interior windows. Instant upfront pricing.",
              },
              {
                step: "02",
                title: "Select Date & Time Slot",
                desc: "Pick any day that suits you, 7 days a week from 8am to 8pm. Same-day appointments available for urgent cleans.",
              },
              {
                step: "03",
                title: "Relax & Pay Post-Clean",
                desc: "Your DBS-vetted cleaner arrives on time with supplies. Your card is charged securely only after the clean is completed.",
              },
            ].map(({ step, title, desc }, idx) => (
              <div
                key={step}
                className={`relative text-center bg-white p-6 sm:p-8 rounded-3xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group stagger-${
                  idx + 1
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-green-600 text-white flex items-center justify-center mx-auto mb-5 text-lg font-black shadow-md shadow-green-600/20 group-hover:scale-110 group-hover:bg-green-700 transition-all duration-300 relative z-10">
                  {step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2.5 group-hover:text-green-700 transition-colors">
                  {title}
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Wales Coverage Area Grid ────────────────────────────── */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="section-eyebrow">
              <MapPin className="w-3.5 h-3.5" /> Local Coverage
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Serving Homes Across Wales
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              We have local, vetted cleaning professionals based right across
              South, West, and North Wales.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {coverageTowns.map((town) => (
              <Link
                key={town.name}
                href={`/book?postcode=${encodeURIComponent(town.name)}`}
                className="p-4 rounded-2xl border border-gray-200 hover:border-green-500 hover:bg-green-50/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-gray-900 group-hover:text-green-700 transition-colors">
                    {town.name}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1.5 transition-all duration-200" />
                </div>
                {town.postcode_prefix && (
                  <div className="text-[11px] text-gray-400 font-mono">
                    {town.postcode_prefix}
                  </div>
                )}
                {town.region && (
                  <div className="text-[10px] font-semibold text-green-700 mt-1">
                    {town.region}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Customer Reviews & Social Proof (Only shown when real reviews exist) ── */}
      {testimonials.length > 0 && (
        <section className="py-14 md:py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-12">
              <div>
                <p className="section-eyebrow">
                  <Star className="w-3.5 h-3.5" /> Customer Testimonials
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
                  What Our Verified Customers Say
                </h2>
              </div>
              {reviewStats && (
                <div className="flex items-center gap-2">
                  <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                    {reviewStats.avg} / 5 ({reviewStats.count}{" "}
                    {reviewStats.count === 1 ? "Review" : "Reviews"})
                  </span>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex text-amber-400 text-sm mb-3">
                      {"★".repeat(t.rating)}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-5 italic">
                      "{t.text}"
                    </p>
                  </div>
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-gray-400">{t.city}</p>
                    </div>
                    <span className="text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-md border border-green-100">
                      {t.service}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 9. Frequently Asked Questions (Accordion) ──────────────── */}
      <section className="py-14 md:py-20 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <p className="section-eyebrow justify-center">
              <Shield className="w-3.5 h-3.5" /> Got Questions?
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              Everything you need to know about MakeMeClean services, security,
              and bookings.
            </p>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-gray-200 overflow-hidden transition-all duration-150"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-gray-50/80 transition-colors font-bold text-sm sm:text-base text-gray-900"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-green-600 shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50/50 border-t border-gray-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 10. Final Call to Action ───────────────────────────────── */}
      <section className="py-14 md:py-20 green-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-green-100 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            Book online in 2 minutes
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 leading-tight">
            Ready to enjoy a spotless home?
          </h2>
          <p className="text-green-100 text-base sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            Let our insured, vetted cleaning team do the hard work for you.
            Available 7 days across Wales.
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5 justify-center">
            <Link
              href="/book"
              className="bg-white text-green-700 font-bold px-8 py-3.5 rounded-xl hover:bg-green-50 transition-all active:scale-[0.98] shadow-lg text-sm sm:text-base inline-flex items-center justify-center gap-2"
            >
              Book a Cleaner Now <ArrowRight className="w-4 h-4" />
            </Link>
            {settings.business_phone && (
              <a
                href={`tel:${settings.business_phone.replace(/\s/g, "")}`}
                className="border-2 border-white/40 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 justify-center text-sm sm:text-base"
              >
                <Phone className="w-4 h-4" /> {settings.business_phone}
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
