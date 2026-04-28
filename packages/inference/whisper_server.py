"""
Davo-AI · Whisper STT server
============================

FastAPI обёртка над `faster-whisper` Large-v3-Turbo.
Поддерживает узбекский, русский, автодетекцию.

Endpoints:
    POST /transcribe   — multipart audio file → text
    GET  /health       — liveness check

Запуск:
    python whisper_server.py --port 8003

Зависимости:
    pip install faster-whisper fastapi uvicorn python-multipart
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s · %(message)s",
)
logger = logging.getLogger("davoai.whisper")

# ─── Configuration ──────────────────────────────────────────────────────────
MODEL_NAME = "large-v3-turbo"
COMPUTE_TYPE = "float16"  # На DGX Spark BF16 не поддерживается ct2, используем FP16
DEVICE = "cuda"
NUM_WORKERS = 1
SUPPORTED_LANGUAGES = {"uz", "ru", "en", "kk"}  # казахский опционально

# ─── Model state ────────────────────────────────────────────────────────────
_model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Грузим модель при старте, освобождаем при shutdown."""
    global _model
    logger.info("Loading Whisper %s on %s (%s)", MODEL_NAME, DEVICE, COMPUTE_TYPE)
    _model = WhisperModel(
        MODEL_NAME,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        num_workers=NUM_WORKERS,
    )
    logger.info("Whisper готов")
    yield
    _model = None


app = FastAPI(
    title="Davo-AI Whisper STT",
    description="Узбекский + русский STT на faster-whisper Large-v3-Turbo",
    lifespan=lifespan,
)


# ─── Schemas ────────────────────────────────────────────────────────────────
class Segment(BaseModel):
    start: float
    end: float
    text: str
    avg_logprob: float


class TranscribeResponse(BaseModel):
    text: str
    language: str
    language_probability: float
    duration: float
    segments: list[Segment]
    model: str = MODEL_NAME


# ─── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "loaded": _model is not None}


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(..., description="Audio file (wav/mp3/m4a/ogg)"),
    language: Literal["uz", "ru", "en", "kk", "auto"] = "auto",
    initial_prompt: str | None = None,
):
    """Транскрибирует аудиофайл.

    `initial_prompt` помогает с медицинской терминологией. Для узбекского ТБ-чата
    рекомендуется передавать что-то вроде:
        "Ҳолати, тиббий маслаҳат, дори воситалари, изониазид, рифампицин."
    """
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not audio.filename:
        raise HTTPException(status_code=400, detail="Empty filename")

    # Сохраняем во временный файл (faster-whisper работает с путями)
    suffix = Path(audio.filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Транскрипция в отдельном thread executor (faster-whisper sync)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: _transcribe_sync(tmp_path, language, initial_prompt),
        )
        return result
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _transcribe_sync(
    path: str,
    language: str,
    initial_prompt: str | None,
) -> TranscribeResponse:
    lang = None if language == "auto" else language

    segments_iter, info = _model.transcribe(
        path,
        language=lang,
        initial_prompt=initial_prompt,
        vad_filter=True,                 # отсекает тишину
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=5,
        word_timestamps=False,
    )

    segments: list[Segment] = []
    full_text_parts: list[str] = []

    for seg in segments_iter:
        segments.append(
            Segment(
                start=round(seg.start, 2),
                end=round(seg.end, 2),
                text=seg.text.strip(),
                avg_logprob=round(seg.avg_logprob, 4),
            )
        )
        full_text_parts.append(seg.text)

    return TranscribeResponse(
        text=" ".join(full_text_parts).strip(),
        language=info.language,
        language_probability=round(info.language_probability, 4),
        duration=round(info.duration, 2),
        segments=segments,
    )


# ─── CLI ────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8003)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    import uvicorn
    uvicorn.run(
        "whisper_server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
