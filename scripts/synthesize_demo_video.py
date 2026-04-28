"""
Davo-AI · Demo Video Synthesizer
=================================

Создаёт синтетическое 10-секундное видео "пациент принимает таблетку"
для тестирования verification pipeline без реальных пациентов.

Структура видео (5 сцен по 2 секунды):
    0–2s  : пациент показывает таблетку перед лицом
    2–4s  : таблетка идёт ко рту
    4–6s  : таблетка во рту, начало глотания
    6–8s  : глоток (рот открыт, виден язык)
    8–10s : пустой рот (открыт для подтверждения)

Использование:
    # Создать одно демо-видео с фото лица из datasets
    python scripts/synthesize_demo_video.py \\
        --face-image data/synthetic/demo_faces/sardor.jpg \\
        --pill-image data/tb_pills/rifampicin/rifampicin_wikimedia_001.jpg \\
        --output assets/demos/sardor_intake.mp4

    # Batch: 5 demo-пациентов
    python scripts/synthesize_demo_video.py --batch 5

Зависимости:
    pip install pillow opencv-python-headless numpy
    + ffmpeg в системе
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np

# ─── Defaults ───────────────────────────────────────────────────────────────
FRAME_W = 720
FRAME_H = 1280  # портретный (как реальный Telegram video)
FPS = 24
DURATION_S = 10

DRUG_COLORS = {
    "rifampicin": ((180, 50, 30), "Rifampicin"),  # red-orange
    "isoniazid": ((240, 240, 240), "Isoniazid"),  # white
    "pyrazinamide": ((230, 230, 220), "Pyrazinamide"),  # off-white
    "ethambutol": ((230, 220, 100), "Ethambutol"),  # yellow
    "combo_fdc": ((200, 100, 80), "RHZE FDC"),  # pink-brown
}


def _draw_face_placeholder(frame: np.ndarray, name: str = "Patient") -> np.ndarray:
    """Рисует плейсхолдер лица (овал + надпись)."""
    h, w = frame.shape[:2]
    cy = h // 3
    cx = w // 2

    # Skin-tone овал
    overlay = frame.copy()
    cv2.ellipse(overlay, (cx, cy), (140, 180), 0, 0, 360, (210, 175, 145), -1)
    cv2.addWeighted(overlay, 0.95, frame, 0.05, 0, frame)

    # Глаза
    cv2.circle(frame, (cx - 50, cy - 30), 8, (40, 40, 40), -1)
    cv2.circle(frame, (cx + 50, cy - 30), 8, (40, 40, 40), -1)

    # Рот (статичный — в реальности будет анимирован)
    cv2.line(frame, (cx - 30, cy + 60), (cx + 30, cy + 60), (60, 30, 20), 3)

    # Имя
    cv2.putText(frame, name, (cx - 60, cy + 230), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (50, 50, 50), 2)
    return frame


def _draw_pill(
    frame: np.ndarray, x: int, y: int, color: tuple[int, int, int], size: int = 40
) -> np.ndarray:
    """Рисует овальную таблетку в указанной позиции."""
    cv2.ellipse(frame, (x, y), (size, size // 2), 0, 0, 360, color, -1)
    # Highlight
    cv2.ellipse(
        frame,
        (x - size // 4, y - size // 6),
        (size // 4, size // 8),
        0,
        0,
        360,
        tuple(min(c + 50, 255) for c in color),
        -1,
    )
    return frame


def _open_mouth(frame: np.ndarray, opening: float = 0.5) -> np.ndarray:
    """Имитирует открытие рта (opening: 0=закрыт, 1=максимально открыт)."""
    h, w = frame.shape[:2]
    cx, cy = w // 2, h // 3 + 60

    if opening < 0.1:
        cv2.line(frame, (cx - 30, cy), (cx + 30, cy), (60, 30, 20), 3)
    else:
        # Овальный открытый рот
        height = int(8 + opening * 30)
        cv2.ellipse(frame, (cx, cy + height // 2), (35, height), 0, 0, 360, (60, 25, 15), -1)
        # Зубы вверху
        cv2.rectangle(frame, (cx - 25, cy - 2), (cx + 25, cy + 4), (240, 240, 230), -1)
    return frame


def _scene_show_pill(
    frame_idx: int, total_frames: int, drug_color: tuple[int, int, int]
) -> np.ndarray:
    """Сцена 1: пациент показывает таблетку перед лицом."""
    frame = np.full((FRAME_H, FRAME_W, 3), 235, dtype=np.uint8)
    _draw_face_placeholder(frame, "Sardor K.")
    # Таблетка в правой нижней области (типа в руке)
    pill_x = FRAME_W // 2 + 100
    pill_y = FRAME_H // 2 + 50
    _draw_pill(frame, pill_x, pill_y, drug_color, size=50)
    return frame


def _scene_pill_to_mouth(
    frame_idx: int, total_frames: int, drug_color: tuple[int, int, int]
) -> np.ndarray:
    """Сцена 2: таблетка движется ко рту."""
    frame = np.full((FRAME_H, FRAME_W, 3), 235, dtype=np.uint8)
    _draw_face_placeholder(frame, "Sardor K.")
    # Линейная интерполяция от руки до рта
    progress = frame_idx / total_frames
    start_x, start_y = FRAME_W // 2 + 100, FRAME_H // 2 + 50
    end_x, end_y = FRAME_W // 2, FRAME_H // 3 + 60
    px = int(start_x + (end_x - start_x) * progress)
    py = int(start_y + (end_y - start_y) * progress)
    _draw_pill(frame, px, py, drug_color, size=int(50 - progress * 10))
    return frame


def _scene_swallow_start(
    frame_idx: int, total_frames: int, drug_color: tuple[int, int, int]
) -> np.ndarray:
    """Сцена 3: таблетка во рту, начало глотания."""
    frame = np.full((FRAME_H, FRAME_W, 3), 235, dtype=np.uint8)
    _draw_face_placeholder(frame, "Sardor K.")
    progress = frame_idx / total_frames
    _open_mouth(frame, opening=progress * 0.7)
    return frame


def _scene_swallow_open(
    frame_idx: int, total_frames: int, drug_color: tuple[int, int, int]
) -> np.ndarray:
    """Сцена 4: открытый рот глотает."""
    frame = np.full((FRAME_H, FRAME_W, 3), 235, dtype=np.uint8)
    _draw_face_placeholder(frame, "Sardor K.")
    _open_mouth(frame, opening=1.0)
    return frame


def _scene_empty_mouth(
    frame_idx: int, total_frames: int, drug_color: tuple[int, int, int]
) -> np.ndarray:
    """Сцена 5: рот открыт, пустой — подтверждение."""
    frame = np.full((FRAME_H, FRAME_W, 3), 235, dtype=np.uint8)
    _draw_face_placeholder(frame, "Sardor K.")
    progress = frame_idx / total_frames
    _open_mouth(frame, opening=0.7 - progress * 0.5)
    # Watermark
    cv2.putText(
        frame,
        "Davo-AI synthetic demo",
        (10, FRAME_H - 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (150, 150, 150),
        1,
    )
    return frame


SCENES = [
    _scene_show_pill,
    _scene_pill_to_mouth,
    _scene_swallow_start,
    _scene_swallow_open,
    _scene_empty_mouth,
]


def synthesize_video(output: Path, drug: str = "rifampicin", duration_s: int = DURATION_S) -> None:
    drug_color, _ = DRUG_COLORS.get(drug, DRUG_COLORS["rifampicin"])

    total_frames = duration_s * FPS
    frames_per_scene = total_frames // len(SCENES)

    if not shutil.which("ffmpeg"):
        # Fallback: write MP4 через OpenCV (без аудио)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output), fourcc, FPS, (FRAME_W, FRAME_H))
        for scene_idx, scene_fn in enumerate(SCENES):
            for fi in range(frames_per_scene):
                frame = scene_fn(fi, frames_per_scene, drug_color)
                writer.write(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
        writer.release()
        print(f"✓ Video создан (OpenCV mp4v, без ffmpeg): {output}")
        return

    # ffmpeg path: write PNG sequence + ffmpeg encode (better quality)
    tmp_dir = output.parent / f".synth_{output.stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    frame_idx = 0
    for scene_fn in SCENES:
        for fi in range(frames_per_scene):
            frame = scene_fn(fi, frames_per_scene, drug_color)
            cv2.imwrite(
                str(tmp_dir / f"frame_{frame_idx:05d}.png"), cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            )
            frame_idx += 1

    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(tmp_dir / "frame_%05d.png"),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    shutil.rmtree(tmp_dir)
    print(f"✓ Video создан (ffmpeg H.264): {output}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("assets/demos/synthetic_intake.mp4"))
    parser.add_argument("--drug", default="rifampicin", choices=list(DRUG_COLORS.keys()))
    parser.add_argument("--duration", type=int, default=DURATION_S)
    parser.add_argument(
        "--batch", type=int, default=0, help="Создать N демо-видео для разных препаратов"
    )
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)

    if args.batch > 0:
        drugs = list(DRUG_COLORS.keys())
        for i in range(args.batch):
            drug = drugs[i % len(drugs)]
            out = args.output.parent / f"demo_{drug}_{i+1}.mp4"
            print(f"[{i+1}/{args.batch}] Generating {drug}...")
            synthesize_video(out, drug=drug, duration_s=args.duration)
    else:
        synthesize_video(args.output, drug=args.drug, duration_s=args.duration)


if __name__ == "__main__":
    main()
