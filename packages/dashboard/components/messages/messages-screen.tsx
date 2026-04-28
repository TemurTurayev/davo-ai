"use client";

/**
 * Messages — Doctor 1-on-1 chat (async).
 * UX per research: thread-style, no real-time pressure, predictable response times.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Stethoscope, CheckCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { getWebApp } from "@/lib/telegram";

interface Message {
  id: string;
  from: "patient" | "doctor";
  text: string;
  timestamp: Date;
}

const SEED_MESSAGES = (lang: "uz" | "ru" | "en"): Message[] => {
  const base = new Date();
  base.setDate(base.getDate() - 2);
  const m1 = new Date(base);
  const m2 = new Date(base); m2.setHours(m2.getHours() + 1);
  const m3 = new Date(); m3.setHours(m3.getHours() - 5);

  if (lang === "uz") return [
    { id: "1", from: "doctor", timestamp: m1, text: "Salom Sardor. Men sizning shifokoringiz, doktor Tursunov. Savollaringiz bo'lsa shu yerda yozing." },
    { id: "2", from: "patient", timestamp: m2, text: "Salom doktor. Birinchi haftada qornda og'irlik bo'lyapti, normalmi?" },
    { id: "3", from: "doctor", timestamp: m3, text: "Bu rifampitsindan, normal. Agar 3-4 kunda o'tmasa — ovqat bilan iching, men ko'rib chiqamiz." },
  ];
  if (lang === "ru") return [
    { id: "1", from: "doctor", timestamp: m1, text: "Здравствуйте, Сардор. Я ваш лечащий врач, доктор Турсунов. Если будут вопросы — пишите здесь." },
    { id: "2", from: "patient", timestamp: m2, text: "Здравствуйте доктор. Первую неделю чувствую тяжесть в животе, это нормально?" },
    { id: "3", from: "doctor", timestamp: m3, text: "Это от рифампицина, в пределах нормы. Если не пройдёт за 3-4 дня — попробуйте принимать с едой, я понаблюдаю." },
  ];
  return [
    { id: "1", from: "doctor", timestamp: m1, text: "Hi Sardor. I'm Dr. Tursunov, your treating physician. Reply here with any questions." },
    { id: "2", from: "patient", timestamp: m2, text: "Hello doctor. First week I feel some stomach heaviness — is this normal?" },
    { id: "3", from: "doctor", timestamp: m3, text: "That's from rifampicin, within normal range. If it doesn't pass in 3-4 days, try with food — I'll monitor." },
  ];
};

export function MessagesScreen({ locale }: { locale: string }) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const [messages, setMessages] = useState<Message[]>(() => SEED_MESSAGES(lang));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    getWebApp()?.HapticFeedback.impactOccurred("light");

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      from: "patient",
      text: draft.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");

    // Mock doctor reply after 1.5s
    setTimeout(() => {
      const reply = mockDoctorReply(userMsg.text, lang);
      setMessages((prev) => [
        ...prev,
        { id: `d-${Date.now()}`, from: "doctor", text: reply, timestamp: new Date() },
      ]);
      getWebApp()?.HapticFeedback.notificationOccurred("success");
      setSending(false);
    }, 1500);
  };

  const placeholder = {
    uz: "Shifokorga yozing...",
    ru: "Напишите врачу...",
    en: "Message your doctor...",
  };

  return (
    <main className="bg-aurora min-h-screen flex flex-col relative">
      {/* Doctor header */}
      <header className="glass-bar sticky top-0 z-10 px-5 py-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-dark)] flex items-center justify-center shadow-md">
          <Stethoscope size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading font-bold">
            {lang === "uz" && "Doktor Tursunov"}
            {lang === "ru" && "Доктор Турсунов"}
            {lang === "en" && "Dr. Tursunov"}
          </h1>
          <p className="text-xs text-[var(--color-slate-500)] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
            {lang === "uz" && "24 soat ichida javob beradi"}
            {lang === "ru" && "Отвечает в течение 24 ч"}
            {lang === "en" && "Replies within 24h"}
          </p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <Bubble key={msg.id} message={msg} lang={lang} />
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm w-fit"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" style={{ animationDelay: "0.2s" }} />
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" style={{ animationDelay: "0.4s" }} />
          </motion.div>
        )}
      </div>

      {/* Input */}
      <footer className="glass-bar-bottom sticky bottom-0 px-4 pt-3 pb-6">
        <div className="flex items-end gap-2 max-w-md mx-auto">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={placeholder[lang]}
            rows={1}
            className="flex-1 max-h-32 px-4 py-3 rounded-2xl bg-white border border-[var(--color-slate-200)] resize-none focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 text-sm"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="w-12 h-12 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
          >
            <Send size={20} />
          </button>
        </div>
      </footer>
    </main>
  );
}

function Bubble({ message, lang }: { message: Message; lang: "uz" | "ru" | "en" }) {
  const isDoctor = message.from === "doctor";
  const time = message.timestamp.toLocaleTimeString(
    lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US",
    { hour: "2-digit", minute: "2-digit" },
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isDoctor ? "justify-start" : "justify-end")}
    >
      <div
        className={cn(
          "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isDoctor
            ? "bg-white shadow-sm border border-[var(--color-slate-200)] rounded-bl-sm"
            : "bg-[var(--color-brand)] text-white shadow-sm rounded-br-sm",
        )}
      >
        <p>{message.text}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-[10px]",
            isDoctor ? "text-[var(--color-slate-400)]" : "text-white/75 justify-end",
          )}
        >
          <span className="tabular">{time}</span>
          {!isDoctor && <CheckCheck size={12} />}
        </div>
      </div>
    </motion.div>
  );
}

/* Mock doctor reply — domain-aware fallback */
function mockDoctorReply(userMsg: string, lang: "uz" | "ru" | "en"): string {
  const lc = userMsg.toLowerCase();
  if (lc.match(/sariq|жёлт|желтоват|yellow/)) {
    return lang === "uz"
      ? "Sariqlik jiddiy belgi. Bugun klinikamizga keling, jigar testini olamiz."
      : lang === "ru"
      ? "Желтизна — серьёзный признак. Подойдите сегодня в клинику, сделаем печёночные пробы."
      : "Jaundice is a serious sign. Please come to the clinic today for liver tests.";
  }
  if (lc.match(/og'ri|болит|боль|pain/)) {
    return lang === "uz"
      ? "Tushundim. Og'riq qachon boshlandi va qaerda? Aniqroq aytsangiz tezroq yordam beraman."
      : lang === "ru"
      ? "Понял. Когда началась боль и где? Если опишете подробнее — быстрее помогу."
      : "Got it. When did the pain start and where? More details will help me respond faster.";
  }
  return lang === "uz"
    ? "Rahmat xabar uchun. Bugun ko'rib chiqaman, javob beraman."
    : lang === "ru"
    ? "Спасибо за сообщение. Посмотрю сегодня и отвечу."
    : "Thanks for your message. I'll review and reply today.";
}
