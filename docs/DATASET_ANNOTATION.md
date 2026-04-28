# TB Pills Dataset · Annotation Guide

> Как разметить 70+ фото туберкулёзных препаратов для обучения YOLOv8.
> Для production целевой объём — 50+ фото каждого из 5 классов (RHZE + combo).

---

## Текущее состояние датасета

```
data/tb_pills/
├── rifampicin/      13 photos  (Wikimedia 3 + Pexels 10)
├── isoniazid/       12 photos  (Wikimedia 3 + Pexels 9)
├── pyrazinamide/    11 photos  (Pexels — нужны реальные!)
├── ethambutol/      12 photos  (Wikimedia 1 + Pexels 11)
├── combo_fdc/       22 photos  (Pexels — нужны реальные RHZE!)
└── 70 total · 112 MB
```

⚠️ **Confidence**: 3.2/5 — нужны реальные узбекские фото для production.

---

## Шаг 1 · Roboflow setup (рекомендуется)

Roboflow — самый быстрый способ разметить и экспортировать в YOLO формат.

### 1.1 Регистрация
1. https://roboflow.com → Sign Up (free tier)
2. Create new workspace: `mindtech-uz`
3. Create project: `davo-ai-tb-pills`
   - Type: **Object Detection**
   - License: **CC BY-SA 4.0**

### 1.2 Upload images
1. Workspace → Upload Images
2. Drag & drop всю папку `data/tb_pills/`
3. Roboflow автоматически распознает структуру `<class>/<image>.jpg`

### 1.3 Annotation
1. Откройте каждое изображение
2. Draw bounding box вокруг каждой видимой таблетки
3. Class label: `rifampicin` / `isoniazid` / `pyrazinamide` / `ethambutol` / `combo_fdc`
4. **Tips**:
   - Включай и блистер, и отдельные таблетки если видны
   - Один фото может содержать несколько боксов разных классов
   - Не размечай половинчатые таблетки на краю (clipped)
   - Минимальный размер бокса: 20×20 пикселей

### 1.4 Train/Val/Test split
- Roboflow автоматически предлагает 70/20/10
- Подтвердите → Generate version

### 1.5 Export
1. Versions → Generate New Version
2. **Preprocessing**:
   - Auto-Orient: ✓
   - Resize: 640×640 (Stretch to)
3. **Augmentations** (опционально, мы делаем сами в `prepare_yolo_dataset.py`):
   - Можно пропустить
4. Generate
5. **Export**: Format = **YOLOv8** → Show download code → `pip install roboflow` инструкция
6. Альтернатива: ZIP file → распаковать в `data/tb_pills_yolo_roboflow/`

---

## Шаг 2 · Альтернатива — CVAT (open-source)

Если не хотите облако:

```bash
# Запустить локально
docker run -it -p 8080:8080 -v cvat_data:/home/django/data cvat/server
# Открыть http://localhost:8080
```

Или использовать https://cvat.ai (free hosted).

Импорт/экспорт **YOLO format**.

---

## Шаг 3 · Запуск автоматического препроцессинга

После того как разметили в Roboflow / CVAT и скачали ZIP:

```bash
# Если уже в YOLO формате
unzip roboflow_export.zip -d data/tb_pills_yolo
ls data/tb_pills_yolo/{train,valid,test}/{images,labels}
```

Или генерируем дефолтные labels (центральный bbox 80% площади — для quick MVP):

```bash
python scripts/prepare_yolo_dataset.py \
  --src data/tb_pills \
  --dst data/tb_pills_yolo \
  --augment 3        # ×3 объём через augmentation
```

→ Создаёт `data/tb_pills_yolo/dataset.yaml`.

---

## Шаг 4 · Training

### На NVIDIA DGX Spark (production)

```bash
ssh dgx
cd /opt/davoai/repo
python scripts/train_yolo.py \
  --data data/tb_pills_yolo/dataset.yaml \
  --model yolov8m.pt \
  --epochs 100 \
  --batch 16 \
  --device 0
```

**Время**: ~2-3 часа. Best weights → `runs/detect/tb_pills_v1/weights/best.pt`.

### На Mac M4 (fallback / dev)

```bash
python scripts/train_yolo.py \
  --model yolov8n.pt \
  --epochs 50 \
  --batch 8 \
  --device mps        # Apple Metal
```

**Время**: ~3-4 часа на M4.

---

## Шаг 5 · Validation

```bash
python scripts/train_yolo.py --validate-only
```

**Целевые метрики**:
| Метрика | MVP | Production |
|---------|-----|------------|
| mAP@0.5 | ≥ 0.75 | ≥ 0.92 |
| mAP@0.5:0.95 | ≥ 0.50 | ≥ 0.75 |
| Per-class recall | ≥ 0.70 | ≥ 0.90 |

---

## Шаг 6 · Export для production

```bash
# ONNX (universal)
python scripts/train_yolo.py --export

# TensorRT (только на NVIDIA, ускоряет inference на DGX в 2-3×)
python scripts/train_yolo.py --export --tensorrt
```

---

## Что нужно сделать ЕЩЁ для production

### P0 (критично)
- [ ] **Реальные фото RHZE FDC** через Stop TB Partnership Global Drug Facility или Респ. ТБ-Центр УЗ
- [ ] **Pyrazinamide** — настоящий 500 mg от Lupin/Macleods/Sandoz
- [ ] **Дополнительно 30+ фото каждого класса** через Темура (TashPMI / диспансер)

### P1 (желательно)
- [ ] Pediatric formulations (для будущего модуля)
- [ ] MDR-TB препараты: bedaquiline, linezolid, moxifloxacin
- [ ] Узбекские блистеры с разной упаковкой

### P2 (далёкая перспектива)
- [ ] Видео-датасет (sequence frames) для swallow detection
- [ ] Negative samples (не-ТБ таблетки) для лучшей discriminative power

---

## Roboflow free tier limits

| Limit | Free | Note |
|-------|------|------|
| Images | 10 000 | у нас 70 — с большим запасом |
| Annotations | unlimited | ✓ |
| Datasets | 3 | хватит на TB pills + faces + видео |
| Version exports | unlimited | ✓ |
| Auto-labelling | нет | у нас human-only annotation |

Free tier более чем достаточен для хакатона.
