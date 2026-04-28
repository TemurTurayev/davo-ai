# Rifampicin (Рифампицин · Rifampitsin)

## Quick reference
- **Class**: Rifamycin antibiotic, RNA polymerase inhibitor
- **TB regimen**: First-line, в RHZE и RH continuation phase
- **Form**: Капсулы 150 mg / 300 mg, красно-оранжевые
- **Adult dose**: 10 mg/kg (max 600 mg) once daily, на пустой желудок
- **Pediatric dose**: 10–20 mg/kg

## Common side effects (≥10%)

### Безопасные / ожидаемые
| Симптом | Тактика | UZ объяснение |
|---------|---------|---------------|
| Оранжево-красная окраска мочи, слёз, пота | Норма, объяснить пациенту | "Siydik to'q sariq rang — bu rifampitsindan, normal." |
| Лёгкая тошнота, anorexia | Принимать с лёгкой едой (хотя инструкция on empty stomach) | "Taom bilan iching agar ko'ngil aynisa." |
| Lo'kalansa headache | Парацетамол | "Bosh og'rig'i — paratsetamol iching." |

### Потенциально опасные (RED FLAG → escalate)
| Симптом | Подозрение | Action |
|---------|-----------|--------|
| **Желтуха (yuz/ko'z sariq)** | Drug-induced hepatitis | **STOP, ALT/AST срочно** |
| **Тёмная моча + желтуха** | Hepatotoxicity | **STOP, hospital** |
| **Сыпь + лихорадка** | DRESS / hypersensitivity | **STOP, allergology** |
| **Geriatric confusion** | Encephalopathy (rare) | **STOP** |

## Drug interactions (CRITICAL)

Rifampicin — **strong CYP3A4 inducer**. Снижает эффективность:
- Oral contraceptives → беременность! (warn women)
- Warfarin → снижение INR
- HIV ARV (esp. PIs) → resistance!
- Methadone → withdrawal
- Phenytoin, valproate → ↑seizure risk

**Pregnancy**: Category C, but acceptable in TB treatment.
**Lactation**: secreted in milk, but compatible.

## Prompts для AI-триажа (UZ)

```
Pacient_complain: "Siydigim qoraygan/sariq"
LLM_check:
  if жалоба = "красно-оранжевая моча alone" → severity=low, "bu normal"
  if жалоба = "тёмная моча + жёлтые глаза" → severity=high, "stop, doctor!"
  if жалоба = "тёмная моча + температура" → severity=medium-high
```

## Sources
- WHO Consolidated Guidelines on Tuberculosis. Module 4: Treatment (2022)
- FDA Label: Rifampin Capsules
- BNF Online (NICE)
