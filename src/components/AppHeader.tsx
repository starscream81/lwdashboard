"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "../../app/i18n/LanguageProvider";

type AppHeaderProps = {
  userName?: string | null;
};

type NavItem = {
  href: string;
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/heroes", labelKey: "nav.heroes" },
  { href: "/research", labelKey: "nav.research" },
  { href: "/buildings", labelKey: "nav.buildings" },
];

export default function AppHeader({ userName }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { t } = useLanguage();

  const handleLogout = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      await signOut(auth);
    } catch (err) {
      console.error("Failed to sign out", err);
    } finally {
      setLoggingOut(false);
      router.push("/login");
    }
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/dashboard" && pathname === "/") return true;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-sm font-semibold tracking-wide text-slate-100 whitespace-nowrap">
            {t("app.name")}
          </span>

          {/* Desktop nav with Extras */}
          <nav className="hidden md:flex items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition",
                    active
                      ? "border-sky-500 bg-sky-600/40 text-sky-50 shadow-sm"
                      : "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500 hover:text-sky-100",
                  ].join(" ")}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}

            {/* Extras placeholder for future dropdown */}
            <button
              type="button"
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-100"
            >
              {t("nav.extras")}
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {userName && (
            <span className="hidden sm:inline-block max-w-[180px] truncate text-xs text-slate-200">
              {userName}
            </span>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs px-3 py-1.5 rounded-md border border-rose-500/80 text-rose-100 hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loggingOut ? t("auth.logout.loading") : t("auth.logout.button")}
          </button>
        </div>
      </div>

      {/* Mobile nav row with horizontal scroll, including Extras */}
      <div className="border-t border-slate-800 md:hidden">
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border whitespace-nowrap",
                  active
                    ? "border-sky-500 bg-sky-600/40 text-sky-50 shadow-sm"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500 hover:text-sky-100",
                ].join(" ")}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}

          <button
            type="button"
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 whitespace-nowrap"
          >
            {t("nav.extras")}
          </button>
        </div>
      </div>
    </header>
  );
}
