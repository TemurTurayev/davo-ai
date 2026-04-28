// Серверная загрузка synthetic cohort. В продакшне заменить на DB queries.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Patient } from "./types";

const COHORT_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "data",
  "synthetic",
  "cohort.json",
);

let _cache: Patient[] | null = null;

export async function loadCohort(): Promise<Patient[]> {
  if (_cache) return _cache;
  const raw = await fs.readFile(COHORT_PATH, "utf-8");
  _cache = JSON.parse(raw) as Patient[];
  return _cache;
}

export async function findPatient(id: string): Promise<Patient | null> {
  const cohort = await loadCohort();
  return cohort.find((p) => p.id === id) ?? null;
}

export async function getAtRiskPatients(): Promise<Patient[]> {
  const cohort = await loadCohort();
  return cohort
    .filter((p) => p.drop_off_risk_score > 0.5)
    .sort((a, b) => b.drop_off_risk_score - a.drop_off_risk_score);
}

export async function getUrgentSideEffects(): Promise<
  Array<{ patient: Patient; sideEffect: Patient["side_effects"][number] }>
> {
  const cohort = await loadCohort();
  const urgent: Array<{ patient: Patient; sideEffect: Patient["side_effects"][number] }> = [];
  for (const patient of cohort) {
    for (const se of patient.side_effects) {
      if (se.severity === "high" || se.severity === "emergency") {
        urgent.push({ patient, sideEffect: se });
      }
    }
  }
  // Newest first
  return urgent.sort(
    (a, b) =>
      new Date(b.sideEffect.occurred_at).getTime() -
      new Date(a.sideEffect.occurred_at).getTime(),
  );
}
