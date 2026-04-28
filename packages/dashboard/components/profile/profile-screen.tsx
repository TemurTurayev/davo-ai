"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  User,
  Calendar,
  Pill,
  Bell,
  Globe,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

import { useTBControlStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { TBControlLogo } from "@/components/brand/tb-control-logo";
import { treatmentDay, regimenLengthDays, formatDate } from "@/lib/utils";
import { localeNames } from "@/i18n/config";

export function ProfileScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const { profile, doses, reset } = useTBControlStore();

  const dayN = profile.treatmentStartedAt
    ? treatmentDay(new Date(profile.treatmentStartedAt))
    : 0;
  const total = regimenLengthDays(profile.regimen);
  const adherenceRate =
    doses.length > 0
      ? Math.round(
          (doses.filter((d) => d.status === "taken").length / doses.length) * 100,
        )
      : 0;

  const t = (uz: string, ru: string, en: string) =>
    locale === "uz" ? uz : locale === "ru" ? ru : en;

  return (
    <main className="px-5 pt-6 pb-6">
      {/* Hero */}
      <header className="card mb-5 text-center py-6">
        <div className="w-20 h-20 rounded-full bg-[var(--color-brand)] mx-auto mb-3 flex items-center justify-center text-white text-3xl font-heading font-extrabold">
          {profile.fullName ? profile.fullName.trim()[0].toUpperCase() : "?"}
        </div>
        <h1 className="font-heading font-extrabold text-xl">
          {profile.fullName || t("Bemor", "Пациент", "Patient")}
        </h1>
        <p className="text-sm text-[var(--color-slate-500)] mt-1">
          {profile.regimen === "dstb"
            ? t("DS-TB rejimi", "Режим DS-TB", "DS-TB regimen")
            : profile.regimen === "mdr"
            ? t("MDR-TB rejimi", "Режим MDR-TB", "MDR-TB regimen")
            : t("Aniqlanmagan", "Не уточнено", "Not specified")}
        </p>
      </header>

      {/* Stats grid */}
      <section className="grid grid-cols-3 gap-2 mb-5">
        <StatCard
          big={`${dayN}`}
          small={t("kun", "день", "day")}
          color="brand"
        />
        <StatCard
          big={`${adherenceRate}%`}
          small={t("Qabul", "Приём", "Adherence")}
          color="success"
        />
        <StatCard
          big={`${total - dayN}`}
          small={t("qoldi", "осталось", "left")}
          color="accent"
        />
      </section>

      {/* Settings */}
      <section className="card mb-5 divide-y divide-[var(--color-slate-200)]">
        <SettingRow
          icon={<Pill size={20} />}
          label={t("Davolash rejimi", "Режим лечения", "Treatment regimen")}
          value={profile.regimen.toUpperCase()}
        />
        <SettingRow
          icon={<Bell size={20} />}
          label={t("Eslatma vaqti", "Время напоминания", "Reminder time")}
          value={profile.reminderTime}
        />
        <SettingRow
          icon={<Calendar size={20} />}
          label={t("Boshlash sanasi", "Начало лечения", "Treatment start")}
          value={profile.treatmentStartedAt ? formatDate(new Date(profile.treatmentStartedAt), locale) : "—"}
        />
        <LinkRow
          icon={<Globe size={20} />}
          label={t("Til", "Язык", "Language")}
          value={localeNames[locale as keyof typeof localeNames]?.native ?? locale}
          href={`/${locale}`}
        />
      </section>

      {/* Help & legal */}
      <section className="card mb-5 divide-y divide-[var(--color-slate-200)]">
        <LinkRow
          icon={<Shield size={20} />}
          label={t("Maxfiylik", "Конфиденциальность", "Privacy")}
          href="#"
        />
        <LinkRow
          icon={<HelpCircle size={20} />}
          label={t("Yordam", "Помощь", "Help")}
          href="#"
        />
      </section>

      {/* Logout / reset (dev only) */}
      <section className="text-center">
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm(t("Hammasini tozalash?", "Сбросить всё?", "Reset all data?"))) {
              reset();
              router.push(`/${locale}`);
            }
          }}
          className="text-[var(--color-slate-500)]"
        >
          <LogOut size={16} />
          {t("Sozlamalarni tiklash", "Сбросить настройки", "Reset settings")}
        </Button>
      </section>

      <footer className="text-center mt-8 text-xs text-[var(--color-slate-400)]">
        <TBControlLogo size={20} className="justify-center mb-2" />
        <p>
          TB Control v0.1 · MindTech ·{" "}
          {t("Toshkentdan sevgi bilan", "Сделано в Ташкенте", "Made in Tashkent")}
        </p>
      </footer>
    </main>
  );
}

function StatCard({
  big,
  small,
  color,
}: {
  big: string;
  small: string;
  color: "brand" | "success" | "accent";
}) {
  const colorMap = {
    brand: "var(--color-brand)",
    success: "var(--color-success)",
    accent: "var(--color-accent)",
  };
  return (
    <div className="card text-center py-4">
      <div
        className="text-2xl font-heading font-extrabold tabular"
        style={{ color: colorMap[color] }}
      >
        {big}
      </div>
      <div className="text-xs text-[var(--color-slate-500)] mt-1">{small}</div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="w-9 h-9 rounded-lg bg-[var(--color-mist)] flex items-center justify-center text-[var(--color-slate-500)]">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-sm text-[var(--color-slate-500)] tabular">{value}</span>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-[var(--color-mist)]/30 -mx-4 px-4 rounded-lg"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--color-mist)] flex items-center justify-center text-[var(--color-slate-500)]">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-sm text-[var(--color-slate-500)]">{value}</span>}
      <ChevronRight size={16} className="text-[var(--color-slate-400)]" />
    </a>
  );
}
