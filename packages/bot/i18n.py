"""Простой i18n loader для узбекского/русского."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

LOCALES_DIR = Path(__file__).parent / "locales"
Lang = Literal["uz", "ru"]


@lru_cache(maxsize=4)
def _load(lang: Lang) -> dict[str, str]:
    path = LOCALES_DIR / f"{lang}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def t(key: str, lang: Lang = "uz", **kwargs) -> str:
    """Перевод по ключу.

    Examples:
        t("start.greeting", lang="uz", name="Sardor")
    """
    locale = _load(lang)
    fallback = _load("ru") if lang != "ru" else {}
    text = locale.get(key) or fallback.get(key) or f"⟨missing: {key}⟩"
    return text.format(**kwargs) if kwargs else text
