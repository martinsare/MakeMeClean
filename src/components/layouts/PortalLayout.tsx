import {
  ComponentType,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import { ChevronRight, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useScrollLock } from "@/hooks/useScrollLock";
import { cn } from "@/lib/utils";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface PortalLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  portalName: string;
  portalDescription: string;
  navigationLabel: string;
  homeHref: string;
  homeLabel: string;
  items: PortalNavItem[];
  contentWidth: "max-w-5xl" | "max-w-7xl" | "max-w-[1600px]";
}

function isActiveRoute(current: string, href: string) {
  if (href === "/admin") return current === href;
  return current === href || current.startsWith(`${href}/`);
}

export default function PortalLayout({
  title,
  subtitle,
  actions,
  portalName,
  portalDescription,
  navigationLabel,
  homeHref,
  homeLabel,
  items,
  contentWidth,
  children,
}: PropsWithChildren<PortalLayoutProps>) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useScrollLock(mobileOpen);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const navigate = (href: string) => {
    setLocation(href);
    setMobileOpen(false);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-4 pb-5 pt-6">
        <div className="flex items-center gap-2 mb-2">
          <img
            src="/logo-horizontal.png"
            alt="MakeMeClean"
            className="h-8 w-auto max-w-[170px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logo.png";
            }}
          />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-green-700 bg-green-50 inline-block px-2 py-0.5 rounded-md border border-green-100">
          {portalDescription}
        </p>
      </div>

      <nav
        aria-label={navigationLabel}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {items.map((item) => {
          const active = isActiveRoute(location, item.href);
          const Icon = item.icon;

          return (
            <button
              key={item.href}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2",
                active
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-white" : "text-gray-400"
                )}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {active && (
                <ChevronRight
                  aria-hidden="true"
                  className="h-4 w-4 text-white/70"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-gray-100 px-3 pb-6 pt-4">
        <button
          type="button"
          onClick={() => navigate(homeHref)}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        >
          <ExternalLink aria-hidden="true" className="h-5 w-5 text-gray-400" />
          {homeLabel}
        </button>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        >
          <LogOut aria-hidden="true" className="h-5 w-5 text-gray-400" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-white lg:flex">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${portalDescription} navigation`}
        >
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 h-full w-full bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="portal-mobile-navigation"
            className="relative z-10 h-full w-[min(18rem,85vw)] overflow-y-auto bg-white shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={`Open ${portalDescription.toLowerCase()} navigation`}
            aria-controls="portal-mobile-navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <img
            src="/logo-horizontal.png"
            alt="MakeMeClean"
            className="h-7 w-auto max-w-[140px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logo.png";
            }}
          />
          <div aria-hidden="true" className="h-10 w-10" />
        </header>

        <main
          className={cn(
            "mx-auto w-full flex-1 p-4 sm:p-6 lg:p-8",
            contentWidth
          )}
        >
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                {actions}
              </div>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
