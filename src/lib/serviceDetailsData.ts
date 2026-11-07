export interface ServiceDetailConfig {
  tagline: string;
  badge?: string;
  durationGuide: { property: string; hours: string; approxHours?: number; bedrooms?: number; bathrooms?: number; living?: number; propertyType?: string; description: string }[];
  inclusions: string[];
  exclusions: string[];
  suppliesInfo: {
    cleanerBrings: string[];
    customerProvides: string[];
  };
  steps: { step: string; title: string; desc: string }[];
  faqs: { q: string; a: string }[];
}

export const defaultServiceDetail: ServiceDetailConfig = {
  tagline: "Professional, vetted, and fully insured cleaning tailored to your home.",
  badge: "Top Rated in Wales",
  durationGuide: [
    { property: "Studio / HMO", hours: "1.5 – 2 hours", approxHours: 2, description: "Compact open-plan or private room clean with bathroom & kitchen refresh" },
    { property: "1–2 Bed Flat", hours: "2.5 – 3 hours", approxHours: 3, description: "Full apartment clean including lounge, kitchen, bedrooms and bathroom" },
    { property: "3 Bed House", hours: "3.5 – 4.5 hours", approxHours: 4, description: "Multi-storey home cleaning across bedrooms, stairs, reception and bathrooms" },
    { property: "4+ Bed House", hours: "5+ hours", approxHours: 5, description: "Complete thorough clean for large family homes across all living spaces" },
  ],
  inclusions: [
    "Full sanitisation of kitchen worktops, hobs & splashbacks",
    "Exterior cleaning of all kitchen cupboards, appliances & microwave",
    "Thorough bathroom scrubbing, shower descaling & toilet disinfection",
    "Dusting all reachable surfaces, skirting boards, switches & mirrors",
    "Vacuuming of all rugs, carpets & thorough mopping of hard floors",
    "Emptying waste bins and replacing fresh liners",
  ],
  exclusions: [
    "External window washing (available upon request)",
    "Hazardous chemical / biological waste removal",
    "Moving heavy furniture exceeding 25kg",
    "Deep industrial carpet wet extraction machinery",
  ],
  suppliesInfo: {
    cleanerBrings: [
      "Professional eco-friendly multi-surface & degreasing sprays",
      "Colour-coded microfibre cloths to avoid cross-contamination",
      "Specialist bathroom limescale remover & disinfectant",
      "Glass & mirror buffing solutions",
    ],
    customerProvides: [
      "Working vacuum cleaner and mop & bucket",
      "Access to running hot water and electricity",
    ],
  },
  steps: [
    { step: "01", title: "Select your service", desc: "Choose hours, property size, and any specialist add-ons with instant price calculation." },
    { step: "02", title: "Book your time slot", desc: "Pick your preferred date and time, 7 days a week from 8:00 to 20:00." },
    { step: "03", title: "Relax & pay post-clean", desc: "Your vetted cleaner arrives on time. Payment is only settled after the clean is finished." },
  ],
  faqs: [
    {
      q: "Do I have to be at home during the cleaning?",
      a: "No! Many of our clients leave a key in a key safe, with a neighbour, or let the cleaner in before heading to work. All staff are DBS-vetted and fully insured.",
    },
    {
      q: "Can I book a regular clean with the same cleaner each time?",
      a: "Yes, for regular weekly or fortnightly bookings, we assign the same dedicated professional to your home so they learn your exact preferences.",
    },
    {
      q: "What happens if I'm not satisfied with the clean?",
      a: "We offer a 100% Satisfaction Guarantee. Contact us within 24 hours with photos and we'll send a cleaner back to re-clean the area free of charge.",
    },
    {
      q: "Are the cleaning products safe for pets and children?",
      a: "Yes, our cleaners use certified eco-friendly and non-toxic products that leave zero hazardous fumes or residues.",
    },
  ],
};

const serviceCustomConfigs: Record<string, Partial<ServiceDetailConfig>> = {
  regular: {
    tagline: "Hassle-free weekly or fortnightly domestic cleaning by your dedicated cleaner.",
    badge: "Most Popular",
    inclusions: [
      "Same vetted cleaner on every visit for regular bookings",
      "Dusting all surfaces, furniture, picture frames and light fixtures",
      "Sanitising kitchen worktops, hobs, sink and microwave exterior",
      "Deep bathroom cleaning: toilet, shower enclosure, taps and mirrors",
      "Complete vacuuming of all carpeted rooms and mopping of hard floors",
      "Beds made with neat hospital corners (linen change on request)",
      "Bins emptied, wiped down and relined",
    ],
    exclusions: [
      "Deep oven interior dismantling (available as add-on)",
      "Carpet wet extraction machine cleaning (available as add-on)",
      "External window cleaning",
    ],
    faqs: [
      {
        q: "Will I have the same cleaner every week?",
        a: "Yes! For recurring weekly or fortnightly cleans, we match you with a regular trusted cleaner so they know exactly how you like your home cared for.",
      },
      {
        q: "Can I skip or reschedule a week if I'm on holiday?",
        a: "Absolutely. You can pause, reschedule, or cancel any session up to 24 hours in advance with zero penalty.",
      },
    ],
  },
  deep: {
    durationGuide: [
      { property: "Studio / 1 Bed Flat", hours: "3 – 3.5 hours", approxHours: 3, bedrooms: 1, bathrooms: 1, living: 1, propertyType: "Flat / Apartment", description: "Intensive limescale removal, grout scrubbing, skirting dusting & deep sanitisation" },
      { property: "2 Bed House", hours: "4 – 5 hours", approxHours: 4.5, bedrooms: 2, bathrooms: 1, living: 1, propertyType: "House", description: "Top-to-bottom scrub of high-use kitchens, bathrooms and all living areas" },
      { property: "3 Bed House", hours: "5.5 – 6.5 hours", approxHours: 6, bedrooms: 3, bathrooms: 2, living: 1, propertyType: "House", description: "Seasonal spring reset tackling accumulated grime, extractor filters and tiles" },
      { property: "4+ Bed House", hours: "7+ hours", approxHours: 7.5, bedrooms: 4, bathrooms: 2, living: 2, propertyType: "House", description: "Complete whole-home deep refresh across all floors and multiple bathrooms" },
    ],
    tagline: "An intensive top-to-bottom refresh eliminating accumulated dirt, limescale, and grime.",
    badge: "Seasonal Favorite",
    inclusions: [
      "Intensive limescale and soap scum removal on shower screens & tiles",
      "Behind and under reachable furniture dusted and vacuumed",
      "Detailed wiping of skirting boards, door frames, sockets and radiators",
      "Degreasing kitchen extractor fan filters & splashbacks",
      "Inside microwave and toaster crumb trays cleaned",
      "Deep grout scrubbing and hard floor sanitisation",
      "All cupboards and drawers wiped externally and handles sanitized",
    ],
    faqs: [
      {
        q: "How does a Deep Clean differ from a Regular Clean?",
        a: "A deep clean is a rigorous, intensive service focusing on stubborn grime, heavy limescale, deep skirting dusting, and hard-to-reach areas that aren't covered in a routine maintenance clean.",
      },
      {
        q: "How often should I book a Deep Clean?",
        a: "Most homeowners book a deep clean every 3 to 6 months, or at the start of a season (spring clean) to reset the home.",
      },
    ],
  },
  tenancy: {
    durationGuide: [
      { property: "1 Bed Flat / Studio", hours: "3 – 4 hours", approxHours: 3.5, bedrooms: 1, bathrooms: 1, living: 1, propertyType: "Flat / Apartment", description: "Checkout clean including inside oven, fridge, internal windows & cupboards" },
      { property: "2 Bed Flat / House", hours: "4.5 – 6 hours", approxHours: 5, bedrooms: 2, bathrooms: 1, living: 1, propertyType: "House", description: "Full tenancy handover clean meeting inventory & estate agency deposit standards" },
      { property: "3 Bed House", hours: "6 – 8 hours", approxHours: 7, bedrooms: 3, bathrooms: 2, living: 1, propertyType: "House", description: "Deep sanitisation of all rooms, appliances, woodwork and sanitised bathrooms" },
      { property: "4+ Bed House", hours: "8+ hours", approxHours: 8.5, bedrooms: 4, bathrooms: 2, living: 2, propertyType: "House", description: "Large family home end-of-tenancy clean with 72-hour free re-clean guarantee" },
    ],
    tagline: "Guaranteed check-out standard clean to secure 100% of your tenancy deposit.",
    badge: "100% Deposit Guarantee",
    inclusions: [
      "Full compliance with Welsh estate agency & inventory checkout checklists",
      "Inside and outside of all kitchen cupboards, drawers and shelving",
      "Complete oven, grill, hob & extractor fan deep degreasing",
      "Inside fridge and freezer (must be defrosted prior to clean)",
      "Intensive descaling of bathroom taps, shower valves, tiles and toilet",
      "Internal windows, sills, and window frames cleaned streak-free",
      "Free 72-hour re-clean guarantee if the inventory clerk flags any item",
    ],
    exclusions: [
      "Professional carpet wet extraction (unless booked as combo package)",
      "Painting or repairing wall scuffs / drywall damage",
      "Rubbish clearance of abandoned heavy furniture",
    ],
    faqs: [
      {
        q: "Does this clean guarantee my deposit back?",
        a: "Yes! Our End of Tenancy checklist aligns with leading Welsh estate agents. If your landlord or inventory clerk reports any cleaning deficiency within 72 hours, we return to re-clean for free.",
      },
      {
        q: "Do appliances need to be empty?",
        a: "Yes, please ensure fridges/freezers are emptied and defrosted, and all personal belongings are removed before the cleaners arrive.",
      },
    ],
  },
  airbnb: {
    durationGuide: [
      { property: "Studio / 1 Bed Let", hours: "1.5 – 2 hours", approxHours: 2, bedrooms: 1, bathrooms: 1, living: 1, propertyType: "Studio", description: "Fast same-day turnaround, bed remaking with crisp linens, and welcome staging" },
      { property: "2 Bed Holiday Home", hours: "2.5 – 3.5 hours", approxHours: 3, bedrooms: 2, bathrooms: 1, living: 1, propertyType: "Flat / Apartment", description: "Guest checkout turnover, linen change, kitchen inventory check & bathroom shine" },
      { property: "3 Bed Cottage", hours: "3.5 – 4.5 hours", approxHours: 4, bedrooms: 3, bathrooms: 2, living: 1, propertyType: "House", description: "Hotel-grade clean for busy family holiday rentals before new arrivals" },
      { property: "4+ Bed Luxury Let", hours: "5+ hours", approxHours: 5.5, bedrooms: 4, bathrooms: 2, living: 2, propertyType: "House", description: "Full presentation turnover with guest replenishment and photo check-in audit" },
    ],
    tagline: "Rapid hotel-standard turnovers for holiday lets, Airbnb hosts, and short-term rentals.",
    badge: "Host Super-Tool",
    inclusions: [
      "Complete linen strip, bed remaking with crisp hotel presentation",
      "Replenishing welcome packs, tea/coffee trays, and guest toiletries",
      "Thorough sanitisation of kitchen, diningware check, and dishwasher unload",
      "Spotless bathroom sanitisation and fresh towel folding",
      "Detailed inspection report and photo log sent to the host post-clean",
      "Emergency key management and same-day checkout turnover",
    ],
    faqs: [
      {
        q: "Can you handle same-day guest turnarounds?",
        a: "Yes! We specialize in tight 10:00 AM check-out to 3:00 PM check-in turnover windows 7 days a week.",
      },
      {
        q: "Do you wash the linen on-site or off-site?",
        a: "If your property has a washing machine/dryer, cleaners can wash on-site, or use host-provided fresh sets from your linen storage.",
      },
    ],
  },
  carpet: {
    durationGuide: [
      { property: "1 Single Room / Rug", hours: "1 – 1.5 hours", approxHours: 1.5, description: "Pre-treatment spray, agitation, hot water extraction shampoo and deodorising" },
      { property: "Living Room & Hallway", hours: "2 – 2.5 hours", approxHours: 2, description: "High-traffic stain removal, enzyme pet treatment and deep extraction" },
      { property: "2–3 Bed Property (Full)", hours: "3 – 4 hours", approxHours: 3.5, description: "Complete wet extraction across all bedrooms, landings, hallway and stairs" },
      { property: "Whole House (4+ Beds)", hours: "4.5 – 6 hours", approxHours: 5, description: "Whole-home industrial carpet shampoo restoration and allergen sanitisation" },
    ],
    tagline: "Deep steam extraction removing embedded allergens, stubborn pet stains, and odors.",
    badge: "Heavy Duty Extraction",
    inclusions: [
      "High-power pre-vacuum to extract dry soil and loose pet hair",
      "Targeted pre-treatment for heavy coffee, wine, ink & pet stains",
      "Hot water extraction with professional eco-shampoo",
      "Deodorising and sanitising treatment killing 99.9% of bacteria",
      "Fast drying time (usually 2 to 4 hours with proper ventilation)",
    ],
    faqs: [
      {
        q: "How long do carpets take to dry after cleaning?",
        a: "With our high-suction extraction equipment, carpets are lightly damp and typically dry completely within 2 to 4 hours.",
      },
      {
        q: "Can you remove tough pet stains and odors?",
        a: "Yes, our enzyme-based pre-treatments break down pet urine, dander, and organic stains without discoloring carpet fibres.",
      },
    ],
  },
  oven: {
    durationGuide: [
      { property: "Single Oven & Hob", hours: "1.5 – 2 hours", approxHours: 1.5, description: "Racks dip-tank soaked, split door glass polished, hob and interior degreased" },
      { property: "Double Oven & Extractor", hours: "2 – 2.5 hours", approxHours: 2, description: "Full double compartment deep clean with filter degreasing and polishing" },
      { property: "Range / AGA Cooker", hours: "3 – 3.5 hours", approxHours: 3, description: "Complete multi-oven and burner restoration with 100% non-caustic safe solution" },
      { property: "Full Kitchen Appliance Set", hours: "3.5 – 4.5 hours", approxHours: 4, description: "Oven, extractor, hob, microwave and fridge interior deep degreased" },
    ],
    tagline: "Fume-free, eco-friendly deep degreasing restoring your oven to showroom shine.",
    badge: "Eco Fume-Free",
    inclusions: [
      "Full removal and dip-tank soaking of oven racks, trays and side panels",
      "Door dismantling to clean between split glass panes",
      "Complete degreasing of internal walls, roof and fan casing",
      "Hob, burners, knobs and splashback polishing",
      "100% non-caustic, odourless eco-safe cleaning solution",
    ],
    faqs: [
      {
        q: "Can I use my oven immediately after the clean?",
        a: "Yes! Because we use 100% non-caustic, non-toxic plant-based solutions, there are no toxic chemical fumes and your oven is ready to cook in immediately.",
      },
    ],
  },
};

export function getServiceDetailConfig(serviceName: string, serviceDescription?: string): ServiceDetailConfig {
  const lower = (serviceName + " " + (serviceDescription || "")).toLowerCase();

  let matchedKey = "regular";
  if (lower.includes("tenancy") || lower.includes("move in") || lower.includes("move out")) {
    matchedKey = "tenancy";
  } else if (lower.includes("airbnb") || lower.includes("holiday") || lower.includes("turnover")) {
    matchedKey = "airbnb";
  } else if (lower.includes("carpet") || lower.includes("upholstery") || lower.includes("rug")) {
    matchedKey = "carpet";
  } else if (lower.includes("oven") || lower.includes("appliance")) {
    matchedKey = "oven";
  } else if (lower.includes("deep") || lower.includes("spring") || lower.includes("after builder")) {
    matchedKey = "deep";
  }

  const custom = serviceCustomConfigs[matchedKey] || {};

  return {
    ...defaultServiceDetail,
    ...custom,
    inclusions: custom.inclusions || defaultServiceDetail.inclusions,
    exclusions: custom.exclusions || defaultServiceDetail.exclusions,
    faqs: custom.faqs ? [...custom.faqs, ...defaultServiceDetail.faqs.slice(2)] : defaultServiceDetail.faqs,
  };
}

