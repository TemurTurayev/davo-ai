"""End-to-end интеграция bot ↔ mock inference servers (через TestClient)."""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

# Path к inference package
INF_ROOT = Path(__file__).resolve().parents[3] / "packages" / "inference"
sys.path.insert(0, str(INF_ROOT))


@pytest.fixture
def mock_app_client():
    import mock_servers
    from fastapi.testclient import TestClient

    return TestClient(mock_servers.app)


def test_mock_health(mock_app_client):
    r = mock_app_client.get("/health")
    assert r.status_code == 200
    assert r.json()["mode"] == "mock"


def test_mock_llm_chat_low_severity(mock_app_client):
    r = mock_app_client.post(
        "/v1/chat/completions",
        json={
            "model": "aya-expanse-32b",
            "messages": [
                {"role": "system", "content": "JSON формат"},
                {"role": "user", "content": "Qornim ozgina og'riyapti"},
            ],
        },
    )
    assert r.status_code == 200
    import json

    content = r.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    assert parsed["severity"] in {"low", "medium"}
    assert parsed["escalate_to_doctor"] is False


def test_mock_llm_chat_red_flag_uzbek(mock_app_client):
    r = mock_app_client.post(
        "/v1/chat/completions",
        json={
            "model": "aya-expanse-32b",
            "messages": [
                {"role": "user", "content": "Ko'zlarim sariq bo'lib qoldi"},
            ],
        },
    )
    assert r.status_code == 200
    import json

    content = r.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    assert parsed["severity"] == "high"
    assert parsed["escalate_to_doctor"] is True


def test_mock_whisper_returns_uzbek(mock_app_client):
    r = mock_app_client.post(
        "/whisper/transcribe",
        files={"audio": ("test.ogg", io.BytesIO(b"fake-audio"), "audio/ogg")},
        data={"language": "uz"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["language"] == "uz"
    assert len(data["text"]) > 0


def test_mock_verifier_returns_structured_result(mock_app_client):
    r = mock_app_client.post(
        "/verifier/verify",
        files={
            "video": ("v.mp4", io.BytesIO(b"fake-video" * 100), "video/mp4"),
            "enrolled_face": ("f.jpg", io.BytesIO(b"fake-face"), "image/jpeg"),
        },
    )
    assert r.status_code == 200
    data = r.json()
    # Структура совпадает с verification_orchestrator schema
    required_keys = {
        "verified",
        "confidence",
        "face_match",
        "face_match_confidence",
        "pill_visible",
        "pill_drugs_detected",
        "pill_confidence",
        "swallow_detected",
        "swallow_confidence",
        "review_required",
        "raw_findings",
    }
    assert required_keys.issubset(set(data.keys()))
    assert 0.0 <= data["confidence"] <= 1.0


def test_mock_verifier_drug_detection(mock_app_client):
    r = mock_app_client.post(
        "/verifier/verify",
        files={
            "video": ("v.mp4", io.BytesIO(b"x" * 10000), "video/mp4"),
            "enrolled_face": ("f.jpg", io.BytesIO(b"y"), "image/jpeg"),
        },
    )
    data = r.json()
    drugs = data["pill_drugs_detected"]
    assert len(drugs) >= 1
    assert all(
        d in {"rifampicin", "isoniazid", "pyrazinamide", "ethambutol", "combo_fdc"} for d in drugs
    )
