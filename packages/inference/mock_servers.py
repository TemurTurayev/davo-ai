"""
Davo-AI · Mock Inference Servers
=================================

Запускает все 4 inference-эндпоинта (LLM, Vision, Whisper, Verifier)
в одном FastAPI-процессе с детерминированными mock-ответами.

Это позволяет команде разрабатывать и тестировать Telegram-бот + dashboard
**без DGX Spark** — на любом ноутбуке.

Запуск:
    python packages/inference/mock_servers.py
    # → http://localhost:9000

В .env установить:
    LLM_API_URL=http://localhost:9000/v1
    VISION_API_URL=http://localhost:9000/v1
    WHISPER_API_URL=http://localhost:9000/whisper
    VERIFIER_API_URL=http://localhost:9000/verifier

Endpoints:
    GET  /health
    POST /v1/chat/completions          → LLM (Aya / Qwen-VL emulation)
    POST /whisper/transcribe           → faster-whisper emulation
    POST /verifier/verify              → full pipeline emulation

Зависимости:
    pip install fastapi uvicorn python-multipart pydantic
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import random
import time
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("davoai.mock")

app = FastAPI(
    title="Davo-AI · Mock Inference Servers",
    description="Локальный stub для разработки бота без DGX Spark",
)


# ─── Health ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "mode": "mock", "services": ["llm", "vision", "whisper", "verifier"]}


@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "aya-expanse-32b", "object": "model", "owned_by": "mock"},
            {"id": "qwen-vl", "object": "model", "owned_by": "mock"},
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════
# LLM — OpenAI-compatible chat completions
# ═══════════════════════════════════════════════════════════════════════════


class ChatMessage(BaseModel):
    role: str
    content: Any  # может быть строкой или list[dict] (для vision)


class ChatRequest(BaseModel):
    model: str = "aya-expanse-32b"
    messages: list[ChatMessage]
    temperature: float = 0.3
    max_tokens: int = 800


# Detector: если в system prompt есть "JSON формат" — возвращаем mock JSON
def _make_chat_response(req: ChatRequest) -> str:
    """Генерирует правдоподобный mock ответ на основе содержимого запроса."""
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    user_text = ""
    if last_user:
        if isinstance(last_user.content, str):
            user_text = last_user.content
        elif isinstance(last_user.content, list):
            user_text = " ".join(
                part.get("text", "")
                for part in last_user.content
                if isinstance(part, dict) and part.get("type") == "text"
            )

    user_lower = user_text.lower()

    # Vision triage (verifier orchestrator)
    if "face_match" in str(req.messages) or "verify" in user_lower:
        verified = random.random() > 0.15  # 85% verified
        return json.dumps(
            {
                "face_match": verified,
                "face_match_confidence": round(
                    random.uniform(0.85, 0.98) if verified else random.uniform(0.30, 0.65), 3
                ),
                "pill_visible": True,
                "swallow_detected": verified,
                "swallow_confidence": round(
                    random.uniform(0.80, 0.95) if verified else random.uniform(0.40, 0.70), 3
                ),
                "explanation": "Mock: yuz mos keladi, dori ko'rinadi, yutish aniqlandi"
                if verified
                else "Mock: shubhali — qayta ko'rib chiqish kerak",
                "review_required": not verified,
            }
        )

    # Side-effect triage (TB drug system prompt)
    if any(kw in user_lower for kw in ["qornim", "болит", "тошн", "sariq", "ko'r", "глаза"]):
        # Распознаём red flags
        red_flag = any(
            kw in user_lower
            for kw in [
                "sariq",
                "qora siy",
                "ko'rishim",
                "глаза стали",
                "моча тёмная",
                "зрение",
                "yuzim shisht",
                "лицо опух",
                "nafas qisil",
            ]
        )
        severity = "high" if red_flag else random.choice(["low", "low", "medium"])
        return json.dumps(
            {
                "severity": severity,
                "expected_se": severity != "high",
                "advice_uz": (
                    "Bu jiddiy belgi bo'lishi mumkin. Iltimos, darhol shifokoringizga murojaat qiling."
                    if red_flag
                    else "Bu rifampitsindan ko'rinadi. Taom bilan iching, agar 2-3 kunda o'tmasa — shifokorga ayting."
                ),
                "advice_ru": (
                    "Это может быть серьёзный симптом. Срочно обратитесь к врачу."
                    if red_flag
                    else "Похоже на побочный эффект рифампицина. Принимайте с едой; если не пройдёт за 2-3 дня — скажите врачу."
                ),
                "escalate_to_doctor": red_flag,
            }
        )

    # Default: friendly conversational reply
    return (
        f"Mock response to: '{user_text[:80]}'. Это отладочный stub-ответ от Davo-AI mock сервера."
    )


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest):
    # Имитируем небольшую задержку (как реальная LLM ~200-500ms)
    await asyncio.sleep(random.uniform(0.2, 0.5))

    content = _make_chat_response(req)
    return {
        "id": f"chatcmpl-mock-{int(time.time()*1000)}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": req.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": len(content) // 4,
            "total_tokens": 100 + len(content) // 4,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# Whisper — STT mock
# ═══════════════════════════════════════════════════════════════════════════

MOCK_TRANSCRIPTS_UZ = [
    "Qornim og'riyapti dori ichgandan keyin",
    "Boshim aylanyapti, bugun o'zimni yomon his qilyapman",
    "Bugun videoni yubora olmadim, ish joyida edim",
    "Ko'zlarim biroz sariq ko'rinadi",
    "Hammasi yaxshi, dori qabul qildim",
]

MOCK_TRANSCRIPTS_RU = [
    "Болит живот после приёма таблеток",
    "Кружится голова, чувствую слабость",
    "Сегодня не успел снять видео, был на работе",
    "Глаза кажутся желтоватыми",
    "Всё хорошо, лекарства принял",
]


@app.post("/whisper/transcribe")
async def whisper_transcribe(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    initial_prompt: str | None = Form(None),
):
    await asyncio.sleep(random.uniform(0.5, 1.5))

    pool = MOCK_TRANSCRIPTS_RU if language == "ru" else MOCK_TRANSCRIPTS_UZ
    text = random.choice(pool)
    detected_lang = "ru" if language == "ru" else "uz"

    return {
        "text": text,
        "language": detected_lang,
        "language_probability": 0.95,
        "duration": round(random.uniform(2.0, 8.0), 2),
        "segments": [
            {
                "start": 0.0,
                "end": 5.0,
                "text": text,
                "avg_logprob": -0.3,
            }
        ],
        "model": "mock-whisper-large-v3-turbo",
    }


@app.get("/whisper/health")
async def whisper_health():
    return {"status": "ok", "model": "mock-whisper", "loaded": True}


# ═══════════════════════════════════════════════════════════════════════════
# Verifier orchestrator — full video verification mock
# ═══════════════════════════════════════════════════════════════════════════


@app.post("/verifier/verify")
async def verify(
    video: UploadFile = File(...),
    enrolled_face: UploadFile = File(...),
):
    await asyncio.sleep(random.uniform(1.0, 2.5))  # имитируем реальный pipeline

    # Размер видео влияет на результат (для разнообразия)
    video_bytes = await video.read()
    size_kb = len(video_bytes) / 1024

    # 80% verified, 15% review_required, 5% rejected
    r = random.random()
    if r < 0.80:
        verified = True
        review = False
        confidence = round(random.uniform(0.85, 0.97), 3)
    elif r < 0.95:
        verified = False
        review = True
        confidence = round(random.uniform(0.55, 0.78), 3)
    else:
        verified = False
        review = False
        confidence = round(random.uniform(0.20, 0.50), 3)

    drugs = random.sample(
        ["rifampicin", "isoniazid", "pyrazinamide", "ethambutol"],
        k=random.randint(1, 3),
    )

    return {
        "verified": verified,
        "confidence": confidence,
        "face_match": verified,
        "face_match_confidence": round(
            random.uniform(0.85, 0.99) if verified else random.uniform(0.30, 0.70), 3
        ),
        "pill_visible": True,
        "pill_drugs_detected": drugs,
        "pill_confidence": round(random.uniform(0.75, 0.95), 3),
        "swallow_detected": verified,
        "swallow_confidence": round(
            random.uniform(0.78, 0.93) if verified else random.uniform(0.40, 0.70), 3
        ),
        "review_required": review,
        "raw_findings": {
            "yolo": {"drugs_seen": drugs, "max_pills_in_single_frame": 1},
            "vision": {"explanation": "Mock pipeline result"},
            "video_size_kb": round(size_kb, 1),
            "keyframes_count": 5,
            "_mock": True,
        },
    }


@app.get("/verifier/health")
async def verifier_health():
    return {"status": "ok", "mode": "mock"}


# ═══════════════════════════════════════════════════════════════════════════
# YOLO — pill detection mock
# ═══════════════════════════════════════════════════════════════════════════


@app.post("/yolo/detect")
async def yolo_detect(
    image: UploadFile = File(...),
    confidence_threshold: float = Form(0.25),
):
    await asyncio.sleep(0.1)
    drug_id = random.randint(0, 4)
    classes = ["rifampicin", "isoniazid", "pyrazinamide", "ethambutol", "combo_fdc"]
    return {
        "detections": [
            {
                "class_id": drug_id,
                "class_name": classes[drug_id],
                "confidence": round(random.uniform(0.75, 0.95), 4),
                "bbox": [0.25, 0.30, 0.75, 0.70],
            }
        ],
        "image_size": {"width": 640, "height": 480},
        "pill_count": 1,
        "drugs_identified": [classes[drug_id]],
        "using_fallback_weights": True,
    }


@app.get("/yolo/health")
async def yolo_health():
    return {
        "status": "ok",
        "mock": True,
        "class_names": {
            0: "rifampicin",
            1: "isoniazid",
            2: "pyrazinamide",
            3: "ethambutol",
            4: "combo_fdc",
        },
    }


# ─── Catch-all для непокрытых endpoint'ов ───────────────────────────────────
@app.get("/{path:path}")
async def catchall_get(path: str):
    return JSONResponse({"mock": True, "path": path, "method": "GET"}, status_code=200)


# ─── CLI ────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9000)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument(
        "--seed", type=int, default=None, help="Random seed для детерминированных ответов в тестах"
    )
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        logger.info(f"Random seed: {args.seed} (deterministic mode)")

    import uvicorn

    logger.info("─" * 50)
    logger.info("Davo-AI Mock Inference Servers")
    logger.info(f"Listening on http://{args.host}:{args.port}")
    logger.info("Endpoints:")
    logger.info(f"  LLM:      http://{args.host}:{args.port}/v1/chat/completions")
    logger.info(f"  Whisper:  http://{args.host}:{args.port}/whisper/transcribe")
    logger.info(f"  Verifier: http://{args.host}:{args.port}/verifier/verify")
    logger.info(f"  YOLO:     http://{args.host}:{args.port}/yolo/detect")
    logger.info("─" * 50)

    uvicorn.run("mock_servers:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
