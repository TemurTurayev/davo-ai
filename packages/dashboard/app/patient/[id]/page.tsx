import Link from "next/link";
import { notFound } from "next/navigation";
import { findPatient } from "@/lib/data";
import type { Patient } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const patient = await findPatient(id);
  if (!patient) notFound();

  // Adherence calendar — последние 30 дней
  const last30Doses = adherenceCalendar(patient, 30);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">
        ← Patients
      </Link>

      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{patient.full_name}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {patient.region} · b. {patient.birth_year} · {patient.language.toUpperCase()} ·
            Tg #{patient.telegram_id}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm">
            Send message
          </button>
          <button className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--color-border)] bg-white text-sm">
            Schedule call
          </button>
        </div>
      </header>

      {/* Treatment summary */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Adherence" value={`${Math.round(patient.adherence_rate * 100)}%`} />
        <Stat label="Current streak" value={`${patient.current_streak} d`} />
        <Stat
          label="Drop-off risk"
          value={`${Math.round(patient.drop_off_risk_score * 100)}%`}
          accent={patient.drop_off_risk_score >= 0.7 ? "danger" : "primary"}
        />
        <Stat label="Treatment started" value={patient.treatment_started_at} />
      </section>

      {/* Drugs */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
        <h2 className="font-semibold mb-3">Текущая схема</h2>
        <div className="flex flex-wrap gap-2">
          {patient.drugs.map((d) => (
            <span
              key={d}
              className="px-2.5 py-1 rounded-full bg-[var(--color-bg)] text-sm ring-1 ring-[var(--color-border)]"
            >
              {d}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-2">
          Reminder time: {patient.reminder_time} ({patient.region})
        </p>
      </section>

      {/* Adherence calendar */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
        <h2 className="font-semibold mb-3">Adherence — last 30 days</h2>
        <div className="flex flex-wrap gap-1">
          {last30Doses.map((day, i) => (
            <div
              key={i}
              title={`${day.date}: ${day.taken ? "✓ taken" : "✗ missed"}`}
              className={`w-6 h-6 rounded ${day.taken ? "bg-emerald-500" : "bg-red-200"}`}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-[var(--color-muted)]">
          <span>
            <span className="inline-block w-3 h-3 bg-emerald-500 rounded mr-1"></span>
            Taken
          </span>
          <span>
            <span className="inline-block w-3 h-3 bg-red-200 rounded mr-1"></span>
            Missed
          </span>
        </div>
      </section>

      {/* Side effects */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Side effects ({patient.side_effects.length})</h2>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {patient.side_effects.length === 0 && (
            <li className="px-5 py-6 text-sm text-[var(--color-muted)] text-center">
              Нет зарегистрированных побочных эффектов
            </li>
          )}
          {patient.side_effects.slice().reverse().map((se, i) => (
            <li key={i} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm">{se.text}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {se.occurred_at} · day +{se.day_offset}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ring-1 ring-inset ${severityClass(se.severity)}`}
              >
                {se.severity}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "danger";
}) {
  const color =
    accent === "primary"
      ? "text-[var(--color-primary)]"
      : accent === "danger"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-fg)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function severityClass(s: string): string {
  switch (s) {
    case "emergency":
      return "bg-red-100 text-red-800 ring-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "medium":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    default:
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
}

function adherenceCalendar(patient: Patient, days: number): Array<{ date: string; taken: boolean }> {
  const taken = new Set(patient.verified_doses);
  const result: Array<{ date: string; taken: boolean }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    result.push({ date: iso, taken: taken.has(iso) });
  }
  return result;
}
