/**
 * Nafas client store (Zustand)
 * Persists onboarding + adherence state to localStorage
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Regimen = "dstb" | "mdr" | "unknown";

export interface DoseRecord {
  date: string;          // ISO date (YYYY-MM-DD)
  status: "taken" | "missed" | "review";
  videoUrl?: string;
  confidence?: number;
}

export interface SideEffectRecord {
  id: string;
  occurredAt: string;     // ISO datetime
  category: string;
  text: string;
  severity: "low" | "medium" | "high" | "emergency";
  advice?: string;
  escalated: boolean;
}

interface NafasState {
  // Profile
  profile: {
    fullName: string;
    regimen: Regimen;
    treatmentStartedAt: string | null;
    reminderTime: string;       // "HH:MM"
    permissions: {
      camera: boolean;
      notifications: boolean;
    };
  };
  isOnboarded: boolean;

  // Adherence
  doses: DoseRecord[];
  sideEffects: SideEffectRecord[];

  // Actions
  setName(name: string): void;
  setRegimen(r: Regimen): void;
  setReminderTime(time: string): void;
  setPermission(k: "camera" | "notifications", v: boolean): void;
  completeOnboarding(): void;
  recordDose(record: DoseRecord): void;
  recordSideEffect(record: Omit<SideEffectRecord, "id">): void;
  reset(): void;
}

export const useNafasStore = create<NafasState>()(
  persist(
    (set) => ({
      profile: {
        fullName: "",
        regimen: "unknown",
        treatmentStartedAt: null,
        reminderTime: "08:00",
        permissions: { camera: false, notifications: false },
      },
      isOnboarded: false,
      doses: [],
      sideEffects: [],

      setName: (name) =>
        set((s) => ({ profile: { ...s.profile, fullName: name } })),
      setRegimen: (regimen) =>
        set((s) => ({ profile: { ...s.profile, regimen } })),
      setReminderTime: (reminderTime) =>
        set((s) => ({ profile: { ...s.profile, reminderTime } })),
      setPermission: (k, v) =>
        set((s) => ({
          profile: {
            ...s.profile,
            permissions: { ...s.profile.permissions, [k]: v },
          },
        })),
      completeOnboarding: () =>
        set((s) => ({
          isOnboarded: true,
          profile: {
            ...s.profile,
            treatmentStartedAt: new Date().toISOString(),
          },
        })),
      recordDose: (record) =>
        set((s) => ({ doses: [...s.doses.filter((d) => d.date !== record.date), record] })),
      recordSideEffect: (record) =>
        set((s) => ({
          sideEffects: [
            ...s.sideEffects,
            { ...record, id: crypto.randomUUID() },
          ],
        })),
      reset: () =>
        set({
          profile: {
            fullName: "",
            regimen: "unknown",
            treatmentStartedAt: null,
            reminderTime: "08:00",
            permissions: { camera: false, notifications: false },
          },
          isOnboarded: false,
          doses: [],
          sideEffects: [],
        }),
    }),
    {
      name: "nafas-state",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR-safe noop
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
    },
  ),
);
