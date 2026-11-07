import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu,
  X,
  User,
  Calendar,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Briefcase,
  Repeat,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin, useStaffRecord } from "@/hooks/useRole";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { staff } = useStaffRecord(user?.id);
  const { isAdmin } = useIsAdmin(user?.id);
  const settings = useSettings();
  const loyaltyEnabled = settings.loyalty_enabled === "true";
  const bookingEnabled = settings.booking_enabled !== "false";
  const isStaff = Boolean(staff);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/book", label: "Book Now" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm"
          : "bg-white border-b border-gray-50"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[64px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <img
              src="/logo-horizontal.png"
              alt="MakeMeClean"
              className="h-10 md:h-11 w-auto max-w-[240px] object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/logo.png";
              }}
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                  isActive(link.href)
                    ? "text-green-700 bg-green-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                {link.label}
                {link.href === "/book" && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                      bookingEnabled
                        ? "bg-green-500 animate-pulse"
                        : "bg-amber-400"
                    )}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-150"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background: "linear-gradient(135deg,#16a34a,#15803d)",
                    }}
                  >
                    {(user.email?.[0] ?? "U").toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                    {user.email?.split("@")[0]}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-gray-400 transition-transform duration-200",
                      dropdownOpen && "rotate-180"
                    )}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 animate-fade-in overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-50 mb-1">
                      <p className="text-xs text-gray-400">Signed in as</p>
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {user.email}
                      </p>
                    </div>
                    {[
                      {
                        href: "/dashboard",
                        icon: LayoutDashboard,
                        label: "Dashboard",
                      },
                      {
                        href: "/bookings",
                        icon: Calendar,
                        label: "My Bookings",
                      },
                      { href: "/plans", icon: Repeat, label: "My Plans" },
                      ...(loyaltyEnabled
                        ? [
                            {
                              href: "/loyalty",
                              icon: Trophy,
                              label: "Loyalty Rewards",
                            },
                          ]
                        : []),
                      { href: "/profile", icon: User, label: "Profile" },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-gray-400" /> {label}
                      </Link>
                    ))}
                    {isStaff && (
                      <>
                        <div className="h-px bg-gray-50 my-1" />
                        <Link
                          href="/staff"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <Briefcase className="w-4 h-4" /> Staff Portal
                        </Link>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <div className="h-px bg-gray-50 my-1" />
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4" /> Admin Panel
                        </Link>
                      </>
                    )}
                    <div className="h-px bg-gray-50 my-1" />
                    <button
                      onClick={() => {
                        signOut();
                        setDropdownOpen(false);
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="btn-primary text-sm py-2 px-5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-50 bg-white px-4 py-4 space-y-1 animate-fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="h-px bg-gray-50 my-2" />
          {user ? (
            <>
              {[
                {
                  href: "/dashboard",
                  icon: LayoutDashboard,
                  label: "Dashboard",
                },
                { href: "/bookings", icon: Calendar, label: "My Bookings" },
                { href: "/plans", icon: Repeat, label: "My Plans" },
                ...(loyaltyEnabled
                  ? [
                      {
                        href: "/loyalty",
                        icon: Trophy,
                        label: "Loyalty Rewards",
                      },
                    ]
                  : []),
                { href: "/profile", icon: User, label: "Profile" },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Icon className="w-4 h-4 text-gray-400" /> {label}
                </Link>
              ))}
              {isStaff && (
                <Link
                  href="/staff"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <Briefcase className="w-4 h-4" /> Staff Portal
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  <LayoutDashboard className="w-4 h-4" /> Admin Panel
                </Link>
              )}
              <button
                onClick={() => {
                  signOut();
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          ) : (
            <div className="flex gap-2 pt-1">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center btn-secondary text-sm py-2.5"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center btn-primary text-sm py-2.5"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
