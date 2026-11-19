import { useState, useRef, useEffect } from "react";
import { CheckCircle, Upload, X, MapPin, Clock, PoundSterling, Heart, Users, Leaf, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { useAuth } from "@/hooks/useAuth";
import { MAX_APPLICATION_DOCUMENT_SIZE_BYTES } from "@/lib/applicationDocuments";

const ROLES = [
  "Domestic Cleaner",
  "Commercial Cleaner",
  "Deep Clean Specialist",
  "End of Tenancy Cleaner",
  "Airbnb / Holiday Let Cleaner",
  "Window Cleaner",
  "Ironing & Laundry Specialist",
  "Other",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EXPERIENCE_TYPES = [
  "Domestic / residential",
  "Commercial / office",
  "Deep cleaning",
  "End of tenancy",
  "Airbnb / short-let",
  "Window cleaning",
  "Ironing / laundry",
];

const RTW_TYPES = [
  "British / Irish Passport",
  "UK Birth Certificate + NI proof",
  "EU Settlement Scheme",
  "Biometric Residence Permit",
  "Work Visa",
  "Other",
];

interface FileEntry {
  label: string;
  key: string;
  required: boolean;
  accept: string;
}

const FILE_FIELDS: FileEntry[] = [
  { label: "CV / Resume *", key: "cv", required: true, accept: ".pdf,.doc,.docx" },
  { label: "Proof of Identity *", key: "id_proof", required: true, accept: ".pdf,.jpg,.jpeg,.png" },
  { label: "Right to Work Document *", key: "rtw_doc", required: true, accept: ".pdf,.jpg,.jpeg,.png" },
  { label: "DBS Certificate (optional)", key: "dbs_cert", required: false, accept: ".pdf,.jpg,.jpeg,.png" },
];

const DRAFT_KEY = (email: string) => `careers-draft-${email.trim().toLowerCase()}`;

type Step = 1 | 2 | 3 | 4;
type EmailStage = "entry" | "verify" | "verified";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
        active ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

const defaultForm = {
  role: "Cleaning",
  employment_type: "",
  available_days: [] as string[],
  available_hours: "",
  earliest_start: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postcode: "",
  rtw_eligible: "",
  rtw_type: "",
  ni_number: "",
  years_experience: "",
  experience_types: [] as string[],
  own_equipment: "",
  driving_licence: "",
  own_transport: "",
  has_convictions: "",
  convictions_details: "",
  date_of_birth: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  heard_about_us: "",
  ref1_name: "",
  ref1_company: "",
  ref1_phone: "",
  ref1_email: "",
  ref2_name: "",
  ref2_company: "",
  ref2_phone: "",
  ref2_email: "",
  notice_period: "",
  current_employer: "",
  current_job_title: "",
  reason_for_leaving: "",
  health_declaration: "",
  health_details: "",
  equal_opps_gender: "",
  equal_opps_age: "",
  equal_opps_ethnicity: "",
  equal_opps_disability: "",
  equal_opps_sexual_orientation: "",
  equal_opps_religion: "",
  has_staff_relationship: "",
  staff_relationship_details: "",
  declare_accurate: false,
  declare_privacy: false,
  declare_dbs_consent: false,
  declare_references_consent: false,
  declare_terms: false,
};

function createSafeDraftForm(source: Partial<typeof defaultForm>) {
  return {
    role: typeof source.role === "string" ? source.role : defaultForm.role,
    employment_type: typeof source.employment_type === "string" ? source.employment_type : "",
    available_days: Array.isArray(source.available_days)
      ? source.available_days.filter((value): value is string => typeof value === "string")
      : [],
    available_hours: typeof source.available_hours === "string" ? source.available_hours : "",
    earliest_start: typeof source.earliest_start === "string" ? source.earliest_start : "",
    years_experience: typeof source.years_experience === "string" ? source.years_experience : "",
    experience_types: Array.isArray(source.experience_types)
      ? source.experience_types.filter((value): value is string => typeof value === "string")
      : [],
    own_equipment: typeof source.own_equipment === "string" ? source.own_equipment : "",
    driving_licence: typeof source.driving_licence === "string" ? source.driving_licence : "",
    own_transport: typeof source.own_transport === "string" ? source.own_transport : "",
    notice_period: typeof source.notice_period === "string" ? source.notice_period : "",
    current_employer: typeof source.current_employer === "string" ? source.current_employer : "",
    current_job_title: typeof source.current_job_title === "string" ? source.current_job_title : "",
    reason_for_leaving: typeof source.reason_for_leaving === "string" ? source.reason_for_leaving : "",
    heard_about_us: typeof source.heard_about_us === "string" ? source.heard_about_us : "",
  };
}

export default function Careers() {
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [emailStage, setEmailStage] = useState<EmailStage>("verified");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [activeRecruitment, setActiveRecruitment] = useState<{ id: string; title: string } | null>(null);
  const [myApplications, setMyApplications] = useState<Array<{ id: string; role: string; status: string; created_at: string; recruitment_id: string | null }>>([]);
  const [showNewApplication, setShowNewApplication] = useState(false);
  const [prefillOpen, setPrefillOpen] = useState(false);
  const [prefillStage, setPrefillStage] = useState<"ask" | "choose">("ask");
  const [prefillLoading, setPrefillLoading] = useState(false);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({ cv: null, id_proof: null, rtw_doc: null, dbs_cert: null });

  const [form, setForm] = useState(defaultForm);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const set = (key: string, value: unknown) =>
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (emailStage === "verified" && updated.email) {
        saveDraft(updated);
      }
      return updated;
    });

  const toggle = (key: "available_days" | "experience_types", val: string) =>
    setForm((f) => {
      const arr = f[key] as string[];
      const updated = { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
      if (emailStage === "verified") saveDraft(updated);
      return updated;
    });

  const saveDraft = (data: typeof form, draftStep = step) => {
    if (!data.email) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY(data.email),
        JSON.stringify({ form: createSafeDraftForm(data), step: draftStep }),
      );
    } catch {}
  };

  const loadDraft = (email: string) => {
    try {
      const key = DRAFT_KEY(email);
      let raw = sessionStorage.getItem(key);
      let legacy = false;
      if (!raw) {
        raw = localStorage.getItem(key);
        legacy = Boolean(raw);
      }
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        form?: Partial<typeof form>;
        step?: number;
      };
      if (!parsed.form || typeof parsed.form !== "object") return null;

      const draftStep = [1, 2, 3, 4].includes(Number(parsed.step))
        ? (Number(parsed.step) as Step)
        : 1;
      return {
        form: {
          ...defaultForm,
          email: email.trim().toLowerCase(),
          ...createSafeDraftForm(parsed.form),
        },
        step: draftStep,
        legacy,
      };
    } catch {
      return null;
    }
  };

  const clearDraft = (email: string) => {
    try {
      sessionStorage.removeItem(DRAFT_KEY(email));
      localStorage.removeItem(DRAFT_KEY(email));
    } catch {}
  };

  useEffect(() => {
    if (!user?.email) return;
    setForm((f) => ({ ...f, email: user.email ?? f.email }));
    setEmailStage("verified");
  }, [user?.email]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("recruitments")
          .select("id,title")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setActiveRecruitment((data as { id: string; title: string } | null) ?? null);
      } catch {
        setActiveRecruitment(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("job_applications")
          .select("id,role,status,created_at,recruitment_id")
          .order("created_at", { ascending: false });
        setMyApplications((data as Array<{ id: string; role: string; status: string; created_at: string; recruitment_id: string | null }>) ?? []);
      } catch {
        setMyApplications([]);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (form.email && emailStage === "entry") {
      const draft = loadDraft(form.email);
      setHasDraft(!!draft);
    }
  }, [form.email, emailStage]);

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!form.email || !form.email.includes("@")) { setError("Please enter a valid email address."); return; }
    setSendingOtp(true);
    setError("");
    const result = await sendOtp(form.email, "careers");
    if (!result.ok) { setError(result.error ?? "Failed to send code"); setSendingOtp(false); return; }
    setEmailStage("verify");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setOtp(["", "", "", "", "", ""]);
    startCooldown();
    setSendingOtp(false);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (next.every((d) => d !== "")) verifyCode(next.join(""));
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) { setOtp(digits.split("")); verifyCode(digits); }
  };

  const verifyCode = async (code: string) => {
    setVerifying(true);
    setError("");
    const result = await verifyOtp(form.email, code, "careers");
    if (!result.ok || !result.verified) {
      const msg =
        result.reason === "expired_or_not_found"
          ? "Code expired. Please request a new one."
          : "Incorrect code. Try again.";
      setError(msg);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setVerifying(false);
      return;
    }
    setEmailStage("verified");
    setVerifying(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });

    const draft = loadDraft(form.email);
    if (draft) {
      setForm(draft.form);
      setStep(draft.step);
      if (draft.legacy) {
        try {
          localStorage.removeItem(DRAFT_KEY(form.email));
          saveDraft(draft.form, draft.step);
        } catch {}
      }
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    const result = await sendOtp(form.email, "careers");
    if (!result.ok) setError(result.error ?? "Failed to resend");
    else startCooldown();
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const goToStep = (next: Step) => {
    setStep(next);
    if (emailStage === "verified") saveDraft(form);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applyPrefill = async (appId: string) => {
    setPrefillLoading(true);
    const { data } = await supabase.from("job_applications").select("*").eq("id", appId).single();
    if (data) {
      setForm((f) => ({
        ...f,
        employment_type: data.employment_type ?? f.employment_type,
        available_days: data.available_days ?? f.available_days,
        available_hours: data.available_hours ?? f.available_hours,
        earliest_start: data.earliest_start ?? f.earliest_start,
        first_name: data.first_name ?? f.first_name,
        last_name: data.last_name ?? f.last_name,
        phone: data.phone ?? f.phone,
        address: data.address ?? f.address,
        city: data.city ?? f.city,
        postcode: data.postcode ?? f.postcode,
        date_of_birth: data.date_of_birth ?? f.date_of_birth,
        emergency_contact_name: data.emergency_contact_name ?? f.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone ?? f.emergency_contact_phone,
        heard_about_us: data.heard_about_us ?? f.heard_about_us,
        rtw_eligible: data.rtw_eligible ?? f.rtw_eligible,
        rtw_type: data.rtw_type ?? f.rtw_type,
        ni_number: data.ni_number ?? f.ni_number,
        years_experience: data.years_experience ?? f.years_experience,
        experience_types: data.experience_types ?? f.experience_types,
        own_equipment: data.own_equipment ?? f.own_equipment,
        driving_licence: data.driving_licence ?? f.driving_licence,
        own_transport: data.own_transport ?? f.own_transport,
        has_convictions: data.has_convictions ?? f.has_convictions,
        convictions_details: data.convictions_details ?? f.convictions_details,
        ref1_name: data.ref1_name ?? f.ref1_name,
        ref1_company: data.ref1_company ?? f.ref1_company,
        ref1_phone: data.ref1_phone ?? f.ref1_phone,
        ref1_email: data.ref1_email ?? f.ref1_email,
        ref2_name: data.ref2_name ?? f.ref2_name,
        ref2_company: data.ref2_company ?? f.ref2_company,
        ref2_phone: data.ref2_phone ?? f.ref2_phone,
        ref2_email: data.ref2_email ?? f.ref2_email,
        notice_period: data.notice_period ?? f.notice_period,
        current_employer: data.current_employer ?? f.current_employer,
        current_job_title: data.current_job_title ?? f.current_job_title,
        reason_for_leaving: data.reason_for_leaving ?? f.reason_for_leaving,
        health_declaration: data.health_declaration ?? f.health_declaration,
        health_details: data.health_details ?? f.health_details,
        equal_opps_gender: data.equal_opps_gender ?? f.equal_opps_gender,
        equal_opps_age: data.equal_opps_age ?? f.equal_opps_age,
        equal_opps_ethnicity: data.equal_opps_ethnicity ?? f.equal_opps_ethnicity,
        equal_opps_disability: data.equal_opps_disability ?? f.equal_opps_disability,
        equal_opps_sexual_orientation: data.equal_opps_sexual_orientation ?? f.equal_opps_sexual_orientation,
        equal_opps_religion: data.equal_opps_religion ?? f.equal_opps_religion,
        has_staff_relationship: data.has_staff_relationship ?? f.has_staff_relationship,
        staff_relationship_details: data.staff_relationship_details ?? f.staff_relationship_details,
        declare_accurate: false,
        declare_privacy: false,
        declare_dbs_consent: false,
        declare_references_consent: false,
        declare_terms: false,
      }));
    }
    setPrefillLoading(false);
    setPrefillOpen(false);
    setShowNewApplication(true);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!form.declare_accurate || !form.declare_privacy || !form.declare_dbs_consent || !form.declare_references_consent) {
      setError("Please accept all declarations to submit.");
      return;
    }
    setSubmitting(true);
    setError("");
    const uploadedPaths: string[] = [];
    try {
      if (!user) throw new Error("Please log in to apply.");
      if (!activeRecruitment?.id) throw new Error("Recruitment is currently closed.");

      const alreadyAppliedToRoleThisRecruitment = myApplications.some(
        (a) =>
          (a.recruitment_id ?? "") === activeRecruitment.id &&
          (a.role ?? "") === form.role &&
          !["rejected", "hired"].includes((a.status ?? "").toLowerCase())
      );
      if (alreadyAppliedToRoleThisRecruitment) {
        throw new Error("You already have an application in progress for this role.");
      }

      const uploadedUrls: Record<string, string> = {};
      for (const field of FILE_FIELDS) {
        const file = files[field.key];
        if (!file) {
          if (field.required) throw new Error(`${field.label.replace(/\s*\*$/, "")} is required.`);
          continue;
        }

        const extension = file.name.includes(".")
          ? file.name.split(".").pop()!.toLowerCase()
          : "";
        const allowedExtensions = field.accept
          .split(",")
          .map((value) => value.trim().replace(/^\./, "").toLowerCase());
        if (!allowedExtensions.includes(extension)) {
          throw new Error(`Choose a supported file type for ${field.label.replace(/\s*\*$/, "")}.`);
        }
        if (file.size > MAX_APPLICATION_DOCUMENT_SIZE_BYTES) {
          throw new Error("Each document must be 10 MB or smaller.");
        }

        const path = `${user.id}/${field.key}_${crypto.randomUUID()}.${extension}`;
        const { error: uploadErr } = await supabase.storage
          .from("applications")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (uploadErr) throw new Error(`Unable to upload ${field.label.replace(/\s*\*$/, "")}.`);

        uploadedPaths.push(path);
        uploadedUrls[field.key] = path;
      }

      const { error: insertErr } = await supabase.from("job_applications").insert({
        user_id: user.id,
        recruitment_id: activeRecruitment.id,
        role: form.role,
        employment_type: form.employment_type || null,
        available_days: form.available_days,
        available_hours: form.available_hours || null,
        earliest_start: form.earliest_start || null,
        first_name: form.first_name,
        last_name: form.last_name,
        email: user.email ?? form.email,
        phone: form.phone,
        address: form.address || null,
        city: form.city || null,
        postcode: form.postcode || null,
        rtw_eligible: form.rtw_eligible,
        rtw_type: form.rtw_type || null,
        ni_number: form.ni_number || null,
        years_experience: form.years_experience || null,
        experience_types: form.experience_types,
        own_equipment: form.own_equipment || null,
        driving_licence: form.driving_licence || null,
        notice_period: form.notice_period || null,
        current_employer: form.current_employer || null,
        current_job_title: form.current_job_title || null,
        reason_for_leaving: form.reason_for_leaving || null,
        health_declaration: form.health_declaration || null,
        health_details: form.health_details || null,
        own_transport: form.own_transport || null,
        has_convictions: form.has_convictions || null,
        convictions_details: form.convictions_details || null,
        date_of_birth: form.date_of_birth || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        heard_about_us: form.heard_about_us || null,
        ref1_name: form.ref1_name || null,
        ref1_company: form.ref1_company || null,
        ref1_phone: form.ref1_phone || null,
        ref1_email: form.ref1_email || null,
        ref2_name: form.ref2_name || null,
        ref2_company: form.ref2_company || null,
        ref2_phone: form.ref2_phone || null,
        ref2_email: form.ref2_email || null,
        equal_opps_gender: form.equal_opps_gender || null,
        equal_opps_age: form.equal_opps_age || null,
        equal_opps_ethnicity: form.equal_opps_ethnicity || null,
        equal_opps_disability: form.equal_opps_disability || null,
        equal_opps_sexual_orientation: form.equal_opps_sexual_orientation || null,
        equal_opps_religion: form.equal_opps_religion || null,
        has_staff_relationship: form.has_staff_relationship || null,
        staff_relationship_details: form.staff_relationship_details || null,
        cv_url: uploadedUrls.cv || null,
        id_proof_url: uploadedUrls.id_proof || null,
        rtw_doc_url: uploadedUrls.rtw_doc || null,
        dbs_cert_url: uploadedUrls.dbs_cert || null,
        status: "pending",
      });

      if (insertErr) throw new Error(insertErr.message);

      // keep profiles (master) and staff table in sync with the latest personal data
      const contactPatch = {
        full_name: `${form.first_name} ${form.last_name}`.trim() || null,
        phone:     form.phone    || null,
        address:   form.address  || null,
        city:      form.city     || null,
        postcode:  form.postcode || null,
      };
      await Promise.all([
        supabase.from("profiles").upsert({ id: user.id, ...contactPatch }, { onConflict: "id" }),
        supabase.from("staff").update({ phone: contactPatch.phone, city: contactPatch.city, postcode: contactPatch.postcode }).eq("user_id", user.id),
      ]);

      clearDraft(form.email);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      if (uploadedPaths.length) {
        await supabase.storage.from("applications").remove(uploadedPaths);
      }
      setError((err as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Application received!</h1>
          <p className="text-gray-500 mb-6">
            Thanks for applying. We'll review your application and get back to you within <strong>3–5 working days</strong>.
          </p>
          <button onClick={() => (window.location.href = "/")} className="btn-primary px-8">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Careers</h1>
          <p className="text-gray-500 mb-6">Please log in to view your applications or apply.</p>
          <button onClick={() => (window.location.href = "/login")} className="btn-primary px-8">
            Log in
          </button>
        </div>
      </div>
    );
  }

  if (!activeRecruitment && !showNewApplication) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-xl w-full text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">We’re not recruiting right now</h1>
          <p className="text-gray-500 mb-6">If you’ve applied before, you can still view your application status below.</p>

          {myApplications.length > 0 ? (
            <div className="card text-left space-y-3">
              <div>
                <p className="font-bold text-gray-900">Your applications</p>
                <p className="text-xs text-gray-500">Latest first</p>
              </div>
              <div className="divide-y divide-gray-100">
                {myApplications.map((a) => (
                  <div key={a.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{a.role}</p>
                      <p className="text-xs text-gray-500">Submitted {new Date(a.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card text-gray-500">No applications yet.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="green-gradient py-12 px-4 text-center text-white">
        <h1 className="text-3xl md:text-4xl font-black mb-3">Join MakeMeClean</h1>
        <p className="text-green-100 max-w-lg mx-auto">
          Flexible hours, competitive pay, and a team that looks after its people.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-green-100">
          {[
            { icon: PoundSterling, text: "Competitive pay" },
            { icon: Clock, text: "Flexible hours" },
            { icon: MapPin, text: "Work locally" },
            { icon: Heart, text: "Great culture" },
            { icon: Leaf, text: "Eco products" },
            { icon: Users, text: "Full training" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5">
              <Icon className="w-4 h-4 text-green-300" /> {text}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">

        {/* ── Prefill modal ── */}
        {prefillOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !prefillLoading && setPrefillOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <p className="text-base font-extrabold text-gray-900">Use previous information?</p>
                <p className="text-sm text-gray-500 mt-0.5">Save time by pre-filling this application with details from a previous one.</p>
              </div>

              {prefillStage === "ask" ? (
                <div className="px-6 py-5 space-y-3">
                  <button
                    onClick={() => setPrefillStage("choose")}
                    className="w-full text-left px-4 py-3.5 rounded-xl border-2 border-green-500 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <p className="text-sm font-bold text-green-800">Yes, choose a previous application</p>
                    <p className="text-xs text-green-600 mt-0.5">Your details will be pre-filled — you can edit anything before submitting.</p>
                  </button>
                  <button
                    onClick={() => { setPrefillOpen(false); setShowNewApplication(true); setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-bold text-gray-800">No, start with a blank form</p>
                    <p className="text-xs text-gray-500 mt-0.5">Fill in everything from scratch.</p>
                  </button>
                </div>
              ) : (
                <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
                  {prefillLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    myApplications.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => applyPrefill(a.id)}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors"
                      >
                        <p className="text-sm font-bold text-gray-900">{a.role}</p>
                        <p className="text-xs text-gray-500">
                          Submitted {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                          <span className="ml-2 capitalize font-medium text-gray-600">· {a.status}</span>
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}

              {prefillStage === "choose" && !prefillLoading && (
                <div className="px-6 pb-5">
                  <button onClick={() => setPrefillStage("ask")} className="text-sm text-gray-400 hover:text-gray-600 mt-2">← Back</button>
                </div>
              )}
            </div>
          </div>
        )}

        {!showNewApplication && (
          <div className="card mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Recruitment</p>
                <p className="text-lg font-extrabold text-gray-900 truncate">{activeRecruitment ? activeRecruitment.title.replace(/\s+\d{2}\/\d{2}\/\d{4}(\s+\d{2}:\d{2})?$/, "").trim() : "Open"}</p>
                {myApplications.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    You can start a new application if you don’t already have one in progress for the same role.
                  </p>
                )}
              </div>
              {activeRecruitment && (
                <button
                  className="btn-primary text-sm py-2"
                  onClick={() => {
                    if (myApplications.length > 0) {
                      setPrefillStage("ask");
                      setPrefillOpen(true);
                    } else {
                      setShowNewApplication(true);
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  New application
                </button>
              )}
            </div>

            {myApplications.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100">
                {myApplications.map((a) => (
                  <div key={a.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{a.role}</p>
                      <p className="text-xs text-gray-500">Submitted {new Date(a.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step indicator — only show when past email verification and form is open */}
        {emailStage === "verified" && showNewApplication && (
          <div className="flex items-start justify-center mb-8">
            {[["1", "Position & Contact"], ["2", "Experience"], ["3", "References"], ["4", "Documents"]].map(([n, label], i) => (
              <div key={n} className="flex items-start">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                    parseInt(n) < step ? "bg-green-600 border-green-600 text-white"
                    : parseInt(n) === step ? "border-green-600 text-green-700"
                    : "border-gray-200 text-gray-400"
                  }`}>
                    {parseInt(n) < step ? "✓" : n}
                  </div>
                  <span className={`text-xs font-medium text-center w-16 leading-tight ${parseInt(n) <= step ? "text-green-700" : "text-gray-400"}`}>{label}</span>
                </div>
                {i < 3 && <div className={`w-8 h-px mt-3.5 shrink-0 ${parseInt(n) < step ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        )}

        {!showNewApplication && (
          <div className="text-center text-sm text-gray-500">
            {activeRecruitment ? "Click New application to apply." : "Recruitment is closed."}
          </div>
        )}

        {/* ── Email entry ── */}
        {emailStage === "entry" && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Start your application</h2>
              <p className="text-sm text-gray-500">
                Enter your email to begin. We'll send a code to verify it — your progress is saved automatically so you can return anytime.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <label className="label">Email address *</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
              {hasDraft && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  Only work preferences are saved in this tab. Verify your email to continue; private details must be entered again.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!form.email || sendingOtp}
              onClick={handleSendOtp}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingOtp ? "Sending code..." : "Send verification code"}
            </button>
          </div>
        )}

        {/* ── OTP verification ── */}
        {emailStage === "verify" && (
          <div className="card space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to <strong>{form.email}</strong>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 text-center mb-4 uppercase tracking-wide">Enter verification code</p>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    disabled={verifying}
                    className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all disabled:opacity-50 bg-white"
                  />
                ))}
              </div>
              {verifying && (
                <p className="text-center text-xs text-gray-400 mt-3">Verifying...</p>
              )}
            </div>

            <div className="text-center space-y-2">
              <button
                onClick={resendCode}
                disabled={resendCooldown > 0}
                className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
              <br />
              <button
                onClick={() => { setEmailStage("entry"); setError(""); setOtp(["", "", "", "", "", ""]); }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Position & Contact ── */}
        {emailStage === "verified" && showNewApplication && step === 1 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Position & Contact</h2>
              <p className="text-sm text-gray-500">Tell us the role you want and how to reach you.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <label className="label">Employment type</label>
              <div className="flex flex-wrap gap-2">
                {["Part-time", "Full-time", "Flexible / Zero Hours", "Weekends Only"].map((t) => (
                  <Chip key={t} active={form.employment_type === t} onClick={() => set("employment_type", t)}>{t}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Days available</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <Chip key={d} active={form.available_days.includes(d)} onClick={() => toggle("available_days", d)}>{d}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Hours available per week</label>
              <div className="flex flex-wrap gap-2">
                {["Up to 10 hours", "10–20 hours", "20–30 hours", "30–40 hours", "40+ hours (full time)"].map((h) => (
                  <Chip key={h} active={form.available_hours === h} onClick={() => set("available_hours", h)}>{h}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Earliest start date</label>
              <input type="date" className="input-field" value={form.earliest_start} onChange={(e) => set("earliest_start", e.target.value)} />
            </div>

            <div>
              <label className="label">Notice period (current employer)</label>
              <select className="input-field" value={form.notice_period} onChange={(e) => set("notice_period", e.target.value)}>
                <option value="">Select</option>
                {["I am currently unemployed", "Immediate / less than 1 week", "1 week", "2 weeks", "1 month", "More than 1 month"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>

            <hr className="border-gray-100" />

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">First name *</label>
                <input className="input-field" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
              </div>
              <div>
                <label className="label">Last name *</label>
                <input className="input-field" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
              </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{form.email}</p>
                <p className="text-xs text-green-600">Email verified</p>
              </div>
            </div>

            <div>
              <label className="label">Phone *</label>
              <input type="tel" className="input-field" placeholder="+44 7000 000000" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input-field" placeholder="House number and street" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">City / Town</label>
                <input className="input-field" placeholder="e.g. Cardiff" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <label className="label">Postcode</label>
                <input className="input-field" placeholder="e.g. CF10 1AB" value={form.postcode} onChange={(e) => set("postcode", e.target.value.toUpperCase())} />
              </div>
            </div>

            <div>
              <label className="label">Date of birth</label>
              <input type="date" className="input-field" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
            </div>

            <hr className="border-gray-100" />

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Emergency contact name</label>
                <input className="input-field" placeholder="Full name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
              </div>
              <div>
                <label className="label">Emergency contact phone</label>
                <input type="tel" className="input-field" placeholder="+44 7000 000000" value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">How did you hear about us?</label>
              <select className="input-field" value={form.heard_about_us} onChange={(e) => set("heard_about_us", e.target.value)}>
                <option value="">Select</option>
                {["Social media (Facebook, Instagram, etc.)", "Google / Search engine", "Word of mouth / friend", "Job board (Indeed, Reed, etc.)", "MakeMeClean website", "Leaflet / flyer", "Other"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={
                !form.first_name ||
                !form.last_name ||
                !form.phone ||
                myApplications.some(
                  (a) =>
                    (a.recruitment_id ?? "") === (activeRecruitment?.id ?? "") &&
                    (a.role ?? "") === form.role &&
                    !["rejected", "hired"].includes((a.status ?? "").toLowerCase())
                )
              }
              onClick={() => goToStep(2)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Experience & RTW ── */}
        {emailStage === "verified" && showNewApplication && step === 2 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Experience & Eligibility</h2>
              <p className="text-sm text-gray-500">Tell us about your background and right to work.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <label className="label">Years of cleaning experience</label>
              <select className="input-field" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)}>
                <option value="">Select</option>
                {["Less than 1 year", "1–2 years", "3–5 years", "6–10 years", "10+ years"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Types of experience</label>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_TYPES.map((t) => (
                  <Chip key={t} active={form.experience_types.includes(t)} onClick={() => toggle("experience_types", t)}>{t}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Own cleaning equipment?</label>
              <div className="flex gap-2">
                {["Yes", "No", "Some"].map((v) => (
                  <Chip key={v} active={form.own_equipment === v.toLowerCase()} onClick={() => set("own_equipment", v.toLowerCase())}>{v}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Full UK driving licence?</label>
              <div className="flex gap-2">
                <Chip active={form.driving_licence === "yes"} onClick={() => set("driving_licence", "yes")}>Yes</Chip>
                <Chip active={form.driving_licence === "no"} onClick={() => set("driving_licence", "no")}>No</Chip>
              </div>
            </div>

            <div>
              <label className="label">Most recent employer (if applicable)</label>
              <input className="input-field" placeholder="Company name" value={form.current_employer} onChange={(e) => set("current_employer", e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Job title</label>
                <input className="input-field" placeholder="e.g. Cleaner" value={form.current_job_title} onChange={(e) => set("current_job_title", e.target.value)} />
              </div>
              <div>
                <label className="label">Reason for leaving</label>
                <input className="input-field" placeholder="e.g. Seeking new opportunity" value={form.reason_for_leaving} onChange={(e) => set("reason_for_leaving", e.target.value)} />
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className="label">Health declaration *</label>
              <p className="text-xs text-gray-400 mb-2">Do you have any physical or mental health condition or disability that may affect your ability to carry out cleaning duties?</p>
              <div className="flex gap-2">
                <Chip active={form.health_declaration === "no"} onClick={() => set("health_declaration", "no")}>No</Chip>
                <Chip active={form.health_declaration === "yes"} onClick={() => set("health_declaration", "yes")}>Yes</Chip>
                <Chip active={form.health_declaration === "prefer_not"} onClick={() => set("health_declaration", "prefer_not")}>Prefer not to say</Chip>
              </div>
            </div>

            {form.health_declaration === "yes" && (
              <div>
                <label className="label">Please describe and state any reasonable adjustments needed</label>
                <textarea className="input-field resize-none" rows={3} value={form.health_details} onChange={(e) => set("health_details", e.target.value)} placeholder="Nature of condition and any adjustments required..." />
              </div>
            )}

            <div>
              <label className="label">Own a car / reliable transport?</label>
              <div className="flex gap-2">
                <Chip active={form.own_transport === "yes"} onClick={() => set("own_transport", "yes")}>Yes</Chip>
                <Chip active={form.own_transport === "no"} onClick={() => set("own_transport", "no")}>No</Chip>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className="label">Legally entitled to work in the UK? *</label>
              <div className="flex gap-2">
                <Chip active={form.rtw_eligible === "yes"} onClick={() => set("rtw_eligible", "yes")}>Yes</Chip>
                <Chip active={form.rtw_eligible === "no"} onClick={() => set("rtw_eligible", "no")}>No</Chip>
              </div>
              {form.rtw_eligible === "no" && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  We can only employ individuals legally entitled to work in the UK.
                </p>
              )}
            </div>

            {form.rtw_eligible === "yes" && (
              <div>
                <label className="label">Right to work document type</label>
                <select className="input-field" value={form.rtw_type} onChange={(e) => set("rtw_type", e.target.value)}>
                  <option value="">Select</option>
                  {RTW_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}

            {form.rtw_eligible === "yes" && (
              <div>
                <label className="label">National Insurance number (if you have one)</label>
                <input className="input-field font-mono tracking-widest" placeholder="AB 12 34 56 C" value={form.ni_number} onChange={(e) => set("ni_number", e.target.value.toUpperCase())} />
              </div>
            )}

            <hr className="border-gray-100" />

            <div>
              <label className="label">Any criminal convictions? *</label>
              <p className="text-xs text-gray-400 mb-2">You are not required to disclose spent convictions under the Rehabilitation of Offenders Act 1974.</p>
              <div className="flex gap-2">
                <Chip active={form.has_convictions === "no"} onClick={() => set("has_convictions", "no")}>No</Chip>
                <Chip active={form.has_convictions === "yes"} onClick={() => set("has_convictions", "yes")}>Yes — I wish to disclose</Chip>
              </div>
            </div>

            {form.has_convictions === "yes" && (
              <div>
                <label className="label">Please provide details</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Nature of offence, date, outcome..."
                  value={form.convictions_details}
                  onChange={(e) => set("convictions_details", e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => goToStep(1)} className="btn-secondary">Back</button>
              <button
                type="button"
                disabled={!form.rtw_eligible || form.rtw_eligible === "no"}
                onClick={() => goToStep(3)}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: References ── */}
        {emailStage === "verified" && showNewApplication && step === 3 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">References</h2>
              <p className="text-sm text-gray-500">Please provide two professional or character references. We may contact them before offering employment.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Reference 1</p>
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Full name *</label>
                    <input className="input-field" placeholder="Jane Smith" value={form.ref1_name} onChange={(e) => set("ref1_name", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Company / Organisation</label>
                    <input className="input-field" placeholder="ABC Cleaning Ltd" value={form.ref1_company} onChange={(e) => set("ref1_company", e.target.value)} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input type="tel" className="input-field" placeholder="+44 7000 000000" value={form.ref1_phone} onChange={(e) => set("ref1_phone", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input-field" placeholder="jane@example.com" value={form.ref1_email} onChange={(e) => set("ref1_email", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Reference 2</p>
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Full name *</label>
                    <input className="input-field" placeholder="John Doe" value={form.ref2_name} onChange={(e) => set("ref2_name", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Company / Organisation</label>
                    <input className="input-field" placeholder="XYZ Services" value={form.ref2_company} onChange={(e) => set("ref2_company", e.target.value)} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input type="tel" className="input-field" placeholder="+44 7000 000000" value={form.ref2_phone} onChange={(e) => set("ref2_phone", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input-field" placeholder="john@example.com" value={form.ref2_email} onChange={(e) => set("ref2_email", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => goToStep(2)} className="btn-secondary">Back</button>
              <button
                type="button"
                disabled={!form.ref1_name || !form.ref2_name}
                onClick={() => goToStep(4)}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Documents & Submit ── */}
        {emailStage === "verified" && showNewApplication && step === 4 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Documents & Declaration</h2>
              <p className="text-sm text-gray-500">Upload your documents and confirm the declaration.</p>
            </div>

            {FILE_FIELDS.map((field) => {
              const file = files[field.key];
              return (
                <div key={field.key}>
                  <label className="label">{field.label}</label>
                  <input
                    type="file"
                    accept={field.accept}
                    ref={(el) => { fileRefs.current[field.key] = el; }}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFiles((prev) => ({ ...prev, [field.key]: f }));
                    }}
                  />
                  {file ? (
                    <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-3 py-2.5">
                      <span className="text-sm text-green-800 font-medium truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles((p) => ({ ...p, [field.key]: null }));
                          if (fileRefs.current[field.key]) fileRefs.current[field.key]!.value = "";
                        }}
                        className="ml-2 text-green-600 hover:text-red-500 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRefs.current[field.key]?.click()}
                      className="w-full border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Choose file
                    </button>
                  )}
                </div>
              );
            })}

            <hr className="border-gray-100" />

            {/* Equal opportunities monitoring */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-4 space-y-4">
              <div>
                <p className="text-sm font-bold text-blue-900">Equal Opportunities Monitoring</p>
                <p className="text-xs text-blue-600 mt-0.5">This information is collected anonymously for monitoring purposes only. It will not be seen by the hiring team and will not affect your application.</p>
              </div>
              <div>
                <label className="label text-blue-800">Gender</label>
                <select className="input-field text-sm" value={form.equal_opps_gender} onChange={(e) => set("equal_opps_gender", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  {["Male", "Female", "Non-binary", "Self-describe", "Prefer not to say"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-blue-800">Age band</label>
                <select className="input-field text-sm" value={form.equal_opps_age} onChange={(e) => set("equal_opps_age", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  {["Under 25", "25–34", "35–44", "45–54", "55–64", "65 or over", "Prefer not to say"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-blue-800">Ethnic origin <span className="font-normal text-blue-500">(ONS 2021 Census)</span></label>
                <select className="input-field text-sm" value={form.equal_opps_ethnicity} onChange={(e) => set("equal_opps_ethnicity", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <optgroup label="White">
                    <option>White – English / Welsh / Scottish / Northern Irish / British</option>
                    <option>White – Irish</option>
                    <option>White – Gypsy or Irish Traveller</option>
                    <option>White – Roma</option>
                    <option>White – Any other White background</option>
                  </optgroup>
                  <optgroup label="Mixed or Multiple ethnic groups">
                    <option>Mixed – White and Black Caribbean</option>
                    <option>Mixed – White and Black African</option>
                    <option>Mixed – White and Asian</option>
                    <option>Mixed – Any other Mixed or Multiple background</option>
                  </optgroup>
                  <optgroup label="Asian or Asian British">
                    <option>Asian or Asian British – Indian</option>
                    <option>Asian or Asian British – Pakistani</option>
                    <option>Asian or Asian British – Bangladeshi</option>
                    <option>Asian or Asian British – Chinese</option>
                    <option>Asian or Asian British – Any other Asian background</option>
                  </optgroup>
                  <optgroup label="Black, African, Caribbean or Black British">
                    <option>Black, African, Caribbean or Black British – African</option>
                    <option>Black, African, Caribbean or Black British – Caribbean</option>
                    <option>Black, African, Caribbean or Black British – Any other Black, African or Caribbean background</option>
                  </optgroup>
                  <optgroup label="Other ethnic group">
                    <option>Other ethnic group – Arab</option>
                    <option>Other ethnic group – Any other ethnic group</option>
                  </optgroup>
                  <option>Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="label text-blue-800">Do you consider yourself to have a disability?</label>
                <select className="input-field text-sm" value={form.equal_opps_disability} onChange={(e) => set("equal_opps_disability", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  {["Yes", "No", "Prefer not to say"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-blue-800">Sexual orientation</label>
                <select className="input-field text-sm" value={form.equal_opps_sexual_orientation} onChange={(e) => set("equal_opps_sexual_orientation", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  {["Heterosexual / Straight", "Gay or Lesbian", "Bisexual", "Pansexual", "Asexual", "Other", "Prefer not to say"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-blue-800">Religion or belief</label>
                <select className="input-field text-sm" value={form.equal_opps_religion} onChange={(e) => set("equal_opps_religion", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  {["No religion", "Christian (including Church of England, Catholic, Protestant and all other Christian denominations)", "Buddhist", "Hindu", "Jewish", "Muslim", "Sikh", "Any other religion or belief", "Prefer not to say"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Staff relationship */}
            <div>
              <label className="label">Personal or family relationship with any current MakeMeClean employee? *</label>
              <div className="flex gap-2">
                <Chip active={form.has_staff_relationship === "no"} onClick={() => set("has_staff_relationship", "no")}>No</Chip>
                <Chip active={form.has_staff_relationship === "yes"} onClick={() => set("has_staff_relationship", "yes")}>Yes</Chip>
              </div>
            </div>
            {form.has_staff_relationship === "yes" && (
              <div>
                <label className="label">Please provide their name and relationship to you</label>
                <input className="input-field" placeholder="e.g. John Smith – brother" value={form.staff_relationship_details} onChange={(e) => set("staff_relationship_details", e.target.value)} />
              </div>
            )}

            <hr className="border-gray-100" />

            {/* Declarations */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Declarations</p>

              {[
                {
                  key: "declare_accurate" as const,
                  text: (
                    <>I confirm that the information I have provided is accurate and complete. I understand that providing false or misleading information will disqualify my application, or may result in dismissal if discovered after employment commences.</>
                  ),
                },
                {
                  key: "declare_privacy" as const,
                  text: (
                    <>I consent to MakeMeClean storing and processing my personal data for the purposes of this recruitment process, in accordance with the UK GDPR and Data Protection Act 2018. I have read the{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">Privacy Policy</a>.</>
                  ),
                },
                {
                  key: "declare_dbs_consent" as const,
                  text: (
                    <>I consent to a Disclosure and Barring Service (DBS) check being carried out as part of the employment process if required.</>
                  ),
                },
                {
                  key: "declare_references_consent" as const,
                  text: (
                    <>I consent to MakeMeClean contacting the references I have provided. I confirm that the referees are aware that they may be contacted.</>
                  ),
                },
                {
                  key: "declare_terms" as const,
                  text: (
                    <>I have read and accept MakeMeClean's{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">Terms &amp; Conditions</a>
                      {" "}and{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">Privacy Policy</a>
                      {" "}and understand they govern my engagement with MakeMeClean.</>
                  ),
                },
              ].map(({ key, text }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => set(key, !form[key])}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      form[key]
                        ? "bg-green-600 border-green-600"
                        : "border-gray-300 bg-white group-hover:border-green-400"
                    }`}
                  >
                    {form[key] && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm text-gray-600 leading-snug">{text}</span>
                </label>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => goToStep(3)} className="btn-secondary">Back</button>
              <button
                type="button"
                disabled={submitting || !files.cv || !files.id_proof || !files.rtw_doc || !form.declare_accurate || !form.declare_privacy || !form.declare_dbs_consent || !form.declare_references_consent || !form.declare_terms}
                onClick={handleSubmit}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
