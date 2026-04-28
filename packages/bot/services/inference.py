"""HTTP-клиент для DGX inference серверов.

LLM (Aya 32B) — OpenAI-compatible.
Vision (Qwen-VL) — OpenAI-compatible.
Whisper — кастомный FastAPI.
Verifier — кастомный orchestrator.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
from loguru import logger

from config import settings


class InferenceClient:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(120.0))

    async def aclose(self) -> None:
        await self._http.aclose()

    # ─── LLM (chat) ─────────────────────────────────────────────
    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 800,
    ) -> str:
        payload = {
            "model": settings.llm_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        resp = await self._http.post(
            f"{settings.llm_api_url}/chat/completions",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    # ─── Whisper (STT) ──────────────────────────────────────────
    async def transcribe(
        self,
        audio_path: Path,
        language: str = "auto",
        initial_prompt: str | None = None,
    ) -> dict[str, Any]:
        with open(audio_path, "rb") as f:
            files = {"audio": (audio_path.name, f, "audio/ogg")}
            data: dict[str, str] = {"language": language}
            if initial_prompt:
                data["initial_prompt"] = initial_prompt
            resp = await self._http.post(
                f"{settings.whisper_api_url}/transcribe",
                files=files,
                data=data,
            )
        resp.raise_for_status()
        return resp.json()

    # ─── Verification (full pipeline) ───────────────────────────
    async def verify_intake_video(
        self,
        video_path: Path,
        enrolled_face_path: Path,
    ) -> dict[str, Any]:
        with open(video_path, "rb") as v, open(enrolled_face_path, "rb") as f:
            files = {
                "video": (video_path.name, v, "video/mp4"),
                "enrolled_face": (enrolled_face_path.name, f, "image/jpeg"),
            }
            resp = await self._http.post(
                f"{settings.verifier_api_url}/verify",
                files=files,
            )
        resp.raise_for_status()
        return resp.json()


# ─── Singleton ──────────────────────────────────────────────────
_client: InferenceClient | None = None


def get_inference_client() -> InferenceClient:
    global _client
    if _client is None:
        _client = InferenceClient()
    return _client


# ─── Side-effect chat helper ────────────────────────────────────
TB_SYSTEM_PROMPT_UZ = """Sen — Davo-AI tibbiy yordamchisan.
Faqat sil kasalligini davolashda yon ta'sirlar haqida maslahat berasan.
Bilimingiz: rifampicin, isoniazid, pyrazinamide, ethambutol — WHO 2024 guidelines.

Qoidalar:
1. Qisqacha javob ber (3-5 jumla)
2. Agar XAVF-XATAR bo'lsa — darhol shifokorga yuborilishini ayt
3. JSON formatda javob qaytar:
{
  "severity": "low|medium|high|emergency",
  "expected_se": true|false,
  "advice_uz": "...",
  "advice_ru": "...",
  "escalate_to_doctor": true|false
}

XAVF-XATAR belgilari (high/emergency):
- Sariqlik (yuz/ko'z) — gepatotoksiklik
- Qora siydik
- Yuz/lablar shishishi — angioedema
- Nafas qisilishi
- Ko'rish yomonlashishi (ethambutol)
- Yurakdan og'ir ovoz/og'riq
"""


async def triage_side_effect(
    user_text: str,
    drugs: list[str],
    user_lang: str = "uz",
) -> dict[str, Any]:
    """Триаж побочного эффекта через LLM."""
    client = get_inference_client()
    drugs_str = ", ".join(drugs) or "rifampicin, isoniazid, pyrazinamide, ethambutol"
    prompt = TB_SYSTEM_PROMPT_UZ + f"\n\nBemor dorilari: {drugs_str}\nFoydalanuvchi tili: {user_lang}"

    raw = await client.chat(
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_text},
        ],
        temperature=0.2,
    )

    import re
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {
            "severity": "medium",
            "expected_se": False,
            "advice_uz": raw,
            "advice_ru": raw,
            "escalate_to_doctor": True,
            "_raw": raw,
        }

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse LLM JSON: {e}")
        return {
            "severity": "medium",
            "expected_se": False,
            "advice_uz": raw,
            "advice_ru": raw,
            "escalate_to_doctor": True,
            "_raw": raw,
        }
