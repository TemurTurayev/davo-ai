#!/usr/bin/env bash
#
# Deploy custom YOLO best.pt as a local HTTP server on Mac.
# Tested on M-series (CPU). For 5+ FPS use MPS (Metal) when ultralytics supports it.
#
# Usage:
#   bash infra/yolo-weights/deploy-yolo-local.sh
#
# Then add a Public Hostname in Cloudflare Dashboard:
#   yolo.21cloud.uz → http://localhost:8004
# (or path-based: ailab.21cloud.uz/yolo/* → localhost:8004)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEIGHTS="$SCRIPT_DIR/davo-ai-tb-pills-best.pt"

if [ ! -f "$WEIGHTS" ]; then
  echo "✗ Missing $WEIGHTS"
  exit 1
fi

# Create a venv at infra/yolo-weights/venv (gitignored)
if [ ! -d "$SCRIPT_DIR/venv" ]; then
  echo "Creating venv..."
  python3 -m venv "$SCRIPT_DIR/venv"
  "$SCRIPT_DIR/venv/bin/pip" install -q --upgrade pip
  echo "Installing ultralytics + fastapi (~1 min)..."
  "$SCRIPT_DIR/venv/bin/pip" install -q ultralytics fastapi 'uvicorn[standard]' python-multipart pillow
fi

# Generate the server code
cat > "$SCRIPT_DIR/yolo_server.py" <<'PY'
import io, time, os
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

WEIGHTS = os.path.join(os.path.dirname(__file__), "davo-ai-tb-pills-best.pt")
print(f"Loading YOLO from {WEIGHTS}...")
model = YOLO(WEIGHTS)
print(f"Classes: {model.names}")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"ok": True, "weights": WEIGHTS, "classes": model.names}

@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    t0 = time.time()
    img = Image.open(io.BytesIO(await image.read())).convert("RGB")
    results = model(img, verbose=False, conf=0.20)
    detections = []
    for r in results:
        if r.boxes is None:
            continue
        for b in r.boxes:
            x1, y1, x2, y2 = b.xyxyn[0].tolist()
            label = model.names[int(b.cls[0])]
            conf = float(b.conf[0])
            detections.append({
                "label": label,
                "confidence": conf,
                "bbox": [x1, y1, x2, y2],
            })
            print(f"  → {label} {conf*100:.0f}%  bbox={x1:.2f},{y1:.2f},{x2:.2f},{y2:.2f}")
    ms = int((time.time() - t0) * 1000)
    print(f"[{ms}ms] {len(detections)} detections")
    return {"detections": detections, "inferenceMs": ms}
PY

echo
echo "Starting YOLO server on :8004..."
cd "$SCRIPT_DIR"
exec ./venv/bin/uvicorn yolo_server:app --host 0.0.0.0 --port 8004
