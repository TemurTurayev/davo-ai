"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, MessageCircleHeart, Activity, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWebApp } from "@/lib/telegram";

interface TabBarProps {
  locale: string;
}

export function TabBar({ locale }: TabBarProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/${locale}/today`, icon: Activity, labelKey: "tab_today" },
    { href: `/${locale}/calendar`, icon: Calendar, labelKey: "tab_calendar" },
    { href: `/${locale}/assistant`, icon: Sparkles, labelKey: "tab_ai" },
    { href: `/${locale}/messages`, icon: MessageCircleHeart, labelKey: "tab_doctor" },
    { href: `/${locale}/profile`, icon: User, labelKey: "tab_profile" },
  ] as const;

  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[var(--color-slate-200)] tg-safe-bottom z-20">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => getWebApp()?.HapticFeedback.selectionChanged()}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-2 flex-1 transition-colors min-h-[56px]",
                isActive
                  ? "text-[var(--color-brand)]"
                  : "text-[var(--color-slate-500)] hover:text-[var(--color-ink)]",
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tabLabel(tab.labelKey, locale)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function tabLabel(key: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    tab_today: { uz: "Bugun", ru: "Сегодня", en: "Today" },
    tab_calendar: { uz: "Taqvim", ru: "Календ.", en: "Calendar" },
    tab_ai: { uz: "AI", ru: "AI", en: "AI" },
    tab_doctor: { uz: "Shifokor", ru: "Врач", en: "Doctor" },
    tab_profile: { uz: "Profil", ru: "Профиль", en: "Profile" },
  };
  return map[key]?.[locale] ?? map[key]?.en ?? key;
}
