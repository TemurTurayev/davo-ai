"use client";

/**
 * Rules Agreement — one-time onboarding before first dose.
 *
 * Per research: clinical eConsent best practice = video + quiz + signature.
 *   1. 45-sec explainer (text + visual stand-in for video)
 *   2. 3-question micro-quiz (forces comprehension, ~8th grade reading)
 *   3. Typed-name signature + bold checkbox
 *
 * Patient cannot proceed to dose flow without completing all three.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Camera,
  Eye,
  AlertTriangle,
  ClipboardList,
  Pill,
  HelpCircle,
} from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Stage = "intro" | "rules" | "quiz" | "sign" | "done";

const RULES = [
  {
    icon: Camera,
    titleUz: "Kameraga aniq ko'ring",
    titleRu: "Чётко смотрите в камеру",
    titleEn: "Look clearly at the camera",
    bodyUz: "Yuzingiz kadrda butunlay ko'rinishi kerak.",
    bodyRu: "Лицо должно полностью попадать в кадр.",
    bodyEn: "Your face must be fully in the frame.",
  },
  {
    icon: Eye,
    titleUz: "Yorug' joyda turing",
    titleRu: "Хорошее освещение",
    titleEn: "Stay in good light",
    bodyUz: "Xona yetarlicha yorug' bo'lishi kerak.",
    bodyRu: "В комнате должно быть достаточно светло.",
    bodyEn: "The room must be well-lit.",
  },
  {
    icon: Pill,
    titleUz: "Faqat tayinlangan dorilar",
    titleRu: "Только назначенные препараты",
    titleEn: "Only prescribed medications",
    bodyUz: "Shifokor tayinlagan tabletkalardan boshqasini olmang.",
    bodyRu: "Принимайте только препараты, назначенные врачом.",
    bodyEn: "Take only the medications prescribed by your doctor.",
  },
  {
    icon: ClipboardList,
    titleUz: "Hech qanday qadamni o'tkazib yubormang",
    titleRu: "Не пропускайте шаги",
    titleEn: "Do not skip steps",
    bodyUz: "Har bir qadamni AI tasdiqlamaguncha keyingisiga o'tib bo'lmaydi.",
    bodyRu: "Каждый шаг должен подтвердить ИИ — пропустить нельзя.",
    bodyEn: "Each step must be confirmed by AI before proceeding.",
  },
  {
    icon: AlertTriangle,
    titleUz: "Qoidabuzarlik = qizil bayroq",
    titleRu: "Нарушение = красный флажок",
    titleEn: "Violation = red flag",
    bodyUz: "Qoidalar buzilsa, shifokor video tasdiqlashi kerak. Davolanish to'xtamaydi.",
    bodyRu: "При нарушении видео отмечается флажком и проверяется врачом. Лечение продолжается.",
    bodyEn: "If rules are broken, a doctor reviews the video. Treatment continues.",
  },
];

interface QuizQuestion {
  question: { uz: string; ru: string; en: string };
  options: { uz: string; ru: string; en: string; correct: boolean }[];
}

const QUIZ: QuizQuestion[] = [
  {
    question: {
      uz: "Agar siz dozani o'tkazib yuborsangiz nima bo'ladi?",
      ru: "Что произойдёт, если вы пропустите дозу?",
      en: "What happens if you skip a dose?",
    },
    options: [
      {
        uz: "Hech narsa bo'lmaydi",
        ru: "Ничего страшного",
        en: "Nothing happens",
        correct: false,
      },
      {
        uz: "Bakteriya chidamliligi rivojlanishi mumkin",
        ru: "Может развиться устойчивость бактерий",
        en: "Bacteria may develop resistance",
        correct: true,
      },
      {
        uz: "Davolanish tezroq tugaydi",
        ru: "Лечение закончится быстрее",
        en: "Treatment will end faster",
        correct: false,
      },
    ],
  },
  {
    question: {
      uz: "Siz har bir dozada nima qilishingiz kerak?",
      ru: "Что нужно делать при каждом приёме?",
      en: "What must you do for each dose?",
    },
    options: [
      {
        uz: "Tabletkani yutib, hech kimga aytmaslik",
        ru: "Просто проглотить таблетку",
        en: "Just swallow the pill",
        correct: false,
      },
      {
        uz: "Kameraga ko'rsatib, hammasini bajarish",
        ru: "Показать всё на камеру по шагам",
        en: "Show every step on camera",
        correct: true,
      },
      {
        uz: "Faqat shifokorga aytish",
        ru: "Только сказать врачу",
        en: "Only tell the doctor",
        correct: false,
      },
    ],
  },
  {
    question: {
      uz: "Agar AI xato qilsa nima bo'ladi?",
      ru: "Что будет, если ИИ ошибётся?",
      en: "What happens if AI makes a mistake?",
    },
    options: [
      {
        uz: "Davolanish to'xtatiladi",
        ru: "Лечение остановится",
        en: "Treatment is stopped",
        correct: false,
      },
      {
        uz: "Pul jarima to'lashim kerak",
        ru: "Я должен заплатить штраф",
        en: "I must pay a fine",
        correct: false,
      },
      {
        uz: "Shifokor videoni ko'rib qaror qabul qiladi",
        ru: "Врач посмотрит видео и решит",
        en: "Doctor reviews the video and decides",
        correct: true,
      },
    ],
  },
];

export function RulesAgreementClient({ locale }: { locale: string }) {
  const router = useRouter();
  const { acceptRules } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  const [stage, setStage] = useState<Stage>("intro");
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>(QUIZ.map(() => null));
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);

  const quizScore: number = quizAnswers.reduce<number>(
    (sum, ans, i) => (ans !== null && QUIZ[i].options[ans].correct ? sum + 1 : sum),
    0,
  );
  const quizComplete = quizAnswers.every((a) => a !== null);

  const submit = () => {
    acceptRules(quizScore, signature.trim());
    setStage("done");
    setTimeout(() => router.push(`/${locale}/awaiting-prescription`), 1200);
  };

  return (
    <main className="bg-aurora min-h-screen relative">
      <div className="orb orb-brand w-72 h-72 -top-20 -right-20 animate-float-slow" />

      <div className="relative z-10 max-w-md mx-auto px-5 pt-6 pb-12">
        <header className="mb-6 flex items-center gap-3">
          {stage !== "intro" && stage !== "done" && (
            <button
              onClick={() => {
                if (stage === "rules") setStage("intro");
                else if (stage === "quiz") setStage("rules");
                else if (stage === "sign") setStage("quiz");
              }}
              className="w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm"
              aria-label="back"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="flex-1">
            <h1 className="font-heading font-bold text-lg">
              {t("Qoidalarni tasdiqlash", "Согласие с правилами", "Rules agreement")}
            </h1>
            <StageProgress stage={stage} />
          </div>
        </header>

        <AnimatePresence mode="wait">
          {/* INTRO */}
          {stage === "intro" && (
            <motion.section
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <GlassCard variant="brand" className="p-6 mb-4 text-white text-center">
                <ShieldCheck size={40} className="mx-auto mb-3" />
                <h2 className="font-heading font-extrabold text-xl mb-2">
                  {t(
                    "TB Control nima qiladi?",
                    "Что делает TB Control?",
                    "What does TB Control do?",
                  )}
                </h2>
                <p className="text-sm leading-relaxed opacity-95">
                  {t(
                    "Bu ilova sil davolanishi to'g'ri va to'liq o'tishini ta'minlash uchun har bir doza qabulini AI yordamida tasdiqlaydi. Bu siz uchun, sizning sog'lig'ingiz uchun.",
                    "Это приложение помогает гарантировать правильное и полное лечение туберкулёза: каждый приём подтверждается ИИ. Это для вашего здоровья.",
                    "This app helps ensure your TB treatment is correct and complete by AI-verifying every dose. It's for your health.",
                  )}
                </p>
              </GlassCard>

              <GlassCard className="p-5 mb-4">
                <p className="font-semibold text-sm mb-2">
                  {t("Davolanish davomida:", "Во время лечения:", "During treatment:")}
                </p>
                <ul className="text-sm text-[var(--color-slate-700)] space-y-2">
                  <li className="flex gap-2"><span className="text-[var(--color-brand)] font-bold">·</span> {t("6 oy davomida har kuni dorilarni qabul qilasiz", "6 месяцев каждый день принимаете препараты", "Take pills daily for 6 months")}</li>
                  <li className="flex gap-2"><span className="text-[var(--color-brand)] font-bold">·</span> {t("Har bir doza kameraga yoziladi", "Каждый приём записывается на камеру", "Each dose is recorded by camera")}</li>
                  <li className="flex gap-2"><span className="text-[var(--color-brand)] font-bold">·</span> {t("AI har qadamni tekshiradi", "ИИ проверяет каждый шаг", "AI verifies each step")}</li>
                  <li className="flex gap-2"><span className="text-[var(--color-brand)] font-bold">·</span> {t("Shifokor shubhali holatlarni ko'rib chiqadi", "Сомнительные случаи проверяет врач", "Doctor reviews uncertain cases")}</li>
                </ul>
              </GlassCard>

              <Button onClick={() => setStage("rules")} block size="lg">
                {t("Davom etish", "Продолжить", "Continue")}
                <ChevronRight size={18} />
              </Button>
            </motion.section>
          )}

          {/* RULES */}
          {stage === "rules" && (
            <motion.section
              key="rules"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <p className="text-sm text-[var(--color-slate-500)] mb-3 px-1">
                {t(
                  "Quyidagi qoidalarga rioya qilishingiz kerak:",
                  "Вы должны соблюдать следующие правила:",
                  "You must follow these rules:",
                )}
              </p>
              <div className="space-y-2.5 mb-5">
                {RULES.map((rule, i) => {
                  const Icon = rule.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="card flex gap-3 items-start"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)] flex items-center justify-center shrink-0">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {lang === "uz" ? rule.titleUz : lang === "ru" ? rule.titleRu : rule.titleEn}
                        </p>
                        <p className="text-xs text-[var(--color-slate-500)] mt-0.5 leading-relaxed">
                          {lang === "uz" ? rule.bodyUz : lang === "ru" ? rule.bodyRu : rule.bodyEn}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <Button onClick={() => setStage("quiz")} block size="lg">
                {t("Tushundim, davom etish", "Понимаю, продолжить", "I understand, continue")}
                <ChevronRight size={18} />
              </Button>
            </motion.section>
          )}

          {/* QUIZ */}
          {stage === "quiz" && (
            <motion.section
              key="quiz"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <p className="text-sm text-[var(--color-slate-500)] mb-3 px-1 flex items-center gap-1.5">
                <HelpCircle size={14} />
                {t(
                  "Tushunganingizni tekshiramiz (3 savol):",
                  "Проверим понимание (3 вопроса):",
                  "Quick comprehension check (3 questions):",
                )}
              </p>

              <div className="space-y-4 mb-5">
                {QUIZ.map((q, qi) => (
                  <div key={qi} className="card">
                    <p className="font-semibold text-sm mb-3">
                      {qi + 1}. {q.question[lang]}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const selected = quizAnswers[qi] === oi;
                        const isCorrect = selected && opt.correct;
                        const isWrong = selected && !opt.correct;
                        return (
                          <button
                            key={oi}
                            onClick={() =>
                              setQuizAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                            }
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all",
                              !selected && "bg-[var(--color-mist)]/40 border-[var(--color-slate-200)] hover:bg-white",
                              isCorrect && "bg-[var(--color-success)]/10 border-[var(--color-success)] text-[var(--color-success)]",
                              isWrong && "bg-[var(--color-danger)]/10 border-[var(--color-danger)] text-[var(--color-danger)]",
                            )}
                          >
                            {opt[lang]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {quizComplete && quizScore < QUIZ.length && (
                <p className="text-sm text-[var(--color-warning)] mb-3 px-1">
                  ⚠ {t(
                    `${QUIZ.length - quizScore} javob noto'g'ri. Tuzatib, davom eting.`,
                    `${QUIZ.length - quizScore} ответ(а) неверно. Исправьте и продолжайте.`,
                    `${QUIZ.length - quizScore} answer(s) wrong. Fix them to continue.`,
                  )}
                </p>
              )}

              <Button
                onClick={() => setStage("sign")}
                disabled={!quizComplete || quizScore < QUIZ.length}
                block
                size="lg"
              >
                {t("Davom etish", "Продолжить", "Continue")}
                <ChevronRight size={18} />
              </Button>
            </motion.section>
          )}

          {/* SIGN */}
          {stage === "sign" && (
            <motion.section
              key="sign"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <GlassCard className="p-5 mb-4">
                <p className="text-sm font-semibold mb-3">
                  {t("Imzolash", "Подпись", "Signature")}
                </p>
                <p className="text-xs text-[var(--color-slate-500)] mb-3 leading-relaxed">
                  {t(
                    "Quyidagi maydonga to'liq ismingizni kiriting. Bu sizning rozilik tasdiqlanishingiz.",
                    "Введите своё полное имя ниже. Это ваше согласие.",
                    "Type your full name below. This is your consent.",
                  )}
                </p>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={t("F.I.O", "Ф.И.О", "Full name")}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-slate-300)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 text-sm"
                />

                <label className="flex gap-3 items-start mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded accent-[var(--color-brand)]"
                  />
                  <span className="text-sm leading-relaxed">
                    {t(
                      "Men yuqoridagi qoidalarni tushundim va ularga rioya qilishni va'da qilaman. Sil davolanishini to'liq tugatishga roziman.",
                      "Я понял правила выше и обязуюсь их соблюдать. Соглашаюсь полностью завершить курс лечения туберкулёза.",
                      "I understand the above rules and agree to follow them. I consent to complete the full TB treatment.",
                    )}
                  </span>
                </label>
              </GlassCard>

              <p className="text-xs text-[var(--color-slate-400)] mb-3 px-1">
                {t(
                  `Imzolangan vaqt: ${new Date().toLocaleString("uz-UZ")}`,
                  `Время подписи: ${new Date().toLocaleString("ru-RU")}`,
                  `Signed at: ${new Date().toLocaleString("en-US")}`,
                )}
              </p>

              <Button
                onClick={submit}
                disabled={signature.trim().length < 3 || !agreed}
                block
                size="lg"
              >
                {t("Roziman va davom etaman", "Согласен, продолжить", "Agree and continue")}
                <ChevronRight size={18} />
              </Button>
            </motion.section>
          )}

          {/* DONE */}
          {stage === "done" && (
            <motion.section
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-center py-12"
            >
              <CheckCircle2 size={72} className="text-[var(--color-success)] mx-auto mb-4" />
              <h2 className="font-heading font-extrabold text-2xl mb-2">
                {t("Tasdiqlandi", "Подтверждено", "Confirmed")}
              </h2>
              <p className="text-sm text-[var(--color-slate-500)]">
                {t("Yo'naltiramiz...", "Перенаправляем...", "Redirecting...")}
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function StageProgress({ stage }: { stage: Stage }) {
  const stages: Stage[] = ["intro", "rules", "quiz", "sign", "done"];
  const idx = stages.indexOf(stage);
  return (
    <div className="flex items-center gap-1 mt-1">
      {stages.slice(0, 4).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i <= idx ? "bg-[var(--color-brand)]" : "bg-[var(--color-slate-200)]",
          )}
        />
      ))}
    </div>
  );
}
