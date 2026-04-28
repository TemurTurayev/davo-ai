#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Davo-AI · NVIDIA DGX Spark setup script
#  Команда: MindTech · AI HEALTH Hackathon 2026
# ────────────────────────────────────────────────────────────────────────────
#  Этот скрипт идемпотентен — можно запускать повторно.
#  Устанавливает: Python 3.11, vLLM, Ollama, faster-whisper, ultralytics,
#  скачивает модели, поднимает 4 inference-сервера через systemd.
#
#  Использование:
#     ssh dgx
#     curl -fsSL https://raw.githubusercontent.com/TemurTurayev/davo-ai/main/infra/dgx/setup_dgx_spark.sh | bash
#
#  Или локально:
#     scp setup_dgx_spark.sh dgx:~
#     ssh dgx "bash ~/setup_dgx_spark.sh"
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
DAVOAI_HOME="${DAVOAI_HOME:-/opt/davoai}"
DAVOAI_USER="${DAVOAI_USER:-$USER}"
PYTHON_VERSION="3.11"
CONDA_ENV="davoai-py311"

# Models — выбраны после research (см. RESEARCH_DOSSIER.md §3.1)
LLM_MODEL="CohereForAI/aya-expanse-32b"          # Узбекский поддержан
VISION_MODEL="Qwen/Qwen2.5-VL-7B-Instruct"       # Multi-image reasoning
WHISPER_MODEL="large-v3-turbo"                    # via faster-whisper
EMBEDDING_MODEL="BAAI/bge-m3"                     # Multi-lingual

# Service ports
LLM_PORT=8001
VISION_PORT=8002
WHISPER_PORT=8003
YOLO_PORT=8004

# ─── Helpers ────────────────────────────────────────────────────────────────
log()      { echo -e "\033[1;36m[davoai]\033[0m $*"; }
warn()     { echo -e "\033[1;33m[warn]\033[0m   $*"; }
err()      { echo -e "\033[1;31m[err]\033[0m    $*" >&2; }
section()  { echo -e "\n\033[1;35m═══ $* ═══\033[0m"; }

require_root() {
    if [[ $EUID -ne 0 ]]; then
        SUDO="sudo"
    else
        SUDO=""
    fi
}

# ─── Verification ───────────────────────────────────────────────────────────
verify_hardware() {
    section "Verifying DGX Spark hardware"

    if ! command -v nvidia-smi &>/dev/null; then
        err "nvidia-smi not found — это точно DGX Spark?"
        exit 1
    fi

    log "GPU info:"
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || true

    local cuda_version
    cuda_version=$(nvcc --version 2>/dev/null | grep -oP 'release \K[0-9]+\.[0-9]+' || echo "unknown")
    log "CUDA version: $cuda_version"

    if [[ "$cuda_version" == "unknown" ]]; then
        warn "CUDA toolkit не найден — проверь nvcc в PATH"
    fi

    log "Memory: $(free -h | awk '/^Mem:/ {print $2 " total, " $7 " available"}')"
    log "Disk:   $(df -h /opt 2>/dev/null | tail -1 | awk '{print $4 " available on /opt"}')"
}

# ─── System dependencies ────────────────────────────────────────────────────
install_system_deps() {
    section "Installing system dependencies"

    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq \
        build-essential \
        git \
        curl \
        wget \
        tmux \
        htop \
        ffmpeg \
        libsndfile1 \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
        software-properties-common

    log "System deps OK"
}

# ─── Miniforge / Conda ──────────────────────────────────────────────────────
install_miniforge() {
    section "Installing Miniforge (если ещё нет)"

    if [[ -d "$HOME/miniforge3" ]]; then
        log "Miniforge уже установлен"
    else
        local arch; arch=$(uname -m)
        local installer="Miniforge3-Linux-${arch}.sh"
        log "Скачиваю $installer"
        curl -fsSLo /tmp/miniforge.sh \
            "https://github.com/conda-forge/miniforge/releases/latest/download/$installer"
        bash /tmp/miniforge.sh -b -p "$HOME/miniforge3"
        rm /tmp/miniforge.sh
    fi

    # shellcheck disable=SC1091
    source "$HOME/miniforge3/etc/profile.d/conda.sh"

    if ! conda env list | grep -q "$CONDA_ENV"; then
        log "Создаю conda env $CONDA_ENV"
        conda create -n "$CONDA_ENV" "python=$PYTHON_VERSION" -y -q
    else
        log "Conda env $CONDA_ENV уже существует"
    fi

    conda activate "$CONDA_ENV"
    log "Активирован env: $(python --version)"
}

# ─── Python packages ────────────────────────────────────────────────────────
install_python_deps() {
    section "Installing Python packages (vLLM, ultralytics, faster-whisper, ...)"

    # PyTorch с CUDA 12.4+ (DGX Spark default)
    pip install --upgrade pip wheel setuptools

    # vLLM — production LLM serving
    pip install --upgrade "vllm>=0.7.0"

    # Vision-specific
    pip install --upgrade \
        "transformers>=4.45.0" \
        accelerate \
        bitsandbytes \
        sentencepiece

    # Whisper
    pip install --upgrade faster-whisper ctranslate2

    # YOLO
    pip install --upgrade ultralytics

    # FastAPI servers
    pip install --upgrade \
        fastapi \
        "uvicorn[standard]" \
        python-multipart \
        pydantic \
        pillow \
        opencv-python-headless

    # Utils
    pip install --upgrade \
        huggingface-hub \
        rich \
        httpx \
        loguru

    log "Python packages OK"
}

# ─── Ollama (для dev/тестов и embedding) ────────────────────────────────────
install_ollama() {
    section "Installing Ollama"

    if command -v ollama &>/dev/null; then
        log "Ollama уже установлен: $(ollama --version 2>&1)"
    else
        curl -fsSL https://ollama.com/install.sh | sh
    fi

    # Поднимаем сервис
    $SUDO systemctl enable ollama 2>/dev/null || true
    $SUDO systemctl start ollama 2>/dev/null || true

    log "Ollama running"
}

# ─── HuggingFace login ──────────────────────────────────────────────────────
hf_login() {
    section "HuggingFace authentication"

    if [[ -z "${HF_TOKEN:-}" ]]; then
        warn "HF_TOKEN не задан — установлю интерактивно"
        warn "Получить токен: https://huggingface.co/settings/tokens"
        huggingface-cli login
    else
        echo "$HF_TOKEN" | huggingface-cli login --token "$HF_TOKEN" --add-to-git-credential
        log "HF authenticated через HF_TOKEN env"
    fi
}

# ─── Download models ────────────────────────────────────────────────────────
download_models() {
    section "Downloading models (это может занять 20-30 минут)"

    mkdir -p "$DAVOAI_HOME/models"
    cd "$DAVOAI_HOME/models"

    # Aya Expanse 32B — главная LLM (узбекский!)
    log "→ Aya Expanse 32B (~64 GB)"
    huggingface-cli download "$LLM_MODEL" \
        --local-dir "./aya-expanse-32b" \
        --local-dir-use-symlinks False

    # Qwen2.5-VL-7B — vision
    log "→ Qwen2.5-VL-7B-Instruct (~14 GB)"
    huggingface-cli download "$VISION_MODEL" \
        --local-dir "./Qwen2.5-VL-7B-Instruct" \
        --local-dir-use-symlinks False

    # BGE-M3 embeddings
    log "→ BGE-M3 (~2 GB)"
    huggingface-cli download "$EMBEDDING_MODEL" \
        --local-dir "./bge-m3" \
        --local-dir-use-symlinks False

    # faster-whisper Large-v3-Turbo (CT2 формат, скачает при первом запуске)
    log "→ Whisper Large-v3-Turbo will be auto-downloaded on first use"

    log "Models OK. Disk usage:"
    du -sh "$DAVOAI_HOME/models"/*
}

# ─── Layout ─────────────────────────────────────────────────────────────────
setup_layout() {
    section "Setting up $DAVOAI_HOME directory structure"

    $SUDO mkdir -p "$DAVOAI_HOME"/{models,servers,logs,scripts,runs}
    $SUDO chown -R "$DAVOAI_USER:$DAVOAI_USER" "$DAVOAI_HOME"

    log "Layout:"
    ls -la "$DAVOAI_HOME"
}

# ─── Server scripts ─────────────────────────────────────────────────────────
deploy_servers() {
    section "Deploying inference server scripts"

    # Серверы лежат рядом со скриптом setup в repo
    local scripts_src="$DAVOAI_HOME/repo/packages/inference"

    if [[ -d "$scripts_src" ]]; then
        cp -r "$scripts_src"/*.py "$DAVOAI_HOME/servers/"
        log "Servers copied from repo"
    else
        warn "Repo not found at $scripts_src — нужно склонировать вручную:"
        warn "  git clone https://github.com/TemurTurayev/davo-ai.git $DAVOAI_HOME/repo"
    fi
}

# ─── systemd units ──────────────────────────────────────────────────────────
write_systemd_units() {
    section "Writing systemd units"

    local conda_path="$HOME/miniforge3/envs/$CONDA_ENV/bin"

    # ─── LLM (Aya Expanse 32B) ────────────────────────────────────────────
    $SUDO tee /etc/systemd/system/davoai-llm.service >/dev/null <<EOF
[Unit]
Description=Davo-AI · LLM Server (Aya Expanse 32B)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$DAVOAI_USER
WorkingDirectory=$DAVOAI_HOME
Environment="PATH=$conda_path:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="HF_HOME=$DAVOAI_HOME/.hf_cache"
Environment="VLLM_LOGGING_LEVEL=INFO"
ExecStart=$conda_path/python -m vllm.entrypoints.openai.api_server \\
    --model $DAVOAI_HOME/models/aya-expanse-32b \\
    --served-model-name aya-expanse-32b \\
    --host 0.0.0.0 \\
    --port $LLM_PORT \\
    --max-model-len 8192 \\
    --dtype bfloat16 \\
    --gpu-memory-utilization 0.45
Restart=on-failure
RestartSec=10
StandardOutput=append:$DAVOAI_HOME/logs/llm.log
StandardError=append:$DAVOAI_HOME/logs/llm.err.log

[Install]
WantedBy=multi-user.target
EOF

    # ─── Vision (Qwen2.5-VL-7B) ───────────────────────────────────────────
    $SUDO tee /etc/systemd/system/davoai-vision.service >/dev/null <<EOF
[Unit]
Description=Davo-AI · Vision Server (Qwen2.5-VL-7B)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$DAVOAI_USER
WorkingDirectory=$DAVOAI_HOME
Environment="PATH=$conda_path:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="HF_HOME=$DAVOAI_HOME/.hf_cache"
ExecStart=$conda_path/python -m vllm.entrypoints.openai.api_server \\
    --model $DAVOAI_HOME/models/Qwen2.5-VL-7B-Instruct \\
    --served-model-name qwen-vl \\
    --host 0.0.0.0 \\
    --port $VISION_PORT \\
    --max-model-len 8192 \\
    --dtype bfloat16 \\
    --gpu-memory-utilization 0.30 \\
    --limit-mm-per-prompt image=5
Restart=on-failure
RestartSec=10
StandardOutput=append:$DAVOAI_HOME/logs/vision.log
StandardError=append:$DAVOAI_HOME/logs/vision.err.log

[Install]
WantedBy=multi-user.target
EOF

    # ─── Whisper STT ──────────────────────────────────────────────────────
    $SUDO tee /etc/systemd/system/davoai-whisper.service >/dev/null <<EOF
[Unit]
Description=Davo-AI · Whisper STT Server (Large-v3-Turbo)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$DAVOAI_USER
WorkingDirectory=$DAVOAI_HOME/servers
Environment="PATH=$conda_path:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=$conda_path/python whisper_server.py --port $WHISPER_PORT
Restart=on-failure
RestartSec=10
StandardOutput=append:$DAVOAI_HOME/logs/whisper.log
StandardError=append:$DAVOAI_HOME/logs/whisper.err.log

[Install]
WantedBy=multi-user.target
EOF

    # ─── YOLO Pill detection ──────────────────────────────────────────────
    $SUDO tee /etc/systemd/system/davoai-yolo.service >/dev/null <<EOF
[Unit]
Description=Davo-AI · YOLOv8 TB Pill Detection Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$DAVOAI_USER
WorkingDirectory=$DAVOAI_HOME/servers
Environment="PATH=$conda_path:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=$conda_path/python yolo_server.py --port $YOLO_PORT
Restart=on-failure
RestartSec=10
StandardOutput=append:$DAVOAI_HOME/logs/yolo.log
StandardError=append:$DAVOAI_HOME/logs/yolo.err.log

[Install]
WantedBy=multi-user.target
EOF

    $SUDO systemctl daemon-reload
    log "Systemd units written"
}

# ─── Enable and start services ──────────────────────────────────────────────
enable_services() {
    section "Enabling and starting services"

    for svc in davoai-llm davoai-vision davoai-whisper davoai-yolo; do
        $SUDO systemctl enable "$svc"
        $SUDO systemctl restart "$svc" || warn "Failed to start $svc — check logs"
    done

    sleep 8
    log "Service status:"
    for svc in davoai-llm davoai-vision davoai-whisper davoai-yolo; do
        printf "  %-20s %s\n" "$svc" "$(systemctl is-active "$svc" || true)"
    done
}

# ─── Smoke tests ────────────────────────────────────────────────────────────
smoke_tests() {
    section "Smoke tests"

    log "1/4 LLM (Aya):"
    curl -fsS "http://localhost:$LLM_PORT/v1/models" | python -m json.tool | head -10 \
        || warn "LLM ещё прогревается — проверь через 30 сек"

    log "2/4 Vision (Qwen-VL):"
    curl -fsS "http://localhost:$VISION_PORT/v1/models" | python -m json.tool | head -10 \
        || warn "Vision ещё прогревается"

    log "3/4 Whisper:"
    curl -fsS "http://localhost:$WHISPER_PORT/health" \
        || warn "Whisper не отвечает — проверь $DAVOAI_HOME/logs/whisper.err.log"

    log "4/4 YOLO:"
    curl -fsS "http://localhost:$YOLO_PORT/health" \
        || warn "YOLO не отвечает — проверь $DAVOAI_HOME/logs/yolo.err.log"
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    log "╔══════════════════════════════════════════════════════════╗"
    log "║       Davo-AI · DGX Spark setup                          ║"
    log "║       Команда: MindTech                                   ║"
    log "╚══════════════════════════════════════════════════════════╝"

    require_root
    verify_hardware
    install_system_deps
    install_miniforge
    install_python_deps
    install_ollama
    setup_layout
    hf_login
    download_models
    deploy_servers
    write_systemd_units
    enable_services
    smoke_tests

    section "✅ DONE"
    log "Inference endpoints:"
    log "  LLM:     http://localhost:$LLM_PORT/v1"
    log "  Vision:  http://localhost:$VISION_PORT/v1"
    log "  Whisper: http://localhost:$WHISPER_PORT"
    log "  YOLO:    http://localhost:$YOLO_PORT"
    log ""
    log "Логи:    $DAVOAI_HOME/logs/"
    log "Models:  $DAVOAI_HOME/models/"
    log ""
    log "Чтобы остановить: sudo systemctl stop davoai-{llm,vision,whisper,yolo}"
    log "Чтобы посмотреть логи: journalctl -u davoai-llm -f"
}

main "$@"
