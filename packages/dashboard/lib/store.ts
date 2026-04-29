/**
 * TB Control client store (Zustand)
 *
 * Strict prescription system:
 * - Doctor prescribes: regimen + drugs + times (read-only for patient)
 * - Patient choices limited to: theme + language
 * - Each dose = 9-step verification flow with red-flag system
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ────────────────────────────────────────────────────────────────────────────
// Domain models
// ────────────────────────────────────────────────────────────────────────────

export type DrugCode =
  | "rifampicin"
  | "isoniazid"
  | "pyrazinamide"
  | "ethambutol"
  | "moxifloxacin"
  | "levofloxacin"
  | "linezolid"
  | "bedaquiline"
  | "clofazimine"
  | "delamanid"
  | "pretomanid"
  | "cycloserine"
  | "ascorutin_demo"   // safe-to-swallow demo placeholder for hackathon presentation
  | "trahisan_demo";   // alternative demo pill (throat lozenges, Engelhard)

export interface PrescribedDrug {
  drugCode: DrugCode;
  dosageMg: number;
  count: number;          // pills per intake
}

export interface PrescribedDose {
  id: string;
  time: string;           // "HH:MM"
  drugs: PrescribedDrug[];
  phase: "intensive" | "continuation" | "maintenance";
}

export type ProtocolId =
  | "ds-tb-2hrze-4hr"
  | "ds-tb-2hrze-4hre"
  | "mdr-tb-shorter"
  | "mdr-tb-individualized"
  | "custom";

export interface Prescription {
  id: string;
  patientName: string;
  patientId: string;            // for future server lookup
  protocol: ProtocolId;
  startDate: string;            // ISO date
  endDate: string;              // ISO date
  doses: PrescribedDose[];      // schedule template
  notes?: string;
  doctorName: string;
  createdAt: string;
}

export type DoseStatus =
  | "pending"          // not yet attempted
  | "completed"        // AI fully verified
  | "completed_flag"   // completed but needs doctor review (red flag)
  | "missed"           // window passed
  | "in_progress";     // currently in flow

export interface DoseRecord {
  id: string;
  prescriptionId: string;
  scheduledAt: string;          // ISO datetime
  completedAt?: string;
  status: DoseStatus;
  videoChunkUrls: string[];     // Supabase Storage URLs
  aiVerification: {
    faceMatch: number | null;       // confidence 0-1
    pillCount: number | null;       // detected count
    pillType: string[] | null;      // detected drug names
    swallowDetected: boolean | null;
    mouthEmpty: boolean | null;
    rulesViolated: string[];        // list of rules broken
  };
  flags: {
    type: "face_mismatch" | "pill_mismatch" | "swallow_uncertain" | "mouth_unclear" | "connection_lost" | "rule_violation";
    note: string;
    timestamp: string;
  }[];
  doctorReviewed: boolean;
  doctorVerdict?: "approved" | "rejected";
}

export interface SideEffectRecord {
  id: string;
  occurredAt: string;
  category: string;
  text: string;
  severity: "low" | "medium" | "high" | "emergency";
  advice?: string;
  escalated: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────────────────

export type Role = "patient" | "doctor" | null;

export type DoseFlowStep =
  | "rules_agreement"   // one-time, before first dose
  | "face_id"           // Phase 1: Identify
  | "show_box"          //
  | "open_box"          // Phase 2: Verify
  | "show_pills"
  | "pill_closeup"
  | "show_glass"
  | "swallow"           // Phase 3: Ingest
  | "mouth_check"
  | "completed";

interface TBControlState {
  // Role + onboarding
  role: Role;
  rulesConsent: {
    accepted: boolean;
    acceptedAt: string | null;
    quizScore: number | null;        // 0-3, how many quiz questions correct
    appVersion: string;
    typedSignature: string;
  };

  // Doctor-set prescription (read-only for patient)
  prescription: Prescription | null;

  // Active dose flow state (in-memory; resets on completion)
  activeDose: {
    doseId: string | null;
    step: DoseFlowStep;
    phase: 1 | 2 | 3;               // 1=Identify, 2=Verify, 3=Ingest
    startedAt: string | null;
    rulesStatus: {
      faceInFrame: "ok" | "warning" | "violated";
      lighting: "ok" | "warning" | "violated";
      singlePerson: "ok" | "warning" | "violated";
      cameraStable: "ok" | "warning" | "violated";
      handsVisible: "ok" | "warning" | "violated";
    };
    warnings: number;                // 0=clean, 1=yellow, 2=orange, 3=red flag
  };

  // History
  doses: DoseRecord[];
  sideEffects: SideEffectRecord[];

  // Settings (only patient choice)
  theme: "light" | "dark" | "auto";

  // Actions
  setRole(role: Role): void;
  acceptRules(quizScore: number, signature: string): void;
  setPrescription(prescription: Prescription): void;
  setTheme(theme: "light" | "dark" | "auto"): void;

  // Dose flow actions
  startDose(scheduledAt: string): string;       // returns doseId
  advanceDoseStep(step: DoseFlowStep): void;
  setRuleStatus(rule: keyof TBControlState["activeDose"]["rulesStatus"], status: "ok" | "warning" | "violated"): void;
  addWarning(): void;
  completeDose(verification: DoseRecord["aiVerification"], flags: DoseRecord["flags"]): void;
  resetActiveDose(): void;

  // Side effects
  recordSideEffect(record: Omit<SideEffectRecord, "id">): void;

  // Dev / reset
  reset(): void;
}

const initialActiveDose: TBControlState["activeDose"] = {
  doseId: null,
  step: "rules_agreement",
  phase: 1,
  startedAt: null,
  rulesStatus: {
    faceInFrame: "ok",
    lighting: "ok",
    singlePerson: "ok",
    cameraStable: "ok",
    handsVisible: "ok",
  },
  warnings: 0,
};

const initialRulesConsent: TBControlState["rulesConsent"] = {
  accepted: false,
  acceptedAt: null,
  quizScore: null,
  appVersion: "0.2.0",
  typedSignature: "",
};

// Step → phase mapping
export const stepToPhase = (step: DoseFlowStep): 1 | 2 | 3 => {
  if (step === "face_id" || step === "show_box") return 1;
  if (step === "open_box" || step === "show_pills" || step === "pill_closeup" || step === "show_glass") return 2;
  return 3;
};

export const useTBControlStore = create<TBControlState>()(
  persist(
    (set, get) => ({
      role: null,
      rulesConsent: initialRulesConsent,
      prescription: null,
      activeDose: initialActiveDose,
      doses: [],
      sideEffects: [],
      theme: "auto",

      setRole: (role) => set({ role }),

      acceptRules: (quizScore, signature) =>
        set({
          rulesConsent: {
            accepted: true,
            acceptedAt: new Date().toISOString(),
            quizScore,
            appVersion: "0.2.0",
            typedSignature: signature,
          },
        }),

      setPrescription: (prescription) => set({ prescription }),

      setTheme: (theme) => set({ theme }),

      startDose: (scheduledAt) => {
        const doseId = crypto.randomUUID();
        const prescription = get().prescription;
        if (!prescription) {
          throw new Error("Cannot start dose without prescription");
        }
        set({
          activeDose: {
            ...initialActiveDose,
            doseId,
            step: "face_id",
            phase: 1,
            startedAt: new Date().toISOString(),
          },
          doses: [
            ...get().doses,
            {
              id: doseId,
              prescriptionId: prescription.id,
              scheduledAt,
              status: "in_progress",
              videoChunkUrls: [],
              aiVerification: {
                faceMatch: null,
                pillCount: null,
                pillType: null,
                swallowDetected: null,
                mouthEmpty: null,
                rulesViolated: [],
              },
              flags: [],
              doctorReviewed: false,
            },
          ],
        });
        return doseId;
      },

      advanceDoseStep: (step) =>
        set((s) => ({
          activeDose: { ...s.activeDose, step, phase: stepToPhase(step) },
        })),

      setRuleStatus: (rule, status) =>
        set((s) => ({
          activeDose: {
            ...s.activeDose,
            rulesStatus: { ...s.activeDose.rulesStatus, [rule]: status },
          },
        })),

      addWarning: () =>
        set((s) => ({
          activeDose: { ...s.activeDose, warnings: s.activeDose.warnings + 1 },
        })),

      completeDose: (verification, flags) => {
        const { activeDose, doses } = get();
        if (!activeDose.doseId) return;
        const finalStatus: DoseStatus = flags.length > 0 ? "completed_flag" : "completed";
        set({
          doses: doses.map((d) =>
            d.id === activeDose.doseId
              ? {
                  ...d,
                  status: finalStatus,
                  completedAt: new Date().toISOString(),
                  aiVerification: verification,
                  flags,
                }
              : d,
          ),
          activeDose: { ...initialActiveDose },
        });
      },

      resetActiveDose: () => set({ activeDose: initialActiveDose }),

      recordSideEffect: (record) =>
        set((s) => ({
          sideEffects: [...s.sideEffects, { ...record, id: crypto.randomUUID() }],
        })),

      reset: () =>
        set({
          role: null,
          rulesConsent: initialRulesConsent,
          prescription: null,
          activeDose: initialActiveDose,
          doses: [],
          sideEffects: [],
          theme: "auto",
        }),
    }),
    {
      name: "tb-control-state",
      version: 3,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return localStorage;
      }),
      // Only persist long-lived prefs across sessions. Rules consent + dose history
      // intentionally NOT persisted — every fresh session shows the full onboarding
      // flow (rules quiz, prescription pickup) which is what we want during demo
      // testing. Theme survives so user doesn't get jarred between sessions.
      partialize: (s) => ({
        role: s.role,
        prescription: s.prescription,
        theme: s.theme,
      }),
    },
  ),
);
