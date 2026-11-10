import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  Pause,
  Play,
  X,
  ArrowRight,
  Repeat,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";
import { RecurringPlan } from "@/types";
import { FREQ_LABELS } from "@/lib/constants";
import { api } from "@/lib/apiClient";

const FREQ_COLORS: Record<string, string> = {
  weekly: "bg-green-50 text-green-700 border-green-200",
  fortnightly: "bg-blue-50 text-blue-700 border-blue-200",
  monthly: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

export default function MyPlans() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [fetching, setFetching] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    api
      .getPlans()
      .then((data) => {
        setPlans((data as RecurringPlan[]) ?? []);
        setFetching(false);
      })
      .catch(() => {
        setFetching(false);
      });
  }, [user]);

  const updateStatus = async (
    id: string,
    status: "active" | "paused" | "cancelled"
  ) => {
    setActionId(id);
    try {
      await api.updatePlanStatus(id, status);
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch (_) {}
    setActionId(null);
  };

  const activePlans = plans.filter((p) => p.status !== "cancelled");
  const cancelledPlans = plans.filter((p) => p.status === "cancelled");

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
                <Repeat className="w-5 h-5 text-green-600" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                My Plans
              </h1>
            </div>
            <p className="text-gray-500 text-sm">
              Your recurring cleaning schedules.
            </p>
          </div>
          <Link
            href="/book"
            className="btn-primary flex items-center gap-2 text-sm shrink-0"
          >
            Book a New Plan <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {activePlans.length === 0 && cancelledPlans.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-20 text-center px-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Repeat className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">
              No recurring plans yet
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Set up a weekly, fortnightly, or monthly clean and save up to 15%
              on every visit.
            </p>
            <Link
              href="/book"
              className="btn-primary inline-flex items-center gap-2"
            >
              Set Up a Plan <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {activePlans.length > 0 && (
              <div className="space-y-4 mb-8">
                {activePlans.map((plan) => {
                  const isLoading = actionId === plan.id;
                  const endHour = (() => {
                    const [h, m] = plan.start_time.split(":").map(Number);
                    const endMins = h * 60 + m + plan.duration_hours * 60;
                    const pad = (n: number) => String(n).padStart(2, "0");
                    return `${pad(Math.floor(endMins / 60))}:${pad(
                      endMins % 60
                    )}`;
                  })();
                  return (
                    <div
                      key={plan.id}
                      className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
                    >
                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-base font-black text-gray-900 mb-2">
                              {plan.service_name}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={cn(
                                   "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                                   FREQ_COLORS[plan.frequency]
                                 )}
                               >
                                 {FREQ_LABELS[plan.frequency]}
                               </span>
                               <span
                                 className={cn(
                                   "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                                   STATUS_COLORS[plan.status]
                                 )}
                               >
                                 {plan.status.charAt(0).toUpperCase() +
                                   plan.status.slice(1)}
                               </span>
                               {plan.discount_percent > 0 && (
                                 <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                   {plan.discount_percent}% off
                                 </span>
                               )}
                             </div>
                           </div>
                           <div className="text-right">
                             <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                               Per visit
                             </p>
                             <p className="text-xl font-black text-green-600">
                               {formatCurrency(plan.price_per_visit)}
                             </p>
                           </div>
                         </div>
 
                         <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-600 mb-4">
                           <div className="flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5 text-gray-400" />
                             {plan.start_time} – {endHour} ({plan.duration_hours}
                             h)
                           </div>
                           <div className="flex items-center gap-2">
                             <MapPin className="w-3.5 h-3.5 text-gray-400" />
                             {plan.city}
                           </div>
                           <div className="flex items-center gap-2">
                             <Calendar className="w-3.5 h-3.5 text-gray-400" />
                             {plan.next_booking_date ? (
                               <span>
                                 Next:{" "}
                                 <strong className="text-gray-900">
                                   {new Date(plan.next_booking_date).toLocaleDateString(
                                     "en-GB",
                                     { day: "numeric", month: "short", year: "numeric" }
                                   )}
                                 </strong>
                               </span>
                             ) : (
                               <span>
                                 Since{" "}
                                 {new Date(plan.created_at).toLocaleDateString(
                                   "en-GB",
                                   { month: "short", year: "numeric" }
                                 )}
                               </span>
                             )}
                           </div>
                         </div>
 
                         <div className="text-xs text-gray-400 mb-4">
                           {plan.address}, {plan.city}, {plan.postcode}
                         </div>
 
                         <div className="flex gap-2 flex-wrap">
                           {plan.status === "active" ? (
                             <button
                               onClick={() => updateStatus(plan.id, "paused")}
                               disabled={isLoading}
                               className="flex items-center gap-1.5 px-4 py-2 border border-amber-200 text-amber-600 font-semibold text-xs rounded-xl hover:bg-amber-50 transition-colors disabled:opacity-50"
                             >
                               <Pause className="w-3.5 h-3.5" /> Pause
                             </button>
                           ) : plan.status === "paused" ? (
                             <button
                               onClick={() => updateStatus(plan.id, "active")}
                               disabled={isLoading}
                               className="flex items-center gap-1.5 px-4 py-2 border border-green-200 text-green-600 font-semibold text-xs rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50"
                             >
                               <Play className="w-3.5 h-3.5" /> Resume
                             </button>
                           ) : null}
                           <button
                             onClick={() => updateStatus(plan.id, "cancelled")}
                             disabled={isLoading || plan.status === "cancelled"}
                             className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-500 font-semibold text-xs rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                           >
                             <X className="w-3.5 h-3.5" /> Cancel Plan
                           </button>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
 
             {cancelledPlans.length > 0 && (
               <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                   Cancelled plans
                 </p>
                 <div className="space-y-3">
                   {cancelledPlans.map((plan) => (
                     <div
                       key={plan.id}
                       className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 opacity-60"
                     >
                       <div className="flex items-center justify-between gap-4">
                         <div>
                           <p className="font-bold text-gray-900 text-sm">
                             {plan.service_name}
                           </p>
                           <p className="text-xs text-gray-400 mt-0.5">
                             {FREQ_LABELS[plan.frequency]} · {plan.city}
                           </p>
                         </div>
                         <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-red-50 text-red-500 border-red-200">
                           Cancelled
                         </span>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}
           </>
         )}
       </div>
     </div>
   );
 }
