"""Davo-AI bot configuration (Pydantic Settings)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Telegram ──────────────────────────────────────
    telegram_bot_token: str
    telegram_bot_username: str = "DavoAIBot"
    telegram_local_api_url: str = "http://localhost:8081"
    use_local_bot_api: bool = True

    # ── DGX inference endpoints ───────────────────────
    llm_api_url: str = "http://localhost:8001/v1"
    llm_model: str = "aya-expanse-32b"

    vision_api_url: str = "http://localhost:8002/v1"
    vision_model: str = "qwen-vl"

    whisper_api_url: str = "http://localhost:8003"
    yolo_api_url: str = "http://localhost:8004"
    verifier_api_url: str = "http://localhost:8005"

    # ── Database ──────────────────────────────────────
    database_url: str = "postgresql+asyncpg://davoai:davoai@localhost:5432/davoai"

    # ── Storage ───────────────────────────────────────
    storage_backend: Literal["local", "supabase", "s3"] = "local"
    storage_local_path: Path = PROJECT_ROOT / "data" / "videos"

    # ── App ───────────────────────────────────────────
    app_env: Literal["development", "production"] = "development"
    log_level: str = "INFO"
    default_language: Literal["uz", "ru"] = "uz"
    timezone: str = "Asia/Tashkent"

    # ── Reminders ─────────────────────────────────────
    default_reminder_time: str = "08:00"
    reminder_retry_interval_minutes: int = 30
    max_reminder_retries: int = 3

    # ── Feature flags ─────────────────────────────────
    enable_voice_input: bool = True
    enable_pediatric_module: bool = False
    enable_drop_off_ml: bool = False


settings = Settings()  # type: ignore[call-arg]
