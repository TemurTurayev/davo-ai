"""
Davo-AI · Verification Orchestrator
====================================

Высокоуровневый сервис, который объединяет YOLO + Vision LLM + faster-whisper
для полной верификации video-of-pill-intake.

Pipeline:
    1. Извлечь ключевые кадры из видео (start, mid, end)
    2. YOLO → детекция таблетки на кадрах "до глотания"
    3. Qwen2.5-VL → проверка face match + swallow motion
    4. Объединить результаты в structured verdict

POST /verify
    body: multipart {video, enrolled_face_image}
    response: VerificationResult с confidence breakdown

Зависимости:
    pip install fastapi uvicorn python-multipart httpx opencv-python-headless pillow
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import cv2
import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("davoai.verifier")

# ─── Service URLs ───────────────────────────────────────────────────────────
YOLO_URL = os.getenv("YOLO_URL", "http://localhost:8004")
VISION_URL = os.getenv("VISION_URL", "http://localhost:8002/v1")
VISION_MODEL = os.getenv("VISION_MODEL", "qwen-vl")

# ─── HTTP client ────────────────────────────────────────────────────────────
_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client
    _client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))
    yield
    if _client is not None:
        await _client.aclose()


app = FastAPI(title="Davo-AI · Verification Orchestrator", lifespan=lifespan)


# ─── Schemas ────────────────────────────────────────────────────────────────
class VerificationResult(BaseModel):
    verified: bool
    confidence: float  # 0..1 общий
    face_match: bool
    face_match_confidence: float
    pill_visible: bool
    pill_drugs_detected: list[str]
    pill_confidence: float
    swallow_detected: bool
    swallow_confidence: float
    review_required: bool  # True если confidence < 0.8
    raw_findings: dict[str, Any]


# ─── Frame extraction ───────────────────────────────────────────────────────
def extract_keyframes(video_path: str) -> list[tuple[float, Image.Image]]:
    """Возвращает 5 ключевых кадров: 5%, 25%, 50%, 75%, 95% длительности."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        cap.release()
        return []

    positions = [int(total * p) for p in (0.05, 0.25, 0.50, 0.75, 0.95)]
    frames: list[tuple[float, Image.Image]] = []

    for pos in positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        if not ret:
            continue
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        ts = pos / fps
        frames.append((ts, Image.fromarray(rgb)))

    cap.release()
    return frames


def img_to_b64(img: Image.Image, fmt: str = "JPEG", max_size: int = 1024) -> str:
    """Конвертирует PIL.Image в base64 data URL для vision LLM."""
    img.thumbnail((max_size, max_size))
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/{fmt.lower()};base64,{b64}"


# ─── YOLO call ──────────────────────────────────────────────────────────────
async def detect_pills_in_video(video_path: str) -> dict[str, Any]:
    assert _client is not None

    with open(video_path, "rb") as f:
        files = {"video": ("video.mp4", f, "video/mp4")}
        resp = await _client.post(
            f"{YOLO_URL}/detect_video",
            files=files,
            data={"confidence_threshold": 0.25, "sample_every_n_frames": 5},
        )

    if resp.status_code != 200:
        return {"error": resp.text, "drugs_seen": [], "max_pills_in_single_frame": 0}

    data = resp.json()
    return data.get("summary", {}) | {"frames_with_detection": len(data.get("per_frame", []))}


# ─── Vision LLM call ────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Ты медицинский AI-верификатор приёма противотуберкулёзных препаратов.
Анализируешь 5 кадров видео + 1 reference-фото лица пациента.

Задачи:
1. FACE_MATCH: лицо на кадрах совпадает с reference?
2. PILL_VISIBLE: видна ли таблетка перед приёмом (кадры 1-2)?
3. SWALLOW_DETECTED: было ли движение проглатывания (рот открыт→закрыт→рот пустой)?

Верни JSON:
{
  "face_match": bool,
  "face_match_confidence": 0..1,
  "pill_visible": bool,
  "swallow_detected": bool,
  "swallow_confidence": 0..1,
  "explanation": "краткое объяснение на узбекском",
  "review_required": bool
}

Будь строгим. Если что-то неясно — review_required=true."""


async def verify_with_vision(
    keyframes: list[tuple[float, Image.Image]],
    enrolled_face: Image.Image,
) -> dict[str, Any]:
    assert _client is not None

    if not keyframes:
        return {"error": "no keyframes", "review_required": True}

    content: list[dict[str, Any]] = [
        {"type": "text", "text": "Reference face image (enrolled):"},
        {"type": "image_url", "image_url": {"url": img_to_b64(enrolled_face)}},
        {"type": "text", "text": f"Video keyframes ({len(keyframes)} штук):"},
    ]
    for ts, img in keyframes:
        content.append({"type": "text", "text": f"Frame at {ts:.1f}s:"})
        content.append({"type": "image_url", "image_url": {"url": img_to_b64(img)}})
    content.append({"type": "text", "text": "Верни ТОЛЬКО JSON, ничего больше."})

    payload = {
        "model": VISION_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        "temperature": 0.1,
        "max_tokens": 500,
    }

    resp = await _client.post(
        f"{VISION_URL}/chat/completions",
        json=payload,
    )
    if resp.status_code != 200:
        return {"error": f"Vision API: {resp.status_code} {resp.text}", "review_required": True}

    data = resp.json()
    text = data["choices"][0]["message"]["content"]

    import json as json_mod
    import re

    # Пытаемся извлечь JSON (модели часто оборачивают в ```json…```)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {"error": "no JSON in vision response", "raw": text, "review_required": True}

    try:
        return json_mod.loads(match.group(0))
    except json_mod.JSONDecodeError as e:
        return {"error": f"JSON parse: {e}", "raw": text, "review_required": True}


# ─── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/verify", response_model=VerificationResult)
async def verify(
    video: UploadFile = File(...),
    enrolled_face: UploadFile = File(...),
):
    # Сохраняем видео
    suffix = Path(video.filename or "v.mp4").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_v:
        tmp_v.write(await video.read())
        video_path = tmp_v.name

    try:
        # Reference face
        face_bytes = await enrolled_face.read()
        face_img = Image.open(io.BytesIO(face_bytes)).convert("RGB")

        # Параллельно: YOLO на видео + ключевые кадры для vision
        keyframes = extract_keyframes(video_path)
        if not keyframes:
            raise HTTPException(400, "Could not extract keyframes from video")

        yolo_task = detect_pills_in_video(video_path)
        vision_task = verify_with_vision(keyframes, face_img)

        yolo_result, vision_result = await asyncio.gather(yolo_task, vision_task)

        # Объединяем
        pill_drugs: list[str] = list(yolo_result.get("drugs_seen", []))
        pill_visible_yolo = yolo_result.get("max_pills_in_single_frame", 0) > 0
        pill_visible_vision = bool(vision_result.get("pill_visible", False))
        pill_visible = pill_visible_yolo or pill_visible_vision

        face_match = bool(vision_result.get("face_match", False))
        face_conf = float(vision_result.get("face_match_confidence", 0.0))
        swallow = bool(vision_result.get("swallow_detected", False))
        swallow_conf = float(vision_result.get("swallow_confidence", 0.0))

        # Pill confidence: 0.9 если YOLO ✓ И vision ✓; 0.6 если только один
        if pill_visible_yolo and pill_visible_vision:
            pill_conf = 0.9
        elif pill_visible_yolo or pill_visible_vision:
            pill_conf = 0.6
        else:
            pill_conf = 0.1

        # Общий confidence — взвешенная среднее
        overall = (face_conf * 0.35) + (pill_conf * 0.30) + (swallow_conf * 0.35)
        verified = overall >= 0.7 and face_match and pill_visible and swallow
        review_required = overall < 0.8 or vision_result.get("review_required", False)

        return VerificationResult(
            verified=verified,
            confidence=round(overall, 3),
            face_match=face_match,
            face_match_confidence=round(face_conf, 3),
            pill_visible=pill_visible,
            pill_drugs_detected=pill_drugs,
            pill_confidence=round(pill_conf, 3),
            swallow_detected=swallow,
            swallow_confidence=round(swallow_conf, 3),
            review_required=review_required,
            raw_findings={
                "yolo": yolo_result,
                "vision": vision_result,
                "keyframes_count": len(keyframes),
            },
        )
    finally:
        Path(video_path).unlink(missing_ok=True)


# ─── CLI ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8005)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run("verification_orchestrator:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
