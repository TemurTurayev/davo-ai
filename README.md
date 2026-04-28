# Davo-AI

> **AI-platforma для замены DOT на VOT при туберкулёзе** — Telegram-бот с локальной AI-верификацией приёма таблеток на узбекском языке.

**Команда**: MindTech · **Хакатон**: AI HEALTH 2026, CAU Tashkent

---

## Что это

В Узбекистане **27% MDR-TB пациентов теряются для лечения** в Каракалпакстане. Лечение MDR-TB стоит **в 35× больше** обычного ТБ ($1773 vs $50). Главная причина срыва — ежедневные походы в диспансер для DOT.

**Davo-AI** заменяет DOT на VOT (Video Observed Therapy) с AI-верификацией:
1. Пациент принимает таблетку перед камерой телефона
2. Telegram-бот отправляет 15-секундное видео в наш AI-стек
3. **Локальная AI** (RTX 5090 GPU server в EU) проверяет: лицо, таблетка, глотание
4. Врач видит только flagged-кейсы — экономия времени медперсонала

Мета-анализ Cureus 2024: **VOT в 2.79× эффективнее DOT** (RR=2.79, 95% CI 2.26–3.45).

---

## Что отличает нас

| | 99DOTS | Scene Health | AICure | MSF Karakalpakstan | **Davo-AI** |
|---|---|---|---|---|---|
| AI-верификация | ❌ | ❌ (manual) | ✅ | ❌ | **✅** |
| Канал | SMS+phone | Native app | Native app | Видеозвонок | **Telegram** |
| Узбекский язык | ❌ | ❌ | ❌ | через медсестру | **✅ (UZ + RU)** |
| Async/Sync | Async | Async | Async | **Sync** (нагрузка) | **Async** |
| Public health TB | ✅ | ✅ | ❌ (pharma trials) | ✅ | **✅** |
| **Локальная AI / data sovereignty** | ❌ | ❌ | ❌ | ❌ | **✅** |

**Killer differentiator**: единственное решение, которое сочетает (a) AI-верификацию + (b) Telegram + (c) узбекский + (d) GPU-инфраструктуру в EU (Slovenia datacenter, GDPR-compliant) → готовность к деплою в локальный датацентр Узбекистана для соответствия закону **ZRU-547**.

---

## Архитектура

```
┌───────────────────────────────────────────────────────────┐
│                   ПАЦИЕНТ (Telegram)                       │
│  Регистрация → Reminder → Запись 15-сек видео → Чат о SE  │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTPS
                         ▼
┌───────────────────────────────────────────────────────────┐
│              BOT GATEWAY (Python aiogram 3.x)              │
│  - Local Telegram Bot API (для видео >20MB)               │
│  - i18n: узбекский primary, русский опция                 │
│  - Очередь задач (RQ/Celery)                              │
└────────────────────────┬──────────────────────────────────┘
                         │ Internal API
                         ▼
┌───────────────────────────────────────────────────────────┐
│         RTX 5090 GPU Server (Slovenia DC, EU)              │
│         32 GB VRAM · vast.ai · ZRU-547-ready                │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  YOLOv8m     │  │ Qwen2.5-VL   │  │  Aya 32B     │    │
│  │  TB pills    │  │  7B AWQ      │  │  AWQ 4-bit   │    │
│  │  fine-tuned  │  │ face/swallow │  │  чат о SE    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ Whisper L-v3 │  │  XGBoost     │                      │
│  │ узб. STT     │  │  drop-off    │                      │
│  └──────────────┘  └──────────────┘                      │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│             ВРАЧ (Next.js Dashboard)                       │
│  Список пациентов · Adherence score · Flagged videos      │
│  Risk alerts · Auto-generated outreach messages           │
└───────────────────────────────────────────────────────────┘
```

---

## Стек (local-first)

| Слой | Технология | Хост |
|------|-----------|------|
| Patient interface | Telegram (aiogram 3.x) | Docker container |
| Local Bot API | telegram-bot-api в Docker | Docker container |
| Vision (pill+swallow) | Qwen2.5-VL-7B-Instruct AWQ + YOLOv8m fine-tuned | RTX 5090 (vast.ai) |
| LLM (chat) | Aya Expanse 32B AWQ (Cohere) — узбекский | RTX 5090 (vast.ai) |
| STT | faster-whisper Large-v3-Turbo INT8 | RTX 5090 (vast.ai) |
| Drop-off ML | XGBoost (rule-based fallback) | RTX 5090 / CPU |
| Database | PostgreSQL | Docker / Supabase |
| Storage (видео) | Local FS / Supabase Storage | RTX 5090 local disk |
| Doctor dashboard | Next.js 16 + shadcn/ui + Recharts | Vercel |
| Auth dashboard | Clerk | Cloud |
| Serving | vLLM + FastAPI + tmux | RTX 5090 (vast.ai) |

**Никаких платных AI API**. Anthropic / OpenAI / Google не используются — все модели self-hosted на собственном GPU-сервере. Готовность к миграции в локальный UZ-датацентр для полного соответствия ZRU-547.

---

## Структура репозитория

```
davo-ai/
├── packages/
│   ├── bot/              ← Telegram bot (Python aiogram)
│   ├── dashboard/        ← Doctor dashboard (Next.js)
│   ├── inference/        ← AI-серверы (vLLM, Vision, Whisper, YOLO)
│   └── shared/           ← Общие типы, утилиты, i18n
│
├── infra/
│   ├── inference/        ← Setup-скрипты (setup_vast_ai.sh + setup_dgx_spark.sh)
│   ├── db/               ← Postgres миграции
│   └── docker/           ← docker-compose для локального dev
│
├── data/
│   ├── tb_pills/         ← Фото-датасет 4 ТБ-препаратов
│   │   ├── rifampicin/
│   │   ├── isoniazid/
│   │   ├── pyrazinamide/
│   │   ├── ethambutol/
│   │   └── combo_fdc/
│   ├── synthetic/        ← Synthetic patient cohort
│   └── kb/               ← Medical knowledge base (UZ guidelines)
│
├── docs/
│   ├── ARCHITECTURE.md   ← Детальная архитектура
│   ├── DESIGN.md         ← Design decisions
│   ├── DEPLOYMENT.md     ← Deployment runbook
│   └── PITCH_UZ.md       ← Pitch на узбекском (5 минут)
│
├── scripts/              ← Helper-скрипты
└── assets/pitch/         ← Слайды, демо-видео
```

---

## Quick Start

### Для разработчика (Mac M4 / Linux)

```bash
# 1. Клонировать
git clone https://github.com/TemurTurayev/davo-ai.git
cd davo-ai

# 2. Setup environment
cp .env.example .env
# Заполнить TELEGRAM_BOT_TOKEN от @BotFather

# 3. Запустить локальную инфру через Docker
docker-compose -f infra/docker/docker-compose.yml up -d
# Поднимает: postgres, telegram-bot-api, ollama (для dev)

# 4. Backend bot
cd packages/bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py

# 5. Doctor dashboard
cd packages/dashboard
pnpm install
pnpm dev   # → http://localhost:3000
```

### Для vast.ai RTX 5090 (production inference)

```bash
# SSH в vast.ai instance
ssh vast   # alias настроен в ~/.ssh/config (port 1879)

# Запустить setup-скрипт (один раз)
cd /workspace
git clone https://github.com/TemurTurayev/davo-ai.git
cd davo-ai
HF_TOKEN=hf_xxx bash infra/inference/setup_vast_ai.sh

# Запустить все inference-серверы (через tmux)
/workspace/davoai/start_all.sh

# Проверить
curl http://localhost:8001/v1/models
```

---

## Команда MindTech

| Имя | Роль | Профиль |
|-----|------|---------|
| **Темур Тураев** | Medical Lead | TashPMI, 5-й курс, педиатрия |
| **Дилшода** | AI/ML Engineer | — |
| **Мухаммад** | Backend / Data | — |
| **Саида** | Presenter / Analyst | — |

---

## Documentation

- [Research Dossier](../RESEARCH_DOSSIER.md) — TB epidemiology, конкуренты, тех-стек, регуляторика
- [3 Ideas Brief](../WhiteCoat_3_Ideas_Brief.pdf) — анализ идей и обоснование выбора Davo-AI
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — детальная архитектура (TBD)
- [docs/PITCH_UZ.md](docs/PITCH_UZ.md) — pitch на узбекском (TBD)

---

## License

Code: MIT (TBD)
TB pill dataset: CC BY-SA 4.0 (содержит Wikimedia изображения)
Medical knowledge base: только публичные WHO / FDA источники

---

**Built with care for Uzbek patients fighting tuberculosis** 🇺🇿
