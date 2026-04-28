import Link from "next/link";
import { getUrgentSideEffects, getAtRiskPatients } from "@/lib/data";

export const dynamic = "force-static";

export default async function AlertsPage() {
  const urgentSE = await getUrgentSideEffects();
  const atRisk = await getAtRiskPatients();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>

      {/* Urgent side effects */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="text-red-600">⚠</span>
            Urgent side effects
          </h2>
          <span className="text-xs text-[var(--color-muted)]">{urgentSE.length} total</span>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {urgentSE.slice(0, 20).map(({ patient, sideEffect }, i) => (
            <li key={i} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <Link
                    href={`/patient/${patient.id}`}
                    className="font-medium hover:text-[var(--color-primary)]"
                  >
                    {patient.full_name}
                  </Link>
                  {" — "}
                  <span className="text-[var(--color-muted)]">{sideEffect.text}</span>
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {sideEffect.occurred_at} · {patient.region}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 ring-1 ring-red-200">
                {sideEffect.severity}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* At-risk patients */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">High drop-off risk ({atRisk.length})</h2>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {atRisk.map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <Link
                  href={`/patient/${p.id}`}
                  className="font-medium hover:text-[var(--color-primary)]"
                >
                  {p.full_name}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">
                  {p.region} · adherence {Math.round(p.adherence_rate * 100)}% · {p.profile}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 ring-1 ring-red-200">
                {Math.round(p.drop_off_risk_score * 100)}% risk
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
