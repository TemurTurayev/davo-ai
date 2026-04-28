# Ethambutol (Этамбутол · Etambutol)

## Quick reference
- **Class**: Aliphatic amine, blocks arabinogalactan synthesis
- **TB regimen**: First-line, intensive phase RHZE (особенно если подозрение на устойчивость к INH)
- **Form**: Таблетки 400 mg, белые/желтоватые (или сероватые в WHO generics)
- **Adult dose**: 15 mg/kg (max 1600 mg) once daily
- **Pediatric dose**: 15–25 mg/kg
- **Renal adjustment**: required if CrCl < 50

## Common side effects

### Безопасные / ожидаемые
| Симптом | Тактика | UZ объяснение |
|---------|---------|---------------|
| Mild GI | С едой OK | "Taom bilan iching" |
| Headache | Парацетамол | "Bosh og'risa — paratsetamol" |

### Потенциально опасные (BIG RED FLAG: VISION)
| Симптом | Подозрение | Action |
|---------|-----------|--------|
| **Снижение зрения (xira ko'rish)** | **Optic neuritis** | **STOP IMMEDIATELY, ophthalmology** |
| **Нарушение цветового зрения (red-green)** | **Optic neuritis** | **STOP IMMEDIATELY** |
| **Scotoma** (слепые пятна) | Optic neuritis | **STOP** |
| **Periph neuropathy** | Дозозависимо | Decrease dose, B6 |
| **Hyperuricemia / gout** | Подобно PZA | NSAIDs |
| **Сыпь** | Hypersensitivity | Evaluate |

## Critical: Visual toxicity
- **Dose-dependent** (>15 mg/kg = выше риск)
- Обычно reversible если поймать рано
- **Baseline visual acuity + color vision** перед началом
- **Monthly eye check** обязателен
- **Особенно опасен у детей** — сложно жалуется → STOP at any suspicion
- В Узбекистане часто упускают — нужна явная инструкция в боте

## Renal dosing
- CrCl 50–80: standard dose
- CrCl 30–50: 15 mg/kg каждые **36 часов**
- CrCl 10–30: 15 mg/kg каждые **48 часов**
- HD: после диализа

## Prompts для AI-триажа (UZ)

```
Pacient: "Ko'rishim biroz xira"
LLM:
  → severity=HIGH ("optic neuritis SUSPECTED")
  → advice: "DIQQAT! Etambutol ko'zga ta'sir qilishi mumkin. DARHOL dorini to'xtating va okulistga boring!"
  → escalate=TRUE

Pacient: "Qizil va yashil rangni ajrata olmayapman"
LLM:
  → severity=EMERGENCY ("classic ethambutol toxicity sign")
  → advice: "Bu etambutol zaharlanish belgisi. Hozir to'xtating, ertaga shifokorga!"
  → escalate=TRUE

Pacient: "Bosh aylanyapti"
LLM:
  → severity=low (если только головокружение без visual)
  → advice: "Sekin qarang harakat qilganda. Agar ko'rishingizga ta'sir qilsa — shifokorga"
```

## Pediatric note
**Не рекомендуется детям младше 5 лет** (нельзя оценить vision toxicity), кроме MDR-TB по жизненным показаниям.

## Sources
- WHO TB Guidelines Module 4 (2022)
- FDA Label: Ethambutol HCl
- AAO clinical statements on EMB-induced optic neuropathy
