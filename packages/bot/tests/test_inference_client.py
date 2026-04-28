"""Tests для inference HTTP client (с mocked endpoints)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


@pytest.fixture
def mock_client_factory(monkeypatch):
    """Фейковый httpx.AsyncClient для unit-тестов."""

    def make(response_data: dict, status_code: int = 200):
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = status_code
        mock_response.json = MagicMock(return_value=response_data)
        mock_response.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        mock_http.aclose = AsyncMock()

        return mock_http

    return make


@pytest.mark.asyncio
async def test_chat_returns_content(mock_client_factory):
    from services.inference import InferenceClient

    fake = mock_client_factory(
        {
            "choices": [{"message": {"content": "Test response"}}],
        }
    )

    client = InferenceClient()
    client._http = fake

    result = await client.chat([{"role": "user", "content": "hi"}])
    assert result == "Test response"
    fake.post.assert_called_once()


@pytest.mark.asyncio
async def test_triage_side_effect_parses_json():
    """triage_side_effect должен парсить JSON из ответа LLM."""
    from services import inference as inf_module

    expected = {
        "severity": "low",
        "expected_se": True,
        "advice_uz": "Hammasi yaxshi",
        "advice_ru": "Всё хорошо",
        "escalate_to_doctor": False,
    }

    with patch.object(
        inf_module.InferenceClient,
        "chat",
        new=AsyncMock(return_value=json.dumps(expected)),
    ):
        # Сбрасываем singleton
        inf_module._client = None
        result = await inf_module.triage_side_effect("test", ["rifampicin"], user_lang="uz")
        assert result["severity"] == "low"
        assert result["escalate_to_doctor"] is False


@pytest.mark.asyncio
async def test_triage_handles_malformed_json():
    """Если LLM вернул не-JSON — graceful fallback."""
    from services import inference as inf_module

    with patch.object(
        inf_module.InferenceClient,
        "chat",
        new=AsyncMock(return_value="this is not JSON at all"),
    ):
        inf_module._client = None
        result = await inf_module.triage_side_effect("test", [], user_lang="uz")
        assert "severity" in result
        assert result["escalate_to_doctor"] is True  # default safe


@pytest.mark.asyncio
async def test_triage_extracts_json_from_markdown():
    """Модели часто оборачивают JSON в ```json ... ```. Должны извлечь."""
    from services import inference as inf_module

    raw = """```json
{
  "severity": "high",
  "expected_se": false,
  "advice_uz": "Shifokorga boring",
  "advice_ru": "К врачу!",
  "escalate_to_doctor": true
}
```"""

    with patch.object(
        inf_module.InferenceClient,
        "chat",
        new=AsyncMock(return_value=raw),
    ):
        inf_module._client = None
        result = await inf_module.triage_side_effect("ko'zlarim sariq", ["rifampicin"])
        assert result["severity"] == "high"
        assert result["escalate_to_doctor"] is True
