"""
Davo-AI · YOLO Dataset Preparation
==================================

Готовит датасет в YOLO-формате из `data/tb_pills/<drug>/<image>.jpg`:
1. Создаёт train / val / test split (default: 70/20/10)
2. Конвертирует Roboflow YOLO labels (если есть) в YOLOv8 формат
3. Применяет augmentation для увеличения объёма (RandomBrightness, RandomRotation, GaussianBlur)
4. Записывает финальный `dataset.yaml`

Использование:
    # Базовый запуск (предполагается что labels уже в Roboflow YOLO формате)
    python scripts/prepare_yolo_dataset.py --src data/tb_pills --dst data/tb_pills_yolo

    # С augmentation (×3 объём)
    python scripts/prepare_yolo_dataset.py --src data/tb_pills --dst data/tb_pills_yolo --augment 3

Зависимости:
    pip install pillow numpy pyyaml
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageEnhance, ImageFilter

# ─── Class mapping (соответствует yolo_server.py) ───────────────────────────
CLASS_NAMES = {
    "rifampicin": 0,
    "isoniazid": 1,
    "pyrazinamide": 2,
    "ethambutol": 3,
    "combo_fdc": 4,
}


def collect_images(src_dir: Path) -> list[tuple[Path, int]]:
    """Возвращает [(image_path, class_id), ...]."""
    items: list[tuple[Path, int]] = []
    for drug_name, class_id in CLASS_NAMES.items():
        drug_dir = src_dir / drug_name
        if not drug_dir.exists():
            print(f"⚠️  Skip {drug_name}: directory not found")
            continue
        for img_path in sorted(drug_dir.glob("*.jpg")):
            items.append((img_path, class_id))
        for img_path in sorted(drug_dir.glob("*.png")):
            items.append((img_path, class_id))
    return items


def split_dataset(
    items: list[tuple[Path, int]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.20,
    seed: int = 42,
) -> tuple[list, list, list]:
    """Stratified split — каждый класс делим пропорционально."""
    rng = random.Random(seed)
    by_class: dict[int, list] = {}
    for path, cid in items:
        by_class.setdefault(cid, []).append((path, cid))

    train, val, test = [], [], []
    for cid, group in by_class.items():
        rng.shuffle(group)
        n = len(group)
        n_train = max(1, int(n * train_ratio))
        n_val = max(1, int(n * val_ratio))
        train.extend(group[:n_train])
        val.extend(group[n_train : n_train + n_val])
        test.extend(group[n_train + n_val :])

    return train, val, test


def make_default_label(image_path: Path, class_id: int) -> str:
    """Создаёт label-файл с центральным bbox занимающим 80% площади.

    Используется для unannotated single-pill фото. Для production —
    нужны точные bounding boxes из Roboflow / CVAT.
    """
    return f"{class_id} 0.5 0.5 0.8 0.8\n"


def copy_with_label(
    items: list[tuple[Path, int]],
    images_dst: Path,
    labels_dst: Path,
    src_labels_dir: Path | None = None,
) -> int:
    """Копирует изображения и создаёт/копирует labels."""
    images_dst.mkdir(parents=True, exist_ok=True)
    labels_dst.mkdir(parents=True, exist_ok=True)

    count = 0
    for src_img, class_id in items:
        # Уникальное имя: <drug>_<original_stem>.jpg
        drug_name = next(name for name, cid in CLASS_NAMES.items() if cid == class_id)
        unique_name = f"{drug_name}_{src_img.stem}.jpg"

        # Копируем изображение
        shutil.copy2(src_img, images_dst / unique_name)

        # Label
        label_path = labels_dst / unique_name.replace(".jpg", ".txt")
        if src_labels_dir is not None:
            roboflow_label = src_labels_dir / src_img.stem / ".txt"
            if roboflow_label.exists():
                shutil.copy2(roboflow_label, label_path)
            else:
                label_path.write_text(make_default_label(src_img, class_id))
        else:
            label_path.write_text(make_default_label(src_img, class_id))

        count += 1
    return count


def augment_image(img: Image.Image, seed: int) -> Image.Image:
    """Применяет лёгкую аугментацию (rotation + brightness + blur)."""
    rng = np.random.default_rng(seed)
    out = img.copy()

    # Rotation ±20°
    angle = float(rng.uniform(-20, 20))
    out = out.rotate(angle, fillcolor=(128, 128, 128), resample=Image.BICUBIC)

    # Brightness ×0.7..1.3
    factor = float(rng.uniform(0.7, 1.3))
    out = ImageEnhance.Brightness(out).enhance(factor)

    # Optional blur (30% probability)
    if rng.random() < 0.3:
        radius = float(rng.uniform(0.5, 1.5))
        out = out.filter(ImageFilter.GaussianBlur(radius=radius))

    # Contrast jitter
    out = ImageEnhance.Contrast(out).enhance(float(rng.uniform(0.85, 1.15)))

    return out


def augment_split(
    items: list[tuple[Path, int]],
    images_dst: Path,
    labels_dst: Path,
    multiplier: int,
) -> int:
    """Создаёт N дополнительных аугментированных копий каждого изображения."""
    if multiplier <= 1:
        return 0

    count = 0
    for src_img, class_id in items:
        try:
            base = Image.open(src_img).convert("RGB")
        except Exception as e:
            print(f"⚠️  Skip {src_img}: {e}")
            continue

        drug_name = next(name for name, cid in CLASS_NAMES.items() if cid == class_id)
        for i in range(multiplier - 1):
            seed = hash((str(src_img), i)) & 0xFFFFFFFF
            aug = augment_image(base, seed)
            unique_name = f"{drug_name}_{src_img.stem}_aug{i}.jpg"
            aug.save(images_dst / unique_name, quality=88)
            (labels_dst / unique_name.replace(".jpg", ".txt")).write_text(
                make_default_label(src_img, class_id)
            )
            count += 1
    return count


def write_dataset_yaml(dst_dir: Path) -> None:
    config = {
        "path": str(dst_dir.resolve()),
        "train": "train/images",
        "val": "val/images",
        "test": "test/images",
        "names": {v: k for k, v in CLASS_NAMES.items()},
    }
    (dst_dir / "dataset.yaml").write_text(
        yaml.safe_dump(config, allow_unicode=True, sort_keys=False)
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", type=Path, default=Path("data/tb_pills"))
    parser.add_argument("--dst", type=Path, default=Path("data/tb_pills_yolo"))
    parser.add_argument("--labels-src", type=Path, default=None,
                        help="Папка с Roboflow YOLO labels (опционально)")
    parser.add_argument("--train-ratio", type=float, default=0.70)
    parser.add_argument("--val-ratio", type=float, default=0.20)
    parser.add_argument("--augment", type=int, default=1,
                        help="Multiplier (1 = no augmentation, 3 = ×3)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    src_dir: Path = args.src
    dst_dir: Path = args.dst

    if not src_dir.exists():
        raise SystemExit(f"❌ Source directory not found: {src_dir}")

    items = collect_images(src_dir)
    if not items:
        raise SystemExit("❌ No images found")

    print(f"📦 Найдено {len(items)} изображений в {len(set(c for _, c in items))} классах")
    by_class: dict[int, int] = {}
    for _, cid in items:
        by_class[cid] = by_class.get(cid, 0) + 1
    for name, cid in CLASS_NAMES.items():
        print(f"   {name:14s}: {by_class.get(cid, 0):3d}")

    # Split
    train, val, test = split_dataset(
        items,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        seed=args.seed,
    )
    print(f"\n📂 Split: train {len(train)}  val {len(val)}  test {len(test)}")

    # Создаём структуру
    if dst_dir.exists():
        shutil.rmtree(dst_dir)

    n_train = copy_with_label(train, dst_dir / "train" / "images", dst_dir / "train" / "labels", args.labels_src)
    n_val = copy_with_label(val, dst_dir / "val" / "images", dst_dir / "val" / "labels", args.labels_src)
    n_test = copy_with_label(test, dst_dir / "test" / "images", dst_dir / "test" / "labels", args.labels_src)

    print(f"\n✓ Скопировано: train {n_train}  val {n_val}  test {n_test}")

    # Augmentation (только train!)
    if args.augment > 1:
        n_aug = augment_split(train, dst_dir / "train" / "images", dst_dir / "train" / "labels", args.augment)
        print(f"✓ Augmentation: +{n_aug} изображений в train (multiplier ×{args.augment})")

    # dataset.yaml
    write_dataset_yaml(dst_dir)
    print(f"\n✓ dataset.yaml: {dst_dir / 'dataset.yaml'}")
    print(f"\nГотово к training:")
    print(f"  yolo train model=yolov8m.pt data={dst_dir}/dataset.yaml epochs=100 imgsz=640 batch=16")


if __name__ == "__main__":
    main()
