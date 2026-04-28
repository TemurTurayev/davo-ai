# Hackathon Runbook — 48 hours

> Точный по-часовой план для команды MindTech на хакатоне.

## T-1 day (preparation, до хакатона)

- [x] vast.ai RTX 5090 (Slovenia datacenter) — арендован 2026-04-28, $0.589/hr, 200 GB disk, 503 GB RAM
- [ ] HuggingFace token у каждого члена команды
- [ ] Telegram bot token у @BotFather (`@DavoAIBot` или `@MindTechDavoBot`)
- [ ] @BotFather → API ID + API Hash (для Local Bot API)
- [ ] Anthropic API key как backup (на случай DGX недоступен)
- [ ] Repo `TemurTurayev/davo-ai` создан, все запушено
- [ ] Vercel проект для dashboard (auto-deploy from main)
- [ ] Темур: фото-датасет TB drugs дополнен из реальных upakovok (post-research)
- [ ] Pitch deck Beamer/Keynote — 9 слайдов на узбекском
- [ ] Тестовый прогон bot end-to-end на Mac M4 + Ollama

---

## H+0 to H+8 — Foundation

### H+0 (8:00 — kickoff)

**Кто делает что:**
- Темур + Дилшода: SSH в vast.ai RTX 5090 (Slovenia), запустить `setup_dgx_spark.sh`
- Мухаммад: docker-compose локальный — Postgres + Local Bot API
- Саида: pitch deck draft + видео сценарий

**Параллельно**:
```bash
# Темур / Дилшода:
ssh vast
mkdir -p /workspace && cd /workspace
git clone https://github.com/TemurTurayev/davo-ai.git
cd davo-ai
HF_TOKEN=hf_xxx bash infra/inference/setup_vast_ai.sh
# (~15-20 минут на vast.ai из-за быстрой сети)

# Мухаммад:
cd davo-ai
docker-compose -f infra/docker/docker-compose.yml up -d
psql -h localhost -U davoai -d davoai -f infra/db/schema.sql

# Саида:
# Слайды 1-3 (проблема, экономика, решение)
```

### H+4

- [ ] DGX setup завершён, все 4 inference сервиса отвечают на /health
- [ ] Postgres запущен с schema + seed
- [ ] Telegram bot стартует на Mac M4 (`python packages/bot/main.py`)
- [ ] Bot отвечает на `/start`

### H+8

- [ ] Регистрация пациента работает end-to-end (FSM до конца)
- [ ] Synthetic data загружена в Postgres
- [ ] Dashboard билдится и показывает 30 пациентов

---

## H+8 to H+16 — Vision pipeline

### H+8 (16:00)

**Темур**: запустить YOLOv8 fine-tuning на TB pills dataset.

```bash
ssh dgx
cd /opt/davoai
yolo train model=yolov8m.pt \
  data=/opt/davoai/repo/data/tb_pills/dataset.yaml \
  epochs=100 imgsz=640 batch=16 \
  project=/opt/davoai/runs name=tb_pills_v1
# ~2-3 часа на vast.ai RTX 5090 (Slovenia)
```

Параллельно — annotation датасета через Roboflow или CVAT (если ещё не сделано).

### H+12

- [ ] YOLO обучена, mAP@0.5 ≥ 0.75
- [ ] Vision verifier тестирован на 5 synthetic videos
- [ ] Bot отправляет видео → получает verification result
- [ ] Dashboard показывает alerts из synthetic data

---

## H+16 to H+24 — Chat + Polish

### H+16

- [ ] Side effect chat (текст и голос) end-to-end
- [ ] Aya Expanse 32B отвечает на узбекском с медицинским контекстом
- [ ] Triage classifier распознаёт red flags (sariq, qora siy, ko'rish)
- [ ] Dashboard alerts page показывает urgent SE

### H+20

- [ ] **Demo flow**: один пациент через все шаги (registration → video → SE → progress)
- [ ] Dashboard видит этого пациента в real-time
- [ ] Ноутбук с pitch deck готов

### H+24 (8:00 next day, mid-point)

🎯 **Готовность 50%** — все компоненты работают по отдельности, начинаем интеграционный тест.

---

## H+24 to H+32 — Integration & Demo data

### H+24

- [ ] Создать 5 demo пациентов с реальными именами и историей
- [ ] Записать живые видео (Темур или Мухаммад) для demo
- [ ] Проверить video upload через Telegram local API (>20 MB сценарий)

### H+28

- [ ] Синтетика drop-off prediction — rule-based scoring работает
- [ ] Dashboard alerts показывает топ-5 at-risk
- [ ] Auto-generated outreach messages (опционально)

### H+32

- [ ] Pitch deck v2 — все слайды на узбекском
- [ ] Demo video v1 — 2 минуты, экранкаст + голос Темура

---

## H+32 to H+40 — Polish & Pitch

### H+32

- [ ] Pitch repetition #1 — Темур говорит, остальные слушают и критикуют
- [ ] Замечания вносятся в slides

### H+36

- [ ] Pitch repetition #2 — на узбекском, 5-минутный таймер
- [ ] Q&A репетиция — 5 вопросов из `docs/PITCH_UZ.md`

### H+40

- [ ] Все commits в main, README с git-history виден
- [ ] Demo video финал, 90-120 секунд
- [ ] Backup: запасное видео если интернет упадёт

---

## H+40 to H+48 — Submission & Final

### H+40

- [ ] Submission package:
  - Source code (GitHub link)
  - Demo video (MP4)
  - Pitch deck (PDF)
  - Architecture doc
  - README

### H+44

- [ ] Pitch repetition #3 — final, на узбекском, в одежде питча
- [ ] Backup laptop с локальной демо

### H+48 (presentation)

🎤 **Pitch на сцене** — 5 минут на узбекском, 10 минут Q&A.

---

## Команда — кто что делает в Q&A

| Тема вопроса | Отвечает |
|--------------|----------|
| ТБ медицина | Темур |
| Pediatric | Темур |
| Узбекская специфика | Темур |
| ML / vision | Дилшода |
| Backend / Telegram | Мухаммад |
| Бизнес / monetization | Саида |
| Dashboard / UX | Саида |
| Регуляторика | Темур + Саида |

---

## Запасной план если vast.ai instance отвалится

### Plan B: новый vast.ai instance
1. Снять snapshot моделей через `huggingface-cli` (на Mac или другом инстансе)
2. Арендовать новый RTX 5090 в той же Slovenia
3. Запустить `setup_vast_ai.sh` — модели скачаются за ~15 мин

### Plan C: Mac M4 + Ollama (для демо если совсем плохо)
1. **Ollama** — fallback стек:
   - `ollama pull qwen2.5:7b`
   - `ollama pull qwen2.5-vl:3b`
   - `ollama pull llama3.2-vision:11b`
2. **Whisper-medium** на CPU (5x медленнее)
3. **YOLO без fine-tune** — yolov8n COCO (показываем concept)
4. **Story**: «Демо на ноутбуке для скорости, production на GPU-сервере»

### Plan D: Mock servers (для slides/демо без AI)
`python packages/inference/mock_servers.py` — детерминированные ответы на порту 9000.
Подходит если интернет умер совсем.

---

## Критические напоминания

⚠️ **Telegram 20 MB лимит** — обязательно Local Bot API в Docker, иначе видео не скачается
⚠️ **Whisper узбекский** — всегда показывать распознанный текст с edit-кнопкой
⚠️ **HuggingFace login** — toкен не должен попасть в git (.env только)
⚠️ **Demo backup** — записать pre-rendered video на случай отказа сети
⚠️ **Pitch — на узбекском** — Темур ведёт, остальные на узбекском приветствие
