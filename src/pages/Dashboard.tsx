import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Plus,
  LayoutDashboard,
  User,
  Star,
  Trophy,
  Repeat,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/lib/supabase";
import {
  cn,
  formatDate,
  formatCurrency,
  isActiveUpcomingBooking,
  isPastDate,
} from "@/lib/utils";
import { Booking } from "@/types";
import { BOOKING_STATUS_STYLES } from "@/lib/constants";
import Spinner from "@/components/Spinner";
import { api } from "@/lib/apiClient";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const settings = useSettings();
  const loyaltyEnabled = settings.loyalty_enabled === "true";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [counts, setCounts] = useState<{
    total: number;
    upcoming: number;
    completed: number;
    cancelled: number;
  } | null>(null);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>(
    {}
  );
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(
    null
  );
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getDashboard(),
      supabase.from("reviews").select("booking_id").eq("user_id", user.id),
    ])
      .then(([data, { data: rData }]) => {
        setBookings((data.recent_bookings as any) ?? []);
        if (data.counts) {
          setCounts({
            total: Number(data.counts.total ?? 0),
            upcoming: Number(data.counts.upcoming ?? 0),
            completed: Number(data.counts.completed ?? 0),
            cancelled: Number(data.counts.cancelled ?? 0),
          });
        }
        setProfile(data.profile);
        const imgMap: Record<string, string> = {};
        for (const svc of data.services ?? []) {
          if (svc.image_url) imgMap[svc.id] = svc.image_url;
        }
        setServiceImages(imgMap);
        setReviewedIds(new Set((rData ?? []).map((r: any) => r.booking_id)));
        setFetchingData(false);
      })
      .catch(() => {
        setFetchingData(false);
      });
  }, [user]);

  if (loading || fetchingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  const totalCount = counts?.total ?? bookings.length;
  const upcoming =
    counts?.upcoming ??
    bookings.filter((b) =>
      isActiveUpcomingBooking(b.status, b.date, b.time_slot, b.payment_status)
    ).length;
  const completed =
    counts?.completed ??
    bookings.filter((b) => b.status === "completed").length;
  const cancelled =
    counts?.cancelled ??
    bookings.filter((b) => b.status === "cancelled").length;
  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "there";
  const initial = (profile?.full_name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Greeting */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            {initial}
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Hello, {displayName}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Here's an overview of your account
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total", value: totalCount, color: "text-gray-900" },
            { label: "Upcoming", value: upcoming, color: "text-blue-600" },
            { label: "Completed", value: completed, color: "text-emerald-600" },
            { label: "Cancelled", value: cancelled, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {label}
              </p>
              <p className={cn("text-2xl font-black", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-4 gap-3 mb-8">
          {[
            {
              href: "/book",
              icon: Plus,
              label: "New Booking",
              sub: "Book a cleaning service",
            },
            {
              href: "/bookings",
              icon: Calendar,
              label: "My Bookings",
              sub: "View & manage bookings",
            },
            ...(loyaltyEnabled
              ? [
                  {
                    href: "/loyalty",
                    icon: Trophy,
                    label: "My Rewards",
                    sub: "View loyalty points",
                  },
                ]
              : [
                  {
                    href: "/plans",
                    icon: Repeat,
                    label: "My Plans",
                    sub: "Recurring clean plans",
                  },
                ]),
            {
              href: "/profile",
              icon: User,
              label: "My Profile",
              sub: "Edit your details",
            },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition-all flex items-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 text-sm">{label}</p>
                <p className="text-xs text-gray-400 truncate">{sub}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
            </Link>
          ))}
        </div>

        {/* Recent bookings */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                Recent Bookings
              </h2>
            </div>
            <Link
              href="/bookings"
              className="text-xs font-semibold text-green-600 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">
                No bookings yet
              </p>
              <Link
                href="/book"
                className="btn-primary inline-block mt-4 text-sm"
              >
                Book your first clean
              </Link>
            </div>
          ) : (
            <div>
              {bookings.map((b, i) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer",
                    i !== 0 && "border-t border-gray-50"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 overflow-hidden shrink-0">
                    {serviceImages[b.service_type] ? (
                      <img
                        src={serviceImages[b.service_type]}
                        alt={b.service_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">
                        🧹
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {b.service_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" /> {formatDate(b.date)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" /> {b.time_slot}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" /> {b.city}
                      </span>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-black text-gray-900">
                      {formatCurrency(b.price)}
                    </p>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        isActiveUpcomingBooking(b.status, b.date, b.time_slot, b.payment_status) &&
                          b.payment_status !== "paid"
                          ? "bg-amber-100 text-amber-700"
                          : BOOKING_STATUS_STYLES[b.status] ??
                            "bg-gray-100 text-gray-600"
                      )}
                    >
                      {isPastDate(b.date) && b.status === "upcoming"
                        ? "Past"
                        : isActiveUpcomingBooking(b.status, b.date, b.time_slot, b.payment_status) &&
                            b.payment_status !== "paid"
                        ? "Payment Pending"
                        : b.status}
                    </span>
                    {b.status === "completed" && !reviewedIds.has(b.id) && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                        <Star className="w-3 h-3" /> Review
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
