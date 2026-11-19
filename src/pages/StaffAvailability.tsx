import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Save, CheckCircle, Clock, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRecord } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { DAYS, getUpcomingWeeks, formatWeekRange } from "@/lib/payroll";
import StaffLayout from "@/components/staff/StaffLayout";

type DaySlot = { from: string; to: string } | null;
type WeekSlots = Record<string, DaySlot>;

const DEFAULT_SLOTS: WeekSlots = Object.fromEntries(DAYS.map((d) => [d, null]));

function Spinner() {
  return <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />;
}

function isDirty(slots: WeekSlots) {
  return Object.values(slots).some((s) => s !== null);
}

export default function StaffAvailability() {
  const { user, loading } = useAuth();
  const [, setLocation]   = useLocation();
  const { staff, loading: staffLoading } = useStaffRecord(user?.id);

  const [weeks]   = useState<string[]>(() => getUpcomingWeeks(4));
  const [avail, setAvail]   = useState<Record<string, WeekSlots>>({});
  const [notes, setNotes]   = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving]     = useState<Record<string, boolean>>({});
  const [saved,  setSaved]      = useState<Record<string, boolean>>({});

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading]);

  useEffect(() => {
    if (staffLoading) return;
    if (!staff?.id) {
      setFetching(false);
      return;
    }
    supabase
      .from("staff_availability")
      .select("week_start, day_slots, notes")
      .eq("staff_id", staff.id)
      .in("week_start", weeks)
      .then(({ data }) => {
        const aMap: Record<string, WeekSlots> = {};
        const nMap: Record<string, string>    = {};
        for (const row of data ?? []) {
          aMap[row.week_start] = { ...DEFAULT_SLOTS, ...(row.day_slots ?? {}) };
          nMap[row.week_start] = row.notes ?? "";
        }
        setAvail(aMap);
        setNotes(nMap);
        setFetching(false);
      });
  }, [staff?.id, staffLoading]);

  const getWeek  = (ws: string): WeekSlots => avail[ws] ?? { ...DEFAULT_SLOTS };
  const getNote  = (ws: string): string    => notes[ws]  ?? "";

  const toggleDay = (ws: string, day: string) => {
    const slots = getWeek(ws);
    const next: WeekSlots = {
      ...slots,
      [day]: slots[day] ? null : { from: "00:00", to: "23:59" },
    };
    setAvail((p) => ({ ...p, [ws]: next }));
    setSaved((p) => ({ ...p, [ws]: false }));
  };

  const setTime = (ws: string, day: string, field: "from" | "to", value: string) => {
    const slots = getWeek(ws);
    const current = slots[day] ?? { from: "00:00", to: "23:59" };
    setAvail((p) => ({ ...p, [ws]: { ...slots, [day]: { ...current, [field]: value } } }));
    setSaved((p) => ({ ...p, [ws]: false }));
  };

  const saveWeek = async (ws: string) => {
    if (!staff?.id) return;
    setSaving((p) => ({ ...p, [ws]: true }));
    await supabase.from("staff_availability").upsert(
      {
        staff_id:   staff.id,
        week_start: ws,
        day_slots:  getWeek(ws),
        notes:      getNote(ws) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,week_start" }
    );
    setSaving((p) => ({ ...p, [ws]: false }));
    setSaved((p)  => ({ ...p, [ws]: true }));
    setTimeout(() => setSaved((p) => ({ ...p, [ws]: false })), 2500);
  };

  if (loading || staffLoading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md w-full shadow-sm">
          <p className="text-lg font-black text-gray-900 mb-1">Active staff profile required</p>
          <p className="text-sm text-gray-500">Your account is not linked to an active staff profile.</p>
        </div>
      </div>
    );
  }

  return (
    <StaffLayout title="My Availability" subtitle="Set your available hours for each day of the week">
      <div className="space-y-5">
        {weeks.map((ws, wi) => {
          const slots     = getWeek(ws);
          const isSaving  = saving[ws];
          const isDone    = saved[ws];
          const activeDays = DAYS.filter((d) => slots[d] !== null);

          return (
            <div key={ws} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

              {/* Week header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-black text-gray-900">{formatWeekRange(ws)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {wi === 0 && (
                      <span className="text-xs font-semibold text-green-600">Current week</span>
                    )}
                    {activeDays.length > 0 && (
                      <span className="text-xs text-gray-400">{activeDays.length} day{activeDays.length !== 1 ? "s" : ""} available</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => saveWeek(ws)}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                  )}
                >
                  {isSaving ? <><Spinner /> Saving…</>
                    : isDone ? <><CheckCircle className="w-4 h-4" /> Saved</>
                    : <><Save className="w-4 h-4" /> Save</>}
                </button>
              </div>

              {/* Day rows */}
              <div className="divide-y divide-gray-50">
                {DAYS.map((day) => {
                  const slot   = slots[day];
                  const active = slot !== null;

                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3.5 transition-colors",
                        active ? "bg-green-50/40" : "bg-white"
                      )}
                    >
                      {/* Toggle */}
                      <button
                        onClick={() => toggleDay(ws, day)}
                        className="shrink-0 flex items-center gap-2 focus:outline-none"
                        aria-label={active ? `Disable ${day}` : `Enable ${day}`}
                      >
                        {active
                          ? <ToggleRight className="w-7 h-7 text-green-600" />
                          : <ToggleLeft  className="w-7 h-7 text-gray-300" />}
                        <span className={cn(
                          "w-9 text-sm font-bold",
                          active ? "text-gray-900" : "text-gray-400"
                        )}>
                          {day}
                        </span>
                      </button>

                      {/* Time pickers or "Unavailable" */}
                      {active ? (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <Clock className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          <input
                            type="time"
                            value={slot!.from}
                            onChange={(e) => setTime(ws, day, "from", e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                          />
                          <span className="text-xs text-gray-400 font-semibold">to</span>
                          <input
                            type="time"
                            value={slot!.to}
                            onChange={(e) => setTime(ws, day, "to", e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                          />
                          <span className="text-xs text-gray-400 ml-1">
                            ({(() => {
                              const [fh, fm] = slot!.from.split(":").map(Number);
                              const [th, tm] = slot!.to.split(":").map(Number);
                              const hrs = (th * 60 + tm - fh * 60 - fm) / 60;
                              return hrs > 0 ? `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs` : "–";
                            })()})
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300 font-medium flex-1">Unavailable</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              <div className="px-5 py-4 border-t border-gray-50">
                <input
                  type="text"
                  placeholder="Notes for this week (optional)…"
                  value={getNote(ws)}
                  onChange={(e) => {
                    setNotes((p) => ({ ...p, [ws]: e.target.value }));
                    setSaved((p) => ({ ...p, [ws]: false }));
                  }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-600 placeholder:text-gray-300"
                />
              </div>

            </div>
          );
        })}
      </div>
    </StaffLayout>
  );
}
