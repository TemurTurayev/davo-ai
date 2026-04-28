"""
Davo-AI · Synthetic patient cohort generator
=============================================

Генерирует реалистичную когорту пациентов с историей адхеренс для:
- Тестирования бота без реальных пациентов
- Training drop-off prediction model (XGBoost)
- Демо-данных для жюри

Паттерны (откалиброваны по Karakalpakstan MDR-TB cohort):
- 60% пациентов: высокий adherence (>90%)
- 25% пациентов: средний adherence (70-90%)
- 15% пациентов: низкий adherence (<70%) → drop-off

Запуск:
    python scripts/generate_synthetic.py --patients 30 --days 90 --output data/synthetic/
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import random
import uuid
from pathlib import Path

import numpy as np

# ─── Configuration ──────────────────────────────────────────────────────────
DRUGS_REGIMENS = [
    ["rifampicin", "isoniazid", "pyrazinamide", "ethambutol"],  # Initial phase 2 mo
    ["rifampicin", "isoniazid"],                                # Continuation 4 mo
    ["combo_fdc"],                                              # FDC (RHZE)
]

UZ_NAMES = [
    "Sardor Karimov", "Diyora Tursunova", "Bekzod Olimov", "Madina Saidova",
    "Anvar Yusupov", "Zarina Norova", "Botir Rahimov", "Lola Akhmedova",
    "Jasur Ismailov", "Nargiza Mirzayeva", "Akmal Tashkentbaev", "Gulnara Aliyeva",
    "Rustam Saidov", "Nodira Karimova", "Otabek Yuldoshev", "Sevara Khalilova",
    "Bakhtiyor Nazarov", "Dilfuza Razzakova", "Sanjar Ergashev", "Munisa Jalilova",
    "Farkhod Soliev", "Aziza Tukhtayeva", "Murat Berdimuratov", "Aygul Nazirova",
    "Timur Saparov", "Ozoda Rakhmatova", "Kamoliddin Yodgorov", "Shahnoza Atayeva",
    "Ulugbek Mahmudov", "Iroda Suleymanova",
]

REGIONS = ["Tashkent", "Samarkand", "Bukhara", "Karakalpakstan", "Fergana", "Andijan", "Namangan"]

SIDE_EFFECT_TEXTS_UZ = [
    "Qornim og'riyapti dori ichgandan keyin",
    "Boshim aylanyapti, charchashayapdim",
    "Ichim qotgan",
    "Tirnaq dori ta'mi yomon",
    "Ko'zlarim sariq bo'lib qolgandek",      # ⚠️ потенциально опасно
    "Siydigim qoraygan",                      # ⚠️ потенциально опасно
    "Bo'g'imlar og'riyapti",
    "Uyqum yomonlashgan",
    "Ko'rishim biroz xira",                    # ⚠️ ethambutol
]

SIDE_EFFECT_TEXTS_RU = [
    "Болит живот после приёма",
    "Кружится голова, слабость",
    "Запор уже три дня",
    "Тошнит после препарата",
    "Глаза стали желтоватыми",                # ⚠️
    "Моча тёмная стала",                       # ⚠️
    "Болят суставы",
    "Плохо сплю по ночам",
    "Зрение немного хуже стало",              # ⚠️
]


# ─── Adherence pattern generation ───────────────────────────────────────────
def adherence_pattern(profile: str, days: int) -> list[bool]:
    """Возвращает список True/False (принял/пропустил) для каждого дня.

    profile:
        'good'    — 92-98% adherence
        'medium'  — 70-90% adherence
        'poor'    — 50-70% + растущая тенденция к drop-off
        'dropout' — хороший старт, потом серия пропусков
    """
    rng = np.random.default_rng()

    if profile == "good":
        base_rate = rng.uniform(0.92, 0.98)
        adherence = rng.random(days) < base_rate
    elif profile == "medium":
        base_rate = rng.uniform(0.70, 0.90)
        adherence = rng.random(days) < base_rate
    elif profile == "poor":
        # Адхеренс падает со временем
        rates = np.linspace(rng.uniform(0.65, 0.75), rng.uniform(0.45, 0.55), days)
        adherence = rng.random(days) < rates
    elif profile == "dropout":
        # Хороший старт, потом drop-off на 30-60 день
        dropout_day = rng.integers(30, min(60, days - 5))
        adherence = np.zeros(days, dtype=bool)
        adherence[:dropout_day] = rng.random(dropout_day) < 0.93
        # После dropout — почти всегда пропуски
        adherence[dropout_day:] = rng.random(days - dropout_day) < 0.20
    else:
        adherence = np.ones(days, dtype=bool)

    return adherence.tolist()


def pick_profile() -> str:
    r = random.random()
    if r < 0.50:
        return "good"
    if r < 0.75:
        return "medium"
    if r < 0.90:
        return "poor"
    return "dropout"


# ─── Patient generator ──────────────────────────────────────────────────────
def gen_patient(idx: int, days: int) -> dict:
    profile = pick_profile()
    name = UZ_NAMES[idx % len(UZ_NAMES)] if idx < len(UZ_NAMES) else f"Patient {idx+1}"

    treatment_start = dt.date.today() - dt.timedelta(days=days)
    regimen = random.choice(DRUGS_REGIMENS)
    region = random.choice(REGIONS)

    adherence = adherence_pattern(profile, days)
    verified_doses = [
        (treatment_start + dt.timedelta(days=i)).isoformat()
        for i, took in enumerate(adherence)
        if took
    ]
    missed_doses = [
        (treatment_start + dt.timedelta(days=i)).isoformat()
        for i, took in enumerate(adherence)
        if not took
    ]

    # Streak calculation
    current_streak = 0
    longest = 0
    cur = 0
    for took in adherence:
        if took:
            cur += 1
            longest = max(longest, cur)
        else:
            cur = 0
    if adherence and adherence[-1]:
        # Текущий streak — кол-во дней приёма с конца до пропуска
        for took in reversed(adherence):
            if took:
                current_streak += 1
            else:
                break

    # Side effect events (генерируем 1-5 на пациента, чаще у poor/dropout)
    se_count_lambda = {"good": 0.5, "medium": 1.5, "poor": 3.0, "dropout": 4.0}[profile]
    n_side_effects = min(int(np.random.poisson(se_count_lambda)), days)
    side_effects = []
    for _ in range(n_side_effects):
        day_offset = random.randint(0, days - 1)
        text_pool = SIDE_EFFECT_TEXTS_UZ if random.random() < 0.7 else SIDE_EFFECT_TEXTS_RU
        text = random.choice(text_pool)

        # Severity: красные флаги в тексте → high
        red_flags = ["sariq", "qora siy", "ko'rish", "Глаза", "Моча тёмная", "Зрение"]
        is_red = any(flag in text for flag in red_flags)
        severity = "high" if is_red else random.choices(
            ["low", "medium", "high"], weights=[60, 30, 10]
        )[0]

        side_effects.append({
            "day_offset": day_offset,
            "occurred_at": (treatment_start + dt.timedelta(days=day_offset)).isoformat(),
            "text": text,
            "severity": severity,
            "is_expected": severity in {"low", "medium"},
            "escalated": severity in {"high", "emergency"},
        })

    adherence_rate = sum(adherence) / len(adherence) if adherence else 0
    drop_off_risk = {
        "good": random.uniform(0.05, 0.15),
        "medium": random.uniform(0.20, 0.45),
        "poor": random.uniform(0.55, 0.80),
        "dropout": random.uniform(0.85, 0.98),
    }[profile]

    return {
        "id": str(uuid.uuid4()),
        "telegram_id": 100000000 + idx,
        "full_name": name,
        "birth_year": random.randint(1955, 2005),
        "phone": f"+9989{random.randint(10000000, 99999999)}",
        "language": random.choices(["uz", "ru"], weights=[80, 20])[0],
        "region": region,
        "treatment_started_at": treatment_start.isoformat(),
        "drugs": regimen,
        "reminder_time": f"{random.randint(7, 10):02d}:00",
        "profile": profile,                   # для дебага и обучения ML
        "adherence_rate": round(adherence_rate, 3),
        "current_streak": current_streak,
        "longest_streak": longest,
        "drop_off_risk_score": round(drop_off_risk, 3),
        "verified_doses": verified_doses,
        "missed_doses": missed_doses,
        "side_effects": side_effects,
        "total_doses": len(adherence),
        "verified_count": sum(adherence),
        "missed_count": len(adherence) - sum(adherence),
    }


# ─── Main ───────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--patients", type=int, default=30)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--output", default="data/synthetic")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    cohort = [gen_patient(i, args.days) for i in range(args.patients)]

    # Сохраняем JSON со всей когортой
    with open(out_dir / "cohort.json", "w", encoding="utf-8") as f:
        json.dump(cohort, f, ensure_ascii=False, indent=2)

    # CSV для ML training (одна строка = один пациент с фичами)
    import csv
    with open(out_dir / "cohort_features.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "patient_id", "profile", "birth_year", "language", "region",
            "drugs_count", "treatment_days", "adherence_rate",
            "current_streak", "longest_streak", "side_effect_count",
            "high_severity_se_count", "drop_off_risk_score",
        ])
        for p in cohort:
            high_se = sum(1 for se in p["side_effects"] if se["severity"] in {"high", "emergency"})
            w.writerow([
                p["id"], p["profile"], p["birth_year"], p["language"], p["region"],
                len(p["drugs"]), p["total_doses"], p["adherence_rate"],
                p["current_streak"], p["longest_streak"], len(p["side_effects"]),
                high_se, p["drop_off_risk_score"],
            ])

    # Sample SQL inserts для seed
    with open(out_dir / "seed_patients.sql", "w", encoding="utf-8") as f:
        f.write("-- Davo-AI synthetic seed data\n")
        f.write("-- Сгенерировано: " + dt.datetime.now().isoformat() + "\n\n")
        for p in cohort[:5]:  # только 5 для seed
            drugs_arr = "{" + ",".join(p["drugs"]) + "}"
            f.write(f"""INSERT INTO patients (
    id, telegram_id, full_name, birth_year, phone, language, timezone,
    treatment_started_at, drugs, reminder_time, consent_cross_border, consent_at
) VALUES (
    '{p["id"]}', {p["telegram_id"]}, '{p["full_name"]}', {p["birth_year"]},
    '{p["phone"]}', '{p["language"]}', 'Asia/Tashkent',
    '{p["treatment_started_at"]}', '{drugs_arr}', '{p["reminder_time"]}',
    FALSE, NOW()
);\n""")

    # Stats
    print(f"✓ Сгенерировано {len(cohort)} пациентов")
    profile_counts: dict[str, int] = {}
    for p in cohort:
        profile_counts[p["profile"]] = profile_counts.get(p["profile"], 0) + 1
    print("  Профили:")
    for prof, count in sorted(profile_counts.items()):
        avg = np.mean([p["adherence_rate"] for p in cohort if p["profile"] == prof])
        print(f"    {prof:8s}: {count:3d}  (avg adherence: {avg:.1%})")
    print(f"  Total side effects: {sum(len(p['side_effects']) for p in cohort)}")
    print(f"  Output: {out_dir}/")
    print(f"    cohort.json (full data)")
    print(f"    cohort_features.csv (for ML)")
    print(f"    seed_patients.sql (DB seed)")


if __name__ == "__main__":
    main()
