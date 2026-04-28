# Isoniazid (Изониазид · Izoniazid)

## Quick reference
- **Class**: Nicotinic acid derivative, mycolic acid synthesis inhibitor
- **TB regimen**: First-line, RHZE и RH continuation
- **Form**: Таблетки 100 mg / 300 mg, белые круглые
- **Adult dose**: 5 mg/kg (max 300 mg) once daily
- **Pediatric dose**: 7–15 mg/kg (max 300 mg)
- **Vitamin B6 (pyridoxine)**: 25–50 mg/day для предотвращения нейропатии

## Common side effects

### Безопасные / ожидаемые
| Симптом | Тактика | UZ объяснение |
|---------|---------|---------------|
| Mild nausea | С едой ОК для INH (в отличие от RIF) | "Ko'ngil aynisa, taom bilan iching." |
| Sleep disturbance | Принимать утром | "Ertalab iching agar uxlay olmasangiz." |
| Asymptomatic transaminase ↑ (10–20%) | Monitor, обычно проходит | Просто наблюдение |

### Потенциально опасные (RED FLAG)
| Симптом | Подозрение | Action |
|---------|-----------|--------|
| **Желтуха + анорексия** | Hepatitis (1–2% adults, ↑ age >35) | **STOP, ALT/AST** |
| **Парестезии, онемение конечностей** | Peripheral neuropathy | **Pyridoxine 100 mg, evaluate** |
| **Тёмная моча + abdominal pain** | Hepatotoxicity | **STOP** |
| **Психоз, судороги** | CNS toxicity (rare) | **STOP, neurology** |
| **Lupus-like syndrome** | Immune-mediated | **STOP** |

## Hepatotoxicity risk factors
- Age > 35 years
- Daily alcohol use
- Concurrent hepatotoxic drugs (RIF, PZA в RHZE!)
- Pre-existing liver disease
- HIV
- Pregnancy / postpartum

→ Baseline ALT/AST + ежемесячный мониторинг при наличии RF.

## Drug interactions
- **Phenytoin**: INH ингибирует CYP2C9 → ↑phenytoin (toxicity)
- **Carbamazepine**: ↑ levels
- **Tyramine foods**: theoretical "cheese reaction" (rare)
- **Paracetamol**: combined hepatotoxicity при high doses

## Prompts для AI-триажа (UZ)

```
Pacient: "Qo'lim/oyog'im uvishyapti"
LLM:
  → severity=medium ("peripheral neuropathy")
  → advice: "Bu izoniaziddan bo'lishi mumkin. B6 vitamini qo'shilganmi? Shifokoringizga ayting."
  → escalate=true if жалоба >2 недель or прогрессирует

Pacient: "Yuzim sariq bo'lib qolgan"
LLM:
  → severity=high ("hepatotoxicity")
  → advice: "DARHOL dorini to'xtating va shifokoringizga boring!"
  → escalate=true
```

## Sources
- WHO Consolidated Guidelines on TB, Module 4
- FDA Label: Isoniazid USP
- TB Drug Toxicity Management Guidelines (CDC 2023)
