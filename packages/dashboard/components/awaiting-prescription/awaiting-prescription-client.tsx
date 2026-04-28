"use client";

/**
 * Awaiting prescription screen.
 * Shown when patient has consented to rules but has no prescription yet.
 *
 * For demo: includes "Use demo prescription" button that auto-creates DS-TB
 * standard regimen so the dose flow can be tested end-to-end.
 */

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ClipboardList, FlaskConical, Stethoscope } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { buildPrescription } from "@/lib/protocols";

export function AwaitingPrescriptionClient({ locale }: { locale: string }) {
  const router = useRouter();
  const { setPrescription } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  const useDemoPrescription = () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14); // mid-treatment for demo
    const prescription = buildPrescription({
      protocolId: "ds-tb-2hrze-4hr",
      patientName: t("Sardor Toshmatov", "Сардор Тошматов", "Sardor Toshmatov"),
      patientId: "demo-patient-1",
      startDate,
      doctorName: t("Dr. Tursunov A.X.", "Др. Турсунов А.Х.", "Dr. A.Kh. Tursunov"),
    });
    setPrescription(prescription);
    router.push(`/${locale}/today`);
  };

  return (
    <main className="bg-aurora min-h-screen relative flex flex-col">
      <div className="orb orb-brand w-72 h-72 -top-20 -left-20 animate-float-slow" />

      <section className="relative z-10 flex-1 flex flex-col justify-center px-5 pb-10 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-20 h-20 rounded-3xl bg-[var(--color-brand-soft)] mx-auto mb-4 flex items-center justify-center">
            <ClipboardList size={36} className="text-[var(--color-brand)]" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl mb-2">
            {t("Tayinlash kutilmoqda", "Ожидание назначения", "Awaiting prescription")}
          </h1>
          <p className="text-[var(--color-slate-500)]">
            {t(
              "Sizning shifokoringiz davolanish rejimini tayinlashi kerak. Iltimos, klinikangizga murojaat qiling.",
              "Ваш врач должен назначить курс лечения. Обратитесь в клинику.",
              "Your doctor must prescribe a treatment regimen. Please contact your clinic.",
            )}
          </p>
        </motion.div>

        <GlassCard className="p-5 mb-4">
          <div className="flex items-start gap-3">
            <Stethoscope size={20} className="text-[var(--color-brand)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold mb-1">
                {t("Shifokoringiz bilan bog'laning", "Свяжитесь со своим врачом", "Contact your doctor")}
              </p>
              <p className="text-xs text-[var(--color-slate-500)]">
                {t(
                  "Tayinlash uchun shifokorga uchrashing. Tayinlanmaguncha ushbu ilova faolligi cheklangan.",
                  "Запишитесь на приём для назначения курса. До назначения функционал ограничен.",
                  "Schedule a visit for prescription. Until prescribed, app functionality is limited.",
                )}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Demo button — for hackathon testing */}
        <GlassCard variant="accent" className="p-5 text-white">
          <div className="flex items-start gap-3 mb-3">
            <FlaskConical size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold mb-1">
                {t("Demo rejimi", "Демо-режим", "Demo mode")}
              </p>
              <p className="text-xs opacity-90">
                {t(
                  "Hackathon namoyishi uchun: standart DS-TB rejimini avtomatik yarating.",
                  "Для демонстрации хакатона: автоматически создать стандартный режим DS-TB.",
                  "For hackathon demo: auto-create a standard DS-TB regimen.",
                )}
              </p>
            </div>
          </div>
          <Button
            onClick={useDemoPrescription}
            variant="secondary"
            block
            className="bg-white text-[var(--color-accent)] hover:bg-white/90"
          >
            {t("Demo tayinlashni ishlatish", "Использовать демо-назначение", "Use demo prescription")}
          </Button>
        </GlassCard>
      </section>
    </main>
  );
}
