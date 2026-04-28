"use client";

/**
 * Today screen — main patient view
 * Shows: today's dose status, big record CTA, recent week heatmap, quick action chips.
 *
 * Per UX research: ONE TAP to record dose. No menus, no dialogs.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Check, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTBControlStore } from "@/lib/store";
import { getWebApp } from "@/lib/telegram";
import { treatmentDay, regimenLengthDays } from "@/lib/utils";
import { TBControlLogo } from "@/components/brand/tb-control-logo";

export function TodayScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("daily");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const { profile, doses, isOnboarded } = useTBControlStore();

  // Redirect to onboarding if not yet
  useEffect(() => {
    if (!isOnboarded) router.push(`/${locale}/onboarding`);
  }, [isOnboarded, router, locale]);

  const todayDose = doses.find((d) => d.date === today);
  const isDoseTaken = todayDose?.status === "taken";

  const startedAt = profile.treatmentStartedAt ? new Date(profile.treatmentStartedAt) : new Date();
  const dayN = treatmentDay(startedAt);
  const total = regimenLengthDays(profile.regimen);

  // Recent 7 days adherence
  const recent7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const dose = doses.find((dd) => dd.date === iso);
    return { date: iso, status: dose?.status ?? (iso === today ? "today" : "future") };
  });

  const onRecord = () => {
    getWebApp()?.HapticFeedback.impactOccurred("medium");
    router.push(`/${locale}/today/record`);
  };

  return (
    <main className="px-5 pt-6 pb-6">
      {/* Greeting */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-[var(--color-slate-500)]">
            {greeting(locale)}, {profile.fullName.split(" ").pop()}
          </p>
          <p className="text-xs tabular text-[var(--color-slate-400)] mt-0.5">
            {t("day_of", { current: dayN, total })}
          </p>
        </div>
        <TBControlLogo size={32} />
      </header>

      {/* Hero card — today's status */}
      <section className="card relative overflow-hidden mb-5" style={{
        background: isDoseTaken
          ? "linear-gradient(135deg, var(--color-success) 0%, #34D399 100%)"
          : "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
        color: "white",
      }}>
        {/* Decorative shape */}
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            {isDoseTaken ? <Check size={20} /> : <Sparkles size={20} />}
            <span className="text-sm font-medium opacity-90">
              {isDoseTaken ? t("verified") : t("title")}
            </span>
          </div>

          <h1 className="text-2xl font-heading font-extrabold leading-tight mb-1">
            {isDoseTaken
              ? localize(locale, {
                  uz: "Bugungi dozani qabul qildingiz",
                  ru: "Доза на сегодня принята",
                  en: "You've taken today's dose",
                })
              : localize(locale, {
                  uz: "Bugun yana bir qadam",
                  ru: "Ещё один день вместе",
                  en: "Another day, another step",
                })}
          </h1>
          <p className="text-sm opacity-85 max-w-xs">
            {isDoseTaken
              ? localize(locale, {
                  uz: "Davom eting. Sog'lik qaytmoqda.",
                  ru: "Продолжайте. Здоровье возвращается.",
                  en: "Keep going. Health is returning.",
                })
              : t("ready_to_record")}
          </p>

          {!isDoseTaken && (
            <Button
              onClick={onRecord}
              size="lg"
              className="mt-5 bg-white text-[var(--color-brand-dark)] hover:bg-white/90 hover:text-[var(--color-brand-dark)] shadow-none"
            >
              <Camera size={20} />
              {t("record_button")}
            </Button>
          )}
        </div>
      </section>

      {/* Recent 7 days mini heatmap */}
      <section className="card mb-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-slate-500)] mb-3">
          {localize(locale, {
            uz: "Oxirgi 7 kun",
            ru: "Последние 7 дней",
            en: "Last 7 days",
          })}
        </h2>
        <div className="flex items-end justify-between gap-1.5">
          {recent7.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full aspect-square rounded-md"
                data-status={d.status}
                style={{
                  background:
                    d.status === "taken" ? "var(--color-success)" :
                    d.status === "missed" ? "rgba(239,68,68,0.5)" :
                    d.status === "today" ? "var(--color-brand-soft)" :
                    "var(--color-mist)",
                  border: d.status === "today" ? "2px solid var(--color-brand)" : "none",
                }}
              />
              <span className="text-[10px] tabular text-[var(--color-slate-400)]">
                {new Date(d.date).getDate()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push(`/${locale}/chat`)}
          className="card text-left hover:shadow-md transition"
        >
          <Heart size={22} className="text-[var(--color-accent)] mb-2" />
          <h3 className="font-heading font-bold text-sm">
            {localize(locale, { uz: "Yon ta'sirlar", ru: "Побочки", en: "Side effects" })}
          </h3>
          <p className="text-xs text-[var(--color-slate-500)] mt-0.5">
            {localize(locale, { uz: "Maslahat oling", ru: "Получить совет", en: "Get advice" })}
          </p>
        </button>
        <button
          onClick={() => router.push(`/${locale}/calendar`)}
          className="card text-left hover:shadow-md transition"
        >
          <Sparkles size={22} className="text-[var(--color-brand)] mb-2" />
          <h3 className="font-heading font-bold text-sm">
            {localize(locale, { uz: "Progress", ru: "Прогресс", en: "Progress" })}
          </h3>
          <p className="text-xs text-[var(--color-slate-500)] mt-0.5">
            {Math.round((dayN / total) * 100)}% {localize(locale, { uz: "yoʻl", ru: "пути", en: "complete" })}
          </p>
        </button>
      </section>
    </main>
  );
}

function greeting(locale: string): string {
  const hour = new Date().getHours();
  if (locale === "uz") {
    if (hour < 12) return "Xayrli tong";
    if (hour < 17) return "Xayrli kun";
    return "Xayrli kech";
  }
  if (locale === "ru") {
    if (hour < 12) return "Доброе утро";
    if (hour < 17) return "Добрый день";
    return "Добрый вечер";
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function localize(locale: string, m: { uz: string; ru: string; en: string }): string {
  return locale === "uz" ? m.uz : locale === "ru" ? m.ru : m.en;
}
