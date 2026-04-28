"use client";

/**
 * Onboarding Wizard — 5-step flow (~90 sec total)
 * Per UX research: do NOT ask for everything in step 1.
 * Steps: name → regimen → time → permissions → done
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Activity, HelpCircle, Camera, Bell, ChevronLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTBControlStore, type Regimen } from "@/lib/store";
import { getWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { TBControlLogo } from "@/components/brand/tb-control-logo";

interface OnboardingWizardProps {
  locale: string;
}

const TOTAL_STEPS = 5;

export function OnboardingWizard({ locale }: OnboardingWizardProps) {
  const router = useRouter();
  const t = useTranslations();
  const tOb = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [regimen, setRegimen] = useState<Regimen>("dstb");
  const [time, setTime] = useState("08:00");
  const [perms, setPerms] = useState({ camera: false, notifications: false });

  const store = useTBControlStore();

  const haptic = (style: "light" | "medium" = "light") => {
    getWebApp()?.HapticFeedback.impactOccurred(style);
  };

  const success = () => {
    getWebApp()?.HapticFeedback.notificationOccurred("success");
  };

  const goNext = () => {
    haptic();
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      // Complete
      store.setName(name.trim() || "Bemor");
      store.setRegimen(regimen);
      store.setReminderTime(time);
      store.setPermission("camera", perms.camera);
      store.setPermission("notifications", perms.notifications);
      store.completeOnboarding();
      success();
      router.push(`/${locale}/today`);
    }
  };

  const goBack = () => {
    haptic();
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length >= 2;
    return true;
  };

  return (
    <main className="min-h-screen flex flex-col bg-[var(--color-bg-warm)]">
      {/* Header with progress + back */}
      <header className="sticky top-0 z-10 bg-[var(--color-bg-warm)]/90 backdrop-blur-md px-5 py-3 border-b border-[var(--color-slate-200)]/50">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-[var(--color-mist)]"
            aria-label={tCommon("back")}
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-sm tabular text-[var(--color-slate-500)]">
            {tOb("step", { current: step, total: TOTAL_STEPS })}
          </span>
          <div className="w-10" />
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-[var(--color-slate-200)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[var(--color-brand)]"
            initial={false}
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </header>

      {/* Steps */}
      <div className="flex-1 px-5 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === 1 && (
              <StepName name={name} setName={setName} placeholder={tOb("name_placeholder")} title={tOb("name_title")} />
            )}
            {step === 2 && (
              <StepRegimen
                regimen={regimen}
                setRegimen={setRegimen}
                title={tOb("regimen_title")}
                t={tOb}
              />
            )}
            {step === 3 && <StepTime time={time} setTime={setTime} title={tOb("time_title")} sub={tOb("time_sub")} />}
            {step === 4 && (
              <StepPermissions
                perms={perms}
                setPerms={setPerms}
                title={tOb("permissions_title")}
                cameraLabel={tOb("permissions_camera")}
                notifLabel={tOb("permissions_notifications")}
              />
            )}
            {step === 5 && <StepDone time={time} title={tOb("complete_title")} sub={tOb("complete_sub", { time })} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <footer className="sticky bottom-0 px-5 pt-3 pb-6 bg-[var(--color-bg-warm)]/95 backdrop-blur-md border-t border-[var(--color-slate-200)]/50">
        <Button
          size="lg"
          block
          onClick={goNext}
          disabled={!canProceed()}
        >
          {step === TOTAL_STEPS ? tCommon("done") : tCommon("next")}
        </Button>
      </footer>
    </main>
  );
}

/* ── Step 1: Name ─────────────────────────────────────────── */
function StepName({
  name,
  setName,
  placeholder,
  title,
}: {
  name: string;
  setName: (s: string) => void;
  placeholder: string;
  title: string;
}) {
  return (
    <div>
      <TBControlLogo size={56} className="mb-6" />
      <h1 className="text-2xl font-heading font-extrabold mb-3">{title}</h1>
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="w-full h-14 px-4 rounded-[12px] border border-[var(--color-slate-200)] bg-white text-base focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition"
        maxLength={100}
      />
    </div>
  );
}

/* ── Step 2: Regimen ──────────────────────────────────────── */
function StepRegimen({
  regimen,
  setRegimen,
  title,
  t,
}: {
  regimen: Regimen;
  setRegimen: (r: Regimen) => void;
  title: string;
  t: (k: string) => string;
}) {
  const options: { id: Regimen; icon: React.ReactNode; title: string; desc: string }[] = [
    { id: "dstb", icon: <Pill size={24} />, title: t("regimen_dstb"), desc: t("regimen_dstb_desc") },
    { id: "mdr", icon: <Activity size={24} />, title: t("regimen_mdr"), desc: t("regimen_mdr_desc") },
    { id: "unknown", icon: <HelpCircle size={24} />, title: t("regimen_unknown"), desc: t("regimen_unknown_desc") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-heading font-extrabold mb-5">{title}</h1>
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => {
              setRegimen(opt.id);
              getWebApp()?.HapticFeedback.selectionChanged();
            }}
            className={cn(
              "w-full text-left p-4 rounded-[14px] border-2 bg-white transition flex items-center gap-3",
              regimen === opt.id
                ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/30 shadow-sm"
                : "border-[var(--color-slate-200)] hover:border-[var(--color-slate-400)]",
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              regimen === opt.id ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-mist)] text-[var(--color-slate-500)]",
            )}>
              {opt.icon}
            </div>
            <div className="flex-1">
              <div className="font-heading font-bold">{opt.title}</div>
              <div className="text-sm text-[var(--color-slate-500)]">{opt.desc}</div>
            </div>
            {regimen === opt.id && <Check className="text-[var(--color-brand)]" size={20} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Step 3: Time picker ──────────────────────────────────── */
function StepTime({
  time,
  setTime,
  title,
  sub,
}: {
  time: string;
  setTime: (t: string) => void;
  title: string;
  sub: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-heading font-extrabold mb-2">{title}</h1>
      <p className="text-[var(--color-slate-500)] mb-6">{sub}</p>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full h-20 text-5xl font-heading font-bold text-center tabular bg-white rounded-[16px] border border-[var(--color-slate-200)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[var(--color-brand)]/15"
      />
      <p className="text-center text-sm text-[var(--color-slate-500)] mt-4">
        {time}
      </p>
    </div>
  );
}

/* ── Step 4: Permissions ──────────────────────────────────── */
function StepPermissions({
  perms,
  setPerms,
  title,
  cameraLabel,
  notifLabel,
}: {
  perms: { camera: boolean; notifications: boolean };
  setPerms: (p: { camera: boolean; notifications: boolean }) => void;
  title: string;
  cameraLabel: string;
  notifLabel: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-heading font-extrabold mb-5">{title}</h1>
      <div className="flex flex-col gap-3">
        <PermToggle
          icon={<Camera size={24} />}
          label={cameraLabel}
          checked={perms.camera}
          onChange={async (v) => {
            if (v) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach((t) => t.stop());
                setPerms({ ...perms, camera: true });
              } catch {
                setPerms({ ...perms, camera: false });
              }
            } else {
              setPerms({ ...perms, camera: false });
            }
          }}
        />
        <PermToggle
          icon={<Bell size={24} />}
          label={notifLabel}
          checked={perms.notifications}
          onChange={(v) => setPerms({ ...perms, notifications: v })}
        />
      </div>
    </div>
  );
}

function PermToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full p-4 rounded-[14px] border-2 bg-white transition flex items-center gap-3 text-left",
        checked ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/30" : "border-[var(--color-slate-200)]",
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        checked ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-mist)] text-[var(--color-slate-500)]",
      )}>
        {icon}
      </div>
      <span className="flex-1 font-medium">{label}</span>
      <div className={cn(
        "w-12 h-7 rounded-full p-0.5 transition",
        checked ? "bg-[var(--color-brand)]" : "bg-[var(--color-slate-200)]",
      )}>
        <div className={cn(
          "w-6 h-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )} />
      </div>
    </button>
  );
}

/* ── Step 5: Done ─────────────────────────────────────────── */
function StepDone({ time, title, sub }: { time: string; title: string; sub: string }) {
  return (
    <div className="text-center pt-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-24 h-24 rounded-full bg-[var(--color-brand)] mx-auto mb-6 flex items-center justify-center"
      >
        <Check size={48} className="text-white" strokeWidth={3} />
      </motion.div>
      <h1 className="text-2xl font-heading font-extrabold mb-2">{title}</h1>
      <p className="text-[var(--color-slate-500)] max-w-xs mx-auto">{sub}</p>
    </div>
  );
}
