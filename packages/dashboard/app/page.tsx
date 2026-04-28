// Главная страница: список пациентов с риск-скорами

import Link from "next/link";
import { loadCohort } from "@/lib/data";
import type { AdherenceProfile, Patient } from "@/lib/types";

export const dynamic = "force-static";

const PROFILE_COLOR: Record<AdherenceProfile, string> = {
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  poor: "bg-orange-50 text-orange-700 ring-orange-200",
  dropout: "bg-red-50 text-red-700 ring-red-200",
};

function riskBadge(risk: number): string {
  if (risk >= 0.7) return "bg-red-50 text-red-700 ring-red-200";
  if (risk >= 0.4) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

export default async function PatientsPage() {
  const cohort = await loadCohort();

  const stats = {
    total: cohort.length,
    high_risk: cohort.filter((p) => p.drop_off_risk_score >= 0.7).length,
    avg_adherence:
      cohort.reduce((s, p) => s + p.adherence_rate, 0) / cohort.length,
    on_streak: cohort.filter((p) => p.current_streak >= 7).length,
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total patients" value={String(stats.total)} />
        <Kpi
          label="High drop-off risk"
          value={String(stats.high_risk)}
          accent="danger"
        />
        <Kpi
          label="Avg adherence"
          value={`${Math.round(stats.avg_adherence * 100)}%`}
          accent="primary"
        />
        <Kpi
          label="On streak ≥7d"
          value={String(stats.on_streak)}
          accent="success"
        />
      </section>

      {/* Patient list */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold">Patients</h2>
          <span className="text-xs text-[var(--color-muted)]">
            Sorted by drop-off risk
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
            <tr>
              <Th>Name</Th>
              <Th>Region</Th>
              <Th>Profile</Th>
              <Th>Adherence</Th>
              <Th>Streak</Th>
              <Th>SE</Th>
              <Th>Risk</Th>
            </tr>
          </thead>
          <tbody>
            {cohort
              .slice()
              .sort((a, b) => b.drop_off_risk_score - a.drop_off_risk_score)
              .map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                  <Td>
                    <Link
                      href={`/patient/${p.id}`}
                      className="font-medium hover:text-[var(--color-primary)]"
                    >
                      {p.full_name}
                    </Link>
                    <p className="text-xs text-[var(--color-muted)]">
                      Tg #{p.telegram_id} · {p.language.toUpperCase()}
                    </p>
                  </Td>
                  <Td>{p.region}</Td>
                  <Td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ring-1 ring-inset ${PROFILE_COLOR[p.profile]}`}
                    >
                      {p.profile}
                    </span>
                  </Td>
                  <Td>{Math.round(p.adherence_rate * 100)}%</Td>
                  <Td>
                    {p.current_streak} {p.current_streak >= 7 && "🔥"}
                  </Td>
                  <Td>
                    {p.side_effects.length}
                    {p.side_effects.some((s) => s.severity === "high" || s.severity === "emergency") && (
                      <span className="ml-1 text-red-600">⚠</span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ring-1 ring-inset ${riskBadge(p.drop_off_risk_score)}`}
                    >
                      {Math.round(p.drop_off_risk_score * 100)}%
                    </span>
                  </Td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-5 py-2 text-xs uppercase tracking-wider">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3">{children}</td>;
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "danger" | "success";
}) {
  const color =
    accent === "primary"
      ? "text-[var(--color-primary)]"
      : accent === "danger"
        ? "text-[var(--color-danger)]"
        : accent === "success"
          ? "text-[var(--color-success)]"
          : "text-[var(--color-fg)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
