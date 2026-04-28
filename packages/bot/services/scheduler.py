"""APScheduler — daily reminders для пациентов."""

from __future__ import annotations

import datetime as dt

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from sqlalchemy import select

from config import settings
from i18n import t
from services.db import Patient, SessionLocal


async def send_daily_reminders(bot: Bot) -> None:
    """Каждую минуту проверяем кому пора отправить reminder."""
    now = dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=5)))  # +05 Tashkent
    current_hm = now.strftime("%H:%M")

    async with SessionLocal() as session:
        result = await session.execute(
            select(Patient).where(
                Patient.deleted_at.is_(None),
            )
        )
        patients = result.scalars().all()

    for p in patients:
        patient_hm = p.reminder_time.strftime("%H:%M") if p.reminder_time else "08:00"
        if patient_hm != current_hm:
            continue
        try:
            lang = p.language or "uz"
            text = t("reminder.daily", lang, name=p.full_name.split()[0] if p.full_name else "")
            await bot.send_message(p.telegram_id, text)
            logger.info(f"Reminder sent to {p.telegram_id}")
        except Exception as e:
            logger.warning(f"Failed reminder for {p.telegram_id}: {e}")


def setup_scheduler(bot: Bot) -> AsyncIOScheduler:
    sched = AsyncIOScheduler(timezone=settings.timezone)
    sched.add_job(
        send_daily_reminders,
        CronTrigger(minute="*"),  # every minute, фильтруем внутри
        kwargs={"bot": bot},
        id="daily_reminders",
        max_instances=1,
        coalesce=True,
    )
    return sched
