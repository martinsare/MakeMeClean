export type ServiceCategory =
  | "ironing"
  | "cleaning_ironing"
  | "office"
  | "airbnb"
  | "domestic";

export interface ServiceBookingConfig {
  category: ServiceCategory;
  stepATitle: string;
  stepASubtitle: string;
  propertyTypeLabel: string;
  propertyTypes: string[];
  field1: { label: string; hint: string; icon: string; min: number; max: number; default: number; unitMultiplier: number };
  field2: { label: string; hint: string; icon: string; min: number; max: number; default: number; unitMultiplier: number };
  field3: { label: string; hint: string; icon: string; min: number; max: number; default: number; unitMultiplier: number };
  extras: { id: string; label: string; icon: string; duration: number; desc: string }[];
  baseHours: number;
  suppliesPrompt: string;
  suppliesCleanerLabel: string;
  suppliesCustomerLabel: string;
  defaultPropertyType: string;
  formatLayout: (bedrooms?: number | null, bathrooms?: number | null, livingRooms?: number | null, propertyType?: string | null) => string;
}

export function getServiceBookingConfig(serviceIdOrName: string): ServiceBookingConfig {
  const s = (serviceIdOrName || "").toLowerCase();

  // 1. Standalone Ironing Service
  if (s === "ironing-service" || s.includes("ironing service") || (s.includes("ironing") && !s.includes("cleaning"))) {
    return {
      category: "ironing",
      stepATitle: "Tell us about your Ironing & Laundry load",
      stepASubtitle: "Select your estimated laundry volume. Professional cleaners iron approx. 15–20 standard garments or mixed linens per hour.",
      propertyTypeLabel: "Service Location",
      propertyTypes: ["Private Residence", "Shared House / Flat", "Business / Boutique"],
      defaultPropertyType: "Private Residence",
      field1: {
        label: "Laundry Baskets",
        hint: "Standard laundry baskets (~15-20 garments each)",
        icon: "🧺",
        min: 1,
        max: 8,
        default: 1,
        unitMultiplier: 1.0,
      },
      field2: {
        label: "Delicate / Formal Items",
        hint: "Business shirts, suits, pleated garments",
        icon: "👔",
        min: 0,
        max: 20,
        default: 5,
        unitMultiplier: 0.1,
      },
      field3: {
        label: "Bedsheet / Linen Sets",
        hint: "Duvet covers, bedsheets & pillowcases",
        icon: "🛏️",
        min: 0,
        max: 8,
        default: 1,
        unitMultiplier: 0.35,
      },
      extras: [
        { id: "wash_fold", label: "Wash & Fold Cycle", icon: "🫧", duration: 1.0, desc: "Run washing machine cycle & tumble/air dry" },
        { id: "bed_linen_change", label: "Fresh Bed Making", icon: "🛏️", duration: 0.5, desc: "Strip and redress beds with ironed linens" },
        { id: "hangers_folding", label: "Wardrobe Staging", icon: "👗", duration: 0.5, desc: "Sort onto hangers & colour-coordinated fold" },
        { id: "steam_press", label: "Steam Touch-Up", icon: "💨", duration: 0.5, desc: "Delicate vertical steam freshening" },
      ],
      baseHours: 1.5,
      suppliesPrompt: "Ironing Equipment & Iron",
      suppliesCleanerLabel: "Cleaner brings standard pressing iron & fabric spray",
      suppliesCustomerLabel: "I will provide iron & ironing board at home",
      formatLayout: (b, d, l) => `${b ?? 1} Basket(s) · ${d ?? 0} Delicates · ${l ?? 0} Linen Sets`,
    };
  }

  // 2. Combined Cleaning & Ironing
  if (s === "cleaning-and-ironing" || s.includes("cleaning and ironing") || s.includes("cleaning & ironing")) {
    return {
      category: "cleaning_ironing",
      stepATitle: "Home & Ironing Breakdown",
      stepASubtitle: "Combine routine housekeeping with your weekly ironing basket in one seamless visit.",
      propertyTypeLabel: "Property Type",
      propertyTypes: ["House / Flat", "Studio", "HMO / Shared House"],
      defaultPropertyType: "House / Flat",
      field1: {
        label: "Bedrooms to Clean",
        hint: "Rooms vacuumed, dusted & tidied",
        icon: "🛏️",
        min: 1,
        max: 8,
        default: 2,
        unitMultiplier: 0.5,
      },
      field2: {
        label: "Bathrooms",
        hint: "Shower, bathtub, basin & WC",
        icon: "🚿",
        min: 1,
        max: 6,
        default: 1,
        unitMultiplier: 0.5,
      },
      field3: {
        label: "Ironing Baskets",
        hint: "Baskets of shirts, tops & bedding to press",
        icon: "🧺",
        min: 1,
        max: 6,
        default: 1,
        unitMultiplier: 1.0,
      },
      extras: [
        { id: "inside_oven", label: "Inside Oven & Grill", icon: "🍳", duration: 0.75, desc: "Deep degreasing & rack soaking" },
        { id: "inside_fridge", label: "Inside Fridge / Freezer", icon: "❄️", duration: 0.5, desc: "Shelves washed & sanitized" },
        { id: "bed_linen_change", label: "Bed Linen Change", icon: "🛏️", duration: 0.5, desc: "Fresh bedsheets changed & made up" },
        { id: "inside_windows", label: "Interior Window Glass", icon: "🪟", duration: 0.5, desc: "Internal panes & sills buffed" },
      ],
      baseHours: 2.5,
      suppliesPrompt: "Cleaning Supplies & Ironing Gear",
      suppliesCleanerLabel: "Cleaner brings eco cleaning products & spray starch",
      suppliesCustomerLabel: "I will provide cleaning products, iron & board",
      formatLayout: (b, d, l) => `${b ?? 1} Bed · ${d ?? 1} Bath · ${l ?? 1} Basket(s) Ironing`,
    };
  }

  // 3. Commercial & Office Cleaning
  if (s === "office-cleaning" || s.includes("office") || s.includes("commercial")) {
    return {
      category: "office",
      stepATitle: "Workplace & Office Layout",
      stepASubtitle: "Tailor your commercial cleaning plan by desk capacity, washrooms, and conference zones.",
      propertyTypeLabel: "Workplace Type",
      propertyTypes: ["Private Office", "Open Plan / Coworking", "Retail / Studio", "Clinic / Practice"],
      defaultPropertyType: "Private Office",
      field1: {
        label: "Desks / Workstations",
        hint: "Workstations wiped, sanitised & bins emptied",
        icon: "🖥️",
        min: 1,
        max: 50,
        default: 6,
        unitMultiplier: 0.1,
      },
      field2: {
        label: "Washrooms / WCs",
        hint: "Commercial cubicles, basins & consumables",
        icon: "🚻",
        min: 1,
        max: 12,
        default: 2,
        unitMultiplier: 0.5,
      },
      field3: {
        label: "Meeting / Breakout Rooms",
        hint: "Boardrooms, lounges, and kitchenettes",
        icon: "☕",
        min: 0,
        max: 8,
        default: 1,
        unitMultiplier: 0.5,
      },
      extras: [
        { id: "kitchenette_deep", label: "Kitchenette & Microwave", icon: "☕", duration: 0.75, desc: "Coffee machines, sink, fridge & counters" },
        { id: "it_sanitise", label: "IT & Phone Sanitisation", icon: "⌨️", duration: 0.75, desc: "Antiviral wipe of keyboards, mice & screens" },
        { id: "glass_partitions", label: "Glass Partitions & Doors", icon: "🪟", duration: 0.5, desc: "Meeting room glass buffed streak-free" },
        { id: "bin_recycling", label: "Waste & Recycling Sort", icon: "♻️", duration: 0.5, desc: "Central collection & recycling liners changed" },
      ],
      baseHours: 2.0,
      suppliesPrompt: "Commercial Janitorial Supplies",
      suppliesCleanerLabel: "Cleaner brings commercial antiviral disinfectants & microfibres",
      suppliesCustomerLabel: "Use on-site janitorial stockroom products",
      formatLayout: (b, d, l, p) => `${b ?? 6} Desks · ${d ?? 2} Washrooms · ${l ?? 1} Meeting Rooms (${p || "Office"})`,
    };
  }

  // 4. Airbnb & Holiday Let Cleaning
  if (s === "airbnb-cleaning" || s.includes("airbnb") || s.includes("holiday") || s.includes("short-let")) {
    return {
      category: "airbnb",
      stepATitle: "Short-Let Turnover & Staging",
      stepASubtitle: "Fast turnover cleaning with guest-ready staging, linen rotation, and checkout inspection.",
      propertyTypeLabel: "Property Type",
      propertyTypes: ["Apartment / Flat", "House / Cottage", "Studio / Pod"],
      defaultPropertyType: "Apartment / Flat",
      field1: {
        label: "Bedrooms to Turn Over",
        hint: "Linen strip, mattress rotate & dust",
        icon: "🛏️",
        min: 1,
        max: 8,
        default: 2,
        unitMultiplier: 0.5,
      },
      field2: {
        label: "Guest Bathrooms",
        hint: "Sanitised, fresh towels & toiletries placed",
        icon: "🚿",
        min: 1,
        max: 6,
        default: 1,
        unitMultiplier: 0.5,
      },
      field3: {
        label: "Living & Dining Areas",
        hint: "Sofa vacuumed, remotes wiped, surfaces buffed",
        icon: "🛋️",
        min: 1,
        max: 5,
        default: 1,
        unitMultiplier: 0.5,
      },
      extras: [
        { id: "linen_wash_onsite", label: "Linen Wash & Dry (On-Site)", icon: "🧺", duration: 1.0, desc: "Wash & dry towels & sheets using guest appliances" },
        { id: "welcome_pack", label: "Restock Welcome Pack", icon: "☕", duration: 0.25, desc: "Tea, coffee, sugar & guest amenities arranged" },
        { id: "oven_turnover", label: "Inside Oven Clean", icon: "🍳", duration: 0.75, desc: "Remove grease & burnt-on food between guests" },
        { id: "fridge_turnover", label: "Fridge Empty & Wipe", icon: "❄️", duration: 0.5, desc: "Discard leftover food & wipe shelves spotless" },
        { id: "photo_audit", label: "Check-in Photo Report", icon: "📸", duration: 0.25, desc: "Inspection photos logged for host peace of mind" },
      ],
      baseHours: 2.0,
      suppliesPrompt: "Eco Turnover Cleaning Supplies",
      suppliesCleanerLabel: "Cleaner brings eco supplies & microfibre cloths",
      suppliesCustomerLabel: "Cleaner uses host supplies kept in lockup",
      formatLayout: (b, d, l, p) => `${b ?? 2} Bed · ${d ?? 1} Bath · ${l ?? 1} Living (${p || "Holiday Let"})`,
    };
  }

  // 5. Standard Domestic Cleans (Standard, Regular, One-Off, Deep, Spring, Housekeeping)
  return {
    category: "domestic",
    stepATitle: "Tell us about your home",
    stepASubtitle: "Set any room count to 0 if that room type is not part of the property. The estimate updates as you change rooms and extras.",
    propertyTypeLabel: "Property Type",
    propertyTypes: ["House / Flat", "Studio", "HMO / Shared House"],
    defaultPropertyType: "House / Flat",
    field1: {
      label: "Bedrooms",
      hint: "Sleep & storage (or 0 for studio)",
      icon: "🛏️",
      min: 0,
      max: 8,
      default: 2,
      unitMultiplier: 0.5,
    },
    field2: {
      label: "Bathrooms",
      hint: "Shower, bath & WC",
      icon: "🚿",
      min: 0,
      max: 6,
      default: 1,
      unitMultiplier: 0.5,
    },
    field3: {
      label: "Living Areas",
      hint: "Lounge & dining (or 0 if none)",
      icon: "🛋️",
      min: 0,
      max: 5,
      default: 1,
      unitMultiplier: 0.5,
    },
    extras: [
      { id: "oven", label: "Inside Oven & Grill", icon: "🍳", duration: 0.75, desc: "Deep degreasing & rack soaking" },
      { id: "fridge", label: "Inside Fridge / Freezer", icon: "❄️", duration: 0.5, desc: "Shelves washed & sanitized" },
      { id: "windows", label: "Interior Window Glass", icon: "🪟", duration: 0.5, desc: "Internal panes & sills buffed" },
      { id: "bed_linen", label: "Bed Linen Change", icon: "🛏️", duration: 0.5, desc: "Fresh bedsheets changed & made up" },
      { id: "ironing", label: "Ironing & Laundry", icon: "🧺", duration: 1.0, desc: "Shirts, linens & folding" },
      { id: "carpet", label: "Carpet Stain Extraction", icon: "🧹", duration: 1.0, desc: "Hot water shampoo machine" },
      { id: "cupboards", label: "Inside Kitchen Cabinets", icon: "📦", duration: 0.75, desc: "Shelves wiped & sanitized" },
    ],
    baseHours: 2.0,
    suppliesPrompt: "Cleaning Products & Supplies",
    suppliesCleanerLabel: "Cleaner brings eco supplies",
    suppliesCustomerLabel: "I will provide cleaning products",
    formatLayout: (b, d, l, p) => `${b ?? 0} Bed · ${d ?? 1} Bath · ${l ?? 1} Living (${p || "House / Flat"})`,
  };
}
