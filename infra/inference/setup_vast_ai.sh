#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Davo-AI · Vast.ai RTX 5090 (32 GB VRAM) setup
#  Команда: MindTech · AI HEALTH Hackathon 2026
# ────────────────────────────────────────────────────────────────────────────
#  Скрипт оптимизирован для:
#    • RTX 5090 — 32 GB VRAM (vs DGX Spark 128 GB unified)
#    • vast.ai pytorch_cuda image (CUDA, PyTorch, Jupyter уже установлены)
#    • Контейнер без systemd → используем tmux
#    • /workspace — основная mount-точка для моделей и кэшей
#
#  Использование:
#     ssh vast
#     export HF_TOKEN=hf_xxx
#     bash <(curl -fsSL https://raw.githubusercontent.com/TemurTurayev/davo-ai/main/infra/inference/setup_vast_ai.sh)
#
#  Или после git clone:
#     cd /workspace && git clone https://github.com/TemurTurayev/davo-ai.git
#     cd davo-ai && bash infra/inference/setup_vast_ai.sh
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
DAVOAI_HOME="${DAVOAI_HOME:-/workspace/davoai}"
DAVOAI_REPO="${DAVOAI_REPO:-/workspace/davo-ai}"
HF_HOME="${HF_HOME:-/workspace/.hf_cache}"
export HF_HOME

# Models — оптимизированы под 32 GB VRAM (AWQ 4-bit для LLM/Vision)
# Total VRAM: ~17 (LLM) + ~7 (Vision) + 1.5 (Whisper) + 2 (BGE) + 1 (YOLO) = ~28 GB
# Остаётся ~4 GB для KV cache → tight but works для демо

# LLM: пробуем Aya 32B AWQ (узбекский лучший), fallback Qwen2.5-32B AWQ
LLM_MODEL_PRIMARY="MaziyarPanahi/aya-expanse-32b-AWQ"
LLM_MODEL_FALLBACK="Qwen/Qwen2.5-32B-Instruct-AWQ"
LLM_MODEL_SAFE="Qwen/Qwen2.5-14B-Instruct-AWQ"   # если 32B не влезет

# Vision
VISION_MODEL="Qwen/Qwen2.5-VL-7B-Instruct-AWQ"

# Whisper / Embeddings
WHISPER_MODEL_REPO="Systran/faster-whisper-large-v3-turbo"
EMBEDDING_MODEL="BAAI/bge-m3"

# Service ports
LLM_PORT=8001
VISION_PORT=8002
WHISPER_PORT=8003
YOLO_PORT=8004
VERIFIER_PORT=8005

# ─── Helpers ────────────────────────────────────────────────────────────────
log()      { echo -e "\033[1;36m[davoai]\033[0m $*"; }
warn()     { echo -e "\033[1;33m[warn]\033[0m   $*"; }
err()      { echo -e "\033[1;31m[err]\033[0m    $*" >&2; }
section()  { echo -e "\n\033[1;35m═══ $* ═══\033[0m"; }

# ─── Verify environment ─────────────────────────────────────────────────────
verify_env() {
    section "Verify GPU + environment"

    if ! command -v nvidia-smi &>/dev/null; then
        err "nvidia-smi not found"
        exit 1
    fi

    log "GPU info:"
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

    log "CUDA: $(nvcc --version 2>/dev/null | grep -oP 'release \K[0-9.]+' || echo 'unknown')"
    log "Python: $(python3 --version)"
    log "Disk free: $(df -h /workspace 2>/dev/null | tail -1 | awk '{print $4}')"
    log "RAM: $(free -h | awk '/^Mem:/ {print $2}')"

    mkdir -p "$DAVOAI_HOME"/{models,servers,logs,runs}
    mkdir -p "$HF_HOME"
}

# ─── Install Python packages (в venv чтобы не конфликтовать с Debian system pip) ─
install_deps() {
    section "Install Python packages (vLLM + faster-whisper + ultralytics)"

    local VENV="/workspace/venv"
    if [[ ! -d "$VENV" ]]; then
        log "Creating venv at $VENV"
        python3 -m venv "$VENV" || apt-get install -y python3-venv && python3 -m venv "$VENV"
    fi

    # shellcheck disable=SC1091
    source "$VENV/bin/activate"
    log "Activated venv: $(python --version)"

    pip install --upgrade --quiet pip wheel setuptools

    # vLLM — production LLM serving
    log "Installing vLLM (это займёт 2-3 минуты)"
    pip install --upgrade --quiet "vllm>=0.7.0"

    # Whisper / YOLO / FastAPI
    log "Installing serving deps"
    pip install --upgrade --quiet \
        faster-whisper \
        ctranslate2 \
        "ultralytics>=8.3.0" \
        fastapi \
        "uvicorn[standard]" \
        python-multipart \
        pillow \
        opencv-python-headless \
        "huggingface-hub[cli]>=0.25.0" \
        loguru \
        rich

    log "Python packages OK"

    # Записываем activation script для удобства
    cat > "$DAVOAI_HOME/activate.sh" <<EOF
#!/usr/bin/env bash
source $VENV/bin/activate
export DAVOAI_HOME=$DAVOAI_HOME
export DAVOAI_REPO=$DAVOAI_REPO
export HF_HOME=$HF_HOME
EOF
    chmod +x "$DAVOAI_HOME/activate.sh"
}

# ─── Clone or pull repo ─────────────────────────────────────────────────────
get_repo() {
    section "Clone or update davo-ai repo"

    if [[ -d "$DAVOAI_REPO/.git" ]]; then
        log "Repo exists, pulling latest"
        (cd "$DAVOAI_REPO" && git pull --rebase)
    else
        log "Cloning repo"
        git clone https://github.com/TemurTurayev/davo-ai.git "$DAVOAI_REPO"
    fi

    # Копируем серверы в DAVOAI_HOME
    cp -v "$DAVOAI_REPO/packages/inference"/*.py "$DAVOAI_HOME/servers/" 2>/dev/null || true
}

# ─── HF login ───────────────────────────────────────────────────────────────
hf_login() {
    section "HuggingFace login"
    # shellcheck disable=SC1091
    source /workspace/venv/bin/activate
    if [[ -z "${HF_TOKEN:-}" ]]; then
        warn "HF_TOKEN не задан в env. Используем anonymous (rate limit 5/min)."
        warn "Получить: https://huggingface.co/settings/tokens → export HF_TOKEN=hf_xxx"
    else
        echo "$HF_TOKEN" | huggingface-cli login --token "$HF_TOKEN" || warn "HF login failed, продолжаем"
        log "HF authenticated"
    fi
}

# ─── Download models ────────────────────────────────────────────────────────
download_models() {
    section "Download models (~25 GB total)"
    # shellcheck disable=SC1091
    source /workspace/venv/bin/activate

    cd "$DAVOAI_HOME/models"

    # LLM: try primary → fallback → safe
    if [[ ! -d "llm" ]]; then
        log "→ Downloading LLM (~17 GB)"
        if huggingface-cli download "$LLM_MODEL_PRIMARY" --local-dir llm 2>&1 | tail -5; then
            log "✓ Aya Expanse 32B AWQ downloaded"
            echo "$LLM_MODEL_PRIMARY" > llm/.model_name
        elif huggingface-cli download "$LLM_MODEL_FALLBACK" --local-dir llm 2>&1 | tail -5; then
            log "✓ Qwen2.5-32B AWQ downloaded (fallback)"
            echo "$LLM_MODEL_FALLBACK" > llm/.model_name
        else
            warn "32B AWQ not available. Falling back to 14B (smaller, less Uzbek-tuned)"
            huggingface-cli download "$LLM_MODEL_SAFE" --local-dir llm
            echo "$LLM_MODEL_SAFE" > llm/.model_name
        fi
    else
        log "LLM already downloaded: $(cat llm/.model_name 2>/dev/null || echo unknown)"
    fi

    # Vision
    if [[ ! -d "vision" ]]; then
        log "→ Downloading Vision (~7 GB)"
        huggingface-cli download "$VISION_MODEL" --local-dir vision || \
            huggingface-cli download "Qwen/Qwen2.5-VL-7B-Instruct" --local-dir vision
    else
        log "Vision already downloaded"
    fi

    # Embeddings
    if [[ ! -d "bge-m3" ]]; then
        log "→ Downloading BGE-M3 embeddings (~2 GB)"
        huggingface-cli download "$EMBEDDING_MODEL" --local-dir bge-m3
    else
        log "BGE-M3 already downloaded"
    fi

    # Whisper качается при первом запуске faster-whisper
    log "Whisper Large-v3-Turbo will be downloaded on first use (~600 MB)"

    log "Disk usage: $(du -sh "$DAVOAI_HOME/models" | cut -f1)"
}

# ─── tmux launcher scripts ──────────────────────────────────────────────────
write_launchers() {
    section "Write tmux launcher scripts"

    cat > "$DAVOAI_HOME/start_all.sh" <<'LAUNCHER'
#!/usr/bin/env bash
# Davo-AI · launch all 4 inference servers in tmux sessions
set -euo pipefail
DAVOAI_HOME="${DAVOAI_HOME:-/workspace/davoai}"
source /workspace/venv/bin/activate

# Kill existing sessions
for s in davoai-llm davoai-vision davoai-whisper davoai-yolo davoai-verifier; do
    tmux kill-session -t $s 2>/dev/null || true
done

echo "─── Starting LLM server (port 8001) ───"
tmux new-session -d -s davoai-llm \
    "cd $DAVOAI_HOME && \
     vllm serve $DAVOAI_HOME/models/llm \
        --served-model-name davoai-llm \
        --host 0.0.0.0 --port 8001 \
        --max-model-len 4096 \
        --gpu-memory-utilization 0.55 \
        --quantization awq_marlin \
        --dtype auto 2>&1 | tee -a $DAVOAI_HOME/logs/llm.log"

echo "Waiting 60s for LLM to warm up..."
sleep 60

echo "─── Starting Vision server (port 8002) ───"
tmux new-session -d -s davoai-vision \
    "cd $DAVOAI_HOME && \
     vllm serve $DAVOAI_HOME/models/vision \
        --served-model-name davoai-vision \
        --host 0.0.0.0 --port 8002 \
        --max-model-len 4096 \
        --gpu-memory-utilization 0.30 \
        --quantization awq_marlin \
        --limit-mm-per-prompt image=5 2>&1 | tee -a $DAVOAI_HOME/logs/vision.log"

sleep 30

echo "─── Starting Whisper STT (port 8003) ───"
tmux new-session -d -s davoai-whisper \
    "cd $DAVOAI_HOME/servers && python whisper_server.py --port 8003 2>&1 | tee -a $DAVOAI_HOME/logs/whisper.log"

echo "─── Starting YOLO (port 8004) ───"
tmux new-session -d -s davoai-yolo \
    "cd $DAVOAI_HOME/servers && python yolo_server.py --port 8004 2>&1 | tee -a $DAVOAI_HOME/logs/yolo.log"

sleep 5

echo ""
echo "─── Active sessions ───"
tmux ls

echo ""
echo "─── Health checks ───"
for url in "http://localhost:8001/v1/models" "http://localhost:8002/v1/models" \
           "http://localhost:8003/health" "http://localhost:8004/health"; do
    echo "  $(curl -s -o /dev/null -w '%{http_code}' "$url" || echo 'fail')  $url"
done
LAUNCHER
    chmod +x "$DAVOAI_HOME/start_all.sh"

    cat > "$DAVOAI_HOME/stop_all.sh" <<'STOP'
#!/usr/bin/env bash
for s in davoai-llm davoai-vision davoai-whisper davoai-yolo davoai-verifier; do
    tmux kill-session -t $s 2>/dev/null && echo "Stopped $s" || true
done
STOP
    chmod +x "$DAVOAI_HOME/stop_all.sh"

    cat > "$DAVOAI_HOME/logs.sh" <<'LOGS'
#!/usr/bin/env bash
# Tail all service logs
DAVOAI_HOME="${DAVOAI_HOME:-/workspace/davoai}"
tail -f "$DAVOAI_HOME/logs"/*.log
LOGS
    chmod +x "$DAVOAI_HOME/logs.sh"

    log "Created launchers: start_all.sh, stop_all.sh, logs.sh"
}

# ─── YOLO dataset prep + training launcher ──────────────────────────────────
write_yolo_launcher() {
    section "Write YOLO training launcher"

    cat > "$DAVOAI_HOME/train_yolo.sh" <<'TRAIN'
#!/usr/bin/env bash
# Davo-AI · YOLO fine-tuning launcher
set -euo pipefail
DAVOAI_REPO="${DAVOAI_REPO:-/workspace/davo-ai}"
source /workspace/venv/bin/activate

cd "$DAVOAI_REPO"

# Step 1: prepare YOLO dataset (split + augmentation)
echo "─── Preparing dataset ───"
python scripts/prepare_yolo_dataset.py --augment 3

# Step 2: train (in tmux, so user can detach)
echo "─── Starting training in tmux session 'davoai-train' ───"
tmux kill-session -t davoai-train 2>/dev/null || true
tmux new-session -d -s davoai-train \
    "cd $DAVOAI_REPO && \
     python scripts/train_yolo.py \
        --model yolov8m.pt \
        --epochs 100 \
        --batch 16 \
        --imgsz 640 \
        --device 0 2>&1 | tee /workspace/davoai/logs/yolo_train.log"

echo ""
echo "✓ Training started in tmux session 'davoai-train'"
echo "  Watch:    tmux attach -t davoai-train  (Ctrl-B then D to detach)"
echo "  Logs:     tail -f /workspace/davoai/logs/yolo_train.log"
echo "  Status:   tmux ls"
TRAIN
    chmod +x "$DAVOAI_HOME/train_yolo.sh"

    log "Created: train_yolo.sh"
}

# ─── Smoke test for installed packages ──────────────────────────────────────
smoke_test() {
    section "Smoke test (используем venv)"
    # shellcheck disable=SC1091
    source /workspace/venv/bin/activate

    python -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'CUDA device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"none\"}')
print(f'CUDA capability: {torch.cuda.get_device_capability(0) if torch.cuda.is_available() else \"none\"}')
"
    log "vLLM version: $(python -c 'import vllm; print(vllm.__version__)' 2>&1 | tail -1)"
    log "ultralytics: $(python -c 'import ultralytics; print(ultralytics.__version__)' 2>&1 | tail -1)"
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    log "╔══════════════════════════════════════════════════════════╗"
    log "║       Davo-AI · Vast.ai RTX 5090 setup                   ║"
    log "║       Команда: MindTech                                   ║"
    log "╚══════════════════════════════════════════════════════════╝"

    verify_env
    install_deps
    get_repo
    hf_login
    download_models
    write_launchers
    write_yolo_launcher
    smoke_test

    section "✅ DONE"
    log "Models:    $DAVOAI_HOME/models/"
    log "Servers:   $DAVOAI_HOME/servers/"
    log "Logs:      $DAVOAI_HOME/logs/"
    log ""
    log "Команды:"
    log "  ./start_all.sh       — поднять все 4 inference сервера"
    log "  ./stop_all.sh        — остановить"
    log "  ./train_yolo.sh      — запустить YOLO fine-tuning"
    log "  ./logs.sh            — tail всех логов"
    log "  tmux ls              — список активных сессий"
    log ""
    log "Эндпоинты (после start_all.sh):"
    log "  LLM:     http://localhost:$LLM_PORT/v1"
    log "  Vision:  http://localhost:$VISION_PORT/v1"
    log "  Whisper: http://localhost:$WHISPER_PORT"
    log "  YOLO:    http://localhost:$YOLO_PORT"
}

main "$@"
