export interface PostcodeCoverageResult {
  covered: boolean;
  city?: string;
  region?: string;
  prefix?: string;
  cleanersCount?: number;
  message: string;
}

// All major Wales postcode prefixes mapped to their urban hubs
export const WALES_POSTCODE_MAP: Record<string, { city: string; region: string; cleanersCount: number }> = {
  // Cardiff & Vale
  CF10: { city: "Cardiff", region: "Cardiff City Centre & Bay", cleanersCount: 7 },
  CF11: { city: "Cardiff", region: "Canton & Grangetown", cleanersCount: 6 },
  CF14: { city: "Cardiff", region: "Whitchurch & Heath", cleanersCount: 8 },
  CF15: { city: "Cardiff", region: "Radyr & Pentyrch", cleanersCount: 5 },
  CF23: { city: "Cardiff", region: "Roath & Llanishen", cleanersCount: 7 },
  CF24: { city: "Cardiff", region: "Cathays & Adamsdown", cleanersCount: 6 },
  CF3:  { city: "Cardiff", region: "St Mellons & Rumney", cleanersCount: 5 },
  CF5:  { city: "Cardiff", region: "Ely & Fairwater", cleanersCount: 5 },
  CF64: { city: "Penarth", region: "Penarth & Dinas Powys", cleanersCount: 5 },
  CF62: { city: "Barry", region: "Barry & Rhoose", cleanersCount: 4 },
  CF63: { city: "Barry", region: "Cadoxton & Palmerstown", cleanersCount: 4 },
  CF72: { city: "Pontypridd", region: "Llantrisant & Talbot Green", cleanersCount: 5 },
  CF37: { city: "Pontypridd", region: "Pontypridd & Hopkinstown", cleanersCount: 6 },
  CF38: { city: "Pontypridd", region: "Beddau & Church Village", cleanersCount: 4 },
  CF83: { city: "Caerphilly", region: "Caerphilly & Bedwas", cleanersCount: 5 },
  CF31: { city: "Bridgend", region: "Bridgend Central", cleanersCount: 5 },
  CF32: { city: "Bridgend", region: "Ogmore & Pencoed", cleanersCount: 4 },
  CF35: { city: "Bridgend", region: "Pencoed & Heol-y-Cyw", cleanersCount: 3 },
  CF44: { city: "Aberdare", region: "Cynon Valley", cleanersCount: 4 },
  CF47: { city: "Merthyr Tydfil", region: "Merthyr Town", cleanersCount: 4 },
  CF48: { city: "Merthyr Tydfil", region: "Dowlais & Cefn-coed", cleanersCount: 3 },
  CF39: { city: "Rhondda", region: "Porth & Tonyrefail", cleanersCount: 4 },
  CF40: { city: "Rhondda", region: "Tonypandy", cleanersCount: 3 },
  CF41: { city: "Rhondda", region: "Pentre", cleanersCount: 3 },
  CF42: { city: "Rhondda", region: "Treorchy", cleanersCount: 3 },

  // Newport & Gwent
  NP10: { city: "Newport", region: "Bassaleg & Rogerstone", cleanersCount: 6 },
  NP19: { city: "Newport", region: "Maindee & Beechwood", cleanersCount: 5 },
  NP20: { city: "Newport", region: "Newport Central & Pill", cleanersCount: 5 },
  NP44: { city: "Cwmbran", region: "Cwmbran & Pontnewydd", cleanersCount: 5 },
  NP4:  { city: "Pontypool", region: "Pontypool & Blaenavon", cleanersCount: 4 },
  NP7:  { city: "Abergavenny", region: "Abergavenny & Llanfoist", cleanersCount: 4 },
  NP26: { city: "Newport", region: "Caldicot & Magor", cleanersCount: 3 },

  // Swansea & South West Wales
  SA1:  { city: "Swansea", region: "Swansea Marina & Uplands", cleanersCount: 8 },
  SA2:  { city: "Swansea", region: "Sketty & Killay", cleanersCount: 6 },
  SA3:  { city: "Swansea", region: "Mumbles & Gower", cleanersCount: 5 },
  SA4:  { city: "Swansea", region: "Gorseinon & Pontarddulais", cleanersCount: 4 },
  SA5:  { city: "Swansea", region: "Cwmbwrla & Manselton", cleanersCount: 5 },
  SA6:  { city: "Swansea", region: "Morriston & Llansamlet", cleanersCount: 5 },
  SA7:  { city: "Swansea", region: "Birchgrove", cleanersCount: 4 },
  SA10: { city: "Neath", region: "Neath Central & Skewen", cleanersCount: 4 },
  SA11: { city: "Neath", region: "Neath Abbey & Briton Ferry", cleanersCount: 4 },
  SA12: { city: "Port Talbot", region: "Port Talbot & Aberavon", cleanersCount: 4 },
  SA13: { city: "Port Talbot", region: "Margam & Taibach", cleanersCount: 3 },
  SA14: { city: "Llanelli", region: "Llanelli & Bynea", cleanersCount: 4 },
  SA15: { city: "Llanelli", region: "Llanelli Central & Dafen", cleanersCount: 4 },
};

/**
 * Validates any UK postcode against MakeMeClean's verified Welsh coverage areas.
 */
export function verifyPostcodeCoverage(rawPostcode: string): PostcodeCoverageResult {
  if (!rawPostcode || rawPostcode.trim().length < 2) {
    return {
      covered: false,
      message: "Please enter a valid UK postcode.",
    };
  }

  // Clean string and extract outward code (e.g. CF10 1AB -> CF10, SA1 2EP -> SA1)
  const cleaned = rawPostcode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Try matching full outward code (e.g. CF64, SA12, NP10, CF5, SA1)
  let matchedPrefix = "";
  for (const prefix of Object.keys(WALES_POSTCODE_MAP)) {
    if (cleaned.startsWith(prefix)) {
      if (prefix.length > matchedPrefix.length) {
        matchedPrefix = prefix;
      }
    }
  }

  if (matchedPrefix && WALES_POSTCODE_MAP[matchedPrefix]) {
    const info = WALES_POSTCODE_MAP[matchedPrefix];
    return {
      covered: true,
      city: info.city,
      region: info.region,
      prefix: matchedPrefix,
      message: `Great news! We cover ${info.city} (${info.region}) with our vetted cleaning team.`,
    };
  }

  // Check broader Welsh area code prefixes (CF, NP, SA, LL, LD, SY)
  const generalPrefixMatch = cleaned.match(/^(CF|NP|SA|LL|LD|SY)[0-9]*/);
  if (generalPrefixMatch) {
    const area = generalPrefixMatch[1];
    const defaultCity = area === "CF" ? "Cardiff" : area === "NP" ? "Newport" : area === "SA" ? "Swansea" : "Wales";
    return {
      covered: true,
      city: defaultCity,
      region: "Wales",
      prefix: generalPrefixMatch[0],
      message: `Great news! We operate across this Welsh postcode area.`,
    };
  }

  return {
    covered: false,
    message: `We currently serve all of Wales (postcodes starting with CF, NP, SA). We're expanding to your area soon!`,
  };
}
