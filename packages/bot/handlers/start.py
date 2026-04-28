"""/start, /help, /lang, /progress."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from i18n import Lang, t
from keyboards import language_picker, main_menu
from services.db import SessionLocal, get_patient_by_tg
from states import Registration

router = Router(name="start")


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    if message.from_user is None:
        return

    async with SessionLocal() as session:
        patient = await get_patient_by_tg(session, message.from_user.id)

    if patient is None:
        # Новый пользователь — выбор языка
        await message.answer(
            t("start.choose_language", "uz"),
            reply_markup=language_picker(),
        )
        await state.set_state(Registration.choosing_language)
    else:
        # Уже зарегистрирован
        lang: Lang = patient.language  # type: ignore[assignment]
        await message.answer(
            t("start.greeting", lang, name=patient.full_name.split()[0]),
            reply_markup=main_menu(lang),
        )


@router.callback_query(Registration.choosing_language, F.data.startswith("lang:"))
async def chose_language(cb: CallbackQuery, state: FSMContext) -> None:
    if cb.data is None:
        return
    lang: Lang = cb.data.split(":")[1]  # type: ignore[assignment]
    await state.update_data(language=lang)

    if cb.message:
        await cb.message.edit_text(t("register.welcome", lang))
        await cb.message.answer(t("register.ask_name", lang))
    await state.set_state(Registration.name)
    await cb.answer()


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    if message.from_user is None:
        return
    async with SessionLocal() as session:
        patient = await get_patient_by_tg(session, message.from_user.id)
    lang: Lang = patient.language if patient else "uz"  # type: ignore[assignment]
    await message.answer(t("help.text", lang))


@router.message(Command("progress"))
async def cmd_progress(message: Message) -> None:
    if message.from_user is None:
        return

    async with SessionLocal() as session:
        patient = await get_patient_by_tg(session, message.from_user.id)
        if patient is None:
            await message.answer("Iltimos, /start buyrug'ini yuboring.")
            return

        from services.db import AdherenceMetrics
        metrics = await session.get(AdherenceMetrics, patient.id)

    lang: Lang = patient.language  # type: ignore[assignment]
    if metrics is None or metrics.total_doses_scheduled == 0:
        await message.answer("Hali davolanish boshlanmagan." if lang == "uz" else "Лечение ещё не начато.")
        return

    days = (
        metrics.last_verified_at - patient.treatment_started_at  # type: ignore[operator]
        if patient.treatment_started_at and metrics.last_verified_at
        else None
    )
    days_count = days.days if days else 0

    await message.answer(t(
        "progress.summary", lang,
        days=days_count,
        confirmed=metrics.total_doses_verified,
        adherence=int((metrics.adherence_rate or 0) * 100),
        streak=metrics.current_streak,
        drugs=", ".join(patient.drugs) if patient.drugs else "—",
    ))
