"""FSM-регистрация: имя → год → телефон → фото → дата начала → препараты → время."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from loguru import logger

from config import settings
from i18n import Lang, t
from keyboards import drug_picker, main_menu, phone_request
from services.db import SessionLocal, upsert_patient
from states import Registration

router = Router(name="registration")


# ─── Имя ────────────────────────────────────────────────────────────────────
@router.message(Registration.name)
async def reg_name(message: Message, state: FSMContext) -> None:
    if message.text is None:
        return
    name = message.text.strip()
    if len(name) < 2 or len(name) > 100:
        return

    await state.update_data(full_name=name)
    data = await state.get_data()
    lang: Lang = data.get("language", "uz")
    await message.answer(t("register.ask_birth_year", lang))
    await state.set_state(Registration.birth_year)


# ─── Год рождения ───────────────────────────────────────────────────────────
@router.message(Registration.birth_year)
async def reg_year(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    lang: Lang = data.get("language", "uz")

    if message.text is None or not message.text.isdigit():
        await message.answer(t("register.invalid_year", lang))
        return

    year = int(message.text)
    if year < 1900 or year > dt.date.today().year:
        await message.answer(t("register.invalid_year", lang))
        return

    await state.update_data(birth_year=year)
    await message.answer(t("register.ask_phone", lang), reply_markup=phone_request(lang))
    await state.set_state(Registration.phone)


# ─── Телефон ────────────────────────────────────────────────────────────────
@router.message(Registration.phone, F.contact)
async def reg_phone_contact(message: Message, state: FSMContext) -> None:
    if message.contact is None:
        return
    await state.update_data(phone=message.contact.phone_number)
    await _ask_for_face(message, state)


@router.message(Registration.phone, F.text)
async def reg_phone_text(message: Message, state: FSMContext) -> None:
    if message.text is None:
        return
    await state.update_data(phone=message.text.strip())
    await _ask_for_face(message, state)


async def _ask_for_face(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    lang: Lang = data.get("language", "uz")
    await message.answer(t("register.ask_face", lang))
    await state.set_state(Registration.face_photo)


# ─── Фото лица ──────────────────────────────────────────────────────────────
@router.message(Registration.face_photo, F.photo)
async def reg_face(message: Message, state: FSMContext) -> None:
    if not message.photo or message.bot is None or message.from_user is None:
        return

    largest = message.photo[-1]
    storage_dir = settings.storage_local_path / "faces"
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / f"{message.from_user.id}.jpg"

    file = await message.bot.get_file(largest.file_id)
    if file.file_path:
        await message.bot.download_file(file.file_path, destination=file_path)

    await state.update_data(face_path=str(file_path))

    data = await state.get_data()
    lang: Lang = data.get("language", "uz")
    await message.answer(t("register.face_received", lang))
    await message.answer(t("register.ask_treatment_start", lang))
    await state.set_state(Registration.treatment_start_date)


# ─── Дата начала лечения ────────────────────────────────────────────────────
@router.message(Registration.treatment_start_date)
async def reg_treatment_start(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    lang: Lang = data.get("language", "uz")

    if message.text is None:
        return
    try:
        treatment_start = dt.datetime.strptime(message.text.strip(), "%Y-%m-%d").date()
    except ValueError:
        await message.answer("YYYY-MM-DD")
        return

    await state.update_data(treatment_start=treatment_start.isoformat(), drugs=[])
    await message.answer(
        t("register.ask_drugs", lang),
        reply_markup=drug_picker(lang, []),
    )
    await state.set_state(Registration.drugs)


# ─── Препараты ──────────────────────────────────────────────────────────────
@router.callback_query(Registration.drugs, F.data.startswith("drug:"))
async def reg_drugs(cb: CallbackQuery, state: FSMContext) -> None:
    if cb.data is None or cb.message is None:
        return
    code = cb.data.split(":")[1]
    data = await state.get_data()
    lang: Lang = data.get("language", "uz")
    selected: list[str] = data.get("drugs", [])

    if code == "done":
        if not selected:
            await cb.answer("Tanlang", show_alert=True)
            return
        await cb.message.edit_text(t("register.ask_drugs", lang) + f"\n\n→ {', '.join(selected)}")
        await cb.message.answer(t("register.ask_reminder_time", lang))
        await state.set_state(Registration.reminder_time)
        await cb.answer()
        return

    if code in selected:
        selected.remove(code)
    else:
        selected.append(code)
    await state.update_data(drugs=selected)
    await cb.message.edit_reply_markup(reply_markup=drug_picker(lang, selected))
    await cb.answer()


# ─── Время напоминания ──────────────────────────────────────────────────────
@router.message(Registration.reminder_time)
async def reg_time(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    lang: Lang = data.get("language", "uz")

    if message.text is None or message.from_user is None:
        return
    try:
        time_obj = dt.datetime.strptime(message.text.strip(), "%H:%M").time()
    except ValueError:
        await message.answer(t("register.invalid_time", lang))
        return

    treatment_start = dt.date.fromisoformat(data["treatment_start"])

    async with SessionLocal() as session:
        patient = await upsert_patient(
            session,
            telegram_id=message.from_user.id,
            full_name=data["full_name"],
            birth_year=data["birth_year"],
            phone=data.get("phone"),
            language=lang,
            treatment_started_at=treatment_start,
            drugs=data["drugs"],
            reminder_time=time_obj,
            enrolled_face_path=data.get("face_path"),
            enrolled_face_at=dt.datetime.now(dt.timezone.utc),
            consent_cross_border=False,         # local-first stack — no cross-border
            consent_at=dt.datetime.now(dt.timezone.utc),
        )
        await session.commit()
        logger.info(f"Patient registered: {patient.id} (tg={patient.telegram_id})")

    await message.answer(
        t("register.complete", lang, time=time_obj.strftime("%H:%M")),
        reply_markup=main_menu(lang),
    )
    await state.clear()
