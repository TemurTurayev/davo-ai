"use client";

/**
 * Role selector client component.
 * - Big patient button (primary, brand color)
 * - Big doctor button (secondary, accent color)
 * - Top-right: language switcher (only patient choice + theme)
 *
 * On patient pick: store role, route to /today (or rules-agreement if first time).
 * On doctor pick: store role, route to /doctor.
 */

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Stethoscope, ChevronRight } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { TBControlLogo } from "@/components/brand/tb-control-logo";
import { ThemeToggle } from "@/components/role-selector/theme-toggle";
import { LanguageSwitcher } from "@/components/role-selector/language-switcher";
import { useEffect } from "react";
import { applyTelegramTheme, getWebApp } from "@/lib/telegram";

export function RoleSelectorClient({ locale }: { locale: string }) {
  const router = useRouter();
  const { setRole, rulesConsent, prescription } = useTBControlStore();

  useEffect(() => {
    const wa = getWebApp();
    wa?.ready();
    wa?.expand();
    if (wa?.themeParams) applyTelegramTheme(wa.themeParams);
  }, []);

  const t = (uz: string, ru: string, en: string) =>
    locale === "uz" ? uz : locale === "ru" ? ru : en;

  const pickPatient = () => {
    setRole("patient");
    getWebApp()?.HapticFeedback.impactOccurred("medium");
    // First-time patient: must agree to rules + needs prescription from doctor
    if (!rulesConsent.accepted) {
      router.push(`/${locale}/rules`);
    } else if (!prescription) {
      router.push(`/${locale}/awaiting-prescription`);
    } else {
      router.push(`/${locale}/today`);
    }
  };

  const pickDoctor = () => {
    setRole("doctor");
    getWebApp()?.HapticFeedback.impactOccurred("medium");
    router.push(`/${locale}/doctor`);
  };

  return (
    <main className="bg-aurora min-h-screen relative overflow-hidden flex flex-col">
      {/* Floating orbs (decorative) */}
      <div className="orb orb-brand w-72 h-72 -top-20 -left-20 animate-float-slow" />
      <div className="orb orb-coral w-64 h-64 top-1/3 -right-16 animate-float-slow" style={{ animationDelay: "2s" }} />

      {/* Top bar */}
      <header className="relative z-10 px-5 pt-6 pb-3 flex items-center justify-between">
        <TBControlLogo size={28} showWordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher current={locale} />
        </div>
      </header>

      {/* Content */}
      <section className="relative z-10 flex-1 flex flex-col justify-center px-5 pb-10 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <h1 className="font-heading font-extrabold text-3xl mb-2">
            {t("Xush kelibsiz", "Добро пожаловать", "Welcome")}
          </h1>
          <p className="text-[var(--color-slate-500)]">
            {t(
              "Davom etish uchun rolingizni tanlang",
              "Выберите роль для продолжения",
              "Choose your role to continue",
            )}
          </p>
        </motion.div>

        {/* Patient button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileTap={{ scale: 0.97 }}
          onClick={pickPatient}
          className="group glass-brand relative overflow-hidden rounded-3xl p-5 mb-3 text-left text-white shadow-lg active:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center shrink-0">
              <User size={28} strokeWidth={2.2} />
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-extrabold text-xl mb-0.5">
                {t("Men bemorman", "Я пациент", "I'm a patient")}
              </h2>
              <p className="text-sm opacity-90">
                {t(
                  "Davolanish jarayoni va dorilarni qabul qilish",
                  "Курс лечения и приём препаратов",
                  "Treatment course and dose taking",
                )}
              </p>
            </div>
            <ChevronRight size={22} className="opacity-80 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        {/* Doctor button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
          whileTap={{ scale: 0.97 }}
          onClick={pickDoctor}
          className="group glass relative overflow-hidden rounded-3xl p-5 text-left shadow-md active:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
              <Stethoscope size={28} strokeWidth={2.2} className="text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-extrabold text-xl mb-0.5">
                {t("Men shifokorman", "Я врач", "I'm a doctor")}
              </h2>
              <p className="text-sm text-[var(--color-slate-500)]">
                {t(
                  "Bemorlarni boshqarish va tayinlash",
                  "Управление пациентами и назначения",
                  "Patient management and prescriptions",
                )}
              </p>
            </div>
            <ChevronRight size={22} className="text-[var(--color-slate-400)] group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        {/* Footer note */}
        <p className="text-center text-xs text-[var(--color-slate-400)] mt-8">
          {t(
            "Davolanish shifokor tomonidan tayinlanadi va qat'iy nazorat ostida",
            "Лечение назначается врачом и проходит под строгим контролем",
            "Treatment is prescribed and supervised by a physician",
          )}
        </p>
      </section>

      <footer className="relative z-10 px-5 pb-6 text-center text-xs text-[var(--color-slate-400)]">
        TB Control · MindTech · CAU Tashkent
      </footer>
    </main>
  );
}
