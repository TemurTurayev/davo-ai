"""Обработка видео приёма таблетки."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

from aiogram import F, Router
from aiogram.types import Message
from config import settings
from i18n import Lang, t
from loguru import logger
from services.db import IntakeVideo, SessionLocal, get_patient_by_tg, update_streak
from services.inference import get_inference_client

router = Router(name="video")


@router.message(F.video | F.video_note)
async def on_video(message: Message) -> None:
    if message.bot is None or message.from_user is None:
        return

    video = message.video or message.video_note
    if video is None:
        return

    async with SessionLocal() as session:
        patient = await get_patient_by_tg(session, message.from_user.id)
        if patient is None:
            await message.answer("/start")
            return
        lang: Lang = patient.language  # type: ignore[assignment]
        face_path = Path(patient.enrolled_face_path or "")
        patient_id = patient.id
        patient_uuid = patient.id

    duration = video.duration or 0
    if duration < 5:
        await message.answer(t("video.too_short", lang, duration=duration))
        return
    if duration > 60:
        await message.answer(t("video.too_long", lang))
        return

    await message.answer(t("video.received", lang))

    # Скачиваем видео локально
    storage_dir = settings.storage_local_path / "intake"
    storage_dir.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    video_path = storage_dir / f"{message.from_user.id}_{ts}.mp4"

    file = await message.bot.get_file(video.file_id)
    if file.file_path:
        await message.bot.download_file(file.file_path, destination=video_path)

    if not face_path.exists():
        logger.warning(f"Enrolled face missing for {patient_id} ({face_path})")
        await message.answer(t("error.generic", lang))
        return

    # Запускаем верификацию
    client = get_inference_client()
    try:
        result = await client.verify_intake_video(video_path, face_path)
    except Exception as e:
        logger.exception(f"Verification failed: {e}")
        await message.answer(t("error.network", lang))
        return

    # Сохраняем результат
    async with SessionLocal() as session:
        record = IntakeVideo(
            patient_id=patient_uuid,
            file_path=str(video_path),
            file_size_bytes=video.file_size,
            duration_seconds=duration,
            status=(
                "verified"
                if result["verified"]
                else "review_required"
                if result["review_required"]
                else "unverified"
            ),
            overall_confidence=result["confidence"],
            face_match=result["face_match"],
            face_match_confidence=result["face_match_confidence"],
            pill_visible=result["pill_visible"],
            pill_drugs_detected=result.get("pill_drugs_detected") or [],
            pill_confidence=result["pill_confidence"],
            swallow_detected=result["swallow_detected"],
            swallow_confidence=result["swallow_confidence"],
            raw_ai_findings=result.get("raw_findings"),
            processed_at=dt.datetime.now(dt.UTC),
        )
        session.add(record)
        await session.flush()

        if result["verified"]:
            new_streak = await update_streak(session, patient_uuid, True)
        elif not result["review_required"]:
            new_streak = await update_streak(session, patient_uuid, False)
        else:
            new_streak = 0  # streak не меняется до решения врача
        await session.commit()

    if result["verified"]:
        await message.answer(
            t(
                "video.verified",
                lang,
                confidence=int(result["confidence"] * 100),
                streak=new_streak,
            )
        )
    elif result["review_required"]:
        await message.answer(t("video.under_review", lang))
    else:
        await message.answer(t("video.unverified", lang))
