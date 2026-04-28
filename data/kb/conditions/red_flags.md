# Red Flags · Критические симптомы для escalation

> Этот файл — главный safety net для AI-чата. Любой из этих симптомов
> требует НЕМЕДЛЕННОЙ эскалации к врачу + остановки терапии.

## Hepatotoxicity (наиболее частая)
**Препараты-виновники**: INH > PZA > RIF (в порядке убывания риска)

### UZ сигналы:
- "Yuzim/ko'zlarim sariq" → жёлтые лицо/глаза
- "Siydigim qoraygan" → тёмная моча
- "Najasim oq" → светлый стул
- "Qornimning o'ng tomoni og'riyapti" → правое подреберье
- "Ishtaha yo'q, ko'ngil aynayapti" → анорексия + nausea

### Action:
**STOP all hepatotoxic TB drugs (RIF + INH + PZA)**, начать симптом + lab работа (ALT, AST, bilirubin, INR), перевод на не-гепатотоксичный режим.

---

## Optic neuritis (от Ethambutol)
### UZ сигналы:
- "Ko'rishim xira" → blurred vision
- "Qizil va yashilni ajrata olmayman" → red-green color blindness
- "Qora dog'lar ko'ryapman" → scotoma
- "Bir tomon ko'rishi yomonlashdi" → unilateral vision loss

### Action:
**STOP Ethambutol IMMEDIATELY**. Срочный осмотр окулиста (визометрия, цветовое зрение, fundus). Часто reversible если STOP в первые недели.

---

## DRESS / Severe Hypersensitivity
### UZ сигналы:
- "Butun tanam toshib chiqdi" → generalized rash
- "Issig'im baland" → fever (>38.5)
- "Bo'yinda shishlar paydo bo'ldi" → lymphadenopathy
- "Lablarim, til shishdi" → mucosal involvement (Stevens-Johnson?)

### Action:
**STOP all suspected drugs**. Hospital admission. CBC, eosinophils, LFTs.

---

## Angioedema / Anaphylaxis
### UZ сигналы:
- "Yuzim, lablarim shishdi" → swelling
- "Nafas ola olmayapman" → difficulty breathing
- "Bo'g'zim qisilyapti" → throat tightness
- "Boshim aylanib ketdi, hushim ketay deyaptu" → near-syncope

### Action:
**EMERGENCY (112)**. Adrenalin IM. Не пытаться добраться самому до клиники!

---

## Peripheral Neuropathy (INH без B6)
### UZ сигналы:
- "Qo'l-oyog'im uvishyapti" → numbness
- "Igna sanchayotgandek og'riyapti" → tingling
- "Yurganimda muvozanat yo'q" → balance issues

### Action:
Pyridoxine 100 mg/day, monitor. Если progressing → STOP INH.

---

## Acute Gout / Severe Arthralgia (PZA)
### UZ сигналы:
- "Birinchi to'pig'im qattiq qizardi va og'riyapti" → first MTP joint
- "Yura olmayapman bo'g'imlar og'rig'idan" → severe joint pain

### Action:
NSAIDs (ibuprofen, naproxen). Если recurrent → consider stopping PZA.

---

## Severe GI bleeding
### UZ сигналы:
- "Qora rangli najas" → melena
- "Qon qusyapman" → hematemesis
- "Boshim aylanyapti, oqarib ketyapman" → hypovolemia

### Action:
**EMERGENCY**. Hospital admission, transfusion if needed.

---

## Severe psychiatric (rare INH)
### UZ сигналы:
- "Allaqanday ovozlar eshityapman" → hallucinations
- "Hech kim yo'q, lekin gapirayotgan kishilarni ko'rayapman" → visual hallucinations

### Action:
**STOP INH**. Psychiatric consultation.

---

## Decision tree для AI

```python
def is_red_flag(text_lower: str) -> dict:
    rules = [
        # Hepatotoxicity
        (("sariq" in text or "жёлт" in text) and ("yuz" in text or "ko'z" in text or "глаз" in text or "лиц" in text),
         "hepatotoxicity", "high"),
        # Optic neuritis
        ("ko'rish" in text or "зрен" in text,
         "optic_neuritis", "high"),
        # Anaphylaxis
        ("nafas" in text and ("qisil" in text or "olm" in text),
         "anaphylaxis", "emergency"),
        ("til shish" in text or "lab shish" in text or "лиц* опух*" in text,
         "angioedema", "emergency"),
        # GI bleeding
        ("qora najas" in text or "qon qus" in text,
         "gi_bleed", "emergency"),
    ]
    # ... return first match
```

---

## Эскалационные контакты (для AI-сообщения пациенту)

| Регион | Скорая | TB-диспансер |
|--------|--------|--------------|
| Toshkent | 103 / 112 | Республиканский ТБ-центр: +998 71 233-XX-XX |
| Qoraqalpog'iston | 103 | Респ. ТБ-диспансер Каракалпакстан |
| Boshqa viloyat | 103 | Local viloyat ТБ-dispanser |

---

## Sources
- WHO TB Drug Toxicity Management 2024
- CDC TB DILI Management
- Republican TB Center of Uzbekistan, MoH RUz protocols
