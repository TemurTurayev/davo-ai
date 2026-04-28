# Davo-AI · Architecture

> Single-page architecture overview. Source of truth — `RESEARCH_DOSSIER.md` + `README.md`.

## High-level data flow

```
┌──────────┐       ┌──────────────┐       ┌─────────────────┐       ┌──────────────┐
│ Patient  │──────▶│ Telegram     │──────▶│  Bot Gateway    │──────▶│   Postgres   │
│ (phone)  │ video │ Bot API      │       │  (aiogram 3.x)  │       │              │
└──────────┘       │ (local)      │       │                 │       └──────────────┘
                   └──────────────┘       │                 │              │
                                          │                 │              │
                                          ▼                 ▼              │
                                  ┌────────────┐    ┌──────────────┐       │
                                  │ DGX Spark  │    │ Local FS     │       │
                                  │ Inference  │    │ /data/videos │       │
                                  └────────────┘    └──────────────┘       │
                                          │                                │
                                          │   verification result          │
                                          ▼                                ▼
                                                              ┌──────────────────────┐
                                                              │  Doctor dashboard    │
                                                              │  (Next.js)           │
                                                              └──────────────────────┘
```

## Components

### 1. Telegram Bot (`packages/bot/`)
- **Framework**: aiogram 3.x (async)
- **Local Bot API**: Docker-контейнер для видео >20 MB
- **State**: FSM в памяти (Redis в продакшне)
- **Locales**: `uz.json` (primary) + `ru.json`
- **Handlers**:
  - `start.py` — /start, /help, /progress, language switching
  - `registration.py` — FSM: name → year → phone → face → drugs → time
  - `video.py` — приём видео → отправка в Verifier → ответ пациенту
  - `chat.py` — text/voice → STT (если voice) → LLM triage → DB
- **Scheduler**: APScheduler, daily reminders в `reminder_time` пациента

### 2. Inference servers (`packages/inference/`)
Все запускаются на NVIDIA DGX Spark через systemd.

| Сервер | Порт | Модель | OpenAI-compatible |
|--------|------|--------|-------------------|
| LLM | 8001 | Aya Expanse 32B | ✅ (vLLM) |
| Vision | 8002 | Qwen2.5-VL-7B-Instruct | ✅ (vLLM) |
| Whisper STT | 8003 | Large-v3-Turbo | Custom FastAPI |
| YOLO Pills | 8004 | YOLOv8m fine-tuned | Custom FastAPI |
| Verifier | 8005 | (orchestrator) | Custom FastAPI |

**Verifier orchestrator** (port 8005) — высокоуровневый pipeline:
1. Принимает video + enrolled face
2. Извлекает 5 ключевых кадров (5%, 25%, 50%, 75%, 95%)
3. Параллельно: YOLO на видео + Vision LLM на кадрах
4. Объединяет результаты в `VerificationResult`
5. Возвращает: `verified`, `confidence`, `face_match`, `pill_visible`, `swallow_detected`, `review_required`

### 3. Database (`infra/db/schema.sql`)
PostgreSQL 16. Таблицы:
- `patients` — основные данные пациента
- `doctors` + `clinics` — врачи и учреждения
- `doses` — запланированные дозы (по дням)
- `intake_videos` — все видео + AI verification result
- `side_effects` — жалобы + AI triage
- `reminder_log` — журнал напоминаний
- `adherence_metrics` — агрегированные показатели (streak, rate)
- `events` — audit trail

### 4. Doctor Dashboard (`packages/dashboard/`)
Next.js 16 + React 19 + Tailwind 4. Минимальные страницы:
- `/` — список пациентов с риск-скорами
- `/patient/[id]` — карточка пациента, calendar adherence, side effects
- `/alerts` — критичные SE + at-risk пациенты

Данные берёт из `data/synthetic/cohort.json` (для MVP). В продакшне → DB.

## Data sovereignty (ZRU-547)

Вся inference — **локально** на DGX Spark в Узбекистане.
Никаких вызовов к Anthropic / OpenAI / Google.
Видео и медданные хранятся в локальной FS / on-prem Postgres.

→ автоматическое соответствие требованию локализации данных (поправка 2021 г.).

## Fallback стратегия (если DGX Spark недоступен)

| Компонент | Fallback на Mac M4 |
|-----------|---------------------|
| LLM (Aya 32B) | Ollama: `aya:8b-23-q4_K_M` или `qwen2.5:7b` |
| Vision | Ollama: `qwen2.5-vl:3b` |
| STT | faster-whisper `medium` (CPU) |
| YOLO | `yolov8n` COCO (без fine-tune) |

Качество ниже на 5–15%, но всё ещё локально.

## Deployment timeline (план для хакатона)

| Часы | Задача |
|------|--------|
| 0-4 | DGX setup script + verify hardware + начать download моделей |
| 4-8 | Telegram bot подключение + регистрация пациента (тест) |
| 8-12 | YOLO fine-tune на TB pills dataset (2-3ч обучения) |
| 12-16 | Verifier integration test (full pipeline на synthetic videos) |
| 16-20 | Dashboard polish + integration с реальной DB (не synthetic) |
| 20-24 | Узбекский pitch deck + repeat демо-сценария |
| 24-32 | Side effect chat — manual prompts + edge cases |
| 32-40 | Demo video recording + pitch repetition (3 round) |
| 40-48 | Polish, bug fixes, final pitch на узбекском |

## Risks register

См. `RESEARCH_DOSSIER.md` Risk Register (10 рисков с митигациями).
