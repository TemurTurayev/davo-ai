"""Common pytest fixtures для bot tests."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Make sure bot package importable from tests
BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

# Set safe defaults for tests (override anything in real .env)
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "0:test-token")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://davoai:test@localhost:5432/davoai_test")
os.environ.setdefault("LLM_API_URL", "http://localhost:9000/v1")
os.environ.setdefault("WHISPER_API_URL", "http://localhost:9000/whisper")
os.environ.setdefault("VERIFIER_API_URL", "http://localhost:9000/verifier")
os.environ.setdefault("VISION_API_URL", "http://localhost:9000/v1")


@pytest.fixture
def sample_patient_data() -> dict:
    """Тестовые данные пациента (узбекский, ТБ-режим RHZE)."""
    return {
        "telegram_id": 100100100,
        "full_name": "Test Patient Sardor",
        "birth_year": 1985,
        "phone": "+998901234567",
        "language": "uz",
        "drugs": ["rifampicin", "isoniazid", "pyrazinamide", "ethambutol"],
    }


@pytest.fixture
def sample_se_low() -> str:
    """Лёгкая жалоба (узбекский) — должна получить severity=low."""
    return "Qornim ozgina og'riyapti dori ichgandan keyin"


@pytest.fixture
def sample_se_redflag() -> str:
    """Red-flag жалоба — должна получить severity=high и escalate."""
    return "Ko'zlarim sariq bo'lib qoldi va siydigim qoraygan"
