import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  CheckCircle,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Minus,
  Plus,
  Repeat,
  CheckCircle2,
  Home,
  Shield,
  Key,
  Car,
  Dog,
  CalendarX,
  Phone,
  Mail,
  Bed,
  Bath,
  Armchair,
  Shirt,
  Sparkle,
  Flame,
  Refrigerator,
  AppWindow,
  Package,
  Layers,
  Coffee,
  Tv,
  Camera,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  START_HOURS,
  calcTimeSlot,
  walesCities,
  fetchActiveCities,
  Service,
} from "@/lib/services";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ACCESS_METHODS,
  calculateRecommendedHours,
  DEFAULT_BOOKING_EXTRAS,
  DEFAULT_DURATION_MULTIPLIERS,
  DURATION_STEP_HOURS,
  MAX_DURATION_HOURS,
  MIN_DURATION_HOURS,
  parseBookingExtras,
  parseDurationMultipliers,
} from "@/lib/constants";
import type { BookingDurationMultipliers, BookingExtra } from "@/lib/constants";
import { useServices } from "@/hooks/useServices";
import { api } from "@/lib/apiClient";
import { getServiceBookingConfig } from "@/lib/serviceBookingConfigs";
import { buildServiceCatalogFromDb } from "@/lib/serviceCatalog";
import {
  verifyPostcodeCoverage,
  type PostcodeCoverageResult,
} from "@/lib/postcodeCoverage";
import { generateCleaningScopeChecklist } from "@/lib/cleaningScopeChecklist";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6; // 1: Service, 2: Frequency & Schedule, 3: Scale & Hours, 4: Location & Access, 5: Review Summary, 6: Confirmed
type RecurringFreq = "none" | "weekly" | "fortnightly" | "monthly";

const EMPTY_DISCOUNTS: Record<RecurringFreq, number> = {
  none: 0,
  weekly: 0,
  fortnightly: 0,
  monthly: 0,
};

const DRAFT_STORAGE_KEY = "mmc_booking_draft_v1";

interface BookingDraftData {
  serviceId?: string;
  step: WizardStep;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  livingRooms: number;
  selectedExtras: string[];
  date: string;
  startHour: string;
  durationHours: number;
  address: string;
  city: string;
  postcode: string;
  notes: string;
  accessMethod: string;
  suppliesOption: string;
  parkingOption: string;
  hasPets: boolean;
  cleanerBringsVacuum: boolean;
  recurringFreq: RecurringFreq;
}

function loadSavedDraft(): Partial<BookingDraftData> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(data: Partial<BookingDraftData>) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage quota or security error ignored
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getMatureRoomIcon(iconEmoji: string, label: string) {
  const text = (label || "").toLowerCase();
  if (text.includes("bed") || text.includes("linen") || iconEmoji.includes("🛏")) {
    return <Bed className="w-4 h-4 text-emerald-700" />;
  }
  if (text.includes("bath") || text.includes("wc") || text.includes("washroom") || iconEmoji.includes("🚿") || iconEmoji.includes("🚻")) {
    return <Bath className="w-4 h-4 text-emerald-700" />;
  }
  if (text.includes("living") || text.includes("lounge") || text.includes("sofa") || iconEmoji.includes("🛋")) {
    return <Armchair className="w-4 h-4 text-emerald-700" />;
  }
  if (text.includes("laundry") || text.includes("ironing") || iconEmoji.includes("🧺")) {
    return <Shirt className="w-4 h-4 text-emerald-700" />;
  }
  if (text.includes("desk") || text.includes("office") || iconEmoji.includes("🖥")) {
    return <Tv className="w-4 h-4 text-emerald-700" />;
  }
  return <Home className="w-4 h-4 text-emerald-700" />;
}

function getMatureExtraIcon(extraId: string, label: string) {
  const key = `${extraId} ${label}`.toLowerCase();
  if (key.includes("oven") || key.includes("grill") || key.includes("cooker")) {
    return <Flame className="w-5 h-5 text-amber-600" />;
  }
  if (key.includes("fridge") || key.includes("freezer")) {
    return <Refrigerator className="w-5 h-5 text-sky-600" />;
  }
  if (key.includes("window") || key.includes("glass")) {
    return <AppWindow className="w-5 h-5 text-cyan-600" />;
  }
  if (key.includes("linen") || key.includes("bed")) {
    return <Bed className="w-5 h-5 text-indigo-600" />;
  }
  if (key.includes("ironing") || key.includes("laundry") || key.includes("wash")) {
    return <Shirt className="w-5 h-5 text-purple-600" />;
  }
  if (key.includes("carpet") || key.includes("shampoo") || key.includes("extraction")) {
    return <Layers className="w-5 h-5 text-emerald-600" />;
  }
  if (key.includes("cabinet") || key.includes("cupboard") || key.includes("storage")) {
    return <Package className="w-5 h-5 text-amber-700" />;
  }
  if (key.includes("coffee") || key.includes("welcome") || key.includes("kitchenette")) {
    return <Coffee className="w-5 h-5 text-amber-800" />;
  }
  if (key.includes("photo") || key.includes("audit") || key.includes("report")) {
    return <Camera className="w-5 h-5 text-blue-600" />;
  }
  if (key.includes("bin") || key.includes("waste") || key.includes("recycling")) {
    return <Trash2 className="w-5 h-5 text-slate-600" />;
  }
  return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
}

function formatDuration(hours: number) {
  if (hours === 0.5) return "30 minutes";
  if (hours % 1 === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const wholeHours = Math.floor(hours);
  return `${wholeHours} ${wholeHours === 1 ? "hour" : "hours"} 30 minutes`;
}

export default function BookingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ serviceId?: string }>();
  const { services } = useServices();

  const savedDraft = loadSavedDraft();

  const [step, setStep] = useState<WizardStep>(() => {
    if (savedDraft?.step && savedDraft.step >= 1 && savedDraft.step <= 5) {
      return savedDraft.step as WizardStep;
    }
    return 1;
  });
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Dynamic Room & Extras State
  const [availableExtras, setAvailableExtras] = useState<BookingExtra[]>(
    DEFAULT_BOOKING_EXTRAS
  );
  const [multipliers, setMultipliers] = useState<BookingDurationMultipliers>(
    DEFAULT_DURATION_MULTIPLIERS
  );

  const [propertyType, setPropertyType] = useState(
    () => savedDraft?.propertyType ?? "House / Flat"
  );
  const [bedrooms, setBedrooms] = useState(() => savedDraft?.bedrooms ?? 2);
  const [bathrooms, setBathrooms] = useState(() => savedDraft?.bathrooms ?? 1);
  const [livingRooms, setLivingRooms] = useState(
    () => savedDraft?.livingRooms ?? 1
  );
  const [selectedExtras, setSelectedExtras] = useState<string[]>(
    () => savedDraft?.selectedExtras ?? []
  );

  const [date, setDate] = useState(() => savedDraft?.date ?? "");
  const [startHour, setStartHour] = useState(
    () => savedDraft?.startHour ?? "09:00"
  );
  const [durationHours, setDurationHours] = useState(
    () => savedDraft?.durationHours ?? calculateRecommendedHours(2, 1, 1, [])
  );
  const [address, setAddress] = useState(() => savedDraft?.address ?? "");
  const [city, setCity] = useState(() => savedDraft?.city ?? "");
  const [citiesList, setCitiesList] = useState<string[]>(walesCities);
  const [postcode, setPostcode] = useState(() => savedDraft?.postcode ?? "");
  const [initialPostcode, setInitialPostcode] = useState("");
  const [coverageInfo, setCoverageInfo] =
    useState<PostcodeCoverageResult | null>(null);
  const [coverageChecked, setCoverageChecked] = useState(false);
  const [cleanerBringsVacuum, setCleanerBringsVacuum] = useState(
    () => savedDraft?.cleanerBringsVacuum ?? false
  );
  const [notes, setNotes] = useState(() => savedDraft?.notes ?? "");
  const [accessMethod, setAccessMethod] = useState(
    () => savedDraft?.accessMethod ?? "home"
  );
  const [suppliesOption, setSuppliesOption] = useState(
    () => savedDraft?.suppliesOption ?? "cleaner"
  );
  const [parkingOption, setParkingOption] = useState(
    () => savedDraft?.parkingOption ?? "free"
  );
  const [hasPets, setHasPets] = useState(() => savedDraft?.hasPets ?? false);
  const [recurringFreq, setRecurringFreq] = useState<RecurringFreq>(
    () => savedDraft?.recurringFreq ?? "none"
  );
  const [liveDiscounts, setLiveDiscounts] =
    useState<Record<RecurringFreq, number>>(EMPTY_DISCOUNTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [bookingAvailabilityChecked, setBookingAvailabilityChecked] =
    useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [bookingDisabledMessage, setBookingDisabledMessage] = useState(
    "We are currently fully booked and temporarily not accepting new bookings. Please check back soon or contact us directly."
  );

  const bookingConfig = getServiceBookingConfig(
    selectedService?.id || selectedService?.name || ""
  );

  // Dynamic estimate calculation based on service category
  const computeRecommendedHours = (
    val1: number,
    val2: number,
    val3: number,
    extras: string[],
    mults = multipliers,
    extList = availableExtras
  ) => {
    if (bookingConfig.category === "ironing") {
      let hours =
        val1 * bookingConfig.field1.unitMultiplier +
        val2 * bookingConfig.field2.unitMultiplier +
        val3 * bookingConfig.field3.unitMultiplier;
      for (const extraId of new Set(extras)) {
        const extra = bookingConfig.extras.find((item) => item.id === extraId);
        if (extra) hours += extra.duration;
      }
      return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
    }

    if (bookingConfig.category === "office") {
      let hours =
        1.0 +
        val1 * bookingConfig.field1.unitMultiplier +
        val2 * bookingConfig.field2.unitMultiplier +
        val3 * bookingConfig.field3.unitMultiplier;
      for (const extraId of new Set(extras)) {
        const extra = bookingConfig.extras.find((item) => item.id === extraId);
        if (extra) hours += extra.duration;
      }
      return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
    }

    if (bookingConfig.category === "cleaning_ironing") {
      let hours = 1.5 + val1 * 0.5 + val2 * 0.5 + val3 * 1.0;
      for (const extraId of new Set(extras)) {
        const extra = bookingConfig.extras.find((item) => item.id === extraId);
        if (extra) hours += extra.duration;
      }
      return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
    }

    return calculateRecommendedHours(
      val1,
      val2,
      val3,
      extras,
      mults,
      bookingConfig.category === "airbnb" ? bookingConfig.extras : extList
    );
  };

  const handleCheckPostcode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!initialPostcode.trim()) return;
    const result = verifyPostcodeCoverage(initialPostcode);
    setCoverageInfo(result);
    setCoverageChecked(true);
    if (result.covered && result.city) {
      setPostcode(initialPostcode.trim().toUpperCase());
      setCity(result.city);
    }
  };

  const handleRoomChange = (
    newBeds: number,
    newBaths: number,
    newLiving: number,
    newExtras: string[]
  ) => {
    setBedrooms(newBeds);
    setBathrooms(newBaths);
    setLivingRooms(newLiving);
    setSelectedExtras(newExtras);
    const recommended = computeRecommendedHours(
      newBeds,
      newBaths,
      newLiving,
      newExtras,
      multipliers,
      availableExtras
    );
    const allowedFloor = Math.max(
      MIN_DURATION_HOURS,
      recommended - DURATION_STEP_HOURS
    );
    setDurationHours((current) =>
      Math.min(MAX_DURATION_HOURS, Math.max(allowedFloor, current))
    );
  };

  const handlePropertyTypeChange = (nextType: string) => {
    setPropertyType(nextType);
    if (bookingConfig.category === "domestic" && nextType === "Studio") {
      handleRoomChange(0, Math.max(1, bathrooms || 1), 1, selectedExtras);
    } else if (
      bookingConfig.category === "domestic" &&
      nextType === "HMO / Shared House"
    ) {
      handleRoomChange(
        1,
        Math.max(1, bathrooms || 1),
        Math.min(1, livingRooms),
        selectedExtras
      );
    } else {
      handleRoomChange(
        Math.max(
          bookingConfig.field1.min,
          bedrooms || bookingConfig.field1.default
        ),
        Math.max(
          bookingConfig.field2.min,
          bathrooms || bookingConfig.field2.default
        ),
        Math.max(
          bookingConfig.field3.min,
          livingRooms || bookingConfig.field3.default
        ),
        selectedExtras
      );
    }
  };

  const recommendedDurationHours = computeRecommendedHours(
    bedrooms,
    bathrooms,
    livingRooms,
    selectedExtras
  );
  const requiresManualQuote = recommendedDurationHours > MAX_DURATION_HOURS;
  const allowedFloorHours = Math.max(
    MIN_DURATION_HOURS,
    recommendedDurationHours - DURATION_STEP_HOURS
  );
  const bedroomLabel = bookingConfig.field1.label;
  const bedroomHint = bookingConfig.field1.hint;
  const bathroomLabel = bookingConfig.field2.label;
  const bathroomHint = bookingConfig.field2.hint;
  const livingAreaLabel = bookingConfig.field3.label;
  const livingAreaHint = bookingConfig.field3.hint;

  const currentAvailableExtras =
    bookingConfig.category === "domestic"
      ? availableExtras
      : bookingConfig.extras;

  const toggleExtra = (extraId: string) => {
    const updated = selectedExtras.includes(extraId)
      ? selectedExtras.filter((id) => id !== extraId)
      : [...selectedExtras, extraId];
    handleRoomChange(bedrooms, bathrooms, livingRooms, updated);
  };

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    fetchActiveCities().then((cities) => {
      if (cities && cities.length > 0) setCitiesList(cities);
    });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryPostcode = searchParams.get("postcode");
    const queryCity = searchParams.get("city");
    if (queryPostcode) setPostcode(queryPostcode.toUpperCase());
    if (queryCity) setCity(queryCity);
    const qType = searchParams.get("propertyType");
    const qBeds = searchParams.get("bedrooms");
    const qBaths = searchParams.get("bathrooms");
    const qLiving = searchParams.get("livingRooms");
    if (qType) setPropertyType(qType);
    if (qBeds != null && !isNaN(Number(qBeds))) setBedrooms(Number(qBeds));
    if (qBaths != null && !isNaN(Number(qBaths))) setBathrooms(Number(qBaths));
    if (qLiving != null && !isNaN(Number(qLiving)))
      setLivingRooms(Number(qLiving));
  }, []);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "discount_weekly",
        "discount_fortnightly",
        "discount_monthly",
        "booking_extras",
        "room_calc_base_hours",
        "room_calc_bed_hours",
        "room_calc_bath_hours",
        "room_calc_living_hours",
        "booking_enabled",
        "booking_disabled_message",
      ])
      .then(({ data, error: settingsError }) => {
        if (settingsError) {
          setError(
            "We couldn't load the cleaning estimate settings. Please try again."
          );
          return;
        }

        const map = new Map<string, unknown>();
        (data || []).forEach((row) => map.set(row.key, row.value));

        setLiveDiscounts({
          none: 0,
          weekly: Number(map.get("discount_weekly") ?? 15),
          fortnightly: Number(map.get("discount_fortnightly") ?? 10),
          monthly: Number(map.get("discount_monthly") ?? 5),
        });

        if (map.has("booking_enabled")) {
          setBookingEnabled(map.get("booking_enabled") !== "false");
        }
        if (map.has("booking_disabled_message")) {
          const msg = map.get("booking_disabled_message") as string;
          if (msg && msg.trim()) setBookingDisabledMessage(msg.trim());
        }
        setBookingAvailabilityChecked(true);

        const parsedExtras = parseBookingExtras(map.get("booking_extras"));
        if (!parsedExtras) {
          setError(
            "The list of optional specialist extras is currently invalid. Defaults are in use."
          );
        } else {
          setAvailableExtras(parsedExtras);
        }

        const newMults =
          parseDurationMultipliers(
            map.get("room_calc_base_hours"),
            map.get("room_calc_bed_hours"),
            map.get("room_calc_bath_hours"),
            map.get("room_calc_living_hours")
          ) || DEFAULT_DURATION_MULTIPLIERS;
        setMultipliers(newMults);

        const initialRec = computeRecommendedHours(
          bedrooms,
          bathrooms,
          livingRooms,
          selectedExtras,
          newMults,
          parsedExtras || DEFAULT_BOOKING_EXTRAS
        );
        setDurationHours(Math.min(MAX_DURATION_HOURS, initialRec));
      });
  }, []);

  useEffect(() => {
    const targetServiceId = params.serviceId || savedDraft?.serviceId;
    if (targetServiceId && services.length > 0) {
      const s = services.find((svc) => svc.id === targetServiceId);
      if (s) {
        setSelectedService(s);
        // Only set default scope if user has not yet entered rooms or had saved draft
        if (!savedDraft?.serviceId) {
          const cfg = getServiceBookingConfig(s.id || s.name);
          setPropertyType(cfg.defaultPropertyType);
          setBedrooms(cfg.field1.default);
          setBathrooms(cfg.field2.default);
          setLivingRooms(cfg.field3.default);
          setSelectedExtras([]);
          setStep(2);
        }
      }
    }
  }, [params.serviceId, services]);

  // Persist draft on every change so browser refresh doesn't lose progress
  useEffect(() => {
    if (step === 6) {
      clearDraft();
      return;
    }
    if (selectedService) {
      saveDraft({
        serviceId: selectedService.id,
        step,
        propertyType,
        bedrooms,
        bathrooms,
        livingRooms,
        selectedExtras,
        date,
        startHour,
        durationHours,
        address,
        city,
        postcode,
        notes,
        accessMethod,
        suppliesOption,
        parkingOption,
        hasPets,
        cleanerBringsVacuum,
        recurringFreq,
      });
    }
  }, [
    selectedService,
    step,
    propertyType,
    bedrooms,
    bathrooms,
    livingRooms,
    selectedExtras,
    date,
    startHour,
    durationHours,
    address,
    city,
    postcode,
    notes,
    accessMethod,
    suppliesOption,
    parkingOption,
    hasPets,
    cleanerBringsVacuum,
    recurringFreq,
  ]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("address, city, postcode")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (!address) setAddress(data.address ?? "");
          if (!city) setCity(data.city ?? "");
          if (!postcode) setPostcode(data.postcode ?? "");
        }
      });
  }, [user]);

  const minDate = new Date();
  // Format local date string (YYYY-MM-DD) avoiding UTC offset skew
  const localTodayStr = `${minDate.getFullYear()}-${String(
    minDate.getMonth() + 1
  ).padStart(2, "0")}-${String(minDate.getDate()).padStart(2, "0")}`;

  // Calculate if there are still daytime slots left today (latest start hour is 17:00)
  const currentHour = minDate.getHours();
  const currentMinute = minDate.getMinutes();
  const remainingTodaySlots = START_HOURS.filter((h) => {
    const [hHour, hMin] = h.split(":").map(Number);
    return (
      hHour > currentHour || (hHour === currentHour && hMin > currentMinute)
    );
  });

  // If today has already passed 17:00 (no daytime slots remaining), min selectable date moves to tomorrow
  const minSelectableDate = new Date();
  if (remainingTodaySlots.length === 0) {
    minSelectableDate.setDate(minSelectableDate.getDate() + 1);
  }
  const minDateStr = `${minSelectableDate.getFullYear()}-${String(
    minSelectableDate.getMonth() + 1
  ).padStart(2, "0")}-${String(minSelectableDate.getDate()).padStart(2, "0")}`;

  const baseHourlyPrice = selectedService?.price ?? 20;
  const svcDiscount = Math.max(
    0,
    Math.min(100, Number(selectedService?.discount_percent ?? 0))
  );
  const hourlyPrice =
    svcDiscount > 0
      ? baseHourlyPrice * (1 - svcDiscount / 100)
      : baseHourlyPrice;
  const totalPrice = hourlyPrice * durationHours;
  const recurringPct = liveDiscounts[recurringFreq] ?? 0;
  const finalPrice =
    recurringPct > 0 ? totalPrice * (1 - recurringPct / 100) : totalPrice;
  const timeSlot = calcTimeSlot(startHour, durationHours);
  const availableStartHours =
    date === localTodayStr && remainingTodaySlots.length > 0
      ? remainingTodaySlots
      : START_HOURS;

  // Initialize date to min selectable date if blank or before min date
  useEffect(() => {
    if (!date || date < minDateStr) {
      setDate(minDateStr);
    }
  }, [minDateStr, date]);

  useEffect(() => {
    if (
      date &&
      availableStartHours.length > 0 &&
      !availableStartHours.includes(startHour)
    ) {
      setStartHour(availableStartHours[0]);
    }
  }, [date, availableStartHours, startHour]);

  const handleStepValidation = (targetStep: WizardStep): boolean => {
    setError("");
    if (targetStep === 3) {
      // Validating Step 2: Scale, Rooms & Specialist Extras
      if (
        bedrooms === 0 &&
        bathrooms === 0 &&
        livingRooms === 0 &&
        selectedExtras.length === 0
      ) {
        setError("Please select at least one room or task.");
        return false;
      }
      if (durationHours < MIN_DURATION_HOURS) {
        setError(`Minimum duration is ${formatDuration(MIN_DURATION_HOURS)}.`);
        return false;
      }
      if (requiresManualQuote) {
        setError(
          `This clean needs more than ${MAX_DURATION_HOURS} hours. Please contact us for a quote.`
        );
        return false;
      }
    } else if (targetStep === 4) {
      // Validating Step 3: Frequency & Schedule
      if (!date) {
        setError("Please choose your preferred appointment date.");
        return false;
      }
      if (availableStartHours.length === 0) {
        setError("No future slots left today. Please select another date.");
        return false;
      }
    } else if (targetStep === 5) {
      // Validating Step 4: Location & Access
      if (!postcode.trim()) {
        setError("Please enter your property postcode.");
        return false;
      }
      if (!city) {
        setError("Please select your city or town.");
        return false;
      }
      if (!address.trim()) {
        setError("Please enter your street address and door number.");
        return false;
      }
    }
    return true;
  };

  const handleNext = (nextStep: WizardStep) => {
    if (handleStepValidation(nextStep)) {
      if (!bookingEnabled) {
        setError(bookingDisabledMessage);
        return;
      }
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingEnabled) {
      setError(bookingDisabledMessage);
      return;
    }
    if (!user || !selectedService) return;
    if (!handleStepValidation(5)) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await api.createBooking({
        serviceId: selectedService.id,
        date,
        startHour,
        durationHours,
        timeSlot,
        address,
        city,
        postcode,
        notes: notes || undefined,
        accessMethod,
        suppliesOption,
        parkingOption,
        hasPets,
        recurringFreq,
        bedrooms,
        bathrooms,
        livingRooms,
        extras: selectedExtras,
        propertyType,
      });

      const newBooking = result.booking || result;
      clearDraft();
      setBookingId(newBooking.id);
      setStep(6);
    } catch (err: any) {
      setError(err?.message || "Failed to submit booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  // Step 6: Confirmation Screen
  if (step === 6 && selectedService)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl border border-gray-200 shadow-xl animate-fade-in">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-green-600">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            Booking Confirmed!
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Your {selectedService.name} has been scheduled for{" "}
            <strong>{date}</strong> ({timeSlot}).
          </p>

          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs text-gray-700 border border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-400">Scale:</span>
              <span className="font-bold">
                {bookingConfig.formatLayout(
                  bedrooms,
                  bathrooms,
                  livingRooms,
                  propertyType
                )}
              </span>
            </div>
            {selectedExtras.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Extras:</span>
                <span className="font-bold">{selectedExtras.join(", ")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="font-bold">{formatDuration(durationHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Supplies:</span>
              <span className="font-bold">
                {suppliesOption === "cleaner"
                  ? "Cleaner brings supplies"
                  : "Customer provides"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Access:</span>
              <span className="font-bold">
                {ACCESS_METHODS.find((m) => m.id === accessMethod)?.label ||
                  accessMethod}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Address:</span>
              <span className="font-bold">
                {address}, {city} ({postcode})
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-bold">Total:</span>
              <span className="text-green-700 font-black text-sm">
                {formatCurrency(finalPrice)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {bookingId && (
              <button
                onClick={() => setLocation(`/pay/${bookingId}`)}
                className="btn-primary w-full py-3"
              >
                Proceed to Secure Payment
              </button>
            )}
            <button
              onClick={() =>
                setLocation(bookingId ? `/bookings/${bookingId}` : "/bookings")
              }
              className="btn-secondary w-full py-3 text-xs"
            >
              View in My Bookings
            </button>
          </div>
        </div>
      </div>
    );

  // Bookings paused banner/gate
  if (bookingAvailabilityChecked && !bookingEnabled) {
    return (
      <div className="min-h-screen bg-gray-50/70 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-xl p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-600">
            <CalendarX className="w-9 h-9" />
          </div>
          <span className="inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 bg-amber-100 text-amber-800 rounded-full mb-3">
            Bookings Temporarily Paused
          </span>
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
            We're Currently Fully Booked
          </h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed bg-amber-50/60 p-4 rounded-2xl border border-amber-100/80">
            {bookingDisabledMessage}
          </p>

          <div className="space-y-3">
            <a
              href="/contact"
              className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 text-sm"
            >
              <Mail className="w-4 h-4" />
              Contact Us for Upcoming Slots
            </a>
            <a
              href="tel:+447362068202"
              className="btn-secondary w-full py-3 inline-flex items-center justify-center gap-2 text-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              Call Support: +44 7362 068202
            </a>
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="text-xs text-gray-400 hover:text-gray-600 pt-2 font-medium"
            >
              ← Back to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepsList = [
    { num: 1, label: "Service" },
    { num: 2, label: "Scope & Extras" },
    { num: 3, label: "Schedule" },
    { num: 4, label: "Location" },
    { num: 5, label: "Review" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Shield className="w-3.5 h-3.5 text-green-600" />
            Fully Insured · DBS Vetted · Cashless Payment
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Book a Professional Clean
          </h1>
        </div>

        {/* Linear Stepper Bar */}
        <div className="flex items-center mb-8 max-w-xl mx-auto">
          {stepsList.map(({ num, label }, i) => (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div
                className={`flex items-center gap-1.5 ${
                  num <= step ? "text-green-600" : "text-gray-300"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    num < step
                      ? "bg-green-600 border-green-600 text-white"
                      : num === step
                      ? "border-green-600 text-green-600 bg-white"
                      : "border-gray-200 text-gray-300 bg-white"
                  }`}
                >
                  {num < step ? "✓" : num}
                </div>
                <span className="text-xs font-bold hidden sm:block">
                  {label}
                </span>
              </div>
              {i < stepsList.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    step > num ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-4 py-3 font-medium mb-6 animate-fade-in">
            {error}
          </div>
        )}

        {/* ═════════ STEP 1: SERVICE SELECTION ═════════ */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            {/* Wecasa-style Upfront Postcode & Local Cleaner Availability Check */}
            <div className="bg-gradient-to-r from-green-900 to-gray-900 text-white rounded-3xl p-5 sm:p-6 shadow-md">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-2">
                  <CheckCircle className="w-3 h-3" /> Live Cleaner Availability
                </div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white mb-1">
                  Check available cleaners in your Welsh postcode
                </h3>
                <p className="text-xs text-gray-300 mb-4">
                  Find out which certified, DBS-checked professionals are
                  working in your area this week.
                </p>

                <form
                  onSubmit={handleCheckPostcode}
                  className="flex gap-2 max-w-md"
                >
                  <input
                    type="text"
                    value={initialPostcode}
                    onChange={(e) =>
                      setInitialPostcode(e.target.value.toUpperCase())
                    }
                    placeholder="e.g. CF10 1AB, SA1, NP20..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-400 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white/20"
                  />
                  <button
                    type="submit"
                    className="btn-primary py-2.5 px-5 text-xs font-bold shrink-0 shadow-xs"
                  >
                    Check Area
                  </button>
                </form>

                {coverageChecked && coverageInfo && (
                  <div
                    className={`mt-3.5 p-3 rounded-2xl text-xs flex items-center gap-2.5 animate-fade-in ${
                      coverageInfo.covered
                        ? "bg-green-800/80 border border-green-500/50 text-green-100"
                        : "bg-amber-900/80 border border-amber-600/50 text-amber-100"
                    }`}
                  >
                    {coverageInfo.covered ? (
                      <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
                    )}
                    <span>{coverageInfo.message}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center max-w-xl mx-auto mb-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                Select your service
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose the category suited to your home or office.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {buildServiceCatalogFromDb(services).map((group) => {
                const matchedDbService =
                  services.find((s) => s.id === group.primaryServiceId) ||
                  services.find((s) =>
                    s.name.toLowerCase().includes(group.id)
                  ) ||
                  services[0];

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      if (!matchedDbService) return;
                      setSelectedService(matchedDbService);
                      const cfg = getServiceBookingConfig(
                        matchedDbService.id || matchedDbService.name
                      );
                      setPropertyType(cfg.defaultPropertyType);
                      setBedrooms(cfg.field1.default);
                      setBathrooms(cfg.field2.default);
                      setLivingRooms(cfg.field3.default);
                      setSelectedExtras([]);
                      setStep(2);
                    }}
                    className="rounded-3xl border-2 border-gray-200 bg-white hover:border-green-600 hover:shadow-lg transition-all text-left flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      {/* Service Category Image */}
                      <div className="h-36 w-full bg-gray-100 overflow-hidden relative">
                        {group.imageUrl ? (
                          <img
                            src={group.imageUrl}
                            alt={group.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center text-4xl">
                            {group.icon}
                          </div>
                        )}
                        {group.badge && (
                          <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-green-900 border border-green-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs">
                            {group.badge}
                          </span>
                        )}
                        <span className="absolute bottom-3 right-3 bg-gray-900/90 backdrop-blur-xs text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
                          {group.hourlyRateRange}
                        </span>
                      </div>

                      <div className="p-6">
                        <h3 className="text-lg font-black text-gray-900 group-hover:text-green-700 transition-colors">
                          {group.name}
                        </h3>
                        <p className="text-xs font-semibold text-green-700 mt-0.5">
                          {group.tagline}
                        </p>
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                          {group.description}
                        </p>
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-green-700">
                      <span>Select service</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═════════ STEP 2: SCOPE, HOURS & EXTRAS ═════════ */}
        {step === 2 && selectedService && (
          <div className="animate-fade-in bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to services
            </button>

            <div>
              <p className="section-eyebrow">
                <Home className="w-3.5 h-3.5" /> Step 2 of 5
              </p>
              <h2 className="text-2xl font-black text-gray-900">
                {bookingConfig.stepATitle}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {bookingConfig.stepASubtitle}
              </p>
            </div>

            {/* Property Type Selector */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2">
                {bookingConfig.propertyTypeLabel}
              </label>
              <div
                className={`grid grid-cols-${bookingConfig.propertyTypes.length} gap-2 sm:gap-3`}
              >
                {bookingConfig.propertyTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={propertyType === type}
                    onClick={() => handlePropertyTypeChange(type)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                      propertyType === type
                        ? "bg-green-600 text-white border-green-600 shadow-xs"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 Scope / Room Counters */}
            <div className="grid sm:grid-cols-3 gap-4 pt-2">
              {/* Field 1 */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-base">
                      {bookingConfig.field1.icon}
                    </span>{" "}
                    {bedroomLabel}
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      {getMatureRoomIcon(bookingConfig.field1.icon, bedroomLabel)}
                    </span>
                    <span>{bedroomLabel}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">{bedroomHint}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{bedroomHint}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleRoomChange(
                        Math.max(bookingConfig.field1.min, bedrooms - 1),
                        bathrooms,
                        livingRooms,
                        selectedExtras
                      )
                    }
                    disabled={bedrooms <= bookingConfig.field1.min}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-black text-sm w-4 text-center">
                    {bedrooms}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleRoomChange(
                        Math.min(bookingConfig.field1.max, bedrooms + 1),
                        bathrooms,
                        livingRooms,
                        selectedExtras
                      )
                    }
                    disabled={bedrooms >= bookingConfig.field1.max}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Field 2 */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-base">
                      {bookingConfig.field2.icon}
                    </span>{" "}
                    {bathroomLabel}
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      {getMatureRoomIcon(bookingConfig.field2.icon, bathroomLabel)}
                    </span>
                    <span>{bathroomLabel}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                  <div className="text-[10px] text-gray-400 mt-1">
                    {bathroomHint}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleRoomChange(
                        bedrooms,
                        Math.max(bookingConfig.field2.min, bathrooms - 1),
                        livingRooms,
                        selectedExtras
                      )
                    }
                    disabled={bathrooms <= bookingConfig.field2.min}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-black text-sm w-4 text-center">
                    {bathrooms}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleRoomChange(
                        bedrooms,
                        Math.min(bookingConfig.field2.max, bathrooms + 1),
                        livingRooms,
                        selectedExtras
                      )
                    }
                    disabled={bathrooms >= bookingConfig.field2.max}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Field 3 */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-base">
                      {bookingConfig.field3.icon}
                    </span>{" "}
                    {livingAreaLabel}
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      {getMatureRoomIcon(bookingConfig.field3.icon, livingAreaLabel)}
                    </span>
                    <span>{livingAreaLabel}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                  <div className="text-[10px] text-gray-400 mt-1">
                    {livingAreaHint}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleRoomChange(
                        bedrooms,
                        bathrooms,
                        Math.max(bookingConfig.field3.min, livingRooms - 1),
                        selectedExtras
                      )
                    }
                    disabled={livingRooms <= bookingConfig.field3.min}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-black text-sm w-4 text-center">
                    {livingRooms}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleRoomChange(
                        bedrooms,
                        bathrooms,
                        Math.min(bookingConfig.field3.max, livingRooms + 1),
                        selectedExtras
                      )
                    }
                    disabled={livingRooms >= bookingConfig.field3.max}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Specialist Add-on Tiles */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2.5">
                Specialist Add-Ons (Optional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currentAvailableExtras.map((extra) => {
                  const isSelected = selectedExtras.includes(extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleExtra(extra.id)}
                      className={`p-3 rounded-2xl text-left border transition-all ${
                        isSelected
                          ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">{extra.icon}</span>
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-8 h-8 rounded-xl bg-gray-100/90 border border-gray-200/60 flex items-center justify-center">
                          {getMatureExtraIcon(extra.id, extra.label)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isSelected
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          +{extra.duration * 60}m
                        </span>
                      </div>
                      <div className="font-bold text-xs text-gray-900">
                        {extra.label}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                        {extra.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recommendation & Hour Adjuster */}
            <div className="p-4 rounded-2xl bg-green-50/60 border border-green-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-green-700 shrink-0" />
                <div className="text-xs text-gray-700">
                  Recommended for your selection:{" "}
                  <strong>{formatDuration(recommendedDurationHours)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500 font-semibold mr-1">
                  Adjust hours:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDurationHours((h) =>
                      Math.max(allowedFloorHours, h - DURATION_STEP_HOURS)
                    )
                  }
                  className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center font-bold hover:bg-gray-100"
                >
                  <Minus className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <span className="font-black text-sm text-green-800 px-1">
                  {formatDuration(durationHours)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDurationHours((h) =>
                      Math.min(MAX_DURATION_HOURS, h + DURATION_STEP_HOURS)
                    )
                  }
                  className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center font-bold hover:bg-gray-100"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary py-2.5 px-5 text-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => handleNext(3)}
                className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
              >
                Continue to Schedule & Frequency{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ═════════ STEP 3: FREQUENCY & SCHEDULE ═════════ */}
        {step === 3 && selectedService && (
          <div className="animate-fade-in bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to scope & hours
            </button>

            <div>
              <p className="section-eyebrow">
                <Calendar className="w-3.5 h-3.5" /> Step 3 of 5
              </p>
              <h2 className="text-2xl font-black text-gray-900">
                Frequency & Schedule
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Lock in your appointment date and start time slot for your{" "}
                {formatDuration(durationHours)} clean.
              </p>
            </div>

            {/* Recurring Frequency Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-green-600" /> How often do
                you need us?
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(
                  [
                    {
                      id: "weekly",
                      label: "Weekly",
                      sub: "Most popular",
                      discountKey: "weekly",
                    },
                    {
                      id: "fortnightly",
                      label: "Fortnightly",
                      sub: "Every 2 weeks",
                      discountKey: "fortnightly",
                    },
                    {
                      id: "monthly",
                      label: "Monthly",
                      sub: "Every 4 weeks",
                      discountKey: "monthly",
                    },
                    {
                      id: "none",
                      label: "One-off",
                      sub: "Single visit",
                      discountKey: "none",
                    },
                  ] as const
                ).map((freq) => {
                  const isSelected = recurringFreq === freq.id;
                  const discount =
                    liveDiscounts[freq.discountKey as RecurringFreq] ?? 0;
                  return (
                    <button
                      type="button"
                      key={freq.id}
                      onClick={() => setRecurringFreq(freq.id as RecurringFreq)}
                      className={cn(
                        "relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all",
                        isSelected
                          ? "border-green-600 bg-green-50/70 text-green-900 ring-2 ring-green-600/20 shadow-xs"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/50"
                      )}
                    >
                      {discount > 0 && (
                        <span className="absolute -top-2 -right-1 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                          SAVE {discount}%
                        </span>
                      )}
                      <span className="font-black text-xs">{freq.label}</span>
                      <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                        {freq.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date & Time Picker */}
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  min={minDateStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Start Time Slot
                </label>
                <select
                  required
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="input-field"
                >
                  {availableStartHours.map((h) => (
                    <option key={h} value={h}>
                      {h} (Finishes at{" "}
                      {calcTimeSlot(h, durationHours).split(" – ")[1]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {date && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-800 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                <span>
                  Appointment scheduled: <strong>{date}</strong> from{" "}
                  <strong>{timeSlot}</strong>
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary py-2.5 px-5 text-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => handleNext(4)}
                className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
              >
                Continue to Location & Keys{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ═════════ STEP 4: LOCATION, ACCESS & SUPPLIES ═════════ */}
        {step === 4 && selectedService && (
          <div className="animate-fade-in bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to schedule
            </button>

            <div>
              <p className="section-eyebrow">
                <MapPin className="w-3.5 h-3.5" /> Step 4 of 5
              </p>
              <h2 className="text-2xl font-black text-gray-900">
                Location & Access
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Where should the cleaner go, and how will they enter?
              </p>
            </div>

            {/* Address fields */}
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Postcode
                  </label>
                  <input
                    type="text"
                    required
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="CF10 1AB"
                    className="input-field uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    City / Town (Wales)
                  </label>
                  <select
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select city/town</option>
                    {citiesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Street Address & Flat Number
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Flat 4, 12 Cathedral Road"
                  className="input-field"
                />
              </div>
            </div>

            {/* Access method */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2">
                <Key className="w-3.5 h-3.5 inline mr-1 text-green-600" /> Key &
                Access Arrangements
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ACCESS_METHODS.map((method) => (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setAccessMethod(method.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all",
                      accessMethod === method.id
                        ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="font-bold text-xs text-gray-900">
                      {method.label}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                      {method.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Supplies Option & Vacuum/Mop Equipment Add-on */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">
                  <Shield className="w-3.5 h-3.5 inline mr-1 text-green-600" />{" "}
                  {bookingConfig.suppliesPrompt}
                </label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSuppliesOption("cleaner")}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all",
                      suppliesOption === "cleaner"
                        ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="font-bold text-xs text-gray-900">
                      {bookingConfig.suppliesCleanerLabel}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Eco sprays, cloths & cleaning agents included
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuppliesOption("customer")}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all",
                      suppliesOption === "customer"
                        ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="font-bold text-xs text-gray-900">
                      {bookingConfig.suppliesCustomerLabel}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Cleaner uses items provided at property
                    </div>
                  </button>
                </div>
              </div>

              {/* Vacuum & Mop Equipment Upgrade */}
              <div className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg">
                    🧹
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      Need cleaner to bring vacuum cleaner & mop?
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Cleaner will bring full heavy-duty vacuum & clean mop
                      bucket (+£7.50 flat)
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={cleanerBringsVacuum}
                    onChange={(e) => setCleanerBringsVacuum(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>

            {/* Parking & Pets */}
            <div className="grid sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-gray-500" /> Parking
                  arrangements
                </label>
                <select
                  value={parkingOption}
                  onChange={(e) => setParkingOption(e.target.value)}
                  className="input-field text-xs bg-white"
                >
                  <option value="free">
                    Free on-street / driveway parking
                  </option>
                  <option value="permit">
                    Visitor permit provided on arrival
                  </option>
                  <option value="paid">Paid parking meter nearby</option>
                  <option value="none">
                    No parking available (public transport only)
                  </option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1">
                  <Dog className="w-3.5 h-3.5 text-gray-500" /> Pets at home
                </label>
                <button
                  type="button"
                  onClick={() => setHasPets(!hasPets)}
                  className={cn(
                    "w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all bg-white",
                    hasPets
                      ? "border-green-600 bg-green-50/50 text-green-800"
                      : "border-gray-200 text-gray-600"
                  )}
                >
                  <span>
                    {hasPets
                      ? "🐾 Yes, pets at property"
                      : "No pets at property"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    Click to toggle
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                Special Instructions (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="E.g. key in lockbox code 1234, friendly dog in utility room, focus on kitchen tiles..."
                className="input-field resize-none text-xs"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-secondary py-2.5 px-5 text-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => handleNext(5)}
                className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
              >
                Review Summary <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ═════════ STEP 5: REVIEW SUMMARY & CONFIRM ═════════ */}
        {step === 5 && selectedService && (
          <form
            onSubmit={handleSubmit}
            className="animate-fade-in bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6"
          >
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to location
            </button>

            <div>
              <p className="section-eyebrow">
                <CheckCircle2 className="w-3.5 h-3.5" /> Step 5 of 5
              </p>
              <h2 className="text-2xl font-black text-gray-900">
                Review & Confirm
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Check your booking details before finalising.
              </p>
            </div>

            {/* Dynamic Personalized Scope Checklist (Wecasa Standard) */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> What
                  your cleaner will cover:
                </div>
                <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  {formatDuration(durationHours)} allocated
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                {generateCleaningScopeChecklist({
                  serviceName: selectedService.name,
                  bedrooms,
                  bathrooms,
                  livingRooms,
                  extras: selectedExtras,
                  propertyType,
                  equipmentBroughtByCleaner: cleanerBringsVacuum,
                }).map((task, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-2.5"
                  >
                    <span className="text-base shrink-0 mt-0.5">
                      {task.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900 leading-snug">
                        {task.title}
                      </div>
                      <div className="text-[10px] text-gray-500 leading-relaxed mt-0.5">
                        {task.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary details card */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-3 text-sm">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <div>
                  <div className="font-black text-gray-900 text-base">
                    {selectedService.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {recurringFreq !== "none"
                      ? `${
                          recurringFreq.charAt(0).toUpperCase() +
                          recurringFreq.slice(1)
                        } repeat clean`
                      : "One-off visit"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-green-700">
                    {formatCurrency(finalPrice)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {formatDuration(durationHours)} @{" "}
                    {formatCurrency(hourlyPrice)}/hr
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-700 pt-1">
                <div>
                  <span className="text-gray-400 block mb-0.5">
                    Appointment:
                  </span>
                  <span className="font-bold">
                    {date} ({timeSlot})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Address:</span>
                  <span className="font-bold">
                    {address}, {city} ({postcode})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Scope:</span>
                  <span className="font-bold">
                    {bookingConfig.formatLayout(
                      bedrooms,
                      bathrooms,
                      livingRooms,
                      propertyType
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Access:</span>
                  <span className="font-bold">
                    {ACCESS_METHODS.find((m) => m.id === accessMethod)?.label ||
                      accessMethod}
                  </span>
                </div>
              </div>

              {selectedExtras.length > 0 && (
                <div className="pt-2 border-t border-gray-200 text-xs">
                  <span className="text-gray-400">Selected Extras: </span>
                  <span className="font-bold text-gray-800">
                    {selectedExtras.join(", ")}
                  </span>
                </div>
              )}

              {cleanerBringsVacuum && (
                <div className="pt-2 text-xs font-medium text-gray-700 flex justify-between items-center border-t border-gray-200">
                  <span>Vacuum & mop equipment hire:</span>
                  <span className="font-bold">+£7.50</span>
                </div>
              )}
              {recurringPct > 0 && (
                <div className="pt-2 text-xs font-semibold text-orange-600 flex items-center gap-1">
                  <span>🎉 {recurringPct}% frequency discount applied!</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-xs text-green-800 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>
                <strong>100% Satisfaction Guarantee.</strong> You are only
                charged once your verified cleaner completes the clean to your
                satisfaction.
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="btn-secondary py-3 px-6 text-xs"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary py-3.5 px-8 text-sm font-bold shadow-md shadow-green-600/20"
              >
                {submitting ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
