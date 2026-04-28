"""
Davo-AI · YOLOv8 TB Pill Detection server
=========================================

FastAPI обёртка над `ultralytics` YOLO. Запускает fine-tuned модель
обнаружения 4 первичных ТБ-препаратов (RHZE).

Classes:
    0  rifampicin
    1  isoniazid
    2  pyrazinamide
    3  ethambutol
    4  combo_fdc

Endpoints:
    POST /detect    — image → detections
    POST /detect_video — video → per-frame detections + summary
    GET  /health    — liveness

Запуск:
    python yolo_server.py --port 8004 --weights /opt/davoai/runs/detect/tb_pills_v1/weights/best.pt

Зависимости:
    pip install ultralytics fastapi uvicorn python-multipart pillow opencv-python-headless
"""

from __future__ import annotations

import argparse
import io
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s · %(message)s",
)
logger = logging.getLogger("davoai.yolo")

# ─── Configuration ──────────────────────────────────────────────────────────
DEFAULT_WEIGHTS = os.getenv(
    "YOLO_WEIGHTS",
    "/opt/davoai/runs/detect/tb_pills_v1/weights/best.pt",
)
FALLBACK_WEIGHTS = "yolov8n.pt"  # COCO-pretrained — для smoke-теста до fine-tune

CLASS_NAMES = {
    0: "rifampicin",
    1: "isoniazid",
    2: "pyrazinamide",
    3: "ethambutol",
    4: "combo_fdc",
}

# ─── Model state ────────────────────────────────────────────────────────────
_model: YOLO | None = None
_using_fallback: bool = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _using_fallback

    weights_path = DEFAULT_WEIGHTS
    if not Path(weights_path).exists():
        logger.warning(
            "Fine-tuned weights не найдены (%s). Загружаю COCO-pretrained yolov8n. "
            "Pill detection будет неточной до finetune!",
            weights_path,
        )
        weights_path = FALLBACK_WEIGHTS
        _using_fallback = True

    logger.info("Loading YOLO weights: %s", weights_path)
    _model = YOLO(weights_path)
    logger.info("YOLO готов. Classes: %s", _model.names)
    yield
    _model = None


app = FastAPI(
    title="Davo-AI · YOLO TB Pill Detection",
    lifespan=lifespan,
)


# ─── Schemas ────────────────────────────────────────────────────────────────
class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: list[float]  # [x1, y1, x2, y2] нормализованные (0..1)


class DetectResponse(BaseModel):
    detections: list[Detection]
    image_size: dict[str, int]
    pill_count: int
    drugs_identified: list[str]
    using_fallback_weights: bool


class FrameResult(BaseModel):
    frame_index: int
    timestamp_seconds: float
    detections: list[Detection]


class VideoDetectResponse(BaseModel):
    duration_seconds: float
    fps: float
    frames_analyzed: int
    per_frame: list[FrameResult]
    summary: dict[str, Any]
    using_fallback_weights: bool


# ─── Helpers ────────────────────────────────────────────────────────────────
def _img_to_array(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return np.array(img)


def _detections_from_result(result, img_w: int, img_h: int) -> list[Detection]:
    out: list[Detection] = []
    if result.boxes is None or result.boxes.xyxy is None:
        return out

    boxes = result.boxes.xyxy.cpu().numpy()       # [n, 4] в пикселях
    confs = result.boxes.conf.cpu().numpy()       # [n]
    cls_ids = result.boxes.cls.cpu().numpy()      # [n]

    for box, conf, cls_id in zip(boxes, confs, cls_ids, strict=True):
        cid = int(cls_id)
        out.append(
            Detection(
                class_id=cid,
                class_name=CLASS_NAMES.get(cid, _model.names.get(cid, f"cls_{cid}")),
                confidence=float(round(conf, 4)),
                bbox=[
                    float(round(box[0] / img_w, 4)),
                    float(round(box[1] / img_h, 4)),
                    float(round(box[2] / img_w, 4)),
                    float(round(box[3] / img_h, 4)),
                ],
            )
        )
    return out


# ─── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "using_fallback_weights": _using_fallback,
        "class_names": CLASS_NAMES,
    }


@app.post("/detect", response_model=DetectResponse)
async def detect(
    image: UploadFile = File(...),
    confidence_threshold: float = Form(0.25),
):
    if _model is None:
        raise HTTPException(503, "Model not loaded")

    img_bytes = await image.read()
    img = _img_to_array(img_bytes)
    h, w = img.shape[:2]

    results = _model.predict(
        img,
        conf=confidence_threshold,
        verbose=False,
    )
    detections = _detections_from_result(results[0], w, h)

    drugs = sorted({d.class_name for d in detections})

    return DetectResponse(
        detections=detections,
        image_size={"width": w, "height": h},
        pill_count=len(detections),
        drugs_identified=drugs,
        using_fallback_weights=_using_fallback,
    )


@app.post("/detect_video", response_model=VideoDetectResponse)
async def detect_video(
    video: UploadFile = File(...),
    confidence_threshold: float = Form(0.25),
    sample_every_n_frames: int = Form(5, description="Анализировать каждый N-й кадр"),
):
    """Анализирует видео покадрово, возвращает детекции и summary."""
    if _model is None:
        raise HTTPException(503, "Model not loaded")

    suffix = Path(video.filename or "video.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await video.read())
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(400, "Cannot open video")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps else 0

        per_frame: list[FrameResult] = []
        max_pill_count = 0
        seen_drugs: set[str] = set()

        idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % sample_every_n_frames != 0:
                idx += 1
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w = rgb.shape[:2]
            results = _model.predict(rgb, conf=confidence_threshold, verbose=False)
            dets = _detections_from_result(results[0], w, h)

            if dets:
                per_frame.append(
                    FrameResult(
                        frame_index=idx,
                        timestamp_seconds=round(idx / fps, 2),
                        detections=dets,
                    )
                )
                max_pill_count = max(max_pill_count, len(dets))
                for d in dets:
                    seen_drugs.add(d.class_name)

            idx += 1

        cap.release()

        summary = {
            "max_pills_in_single_frame": max_pill_count,
            "drugs_seen": sorted(seen_drugs),
            "frames_with_detection": len(per_frame),
        }

        return VideoDetectResponse(
            duration_seconds=round(duration, 2),
            fps=round(fps, 2),
            frames_analyzed=idx,
            per_frame=per_frame,
            summary=summary,
            using_fallback_weights=_using_fallback,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ─── CLI ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8004)
    parser.add_argument("--weights", default=None)
    args = parser.parse_args()

    if args.weights:
        os.environ["YOLO_WEIGHTS"] = args.weights

    import uvicorn
    uvicorn.run(
        "yolo_server:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
