"""Чат о побочных эффектах: текст или голос → AI-триаж."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

from aiogram import F, Router
from aiogram.types import Message
from loguru import logger

from config import settings
from i18n import Lang, t
from services.db import SessionLocal, SideEffect, get_patient_by_tg
from services.inference import get_inference_client, triage_side_effect

router = Router(name="chat")


@router.message(F.voice)
async def on_voice(message: Message) -> None:
    if message.bot is None or message.from_user is None or message.voice is None:
        return

    async with SessionLocal() as session:
        patient = await get_patient_by_tg(session, message.from_user.id)
        if patient is None:
            return
        lang: Lang = patient.language  # type: ignore[assignment]
        drugs = list(patient.drugs or [])
        patient_uuid = patient.id

    await message.answer(t("chat.thinking", lang))

    # Скачиваем голосовое
    storage_dir = settings.storage_local_path / "voice"
    storage_dir.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    voice_path = storage_dir / f"{message.from_user.id}_{ts}.ogg"

    file = await message.bot.get_file(message.voice.file_id)
    if file.file_path:
        await message.bot.download_file(file.file_path, destination=voice_path)

    client = get_inference_client()
    try:
        stt_result = await client.transcribe(
            voice_path,
            language=lang,
            initial_prompt="Sil kasalligi, dori, yon ta'sir, izoniazid, rifampicin, pyrazinamide, ethambutol",
        )
    except Exception as e:
        logger.exception(f"STT failed: {e}")
        await message.answer(t("error.network", lang))
        return

    user_text = stt_result.get("text", "").strip()
    if not user_text:
        await message.answer("Iltimos, qaytadan ayting" if lang == "uz" else "Пожалуйста, повторите")
        return

    # Показываем что распознали (с возможностью редактировать)
    confirm_msg = (
        f"📝 Eshitganim:\n\n«{user_text}»\n\nTo'g'ri bo'lsa — qayta yozing yoki tasdiqlang."
        if lang == "uz" else
        f"📝 Распознано:\n\n«{user_text}»\n\nЕсли неверно — перепишите."
    )
    await message.answer(confirm_msg)

    await _process_complaint(message, lang, user_text, drugs, patient_uuid, voice_path=voice_path)


@router.message(F.text & ~F.text.startswith("/"))
async def on_text(message: Message) -> None:
    if message.from_user is None or message.text is None:
        return

    # Игнорируем кнопки главного меню (они обрабатываются отдельно)
    text = message.text.strip()
    if text in {"🎥", "📊", "💊", "👨‍⚕️", "❓"} or len(text) < 5:
        return

    async with SessionLocal() as session:
        patient = await get_patient_by_tg(session, message.from_user.id)
        if patient is None:
            return
        lang: Lang = patient.language  # type: ignore[assignment]
        drugs = list(patient.drugs or [])
        patient_uuid = patient.id

    await message.answer(t("chat.thinking", lang))
    await _process_complaint(message, lang, text, drugs, patient_uuid)


async def _process_complaint(
    message: Message,
    lang: Lang,
    user_text: str,
    drugs: list[str],
    patient_uuid,
    voice_path: Path | None = None,
) -> None:
    try:
        triage = await triage_side_effect(user_text, drugs, user_lang=lang)
    except Exception as e:
        logger.exception(f"Triage failed: {e}")
        await message.answer(t("error.network", lang))
        return

    severity = triage.get("severity", "medium")
    advice_uz = triage.get("advice_uz") or ""
    advice_ru = triage.get("advice_ru") or ""
    escalate = triage.get("escalate_to_doctor", False) or severity in {"high", "emergency"}

    advice_text = advice_uz if lang == "uz" else (advice_ru or advice_uz)

    # Сохраняем
    async with SessionLocal() as session:
        se = SideEffect(
            patient_id=patient_uuid,
            raw_text=user_text,
            raw_voice_path=str(voice_path) if voice_path else None,
            transcription_language=lang if voice_path else None,
            severity=severity,
            is_expected=triage.get("expected_se"),
            advice_uz=advice_uz,
            advice_ru=advice_ru,
            escalated_to_doctor=escalate,
            related_drugs=drugs,
        )
        session.add(se)
        await session.commit()

    # Ответ пациенту
    if severity == "emergency":
        await message.answer(t("chat.urgent", lang, phone="+998711234567"))
    else:
        await message.answer(advice_text or t("error.generic", lang))

    if escalate:
        await message.answer(t("chat.escalated", lang))
