"use client";

/**
 * Profile screen — STRICT prescription system.
 *
 * Patient can only change: theme + language.
 * All other data is doctor-prescribed and read-only.
 *
 * Shows: prescribed regimen (read-only), adherence stats, contact doctor.
 */

import { useRouter } from "next/navigation";
import {
  Pill,
  Calendar,
  Clock,
  Stethoscope,
  Globe,
  Sun,
  Moon,
  Monitor,
  Shield,
  HelpCircle,
  LogOut,
  Lock,
} from "lucide-react";
import Link from "next/link";

import { useTBControlStore } from "@/lib/store";
import { TBControlLogo } from "@/components/brand/tb-control-logo";
import { GlassCard } from "@/components/ui/glass-card";
import { localeNames } from "@/i18n/config";
import { PROTOCOLS, DRUG_LABELS } from "@/lib/protocols";
import { treatmentDay } from "@/lib/utils";
import { useEffect } from "react";

export function ProfileScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const { prescription, doses, theme, setTheme, reset } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // Apply theme on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (theme === "auto") {
      root.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);

  const dayN = prescription
    ? treatmentDay(new Date(prescription.startDate))
    : 0;

  const adherenceRate =
    doses.length > 0
      ? Math.round(
          (doses.filter((d) => d.status === "completed" || d.status === "completed_flag").length / doses.length) * 100,
        )
      : 0;

  const protocolDef = prescription && prescription.protocol !== "custom"
    ? PROTOCOLS[prescription.protocol]
    : null;

  return (
    <main className="bg-aurora min-h-screen relative pb-24">
      <div className="orb orb-brand w-72 h-72 -top-20 -right-20 animate-float-slow" />

      <div className="relative z-10 px-5 pt-6 pb-6">
        {/* Hero — patient identity */}
        <GlassCard variant="brand" className="mb-5 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-white/25 backdrop-blur-md mx-auto mb-3 flex items-center justify-center text-white text-3xl font-heading font-extrabold">
            {prescription?.patientName ? prescription.patientName.trim()[0].toUpperCase() : "?"}
          </div>
          <h1 className="font-heading font-extrabold text-xl text-white">
            {prescription?.patientName || t("Bemor", "Пациент", "Patient")}
          </h1>
          <p className="text-sm text-white/85 mt-1">
            {protocolDef
              ? protocolDef[lang === "uz" ? "nameUz" : lang === "ru" ? "nameRu" : "nameEn"]
              : t("Tayinlanmagan", "Не назначено", "Not assigned")}
          </p>
        </GlassCard>

        {/* Adherence stat */}
        {prescription && (
          <div className="grid grid-cols-2 gap-3 mb-5">
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
          </div>
        )}

        {/* DOCTOR-PRESCRIBED — read-only with lock icon */}
        {prescription && protocolDef && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-slate-500)] mb-2 px-1 flex items-center gap-1.5">
              <Lock size={12} />
              {t("Shifokor tayinladi", "Назначено врачом", "Doctor-prescribed")}
            </h2>
            <div className="card divide-y divide-[var(--color-slate-200)]">
              <ReadOnlyRow
                icon={<Stethoscope size={18} />}
                label={t("Shifokor", "Врач", "Doctor")}
                value={prescription.doctorName}
              />
              <ReadOnlyRow
                icon={<Calendar size={18} />}
                label={t("Boshlandi", "Начато", "Started")}
                value={new Date(prescription.startDate).toLocaleDateString(
                  lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US",
                )}
              />
              <ReadOnlyRow
                icon={<Calendar size={18} />}
                label={t("Tugaydi", "Завершится", "Ends")}
                value={new Date(prescription.endDate).toLocaleDateString(
                  lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US",
                )}
              />
              <ReadOnlyRow
                icon={<Clock size={18} />}
                label={t("Vaqt", "Время приёма", "Dose time")}
                value={prescription.doses.map((d) => d.time).join(" · ")}
              />
            </div>
            {/* Drugs strip */}
            <div className="mt-3 px-1">
              <p className="text-xs text-[var(--color-slate-500)] mb-2">
                {t("Bugungi dorilar:", "Сегодняшние препараты:", "Today's drugs:")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {prescription.doses.flatMap((d) =>
                  d.drugs.map((drug, i) => (
                    <span
                      key={`${d.id}-${i}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                      style={{ backgroundColor: DRUG_LABELS[drug.drugCode].color }}
                    >
                      <Pill size={12} />
                      {DRUG_LABELS[drug.drugCode][lang]} · {drug.dosageMg}mg
                    </span>
                  )),
                )}
              </div>
            </div>
          </section>
        )}

        {/* PATIENT CHOICES — only theme + language */}
        <section className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-slate-500)] mb-2 px-1">
            {t("Sozlamalar", "Настройки", "Settings")}
          </h2>

          {/* Theme picker */}
          <div className="card mb-3">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sun size={16} className="text-[var(--color-slate-500)]" />
              {t("Mavzu", "Тема", "Theme")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "auto"] as const).map((th) => {
                const Icon = th === "light" ? Sun : th === "dark" ? Moon : Monitor;
                const labelMap = {
                  light: t("Yorug'", "Светлая", "Light"),
                  dark: t("Qorong'i", "Тёмная", "Dark"),
                  auto: t("Avto", "Авто", "Auto"),
                };
                const active = theme === th;
                return (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    className={`py-3 rounded-xl flex flex-col items-center gap-1 text-xs font-medium transition-all ${
                      active
                        ? "bg-[var(--color-brand)] text-white shadow-md"
                        : "bg-[var(--color-mist)] text-[var(--color-slate-600)] hover:bg-white"
                    }`}
                  >
                    <Icon size={18} />
                    {labelMap[th]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language picker */}
          <div className="card">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Globe size={16} className="text-[var(--color-slate-500)]" />
              {t("Til", "Язык", "Language")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["uz", "ru", "en"] as const).map((lng) => {
                const active = lng === locale;
                return (
                  <a
                    key={lng}
                    href={`/${lng}/profile`}
                    className={`py-3 rounded-xl flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                      active
                        ? "bg-[var(--color-brand)] text-white shadow-md"
                        : "bg-[var(--color-mist)] text-[var(--color-slate-600)] hover:bg-white"
                    }`}
                  >
                    <span className="text-base">{lng.toUpperCase()}</span>
                    <span className="opacity-90">{localeNames[lng]?.native}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* Face enrollment + Help */}
        <section className="mb-5">
          <div className="card divide-y divide-[var(--color-slate-200)]">
            <LinkRow
              icon={<Pill size={18} />}
              label={t("Yuzni ro'yxatdan o'tkazish", "Регистрация лица (Face ID)", "Enroll face (Face ID)")}
              href={`/${locale}/enroll`}
            />
            <LinkRow
              icon={<Shield size={18} />}
              label={t("Maxfiylik", "Конфиденциальность", "Privacy")}
              href="#"
            />
            <LinkRow
              icon={<HelpCircle size={18} />}
              label={t("Yordam", "Помощь", "Help")}
              href="#"
            />
          </div>
        </section>

        {/* Reset (dev only) */}
        <section className="text-center">
          <button
            onClick={() => {
              if (confirm(t("Hammasini tozalash?", "Сбросить всё?", "Reset all data?"))) {
                reset();
                router.push(`/${locale}`);
              }
            }}
            className="text-sm text-[var(--color-slate-500)] hover:text-[var(--color-danger)] transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut size={14} />
            {t("Sozlamalarni tiklash", "Сбросить", "Reset")}
          </button>
        </section>

        <footer className="text-center mt-8 text-xs text-[var(--color-slate-400)]">
          <TBControlLogo size={20} className="justify-center mb-2" />
          <p>TB Control v0.2 · MindTech · CAU Tashkent</p>
        </footer>
      </div>
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
        className="text-3xl font-heading font-extrabold tabular"
        style={{ color: colorMap[color] }}
      >
        {big}
      </div>
      <div className="text-xs text-[var(--color-slate-500)] mt-1">{small}</div>
    </div>
  );
}

function ReadOnlyRow({
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
      <span className="text-sm text-[var(--color-slate-500)] text-right max-w-[55%] truncate">{value}</span>
      <Lock size={11} className="text-[var(--color-slate-400)] shrink-0" />
    </div>
  );
}

function LinkRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--color-mist)] flex items-center justify-center text-[var(--color-slate-500)]">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
    </a>
  );
}
