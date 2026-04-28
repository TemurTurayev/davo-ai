# Pyrazinamide (Пиразинамид · Pirazinamid)

## Quick reference
- **Class**: Nicotinamide analog
- **TB regimen**: First-line, intensive phase RHZE (первые 2 мес)
- **Form**: Таблетки 500 mg, белые
- **Adult dose**: 25 mg/kg (1500–2000 mg) once daily
- **Pediatric dose**: 30–40 mg/kg

## Common side effects

### Безопасные / ожидаемые
| Симптом | Тактика | UZ объяснение |
|---------|---------|---------------|
| **Гиперурикемия** | Чаще asymptomatic, monitor uric acid | "Qon tahlilida nordon ko'paygan — bu PZA bilan kechadi" |
| Mild GI upset | С едой | "Taom bilan iching" |
| Photosensitivity | SPF, избегать загара | "Quyoshda ehtiyot bo'ling, krem ishlating" |
| Arthralgia (suchaya) | NSAIDs (ibuprofen ОК) | "Bo'g'imlar og'risa — ibuprofen iching" |

### Потенциально опасные
| Симптом | Подозрение | Action |
|---------|-----------|--------|
| **Острый подагрический приступ** | Symptomatic gout | NSAID, allopurinol, monitor |
| **Желтуха + ↑ALT** | Hepatotoxicity (наиболее гепатотоксичный из RHZE!) | **STOP** |
| **Сыпь + лихорадка** | Hypersensitivity | **STOP, allergy** |
| **Rhabdomyolysis** (rare) | Severe muscle pain | **STOP, CK** |

## Особенности
- **Самый гепатотоксичный** из RHZE — 1% develop hepatitis
- ↑ uric acid у 80% пациентов (mostly asymptomatic)
- Photosensitivity — частая жалоба узбекских пациентов летом
- Безопасен при HIV
- **Противопоказан в severe gout, severe liver disease**

## Drug interactions
- Аллопуринол — ↑ pyrazinamide toxicity
- Probenecid — теоретически снижает effect
- Other hepatotoxic drugs (avoid combined!)

## Prompts для AI-триажа (UZ)

```
Pacient: "Bo'g'imlarim og'riyapti, ayniqsa to'piq"
LLM:
  → severity=low-medium (gout / arthralgia от PZA)
  → advice: "Bu pirazinamiddan keladi. Ibuprofen iching, agar 2 kunda o'tmasa — shifokorga."

Pacient: "Quyoshda terim qizardi va og'ridi"
LLM:
  → severity=low (photosensitivity)
  → advice: "PZA quyoshga sezgirlikni oshiradi. SPF 50+ ishlating, kun davomida soyada turing."
```

## Sources
- WHO Consolidated Guidelines on TB
- FDA Label: Pyrazinamide
- Lancet Infect Dis 2023 — DILI in TB treatment
