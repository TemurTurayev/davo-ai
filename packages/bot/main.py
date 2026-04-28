"""Davo-AI Telegram Bot — entry point."""

from __future__ import annotations

import asyncio
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from config import settings
from handlers import chat, registration, start, video
from loguru import logger
from services.scheduler import setup_scheduler


def setup_logging() -> None:
    logger.remove()
    logger.add(
        sys.stderr,
        level=settings.log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level:<8}</level> | <cyan>{name}</cyan> · {message}",
    )


async def main() -> None:
    setup_logging()
    logger.info("🚀 Davo-AI bot запускается ...")
    logger.info(f"   LLM: {settings.llm_api_url} ({settings.llm_model})")
    logger.info(f"   Vision: {settings.vision_api_url}")
    logger.info(f"   Whisper: {settings.whisper_api_url}")
    logger.info(f"   Verifier: {settings.verifier_api_url}")
    logger.info(f"   DB: {settings.database_url.split('@')[-1]}")
    logger.info(f"   Local Bot API: {settings.use_local_bot_api}")

    # Sessions: local Bot API support
    if settings.use_local_bot_api:
        api_server = TelegramAPIServer.from_base(settings.telegram_local_api_url)
        session = AiohttpSession(api=api_server)
    else:
        session = AiohttpSession()

    bot = Bot(
        token=settings.telegram_bot_token,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(start.router)
    dp.include_router(registration.router)
    dp.include_router(video.router)
    dp.include_router(chat.router)

    scheduler = setup_scheduler(bot)
    scheduler.start()

    me = await bot.get_me()
    logger.info(f"✓ Bot @{me.username} (id={me.id}) готов")

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        scheduler.shutdown()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
