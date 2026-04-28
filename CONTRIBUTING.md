# Contributing to Davo-AI

> Гайд для команды MindTech и будущих контрибьюторов.

---

## TL;DR (5 минут setup)

```bash
# 1. Клонировать
git clone https://github.com/TemurTurayev/davo-ai.git && cd davo-ai

# 2. Скопировать dev-конфиг
cp .env.dev .env
# → отредактировать TELEGRAM_BOT_TOKEN от @BotFather

# 3. Pre-commit hooks
pip install pre-commit && pre-commit install

# 4. Поднять локальную инфру (Postgres + Telegram local API)
docker-compose -f infra/docker/docker-compose.yml up -d

# 5. Сгенерировать synthetic данные
python scripts/generate_synthetic.py --patients 30 --days 90

# 6. Запустить mock inference servers (вместо DGX)
cd packages/inference
pip install -r requirements.txt
python mock_servers.py    # → http://localhost:9000

# 7. Запустить bot (в новом терминале)
cd packages/bot
pip install -r requirements.txt
python main.py

# 8. Запустить dashboard (в третьем терминале)
cd packages/dashboard
pnpm install && pnpm dev   # → http://localhost:3000
```

---

## Команда — кто за что отвечает

| Имя | Роль | Главная зона | Какой компонент |
|-----|------|--------------|-----------------|
| **Темур** | Medical Lead + Pitch | Knowledge base, медицинский Q&A | `data/kb/`, `docs/PITCH_UZ.md`, бизнес-логика чата |
| **Дилшода** | AI / ML Engineer | Vision + STT + drop-off | `packages/inference/`, `scripts/train_yolo.py` |
| **Мухаммад** | Backend / Data | Bot + DB + Telegram | `packages/bot/`, `infra/db/`, `docker-compose` |
| **Саида** | Presenter + Analyst | Dashboard + slides | `packages/dashboard/`, `assets/pitch/` |

---

## Workflow

### 1. Branch naming
```
feat/<short-desc>     # новая функция
fix/<short-desc>      # баг
refactor/<short-desc> # рефакторинг
docs/<short-desc>     # только документация
test/<short-desc>     # только тесты
```

### 2. Commit messages — Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`, `perf`

**Scopes**: `bot`, `inference`, `dashboard`, `db`, `dgx`, `pitch`, `kb`, `mock`

**Examples** (из нашей истории):
- `feat(yolo): training pipeline + dataset annotation guide`
- `feat(mock): mock inference servers for offline dev`
- `fix(security): env-var credentials + SECURITY.md`
- `test(bot): pytest suite (30 tests, all green)`
- `ci: GitHub Actions workflows (CI + Security)`

### 3. Pull Request workflow

1. Создать ветку `feat/...` от main
2. Закоммитить с Conventional Commits
3. Push: `git push -u origin feat/...`
4. `gh pr create --base main --title "feat(...): ..."`
5. **Pre-commit + CI должны быть зелёными**
6. **При мерже: rebase или squash** (не merge commit) для чистой истории

### 4. Pre-commit checks (запускаются автоматически)

- `gitleaks` — поиск секретов
- `ruff` (lint + format) — Python качество кода
- `check-yaml`, `check-json` — синтаксис конфигов
- `forbid hardcoded email + password patterns` — наша custom-проверка
- `detect-private-key` — приватные ключи
- `mixed-line-ending` — CRLF→LF

**Manual checks** (запускать локально перед PR):
```bash
pre-commit run pyright --all-files --hook-stage manual
pre-commit run tsc-dashboard --all-files --hook-stage manual
```

---

## Запуск тестов

### Bot
```bash
cd packages/bot
pytest -v
# или конкретный тест:
pytest tests/test_i18n.py -v
```

### Mock servers integration
```bash
cd packages/bot
pytest tests/test_mock_integration.py -v
```

### Dashboard typecheck
```bash
cd packages/dashboard
pnpm typecheck
pnpm build
```

---

## Структура проекта

```
davo-ai/
├── packages/
│   ├── bot/              ← Telegram bot (Python aiogram)
│   │   ├── handlers/     ← /start, регистрация, видео, чат
│   │   ├── services/     ← DB, inference HTTP, scheduler
│   │   ├── locales/      ← uz.json + ru.json
│   │   └── tests/        ← pytest suite
│   ├── dashboard/        ← Next.js 16 врачебный dashboard
│   └── inference/        ← AI-серверы (vLLM, Whisper, YOLO, Verifier, Mock)
│
├── infra/
│   ├── inference/        ← setup_vast_ai.sh + setup_dgx_spark.sh (fallback)
│   ├── db/               ← Postgres schema + миграции
│   └── docker/           ← docker-compose для локального dev
│
├── data/
│   ├── tb_pills/         ← фото-датасет 70 ТБ-таблеток (5 классов)
│   ├── tb_pills_yolo/    ← (gitignored) — генерируется prepare_yolo_dataset.py
│   ├── synthetic/        ← synthetic patient cohort
│   └── kb/               ← medical knowledge base (RAG-ready)
│
├── docs/                 ← ARCHITECTURE, PITCH_UZ, RUNBOOK
├── scripts/              ← helpers (synthetic, YOLO train, video synth, pitch gen)
└── assets/
    ├── pitch/            ← готовый PDF deck
    └── demos/            ← синтетические demo-видео
```

---

## Distinctive команды

```bash
# Сгенерировать synthetic-когорту
python scripts/generate_synthetic.py --patients 30 --days 90

# Подготовить YOLO dataset (split + augmentation)
python scripts/prepare_yolo_dataset.py --augment 3

# Train YOLO (на RTX 5090 (vast.ai))
python scripts/train_yolo.py --epochs 100 --batch 16

# Сгенерировать pitch deck
python scripts/generate_pitch_uz.py

# Синтез demo-видео
python scripts/synthesize_demo_video.py --batch 5

# Запустить mock-серверы (для dev без DGX)
python packages/inference/mock_servers.py

# Pre-commit проверка всего репо
pre-commit run --all-files
```

---

## Где взять токены / креды

| Сервис | Как получить |
|--------|--------------|
| Telegram Bot Token | https://t.me/BotFather → /newbot |
| Telegram API ID/Hash | https://my.telegram.org → API development tools |
| HuggingFace Token | https://huggingface.co/settings/tokens (read access) |
| RTX 5090 (vast.ai) SSH | По заявке (см. `~/.claude/CLAUDE.md`) |

**ВАЖНО**: токены никогда не commit'ить. Только в `.env` (gitignored).

---

## Что делать если...

**Pre-commit падает на gitleaks**:
1. `git diff --staged` — найти какой файл/строка
2. Перенести в `.env`, заменить ссылкой на env-var
3. Если false-positive — добавить в `.gitleaks.toml` allowlist

**Тесты падают локально, но не в CI**:
- Проверь `.env` — может быть нестандартные значения
- `pytest --cache-clear`

**Bot не запускается — `KeyError: TELEGRAM_BOT_TOKEN`**:
- `cp .env.dev .env`
- Заполнить TELEGRAM_BOT_TOKEN

**Нужно добавить новый язык**:
1. `packages/bot/locales/<lang>.json` — все ключи
2. `packages/bot/i18n.py` — добавить в `Lang` Literal
3. `packages/bot/keyboards.py` — language_picker

**Хочется добавить новую AI-модель**:
- Через vLLM: добавить в `infra/inference/setup_vast_ai.sh` (download + tmux launcher)
- Через Ollama (для dev): добавить `ollama pull <model>` в docker-compose

---

## Контакты

- **Lead**: Темур Тураев — [@Turayev_Temur](https://t.me/Turayev_Temur)
- **Email**: temurturayev7822@gmail.com
- **Slack/Discord**: создадим если нужно

---

**Спасибо за вклад в борьбу с туберкулёзом в Узбекистане!** 🇺🇿
