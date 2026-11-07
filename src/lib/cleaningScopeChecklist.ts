export interface CleaningTaskItem {
  category: "kitchen" | "bathrooms" | "bedrooms" | "living" | "extras" | "supplies";
  title: string;
  desc: string;
  icon: string;
}

/**
 * Dynamically builds a Wecasa-style transparent scope checklist
 * customized to the user's selected room counts and specialist add-ons.
 */
export function generateCleaningScopeChecklist(params: {
  serviceName: string;
  bedrooms: number;
  bathrooms: number;
  livingRooms: number;
  extras: string[];
  propertyType: string;
  equipmentBroughtByCleaner: boolean;
}): CleaningTaskItem[] {
  const { serviceName, bedrooms, bathrooms, livingRooms, extras, propertyType, equipmentBroughtByCleaner } = params;
  const list: CleaningTaskItem[] = [];
  const s = serviceName.toLowerCase();

  // Ironing service only
  if (s.includes("ironing") && !s.includes("cleaning")) {
    list.push({
      category: "living",
      title: `${bedrooms} Laundry Basket(s) Steam Pressed`,
      desc: "Delicate pressing and garment steaming on hangers and folded neat",
      icon: "🧺",
    });
    if (bathrooms > 0) {
      list.push({
        category: "bedrooms",
        title: `${bathrooms} Formal Shirts / Delicates`,
        desc: "Precision collar, cuff, and pleat alignment",
        icon: "👔",
      });
    }
    if (livingRooms > 0) {
      list.push({
        category: "bedrooms",
        title: `${livingRooms} Bedding & Linen Sets`,
        desc: "Duvet covers, sheets, and pillowcase pressing",
        icon: "🛏️",
      });
    }
    return list;
  }

  // Commercial / Office
  if (s.includes("office") || s.includes("commercial")) {
    list.push({
      category: "living",
      title: `${bedrooms} Desks & Workstations Sanitised`,
      desc: "Wiped down with antibacterial surface spray & waste bins emptied",
      icon: "🖥️",
    });
    list.push({
      category: "bathrooms",
      title: `${bathrooms} Commercial Washrooms Descaled`,
      desc: "Cubicles scrubbed, sinks polished, soap and paper replenished",
      icon: "🚻",
    });
    if (livingRooms > 0) {
      list.push({
        category: "living",
        title: `${livingRooms} Meeting Rooms & Breakouts`,
        desc: "Conference tables buffed, chairs straightened, whiteboards cleared",
        icon: "☕",
      });
    }
    list.push({
      category: "living",
      title: "Hard Floors & High-Traffic Vacuuming",
      desc: "Full vacuum and damp antibacterial mop across all hallways",
      icon: "🧹",
    });
    return list;
  }

  // Standard / Deep / Airbnb Domestic Clean scope
  // Kitchen (only included if entire house clean or kitchen elements exist, or if living/dining/bedrooms are selected)
  const isFullHouseClean = bedrooms > 0 || livingRooms > 0;
  if (isFullHouseClean) {
    list.push({
      category: "kitchen",
      title: "Kitchen Worktops, Hobs & Splashbacks",
      desc: "Degreased, sanitized and buffed streak-free",
      icon: "🍳",
    });
    list.push({
      category: "kitchen",
      title: "Sink & Tap Descaling",
      desc: "Limescale scrubbed, basin sanitized and chrome taps polished",
      icon: "🚰",
    });
  }

  // Bathrooms
  if (bathrooms > 0) {
    list.push({
      category: "bathrooms",
      title: `${bathrooms} Bathroom(s) Deep Clean & Disinfection`,
      desc: "Toilet bowl sanitized, shower screen descaled, tiles wiped & mirror polished",
      icon: "🚿",
    });
  }

  // Bedrooms
  if (bedrooms > 0) {
    list.push({
      category: "bedrooms",
      title: `${bedrooms} Bedroom(s) Dusted & Tidy`,
      desc: "Beds made, bedside tables and sills dusted, floors vacuumed",
      icon: "🛏️",
    });
  }

  // Living Rooms
  if (livingRooms > 0) {
    list.push({
      category: "living",
      title: `${livingRooms} Living & Dining Area(s)`,
      desc: "Sofas tidied, coffee tables wiped, skirting boards dusted & floors mopped",
      icon: "🛋️",
    });
  }

  // General whole home floors - only if living areas or bedrooms are selected
  if (isFullHouseClean) {
    list.push({
      category: "living",
      title: "Full Vacuum & Mop",
      desc: "Carpets vacuumed edge-to-edge & hard floors damp mopped with eco cleanser",
      icon: "🧹",
    });
  }

  // Specialist extras
  if (extras.includes("oven")) {
    list.push({
      category: "extras",
      title: "Inside Oven & Grill Deep Degrease",
      desc: "Oven racks soaked, glass door scrubbed, burnt-on grease stripped (+45m)",
      icon: "🍳",
    });
  }
  if (extras.includes("fridge")) {
    list.push({
      category: "extras",
      title: "Inside Fridge & Freezer Disinfection",
      desc: "Shelves removed & washed, food drawers sanitized (+30m)",
      icon: "❄️",
    });
  }
  if (extras.includes("windows")) {
    list.push({
      category: "extras",
      title: "Interior Window Panes & Sills Buffed",
      desc: "Internal glass polished streak-free with microfibre cloth (+30m)",
      icon: "🪟",
    });
  }
  if (extras.includes("bed_linen")) {
    list.push({
      category: "extras",
      title: "Full Bed Linen Strip & Fresh Dressing",
      desc: "Duvet covers, pillowcases and bedsheets dressed to hotel standard (+30m)",
      icon: "🛏️",
    });
  }
  if (extras.includes("ironing")) {
    list.push({
      category: "extras",
      title: "Ironing & Garment Pressing",
      desc: "Shirts and trousers steam pressed and placed on hangers (+60m)",
      icon: "🧺",
    });
  }
  if (extras.includes("carpet")) {
    list.push({
      category: "extras",
      title: "Carpet Stain Extraction Machine",
      desc: "Shampoo injection & vacuum extraction on high-traffic rugs (+60m)",
      icon: "🧹",
    });
  }
  if (extras.includes("cupboards")) {
    list.push({
      category: "extras",
      title: "Inside Kitchen Cabinets Sanitized",
      desc: "Empty cupboard shelves wiped down and crumbs removed (+45m)",
      icon: "📦",
    });
  }

  // Equipment option
  if (equipmentBroughtByCleaner) {
    list.push({
      category: "supplies",
      title: "Cleaner Brings Heavy-Duty Vacuum & Mop Kit",
      desc: "Cleaner supplies commercial vacuum cleaner, mop and fresh bucket",
      icon: "⚡",
    });
  }

  return list;
}
