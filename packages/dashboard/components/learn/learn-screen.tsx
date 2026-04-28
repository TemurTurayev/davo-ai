"use client";

/**
 * Learn screen — Drug Education Cards.
 * Per research P0: explain drugs, side effects, what-to-do at high contrast (50+ readability).
 *
 * Cards collapse/expand. Glass header with drug + body solid for clinical accuracy.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, AlertCircle, Pill, Info } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { getWebApp } from "@/lib/telegram";

interface DrugInfo {
  id: string;
  letter: string;
  bg: string;
  name: { uz: string; ru: string; en: string };
  dose: string;
  what: { uz: string; ru: string; en: string };
  how: { uz: string; ru: string; en: string };
  side_effects: { uz: string[]; ru: string[]; en: string[] };
  red_flags: { uz: string[]; ru: string[]; en: string[] };
  miss_rule: { uz: string; ru: string; en: string };
}

const DRUGS: DrugInfo[] = [
  {
    id: "rifampicin",
    letter: "R",
    bg: "from-rose-500 to-rose-600",
    name: { uz: "Rifampitsin", ru: "Рифампицин", en: "Rifampicin" },
    dose: "600 mg / kun · 1×",
    what: {
      uz: "Bakteriyaning RNK sintezini bloklaydi. Sil davolashning eng muhim dorisi.",
      ru: "Блокирует синтез РНК у бактерии. Главный препарат лечения ТБ.",
      en: "Blocks bacterial RNA synthesis. The cornerstone of TB treatment.",
    },
    how: {
      uz: "Bo'sh oshqozonga, ovqatdan 1 soat oldin yoki 2 soat keyin. Ko'p suv ichish.",
      ru: "Натощак, за 1 час до еды или через 2 часа после. Пить много воды.",
      en: "On empty stomach, 1h before or 2h after meals. Drink plenty of water.",
    },
    side_effects: {
      uz: [
        "To'q-sariq siydik, ko'z yoshi, ter — bu NORMAL, dorining bo'yog'i",
        "Ko'ngil aynishi, ozgina qornda og'irlik (ovqat bilan iching agar qattiq)",
        "Engil bosh og'rig'i",
      ],
      ru: [
        "Оранжево-красная моча, слёзы, пот — это НОРМАЛЬНО, краситель препарата",
        "Тошнота, лёгкая тяжесть в животе (с едой если сильно)",
        "Лёгкая головная боль",
      ],
      en: [
        "Orange-red urine, tears, sweat — this is NORMAL, drug pigment",
        "Mild nausea, stomach discomfort (take with food if severe)",
        "Mild headache",
      ],
    },
    red_flags: {
      uz: [
        "Yuz/ko'z sariq bo'lishi",
        "Qora siydik bilan birga sariqlik",
        "Allergik toshma + isitma",
      ],
      ru: [
        "Желтизна лица или белков глаз",
        "Тёмная моча ВМЕСТЕ с желтизной",
        "Сыпь + температура",
      ],
      en: [
        "Yellowing of face or eye whites",
        "Dark urine WITH yellowing",
        "Rash + fever",
      ],
    },
    miss_rule: {
      uz: "Doza pauza ≥ 8 soat — keyingi rejimini saqlang. Ikki dozani BIRGA ICHMANG.",
      ru: "Если пропуск ≥ 8 часов — продолжайте по обычному графику. Две дозы вместе НЕ ПРИНИМАТЬ.",
      en: "If missed by ≥ 8 hours — continue with regular schedule. Do NOT double-dose.",
    },
  },
  {
    id: "isoniazid",
    letter: "H",
    bg: "from-slate-500 to-slate-600",
    name: { uz: "Izoniazid", ru: "Изониазид", en: "Isoniazid" },
    dose: "300 mg / kun · 1×",
    what: {
      uz: "Bakteriyaning hujayra devorini buzadi. Pirikson bilan birga ichiladi.",
      ru: "Разрушает клеточную стенку бактерии. Принимается с пиридоксином (B6).",
      en: "Disrupts bacterial cell wall. Taken with pyridoxine (B6).",
    },
    how: {
      uz: "Har kuni bir vaqtda. B6 (piridoksin) — qo'l-oyoq uvishishini oldini olish uchun.",
      ru: "Каждый день в одно время. С B6 (пиридоксин) — для защиты от онемения конечностей.",
      en: "Same time daily. With B6 (pyridoxine) — to prevent peripheral neuropathy.",
    },
    side_effects: {
      uz: [
        "Engil charchoq",
        "Boshda og'irlik dastlabki kunlar",
      ],
      ru: [
        "Лёгкая усталость",
        "Тяжесть в голове первые дни",
      ],
      en: [
        "Mild fatigue",
        "Heavy-headed first days",
      ],
    },
    red_flags: {
      uz: [
        "Sariqlik (jigar)",
        "Qo'l-oyoq uvishishi (B6 yetishmovchiligi)",
        "Ko'rish o'zgarishi",
      ],
      ru: [
        "Желтизна (печень)",
        "Онемение рук/ног (нехватка B6)",
        "Изменение зрения",
      ],
      en: [
        "Jaundice (liver)",
        "Numbness in hands/feet (B6 deficiency)",
        "Vision changes",
      ],
    },
    miss_rule: {
      uz: "Pauza ≥ 24 soat — shifokorga aytib, qaytadan boshlang.",
      ru: "Пропуск ≥ 24 часов — сообщите врачу, начните по новой.",
      en: "Missed ≥ 24 hours — tell doctor, restart schedule.",
    },
  },
  {
    id: "pyrazinamide",
    letter: "Z",
    bg: "from-stone-500 to-stone-600",
    name: { uz: "Pirazinamid", ru: "Пиразинамид", en: "Pyrazinamide" },
    dose: "1500-2000 mg / kun · 1×",
    what: {
      uz: "Faqat birinchi 2 oy. Faqatgina kislorodsiz muhitda yashayotgan bakteriyalarga ta'sir qiladi.",
      ru: "Только первые 2 месяца. Действует на бактерий в анаэробной среде.",
      en: "First 2 months only. Targets bacteria in anaerobic environments.",
    },
    how: {
      uz: "Ovqat bilan iching — oshqozonga yumshoqroq.",
      ru: "С едой — мягче для желудка.",
      en: "With food — easier on the stomach.",
    },
    side_effects: {
      uz: [
        "Bo'g'imlarda ozgina og'riq (asosan to'piq)",
        "Quyoshda terining qizarishi (SPF kerak!)",
        "Siydikda ozroq nordon",
      ],
      ru: [
        "Лёгкая боль в суставах (часто щиколотки)",
        "Покраснение кожи на солнце (нужен SPF!)",
        "Лёгкое повышение мочевой кислоты",
      ],
      en: [
        "Mild joint pain (often ankles)",
        "Skin redness in sun (use SPF!)",
        "Slight uric acid increase",
      ],
    },
    red_flags: {
      uz: [
        "Sariqlik",
        "To'piqning qattiq shishishi (podagra)",
      ],
      ru: [
        "Желтизна",
        "Сильный отёк щиколотки (подагра)",
      ],
      en: [
        "Jaundice",
        "Severe ankle swelling (gout)",
      ],
    },
    miss_rule: {
      uz: "Bir doza unutilsa — keyingi rejimida davom eting.",
      ru: "Пропустили дозу — продолжайте по обычному графику.",
      en: "Missed one dose — continue regular schedule.",
    },
  },
  {
    id: "ethambutol",
    letter: "E",
    bg: "from-amber-500 to-amber-600",
    name: { uz: "Etambutol", ru: "Этамбутол", en: "Ethambutol" },
    dose: "1200 mg / kun · 1×",
    what: {
      uz: "Bakteriya hujayra devorini sintezini sekinlashtiradi. Boshqa dorilarga turg'unlik oldini oladi.",
      ru: "Замедляет синтез клеточной стенки. Защищает от устойчивости к другим препаратам.",
      en: "Slows cell-wall synthesis. Prevents resistance to other drugs.",
    },
    how: {
      uz: "Har kuni bir vaqtda. Ovqat bilan yoki bo'sh oshqozonga.",
      ru: "Каждый день в одно время. С едой или натощак.",
      en: "Same time daily. With food or empty stomach.",
    },
    side_effects: {
      uz: [
        "Engil bosh og'rig'i",
      ],
      ru: [
        "Лёгкая головная боль",
      ],
      en: [
        "Mild headache",
      ],
    },
    red_flags: {
      uz: [
        "⚠️ Ko'rishning xiralashishi — DARHOL shifokorga!",
        "⚠️ Yashil-qizil ranglarni farqlay olmaslik",
        "⚠️ Markaziy ko'rish doirasi qisqarishi",
      ],
      ru: [
        "⚠️ Размытое зрение — НЕМЕДЛЕННО к врачу!",
        "⚠️ Не различаете зелёный/красный цвета",
        "⚠️ Сужение поля зрения",
      ],
      en: [
        "⚠️ Blurred vision — see doctor IMMEDIATELY!",
        "⚠️ Can't distinguish red/green",
        "⚠️ Tunnel vision",
      ],
    },
    miss_rule: {
      uz: "Pauza > 24 soat — shifokoringizga ayting.",
      ru: "Пропуск > 24 часов — сообщите врачу.",
      en: "Missed > 24h — tell your doctor.",
    },
  },
];

export function LearnScreen({ locale }: { locale: string }) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const [openId, setOpenId] = useState<string | null>(DRUGS[0].id);

  const titleMap = {
    uz: "Dorilar haqida",
    ru: "О препаратах",
    en: "About medications",
  };
  const subMap = {
    uz: "Har bir dorini bilish — davolanishingizni yaxshilaydi",
    ru: "Знание препаратов — основа успешного лечения",
    en: "Understanding your meds is key to successful treatment",
  };

  return (
    <main className="bg-aurora min-h-screen relative">
      <div className="orb orb-teal w-64 h-64 -left-20 top-40 opacity-30" />

      <div className="relative px-5 pt-6 pb-8 z-10">
        <header className="mb-6">
          <h1 className="font-heading font-extrabold text-2xl mb-1">{titleMap[lang]}</h1>
          <p className="text-sm text-[var(--color-slate-500)]">{subMap[lang]}</p>
        </header>

        <div className="flex flex-col gap-3">
          {DRUGS.map((drug) => (
            <DrugCard
              key={drug.id}
              drug={drug}
              lang={lang}
              isOpen={openId === drug.id}
              onToggle={() =>
                setOpenId((prev) => {
                  getWebApp()?.HapticFeedback.selectionChanged();
                  return prev === drug.id ? null : drug.id;
                })
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function DrugCard({
  drug,
  lang,
  isOpen,
  onToggle,
}: {
  drug: DrugInfo;
  lang: "uz" | "ru" | "en";
  isOpen: boolean;
  onToggle: () => void;
}) {
  const labels = {
    what: { uz: "Bu nima?", ru: "Что это?", en: "What is it?" },
    how: { uz: "Qanday qabul qilish?", ru: "Как принимать?", en: "How to take" },
    side: { uz: "Yon ta'sirlar (norma)", ru: "Побочки (норма)", en: "Side effects (normal)" },
    red: { uz: "Xavfli belgilar", ru: "Опасные признаки", en: "Red flags" },
    miss: { uz: "Agar dozani unutsangiz", ru: "Если пропустили дозу", en: "If you miss a dose" },
  };

  return (
    <article
      className={cn(
        "rounded-2xl bg-white border border-[var(--color-slate-200)] overflow-hidden transition-shadow",
        isOpen ? "shadow-lg" : "shadow-sm hover:shadow-md",
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${drug.bg} text-white font-extrabold text-lg flex items-center justify-center shadow-md shrink-0`}>
          {drug.letter}
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-bold text-base">{drug.name[lang]}</h3>
          <p className="text-xs text-[var(--color-slate-500)] tabular">{drug.dose}</p>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className="text-[var(--color-slate-400)]" />
        </motion.div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 space-y-4 border-t border-[var(--color-slate-200)] pt-4">
              <Section icon={<Info size={16} />} title={labels.what[lang]}>
                {drug.what[lang]}
              </Section>
              <Section icon={<Pill size={16} />} title={labels.how[lang]}>
                {drug.how[lang]}
              </Section>
              <Section icon={null} title={labels.side[lang]}>
                <ul className="space-y-1.5">
                  {drug.side_effects[lang].map((s, i) => (
                    <li key={i} className="text-sm text-[var(--color-slate-700)] flex gap-2">
                      <span className="text-[var(--color-slate-400)]">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <RedFlagSection title={labels.red[lang]} items={drug.red_flags[lang]} />
              <div className="rounded-lg bg-[var(--color-mist)] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)] mb-1">
                  {labels.miss[lang]}
                </p>
                <p className="text-sm text-[var(--color-slate-700)]">{drug.miss_rule[lang]}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon && <span className="text-[var(--color-brand)]">{icon}</span>}
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)]">
          {title}
        </h4>
      </div>
      <div className="text-sm text-[var(--color-slate-700)] leading-relaxed">{children}</div>
    </div>
  );
}

function RedFlagSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle size={16} className="text-[var(--color-danger)]" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-danger)]">
          {title}
        </h4>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-[var(--color-slate-700)] flex gap-2">
            <span className="text-[var(--color-danger)]">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
