/**
 * WHO TB treatment protocol presets.
 * Sources: WHO Consolidated TB Guidelines (2022, 2024 updates).
 *
 * Doctor selects a preset → can edit per patient → can save as custom template.
 */

import type { ProtocolId, PrescribedDose, DrugCode } from "./store";

export interface ProtocolDefinition {
  id: ProtocolId;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  durationDays: number;
  description: { uz: string; ru: string; en: string };
  /** Schedule generator: returns dose templates for given day-in-treatment */
  schedule: (dayN: number) => PrescribedDose[];
}

// ────────────────────────────────────────────────────────────────────────────
// Drug catalog (label, default dose by weight band — simplified for demo)
// ────────────────────────────────────────────────────────────────────────────

export const DRUG_LABELS: Record<DrugCode, { uz: string; ru: string; en: string; abbr: string; color: string }> = {
  rifampicin:    { uz: "Rifampitsin",   ru: "Рифампицин",    en: "Rifampicin",    abbr: "R", color: "#EF4444" },
  isoniazid:     { uz: "Izoniazid",     ru: "Изониазид",     en: "Isoniazid",     abbr: "H", color: "#F59E5B" },
  pyrazinamide:  { uz: "Pirazinamid",   ru: "Пиразинамид",   en: "Pyrazinamide",  abbr: "Z", color: "#FBBF24" },
  ethambutol:    { uz: "Etambutol",     ru: "Этамбутол",     en: "Ethambutol",    abbr: "E", color: "#10B981" },
  moxifloxacin:  { uz: "Moksifloksatsin", ru: "Моксифлоксацин", en: "Moxifloxacin", abbr: "Mfx", color: "#6366F1" },
  levofloxacin:  { uz: "Levofloksatsin", ru: "Левофлоксацин", en: "Levofloxacin",  abbr: "Lfx", color: "#8B5CF6" },
  linezolid:     { uz: "Linezolid",     ru: "Линезолид",     en: "Linezolid",     abbr: "Lzd", color: "#EC4899" },
  bedaquiline:   { uz: "Bedakvilin",    ru: "Бедаквилин",    en: "Bedaquiline",   abbr: "Bdq", color: "#0EA5A4" },
  clofazimine:   { uz: "Klofazimin",    ru: "Клофазимин",    en: "Clofazimine",   abbr: "Cfz", color: "#A16207" },
  delamanid:     { uz: "Delamanid",     ru: "Деламанид",     en: "Delamanid",     abbr: "Dlm", color: "#0891B2" },
  pretomanid:    { uz: "Pretomanid",    ru: "Претоманид",    en: "Pretomanid",    abbr: "Pa",  color: "#7C3AED" },
  cycloserine:   { uz: "Sikloserin",    ru: "Циклосерин",    en: "Cycloserine",   abbr: "Cs",  color: "#0E7490" },
  ascorutin_demo:{ uz: "Askorutin (demo)", ru: "Аскорутин (демо)", en: "Ascorutin (demo)", abbr: "Asc", color: "#84CC16" },
};

// ────────────────────────────────────────────────────────────────────────────
// Protocol: DS-TB 2HRZE / 4HR (standard)
// 2 months intensive (R+H+Z+E daily) + 4 months continuation (R+H daily)
// ────────────────────────────────────────────────────────────────────────────

export const DS_TB_STANDARD: ProtocolDefinition = {
  id: "ds-tb-2hrze-4hr",
  nameUz: "DS-TB standart (2HRZE / 4HR)",
  nameRu: "DS-TB стандарт (2HRZE / 4HR)",
  nameEn: "DS-TB standard (2HRZE / 4HR)",
  durationDays: 180,
  description: {
    uz: "Sezgir sil — WHO standart rejimi: 2 oy intensiv (R+H+Z+E) + 4 oy davomiy (R+H).",
    ru: "Чувствительный ТБ — стандарт ВОЗ: 2 мес интенсивная фаза (R+H+Z+E) + 4 мес поддерживающая (R+H).",
    en: "Drug-sensitive TB — WHO standard: 2-month intensive (R+H+Z+E) + 4-month continuation (R+H).",
  },
  schedule: (dayN) => {
    const isIntensive = dayN <= 60;
    return [
      {
        id: `dose-${dayN}-morning`,
        time: "08:00",
        phase: isIntensive ? "intensive" : "continuation",
        drugs: isIntensive
          ? [
              { drugCode: "rifampicin",   dosageMg: 600,  count: 1 },
              { drugCode: "isoniazid",    dosageMg: 300,  count: 1 },
              { drugCode: "pyrazinamide", dosageMg: 1500, count: 1 },
              { drugCode: "ethambutol",   dosageMg: 1200, count: 1 },
            ]
          : [
              { drugCode: "rifampicin", dosageMg: 600, count: 1 },
              { drugCode: "isoniazid",  dosageMg: 300, count: 1 },
            ],
      },
    ];
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Protocol: DS-TB 2HRZE / 4HRE (relapse / re-treatment)
// ────────────────────────────────────────────────────────────────────────────

export const DS_TB_RETREAT: ProtocolDefinition = {
  id: "ds-tb-2hrze-4hre",
  nameUz: "DS-TB takroriy (2HRZE / 4HRE)",
  nameRu: "DS-TB повторное (2HRZE / 4HRE)",
  nameEn: "DS-TB retreatment (2HRZE / 4HRE)",
  durationDays: 180,
  description: {
    uz: "Takroriy yoki boshqa hollar uchun: 2 oy intensiv + 4 oy davomiy (R+H+E).",
    ru: "Повторное лечение: 2 мес интенсивная + 4 мес поддерживающая (R+H+E).",
    en: "Retreatment regimen: 2-month intensive + 4-month continuation (R+H+E).",
  },
  schedule: (dayN) => {
    const isIntensive = dayN <= 60;
    return [
      {
        id: `dose-${dayN}-morning`,
        time: "08:00",
        phase: isIntensive ? "intensive" : "continuation",
        drugs: isIntensive
          ? [
              { drugCode: "rifampicin",   dosageMg: 600,  count: 1 },
              { drugCode: "isoniazid",    dosageMg: 300,  count: 1 },
              { drugCode: "pyrazinamide", dosageMg: 1500, count: 1 },
              { drugCode: "ethambutol",   dosageMg: 1200, count: 1 },
            ]
          : [
              { drugCode: "rifampicin", dosageMg: 600,  count: 1 },
              { drugCode: "isoniazid",  dosageMg: 300,  count: 1 },
              { drugCode: "ethambutol", dosageMg: 1200, count: 1 },
            ],
      },
    ];
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Protocol: MDR-TB shorter regimen (BPaL-M, ~6-9 months)
// ────────────────────────────────────────────────────────────────────────────

export const MDR_TB_SHORTER: ProtocolDefinition = {
  id: "mdr-tb-shorter",
  nameUz: "MDR-TB qisqa rejim (BPaL-M)",
  nameRu: "MDR-TB короткий режим (BPaL-M)",
  nameEn: "MDR-TB shorter (BPaL-M)",
  durationDays: 270,
  description: {
    uz: "MDR-TB uchun WHO 2024 BPaL-M: Bdq + Pa + Lzd + Mfx, 6-9 oy.",
    ru: "MDR-TB по WHO 2024 BPaL-M: Bdq + Pa + Lzd + Mfx, 6-9 месяцев.",
    en: "WHO 2024 BPaL-M for MDR-TB: Bdq + Pa + Lzd + Mfx, 6-9 months.",
  },
  schedule: (_dayN) => [
    {
      id: `dose-morning`,
      time: "08:00",
      phase: "intensive",
      drugs: [
        { drugCode: "bedaquiline",  dosageMg: 400, count: 1 },
        { drugCode: "pretomanid",   dosageMg: 200, count: 1 },
        { drugCode: "linezolid",    dosageMg: 600, count: 1 },
        { drugCode: "moxifloxacin", dosageMg: 400, count: 1 },
      ],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Protocol: MDR-TB individualized (longer, 18-20 months)
// ────────────────────────────────────────────────────────────────────────────

export const MDR_TB_INDIVIDUALIZED: ProtocolDefinition = {
  id: "mdr-tb-individualized",
  nameUz: "MDR-TB individual (18-20 oy)",
  nameRu: "MDR-TB индивидуальный (18-20 мес)",
  nameEn: "MDR-TB individualized (18-20 mo)",
  durationDays: 600,
  description: {
    uz: "Murakkab MDR/XDR holatlar uchun: Bdq + Lzd + Lfx + Cfz + Cs, individual dozalar.",
    ru: "Для сложных MDR/XDR: Bdq + Lzd + Lfx + Cfz + Cs, индивидуальные дозы.",
    en: "For complex MDR/XDR: Bdq + Lzd + Lfx + Cfz + Cs, individualized doses.",
  },
  schedule: (_dayN) => [
    {
      id: `dose-morning`,
      time: "08:00",
      phase: "intensive",
      drugs: [
        { drugCode: "bedaquiline",  dosageMg: 400, count: 1 },
        { drugCode: "linezolid",    dosageMg: 600, count: 1 },
        { drugCode: "levofloxacin", dosageMg: 750, count: 1 },
        { drugCode: "clofazimine",  dosageMg: 100, count: 1 },
        { drugCode: "cycloserine",  dosageMg: 500, count: 1 },
      ],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────

export const PROTOCOLS: Record<Exclude<ProtocolId, "custom">, ProtocolDefinition> = {
  "ds-tb-2hrze-4hr": DS_TB_STANDARD,
  "ds-tb-2hrze-4hre": DS_TB_RETREAT,
  "mdr-tb-shorter": MDR_TB_SHORTER,
  "mdr-tb-individualized": MDR_TB_INDIVIDUALIZED,
};

export const PROTOCOL_LIST = Object.values(PROTOCOLS);

/**
 * Build a default Prescription from a protocol + start date.
 * Doctor can then edit `doses` to customize per patient.
 */
export function buildPrescription(args: {
  protocolId: Exclude<ProtocolId, "custom">;
  patientName: string;
  patientId: string;
  startDate: Date;
  doctorName: string;
}): import("./store").Prescription {
  const proto = PROTOCOLS[args.protocolId];
  const endDate = new Date(args.startDate);
  endDate.setDate(endDate.getDate() + proto.durationDays);

  return {
    id: crypto.randomUUID(),
    patientName: args.patientName,
    patientId: args.patientId,
    protocol: args.protocolId,
    startDate: args.startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    doses: proto.schedule(1),     // day 1 schedule (used as template)
    doctorName: args.doctorName,
    createdAt: new Date().toISOString(),
  };
}
