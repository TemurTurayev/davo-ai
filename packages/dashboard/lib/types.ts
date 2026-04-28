// Типы данных пациента — соответствуют synthetic cohort.json + DB schema

export type AdherenceProfile = "good" | "medium" | "poor" | "dropout";

export type DrugCode =
  | "rifampicin"
  | "isoniazid"
  | "pyrazinamide"
  | "ethambutol"
  | "combo_fdc";

export type Severity = "low" | "medium" | "high" | "emergency";

export interface SideEffect {
  day_offset: number;
  occurred_at: string;
  text: string;
  severity: Severity;
  is_expected: boolean;
  escalated: boolean;
}

export interface Patient {
  id: string;
  telegram_id: number;
  full_name: string;
  birth_year: number;
  phone: string;
  language: "uz" | "ru";
  region: string;
  treatment_started_at: string;
  drugs: DrugCode[];
  reminder_time: string;
  profile: AdherenceProfile;
  adherence_rate: number;
  current_streak: number;
  longest_streak: number;
  drop_off_risk_score: number;
  verified_doses: string[];
  missed_doses: string[];
  side_effects: SideEffect[];
  total_doses: number;
  verified_count: number;
  missed_count: number;
}
