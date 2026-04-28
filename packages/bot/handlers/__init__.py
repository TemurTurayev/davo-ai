"""Telegram handlers — каждый router в отдельном модуле."""

from . import chat, registration, start, video

__all__ = ["chat", "registration", "start", "video"]
