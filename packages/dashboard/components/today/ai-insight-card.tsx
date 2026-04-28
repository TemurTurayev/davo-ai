"use client";

/**
 * AIInsightCard — daily AI-generated tip based on patient context.
 * In production: server action calls Aya 32B with patient context.
 * For demo: rotating set of high-quality medical tips per locale.
 */

import { useEffect, useMemo, useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInsightCardProps {
  locale: string;
  treatmentDay: number;
}

const TIPS: Record<string, { title: string; body: string }[]> = {
  uz: [
    {
      title: "Tabletkani taom bilan iching",
      body: "Rifampitsin bo'sh oshqozonga ichish kerak, lekin agar ko'ngil aynisa — ozgina nonbar bilan bo'lishi mumkin. Asosiysi — har kuni bir vaqtda.",
    },
    {
      title: "Suvni ko'p iching",
      body: "Kuniga 8 stakan suv jigarga yordam beradi va siydikning to'q rangini tezroq tozalaydi.",
    },
    {
      title: "Vitamin B6 muhim",
      body: "Izoniazid bilan birga B6 (piridoksin) ichish — qo'l-oyoq uvishishini oldini oladi.",
    },
    {
      title: "Quyoshda ehtiyot bo'ling",
      body: "Pirazinamid teringizni quyoshga sezgir qiladi. SPF 50+ ishlating va to'g'ridan-to'g'ri quyoshda kam bo'ling.",
    },
    {
      title: "Vaznni har hafta o'lchang",
      body: "Vazn yo'qolishi davolanish samarasizligini ko'rsatishi mumkin. Profilingizda yozib boring.",
    },
    {
      title: "Davolanish — marafon, sprint emas",
      body: "6 oy ko'p ko'rinadi, lekin har bir kun sizni g'alabaga yaqinlashtiradi. Bugun 1 kun yutgansiz.",
    },
  ],
  ru: [
    {
      title: "Принимайте вместе с едой",
      body: "Рифампицин лучше пить натощак, но если тошнит — можно с лёгким перекусом. Главное — каждый день в одно и то же время.",
    },
    {
      title: "Пейте больше воды",
      body: "8 стаканов в день помогают печени и быстрее очищают тёмную окраску мочи.",
    },
    {
      title: "Витамин B6 важен",
      body: "С изониазидом нужен B6 (пиридоксин) — он защищает от онемения рук и ног.",
    },
    {
      title: "Берегитесь солнца",
      body: "Пиразинамид делает кожу чувствительной к солнцу. Используйте SPF 50+ и меньше находитесь на прямом солнце.",
    },
    {
      title: "Взвешивайтесь раз в неделю",
      body: "Потеря веса может означать что лечение нужно скорректировать. Запишите в профиле.",
    },
    {
      title: "Лечение — марафон, не спринт",
      body: "6 месяцев кажутся долгими, но каждый день приближает вас к победе. Сегодня вы выиграли ещё один день.",
    },
  ],
  en: [
    {
      title: "Take with food if needed",
      body: "Rifampicin works best on empty stomach, but if you feel nauseous — a light snack is okay. Consistency matters more than timing.",
    },
    {
      title: "Drink plenty of water",
      body: "8 glasses a day support liver health and clear the dark urine color faster.",
    },
    {
      title: "Vitamin B6 matters",
      body: "Take pyridoxine (B6) with isoniazid — it prevents tingling in hands and feet.",
    },
    {
      title: "Watch out for sunlight",
      body: "Pyrazinamide makes skin sun-sensitive. Use SPF 50+ and minimize direct sun exposure.",
    },
    {
      title: "Weigh yourself weekly",
      body: "Weight loss can signal treatment needs adjustment. Track it in your profile.",
    },
    {
      title: "Treatment is a marathon",
      body: "6 months feels long, but every day brings you closer to recovery. Today you won another day.",
    },
  ],
};

export function AIInsightCard({ locale, treatmentDay }: AIInsightCardProps) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const pool = TIPS[lang];

  // Initial seeded by treatment day
  const [index, setIndex] = useState(treatmentDay % pool.length);

  // Rotate every 24h based on treatment day in production
  useEffect(() => {
    setIndex(treatmentDay % pool.length);
  }, [treatmentDay, pool.length]);

  const tip = pool[index];

  const labelMap = { uz: "AI Maslahati", ru: "Совет AI", en: "AI Tip" };
  const refreshLabel = { uz: "Yangisi", ru: "Другой", en: "Refresh" };

  return (
    <div className="glass relative overflow-hidden">
      {/* Decorative orb */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-brand)]/30 to-[var(--color-accent)]/30 blur-2xl pointer-events-none" />

      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-dark)] flex items-center justify-center shrink-0 shadow-md">
          <Sparkles size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand)]">
              {labelMap[lang]}
            </span>
            <button
              onClick={() => setIndex((i) => (i + 1) % pool.length)}
              className="text-xs text-[var(--color-slate-500)] flex items-center gap-1 hover:text-[var(--color-brand)] transition"
              aria-label={refreshLabel[lang]}
            >
              <RotateCcw size={12} />
              {refreshLabel[lang]}
            </button>
          </div>
          <h3 className="font-heading font-bold text-[var(--color-ink)] mb-1">{tip.title}</h3>
          <p className="text-sm text-[var(--color-slate-700)] leading-relaxed">{tip.body}</p>
        </div>
      </div>
    </div>
  );
}
