import { Service } from "@/lib/services";

export interface ServiceCategoryCard {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  description: string;
  icon: string;
  imageUrl?: string | null;
  primaryServiceId: string;
  hourlyRateRange: string;
  price?: number;
  discount_percent?: number;
  services?: Service[];
}

export function resolveServiceCategory(s: Service): string {
  const dbCat = (s.category || "").trim().toLowerCase();
  // If explicitly categorized and not just the unmigrated generic 'domestic'
  if (dbCat && !["domestic", ""].includes(dbCat)) {
    return dbCat;
  }

  const id = (s.id || "").toLowerCase();
  const name = (s.name || "").toLowerCase();

  if (id.includes("ironing") || name.includes("ironing")) return "ironing";
  if (id.includes("office") || name.includes("office") || id.includes("commercial") || name.includes("commercial")) return "commercial";
  if (id.includes("airbnb") || name.includes("airbnb") || id.includes("holiday") || name.includes("holiday")) return "airbnb";
  if (id.includes("deep") || name.includes("deep") || id.includes("spring") || name.includes("spring")) return "deep";
  return "domestic";
}

function resolveServiceIcon(s: Service, catKey: string): string {
  if (s.icon && s.icon.trim() !== "") return s.icon;
  if (catKey === "deep") return "🧽";
  if (catKey === "airbnb") return "🏨";
  if (catKey === "ironing") return "🧺";
  if (catKey === "commercial") return "🏢";
  return "🧹";
}

function resolveCategoryName(catKey: string, primary: Service): string {
  if (catKey === "domestic") return "Classic Domestic Cleaning";
  if (catKey === "deep") return "Deep Cleaning & Spring Reset";
  if (catKey === "airbnb") return "Holiday Rental & Airbnb Turnover";
  if (catKey === "ironing") return "Ironing & Laundry Service";
  if (catKey === "commercial") return "Office & Commercial Cleaning";
  return primary.name || catKey.charAt(0).toUpperCase() + catKey.slice(1);
}

function resolveCategoryTagline(catKey: string, primary: Service): string {
  if (primary.tagline && primary.tagline.trim() !== "") return primary.tagline;
  if (catKey === "domestic") return "Day-to-day routine housekeeping & maintenance";
  if (catKey === "deep") return "Thorough top-to-bottom scrub for built-up grime";
  if (catKey === "airbnb") return "Fast guest turnovers & staging between stays";
  if (catKey === "ironing") return "Professional steam pressing, folding & wardrobe care";
  if (catKey === "commercial") return "Professional cleanliness for workplaces and offices";
  return primary.description || "";
}

function resolveCategoryDescription(catKey: string, primary: Service): string {
  if (primary.description && primary.description.trim() !== "") return primary.description;
  if (catKey === "domestic") return "Dusting surfaces, vacuuming & mopping floors, sanitising bathrooms & kitchens, making beds, and emptying bins.";
  if (catKey === "deep") return "Detailed limescale removal, grout scrubbing, skirting boards, door frames, sockets, and behind furniture.";
  if (catKey === "airbnb") return "Complete linen strip & bed dressing, guest amenities check, bathroom shine, kitchen inventory and photo check-in.";
  if (catKey === "ironing") return "Shirts, trousers, delicates, and bedsheet pressing (~15-20 garments/hr) done neatly in your home.";
  if (catKey === "commercial") return "Desks wiped, bin collection & recycling, washrooms sanitised, kitchenettes & meeting room glass buffed.";
  return "";
}

/**
 * Builds dynamic service catalog cards directly from database services.
 * Groups services dynamically by category so every single active service
 * in the database is represented without hardcoding or missing items.
 */
export function buildServiceCatalogFromDb(dbServices: Service[]): ServiceCategoryCard[] {
  if (!dbServices || dbServices.length === 0) {
    return [];
  }

  // Filter active services
  const activeServices = dbServices.filter((s) => s.active !== false);

  // Group services by category
  const grouped = new Map<string, Service[]>();
  for (const s of activeServices) {
    const cat = resolveServiceCategory(s);
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(s);
  }

  const cards: ServiceCategoryCard[] = [];

  // Consistent order: domestic, deep, airbnb, ironing, commercial, then any custom categories
  const preferredOrder = ["domestic", "deep", "airbnb", "ironing", "commercial"];
  const sortedCategories = Array.from(grouped.entries()).sort((a, b) => {
    const idxA = preferredOrder.indexOf(a[0]);
    const idxB = preferredOrder.indexOf(b[0]);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [catKey, groupServices] of sortedCategories) {
    // Pick the primary service in this category (prefer canonical match, lowest sort order, or price)
    const sorted = [...groupServices].sort((a, b) => {
      // Prioritize canonical standard-cleaning for domestic, deep-cleaning for deep, etc.
      const isCanonicalA = (catKey === "domestic" && a.id === "standard-cleaning") ||
                           (catKey === "deep" && a.id === "deep-cleaning") ||
                           (catKey === "airbnb" && a.id === "airbnb-cleaning") ||
                           (catKey === "ironing" && a.id === "ironing-service") ||
                           (catKey === "commercial" && a.id === "office-cleaning");
      const isCanonicalB = (catKey === "domestic" && b.id === "standard-cleaning") ||
                           (catKey === "deep" && b.id === "deep-cleaning") ||
                           (catKey === "airbnb" && b.id === "airbnb-cleaning") ||
                           (catKey === "ironing" && b.id === "ironing-service") ||
                           (catKey === "commercial" && b.id === "office-cleaning");
      if (isCanonicalA && !isCanonicalB) return -1;
      if (!isCanonicalA && isCanonicalB) return 1;

      const soA = typeof a.sort_order === "number" ? a.sort_order : 999;
      const soB = typeof b.sort_order === "number" ? b.sort_order : 999;
      if (soA !== soB) return soA - soB;
      return a.price - b.price;
    });
    const primary = sorted[0];

    const prices = groupServices.map((s) => s.price).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : (primary?.price || 0);

    const name = resolveCategoryName(catKey, primary);
    const badge = primary.badge || (catKey === "domestic" ? "Most Popular" : catKey === "deep" ? "Intensive" : catKey === "airbnb" ? "Host Special" : catKey === "ironing" ? "Garment Care" : catKey === "commercial" ? "Business" : undefined);
    const tagline = resolveCategoryTagline(catKey, primary);
    const description = resolveCategoryDescription(catKey, primary);
    const icon = resolveServiceIcon(primary, catKey);

    const imageUrl =
      primary.image_url ||
      (catKey === "domestic"
        ? "/images/service-regular-cleaning.jpg"
        : catKey === "deep"
        ? "/images/service-deep-cleaning.jpg"
        : catKey === "airbnb"
        ? "/images/service-airbnb-cleaning.jpg"
        : catKey === "ironing"
        ? "/images/service-ironing-service.jpg"
        : catKey === "commercial"
        ? "/images/service-office-cleaning.jpg"
        : null);

    cards.push({
      id: catKey,
      name,
      badge: badge || undefined,
      tagline,
      description,
      icon,
      imageUrl,
      primaryServiceId: primary.id,
      hourlyRateRange: minPrice > 0 ? `From £${minPrice.toFixed(2)}/hr` : `£0.00/hr`,
      price: primary.price || minPrice,
      discount_percent: primary.discount_percent,
      services: groupServices,
    });
  }

  return cards;
}
