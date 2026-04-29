/**
 * Per-step UI metadata for the dose flow: title (3 langs), hint, icon, AI
 * model name shown in the model badge.
 *
 * Kept separate from `useDoseStepRunner` (state machine) so designers/copy
 * can edit strings without touching logic.
 */

import {
  Camera as CameraIcon,
  Check,
  Pill,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { DoseFlowStep } from "@/lib/store";

export interface StepUI {
  key: DoseFlowStep;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  hintUz: string;
  hintRu: string;
  hintEn: string;
  icon: LucideIcon;
  modelLabel: string;
}

export const STEP_META: Record<DoseFlowStep, StepUI | null> = {
  rules_agreement: null,
  completed: null,
  face_id: {
    key: "face_id",
    titleUz: "Yuzni kameraga ko'rsating",
    titleRu: "Покажите лицо в камеру",
    titleEn: "Show your face to the camera",
    hintUz: "Asta-sekin chapga, keyin o'ngga buring",
    hintRu: "Медленно поверните голову влево, затем вправо",
    hintEn: "Slowly turn your head left, then right",
    icon: CameraIcon,
    modelLabel: "Mediapipe FaceMesh + Embeddings",
  },
  show_box: {
    key: "show_box",
    titleUz: "Tabletka qutisini ko'rsating",
    titleRu: "Покажите коробку с таблетками",
    titleEn: "Show the pill box",
    hintUz: "Qutining yorlig'i kameraga qaragan bo'lsin",
    hintRu: "Этикеткой к камере",
    hintEn: "Hold so the label faces the camera",
    icon: Pill,
    modelLabel: "YOLO v8 (custom-trained) + OCR",
  },
  open_box: {
    key: "open_box",
    titleUz: "Qutini oching",
    titleRu: "Откройте коробку",
    titleEn: "Open the box",
    hintUz: "Qopqoqni ko'taring, blistir ko'rinsin",
    hintRu: "Поднимите крышку — должен быть виден блистер",
    hintEn: "Lift the lid — blister should be visible",
    icon: Pill,
    modelLabel: "Action detection + Optical flow",
  },
  show_pills: {
    key: "show_pills",
    titleUz: "Tabletkalarni kaftga oling",
    titleRu: "Положите таблетки на ладонь",
    titleEn: "Place pills on your palm",
    hintUz: "Hammasi ko'rinishi kerak",
    hintRu: "Все таблетки должны быть видны",
    hintEn: "All pills must be visible",
    icon: Pill,
    modelLabel: "YOLO + Mediapipe Hands",
  },
  pill_closeup: {
    key: "pill_closeup",
    titleUz: "Tabletkani yaqinroq ko'rsating",
    titleRu: "Поднесите таблетку ближе",
    titleEn: "Hold the pill closer",
    hintUz: "AI dorining turini tekshiradi",
    hintRu: "ИИ проверит тип препарата",
    hintEn: "AI will verify the drug type",
    icon: Sparkles,
    modelLabel: "Vision LLM (Qwen-VL 7B AWQ)",
  },
  show_glass: {
    key: "show_glass",
    titleUz: "Suvli stakanni ko'rsating",
    titleRu: "Покажите стакан с водой",
    titleEn: "Show the glass of water",
    hintUz: "Stakan shaffof bo'lishi kerak",
    hintRu: "Стакан должен быть прозрачным",
    hintEn: "Glass must be transparent",
    icon: Pill,
    modelLabel: "YOLO + translucency check",
  },
  swallow: {
    key: "swallow",
    titleUz: "Tabletkani og'izga soling va suv iching",
    titleRu: "Положите таблетку в рот и запейте",
    titleEn: "Place pill in mouth and drink water",
    hintUz: "Yutib, pastdagi tugmani bosib turing",
    hintRu: "Проглотите и удерживайте кнопку внизу",
    hintEn: "Swallow and hold the bottom button",
    icon: Pill,
    modelLabel: "Optical flow + gesture recognition",
  },
  mouth_check: {
    key: "mouth_check",
    titleUz: "Og'izni keng oching",
    titleRu: "Откройте рот пошире",
    titleEn: "Open your mouth wide",
    hintUz: "AI tabletka o'tib ketganini tekshiradi",
    hintRu: "ИИ убедится, что таблетка проглочена",
    hintEn: "AI will confirm the pill is swallowed",
    icon: Check,
    modelLabel: "Mouth-cavity scan + Vision LLM",
  },
};

// Simplified flow per user feedback (2026-04-29): removed "open_box" and
// "show_pills" — redundant with show_box (we already see the box) and
// pill_closeup (we already see the pills before swallowing). 8 → 6 steps.
//
// Phase grouping in PhaseIndicator stays: Identify (face+box) ·
// Verify (pill_closeup + glass) · Ingest (swallow + mouth_check).
export const DOSE_STEP_ORDER: DoseFlowStep[] = [
  "face_id", "show_box",
  "pill_closeup", "show_glass",
  "swallow", "mouth_check", "completed",
];
