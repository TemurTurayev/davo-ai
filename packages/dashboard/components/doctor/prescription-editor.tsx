"use client";

/**
 * Doctor Prescription Editor.
 * Doctor selects WHO protocol → can edit doses → assigns to patient.
 *
 * Demo flow: edit current patient's prescription (TB Control demo patient).
 * Production: would have patient picker / search.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Save,
  Calendar,
  User as UserIcon,
  Pill,
  Plus,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { useTBControlStore, type DrugCode, type ProtocolId } from "@/lib/store";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PROTOCOL_LIST, PROTOCOLS, DRUG_LABELS, buildPrescription } from "@/lib/protocols";
import { cn } from "@/lib/utils";

export function PrescriptionEditor({ locale }: { locale: string }) {
  const router = useRouter();
  const { prescription, setPrescription } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // Editable form state
  const [patientName, setPatientName] = useState(prescription?.patientName || "Sardor Toshmatov");
  const [doctorName, setDoctorName] = useState(prescription?.doctorName || "Dr. A.X. Tursunov");
  const [protocolId, setProtocolId] = useState<Exclude<ProtocolId, "custom">>(
    (prescription?.protocol !== "custom" ? prescription?.protocol : "ds-tb-2hrze-4hr") || "ds-tb-2hrze-4hr",
  );
  const [startDate, setStartDate] = useState(
    prescription?.startDate || new Date().toISOString().slice(0, 10),
  );
  const [doseTime, setDoseTime] = useState(prescription?.doses[0]?.time || "08:00");
  const [drugs, setDrugs] = useState(
    prescription?.doses[0]?.drugs ?? PROTOCOLS["ds-tb-2hrze-4hr"].schedule(1)[0].drugs,
  );
  const [saved, setSaved] = useState(false);

  const protocolDef = PROTOCOLS[protocolId];

  const applyProtocol = (id: Exclude<ProtocolId, "custom">) => {
    setProtocolId(id);
    setDrugs(PROTOCOLS[id].schedule(1)[0].drugs);
  };

  const updateDrugCount = (idx: number, delta: number) => {
    setDrugs((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, count: Math.max(0, d.count + delta) } : d))
        .filter((d) => d.count > 0),
    );
  };

  const removeDrug = (idx: number) => {
    setDrugs((prev) => prev.filter((_, i) => i !== idx));
  };

  const addDrug = (code: DrugCode) => {
    if (drugs.some((d) => d.drugCode === code)) return;
    setDrugs((prev) => [...prev, { drugCode: code, dosageMg: 600, count: 1 }]);
  };

  const save = () => {
    const base = buildPrescription({
      protocolId,
      patientName,
      patientId: prescription?.patientId || "demo-patient-1",
      startDate: new Date(startDate),
      doctorName,
    });
    setPrescription({
      ...base,
      doses: [{ ...base.doses[0], time: doseTime, drugs }],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const allDrugCodes = Object.keys(DRUG_LABELS) as DrugCode[];
  const availableDrugs = allDrugCodes.filter((c) => !drugs.some((d) => d.drugCode === c));

  return (
    <main className="bg-aurora min-h-screen relative overflow-hidden pb-12">
      <div className="orb orb-mint w-72 h-72 -top-20 -right-20 animate-float-slow" />

      <div className="relative z-10 max-w-2xl mx-auto px-5 pt-6 pb-6">
        {/* Header */}
        <header className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push(`/${locale}/doctor`)}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-heading font-extrabold text-2xl">
              {t("Tayinlash", "Назначение", "Prescription")}
            </h1>
            <p className="text-xs text-[var(--color-slate-500)]">
              {t("Bemor uchun davolanish rejimi", "Режим лечения для пациента", "Treatment regimen for patient")}
            </p>
          </div>
        </header>

        {/* Patient + doctor */}
        <GlassCard className="p-4 mb-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-slate-500)] mb-3">
            {t("Bemor ma'lumotlari", "Данные пациента", "Patient info")}
          </p>
          <div className="space-y-3">
            <Field
              icon={<UserIcon size={16} />}
              label={t("Bemor F.I.O", "Ф.И.О пациента", "Patient name")}
              value={patientName}
              onChange={setPatientName}
            />
            <Field
              icon={<UserIcon size={16} />}
              label={t("Shifokor", "Врач", "Doctor")}
              value={doctorName}
              onChange={setDoctorName}
            />
            <Field
              icon={<Calendar size={16} />}
              label={t("Boshlash sanasi", "Дата начала", "Start date")}
              value={startDate}
              onChange={setStartDate}
              type="date"
            />
            <Field
              icon={<Calendar size={16} />}
              label={t("Qabul vaqti", "Время приёма", "Dose time")}
              value={doseTime}
              onChange={setDoseTime}
              type="time"
            />
          </div>
        </GlassCard>

        {/* Protocol picker */}
        <GlassCard className="p-4 mb-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-slate-500)] mb-3">
            {t("WHO protokoli", "Протокол ВОЗ", "WHO protocol")}
          </p>
          <div className="space-y-2">
            {PROTOCOL_LIST.map((p) => {
              const active = p.id === protocolId;
              return (
                <button
                  key={p.id}
                  onClick={() => applyProtocol(p.id as Exclude<ProtocolId, "custom">)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all",
                    active
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40"
                      : "border-[var(--color-slate-200)] hover:border-[var(--color-slate-300)]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{p[`name${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as "nameUz" | "nameRu" | "nameEn"]}</p>
                    {active && <CheckCircle2 size={16} className="text-[var(--color-brand)]" />}
                  </div>
                  <p className="text-xs text-[var(--color-slate-500)] mt-0.5 leading-relaxed">
                    {p.description[lang]}
                  </p>
                  <p className="text-[10px] text-[var(--color-slate-400)] mt-1 tabular">
                    {p.durationDays} {t("kun", "дней", "days")}
                  </p>
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Drugs editor */}
        <GlassCard className="p-4 mb-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-slate-500)] mb-3">
            {t("Tayinlangan dorilar", "Назначенные препараты", "Prescribed drugs")}
          </p>
          <div className="space-y-2">
            {drugs.map((drug, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--color-slate-200)]"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ backgroundColor: DRUG_LABELS[drug.drugCode].color }}
                >
                  {DRUG_LABELS[drug.drugCode].abbr}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{DRUG_LABELS[drug.drugCode][lang]}</p>
                  <input
                    type="number"
                    value={drug.dosageMg}
                    onChange={(e) =>
                      setDrugs((prev) =>
                        prev.map((d, idx) =>
                          idx === i ? { ...d, dosageMg: parseInt(e.target.value) || 0 } : d,
                        ),
                      )
                    }
                    className="text-xs text-[var(--color-slate-500)] bg-transparent outline-none border-b border-transparent focus:border-[var(--color-brand)] tabular w-20"
                  />
                  <span className="text-xs text-[var(--color-slate-500)]"> mg × </span>
                  <span className="text-xs text-[var(--color-slate-500)] tabular">
                    {drug.count}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateDrugCount(i, -1)}
                    className="w-7 h-7 rounded-lg bg-[var(--color-mist)] flex items-center justify-center text-[var(--color-slate-600)] hover:bg-[var(--color-slate-200)]"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold tabular text-sm">{drug.count}</span>
                  <button
                    onClick={() => updateDrugCount(i, 1)}
                    className="w-7 h-7 rounded-lg bg-[var(--color-brand-soft)] flex items-center justify-center text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add drug picker */}
          {availableDrugs.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-[var(--color-slate-500)] mb-2">
                {t("Qo'shish:", "Добавить:", "Add:")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableDrugs.slice(0, 8).map((code) => (
                  <button
                    key={code}
                    onClick={() => addDrug(code)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow-sm active:scale-95 transition"
                    style={{ backgroundColor: DRUG_LABELS[code].color }}
                  >
                    + {DRUG_LABELS[code].abbr}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Save */}
        <Button onClick={save} block size="lg" className="mb-3">
          <Save size={18} />
          {saved
            ? t("Saqlandi ✓", "Сохранено ✓", "Saved ✓")
            : t("Tayinlashni saqlash", "Сохранить назначение", "Save prescription")}
        </Button>

        <p className="text-xs text-center text-[var(--color-slate-400)]">
          {t(
            "Bemor ushbu rejimni ko'radi va o'zgartira olmaydi.",
            "Пациент увидит этот режим и не сможет его изменить.",
            "Patient sees this regimen and cannot edit it.",
          )}
        </p>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-2 mb-1 text-xs font-medium text-[var(--color-slate-500)]">
        {icon}
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-slate-200)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 text-sm"
      />
    </label>
  );
}
