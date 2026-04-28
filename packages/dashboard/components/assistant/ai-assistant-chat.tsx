"use client";

/**
 * AI Assistant Chat — TB-domain expert.
 * Backed by local Qwen 2.5-14B AWQ on vast.ai (port 8001).
 * Falls back to mock pattern-matched replies if NEXT_PUBLIC_USE_MOCK_INFERENCE=true.
 *
 * Suggested prompts shown at top for low-tech-literacy users.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, AlertCircle, Stethoscope, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { chatWithAssistant, type ChatMessage } from "@/lib/inference";
import { getWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = {
  uz: [
    "Rifampitsindan qornim og'riyapti, nima qilay?",
    "Siydigim qizg'ish — bu xavflimi?",
    "Dozani o'tkazib yubordim, qanday harakat qilish kerak?",
  ],
  ru: [
    "Болит живот после рифампицина, что делать?",
    "Моча красноватая — это опасно?",
    "Пропустил дозу, как поступить?",
  ],
  en: [
    "Stomach pain after rifampicin — what to do?",
    "Reddish urine — is this dangerous?",
    "I missed a dose, what should I do?",
  ],
};

export function AIAssistantChat({ locale }: { locale: string }) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t(
        "Salom! Men sil davolanishi bo'yicha AI yordamchingizman. Dorilar, yon ta'sirlar yoki rejim haqida savol bering. Tibbiy holatlarda esa shifokoringizga murojaat qiling.",
        "Здравствуйте! Я AI-ассистент по лечению туберкулёза. Спросите про препараты, побочные эффекты или режим. По тревожным симптомам — обращайтесь к врачу.",
        "Hi! I'm your TB-treatment AI assistant. Ask about drugs, side effects, or your regimen. For alarming symptoms — contact your doctor.",
      ),
      timestamp: new Date(),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text?: string) => {
    const userText = (text ?? draft).trim();
    if (!userText || thinking) return;
    getWebApp()?.HapticFeedback.impactOccurred("light");

    const userMsg: UIMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setThinking(true);

    try {
      const history: ChatMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const reply = await chatWithAssistant(history, lang);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply, timestamp: new Date() },
      ]);
      getWebApp()?.HapticFeedback.notificationOccurred("success");
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: t(
            "Kechirasiz, hozir javob berolmadim. Iltimos, keyinroq urinib ko'ring yoki to'g'ridan-to'g'ri shifokoringiz bilan bog'laning.",
            "Извините, не могу ответить сейчас. Попробуйте позже или свяжитесь с врачом.",
            "Sorry, I can't respond right now. Please try later or contact your doctor.",
          ),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <main className="bg-aurora min-h-screen flex flex-col relative max-w-2xl mx-auto w-full">
      {/* Header */}
      <header className="sticky top-0 z-10 px-5 py-3 flex items-center gap-3 bg-white/85 backdrop-blur shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
          <Sparkles size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading font-bold flex items-center gap-1.5">
            {t("AI yordamchi", "AI-ассистент", "AI Assistant")}
            <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-bold uppercase tracking-wide">
              {t("TB Mutaxassis", "ТБ-эксперт", "TB Expert")}
            </span>
          </h1>
          <p className="text-xs text-[var(--color-slate-500)] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
            Qwen 14B · {t("mahalliy", "локально", "local")}
          </p>
        </div>
      </header>

      {/* Suggestions (shown when only welcome msg) */}
      {messages.length === 1 && (
        <div className="px-5 pt-4">
          <p className="text-xs text-[var(--color-slate-500)] mb-2 px-1">
            {t("Tezkor savollar:", "Быстрые вопросы:", "Quick questions:")}
          </p>
          <div className="space-y-2">
            {SUGGESTIONS[lang].map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => send(s)}
                className="w-full text-left px-4 py-3 rounded-2xl bg-white shadow-sm border border-[var(--color-slate-200)] hover:border-violet-300 hover:bg-violet-50/30 transition-colors text-sm"
              >
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <Bubble key={msg.id} message={msg} lang={lang} />
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl shadow-sm w-fit"
          >
            <Loader2 size={14} className="animate-spin text-violet-500" />
            <span className="text-xs text-[var(--color-slate-500)]">
              {t("O'ylayapti…", "Думаю…", "Thinking…")}
            </span>
          </motion.div>
        )}
      </div>

      {/* Disclaimer + input */}
      <footer className="sticky bottom-0 left-0 right-0 px-4 pt-2 pb-6 bg-gradient-to-t from-white via-white to-transparent">
        <p className="text-[10px] text-[var(--color-slate-400)] text-center mb-2 px-2 flex items-center justify-center gap-1">
          <AlertCircle size={10} />
          {t(
            "AI maslahat — favqulodda holatda shifokorga murojaat qiling",
            "Совет ИИ — в экстренных случаях обращайтесь к врачу",
            "AI advice — for emergencies, contact your doctor",
          )}
        </p>
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
            placeholder={t("Savol yozing…", "Напишите вопрос…", "Ask a question…")}
            rows={1}
            disabled={thinking}
            className="flex-1 max-h-32 px-4 py-3 rounded-2xl bg-white border border-[var(--color-slate-200)] resize-none focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 text-sm disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!draft.trim() || thinking}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-shadow"
          >
            <Send size={20} />
          </button>
        </div>
      </footer>
    </main>
  );
}

function Bubble({ message, lang }: { message: UIMessage; lang: "uz" | "ru" | "en" }) {
  const isAssistant = message.role === "assistant";
  const time = message.timestamp.toLocaleTimeString(
    lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US",
    { hour: "2-digit", minute: "2-digit" },
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
    >
      {isAssistant && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mr-2 shrink-0 self-end mb-1">
          <Sparkles size={14} className="text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
          isAssistant
            ? "bg-white border border-[var(--color-slate-200)] rounded-bl-sm"
            : "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white rounded-br-sm",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div
          className={cn(
            "text-[10px] mt-1",
            isAssistant ? "text-[var(--color-slate-400)]" : "text-white/75 text-right",
          )}
        >
          {time}
        </div>
      </div>
    </motion.div>
  );
}
