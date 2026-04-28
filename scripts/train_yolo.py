"""
Davo-AI · YOLO Training Script
==============================

Обучает YOLOv8m на TB pills datasete. Запускать на NVIDIA DGX Spark.

Использование:
    # Quick start (на DGX Spark)
    python scripts/train_yolo.py

    # С кастомными гиперпарам
    python scripts/train_yolo.py --epochs 200 --batch 32 --imgsz 640

    # Resume training
    python scripts/train_yolo.py --resume

    # Validate only (после обучения)
    python scripts/train_yolo.py --validate-only

Time:
    - DGX Spark, YOLOv8m, 100 epochs, batch 16, imgsz 640 → ~2-3 часа
    - Mac M4 GPU, YOLOv8n, 100 epochs → ~6-8 часов
"""

from __future__ import annotations

import argparse
from pathlib import Path

# ─── Defaults ───────────────────────────────────────────────────────────────
DEFAULT_DATASET = Path("data/tb_pills_yolo/dataset.yaml")
DEFAULT_PROJECT = Path("runs/detect")
DEFAULT_NAME = "tb_pills_v1"


def train(args: argparse.Namespace) -> None:
    from ultralytics import YOLO

    if args.resume:
        # Resume from last checkpoint
        last_path = Path(args.project) / args.name / "weights" / "last.pt"
        if not last_path.exists():
            raise SystemExit(f"❌ Resume checkpoint not found: {last_path}")
        model = YOLO(str(last_path))
        results = model.train(resume=True)
    else:
        # Fresh training
        model = YOLO(args.model)

        # Hyperparameters tuned for small dataset (~70 images × 3 augmentation)
        results = model.train(
            data=str(args.data),
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
            project=str(args.project),
            name=args.name,
            exist_ok=False,
            patience=30,                # early stopping
            save_period=10,             # сохранять каждые 10 эпох

            # Optimization
            optimizer="auto",           # AdamW for low data, SGD for large
            lr0=args.lr,
            lrf=0.01,                   # final LR = lr0 * lrf
            momentum=0.937,
            weight_decay=0.0005,
            warmup_epochs=3.0,

            # Augmentation (built-in)
            hsv_h=0.015,
            hsv_s=0.7,
            hsv_v=0.4,
            degrees=15.0,               # rotation
            translate=0.1,
            scale=0.5,
            shear=0.0,
            perspective=0.0,
            flipud=0.0,
            fliplr=0.5,                 # 50% horizontal flip
            mosaic=1.0,
            mixup=0.1,
            copy_paste=0.0,

            # Performance
            cache=True,                 # cache images in RAM
            workers=4,
            device=args.device,
            amp=True,                   # mixed precision

            # Logging
            verbose=True,
            plots=True,
        )

    print(f"\n✓ Training complete")
    print(f"   Best weights: {Path(args.project) / args.name / 'weights' / 'best.pt'}")
    print(f"   mAP@0.5: {results.box.map50:.3f}")
    print(f"   mAP@0.5:0.95: {results.box.map:.3f}")


def validate(args: argparse.Namespace) -> None:
    from ultralytics import YOLO

    weights = Path(args.project) / args.name / "weights" / "best.pt"
    if not weights.exists():
        raise SystemExit(f"❌ Trained weights not found: {weights}")

    model = YOLO(str(weights))
    metrics = model.val(data=str(args.data), split="test", imgsz=args.imgsz)
    print("\n📊 Test set metrics:")
    print(f"   mAP@0.5:       {metrics.box.map50:.3f}")
    print(f"   mAP@0.5:0.95:  {metrics.box.map:.3f}")
    print(f"   Precision:     {metrics.box.mp:.3f}")
    print(f"   Recall:        {metrics.box.mr:.3f}")

    # Per-class breakdown
    print("\n   Per-class mAP@0.5:")
    for i, name in enumerate(model.names.values()):
        print(f"     {name:14s}: {metrics.box.maps[i]:.3f}")


def export(args: argparse.Namespace) -> None:
    """Экспорт модели в формат для production (ONNX или TensorRT)."""
    from ultralytics import YOLO

    weights = Path(args.project) / args.name / "weights" / "best.pt"
    model = YOLO(str(weights))

    # ONNX (universal, CPU-friendly)
    model.export(format="onnx", imgsz=args.imgsz)
    print(f"✓ Exported ONNX: {weights.with_suffix('.onnx')}")

    # TensorRT (если на DGX и --tensorrt)
    if args.tensorrt:
        model.export(format="engine", imgsz=args.imgsz, half=True)
        print(f"✓ Exported TensorRT: {weights.with_suffix('.engine')}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--model", default="yolov8m.pt",
                        help="Base model: yolov8n.pt (fast), yolov8m.pt (balanced), yolov8l.pt (high quality)")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr", type=float, default=0.01)
    parser.add_argument("--device", default="0",
                        help="GPU device id (0 / 1 / cpu / mps for Apple Silicon)")
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT)
    parser.add_argument("--name", default=DEFAULT_NAME)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--tensorrt", action="store_true",
                        help="Также экспортировать TensorRT engine (только на NVIDIA)")
    args = parser.parse_args()

    if args.validate_only:
        validate(args)
    elif args.export:
        export(args)
    else:
        train(args)
        # После training — автоматическая validation на test set
        validate(args)


if __name__ == "__main__":
    main()
