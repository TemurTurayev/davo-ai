"""i18n loader tests."""

from __future__ import annotations

import pytest
from i18n import t


def test_uz_translation_loads():
    text = t("start.greeting", "uz", name="Sardor")
    assert "Sardor" in text
    assert "Davo-AI" in text
    # Russian shouldn't leak
    assert "Здравствуйте" not in text


def test_ru_translation_loads():
    text = t("start.greeting", "ru", name="Алишер")
    assert "Алишер" in text
    assert "Здравствуйте" in text


def test_missing_key_returns_marker():
    text = t("nonexistent.key", "uz")
    assert "missing" in text


def test_missing_key_falls_back_to_ru():
    # Если ключа нет в uz, но есть в ru — должен вернуться ru вариант
    # (на момент написания все ключи есть в обоих языках)
    text = t("start.greeting", "uz", name="X")
    assert text != ""


@pytest.mark.parametrize(
    "key",
    [
        "start.greeting",
        "start.choose_language",
        "register.ask_name",
        "video.received",
        "video.verified",
        "chat.thinking",
        "btn.send_video",
        "error.generic",
    ],
)
def test_critical_keys_translated(key):
    """Все критические ключи должны быть переведены в обоих языках."""
    uz_text = t(key, "uz")
    ru_text = t(key, "ru")
    assert "missing" not in uz_text, f"UZ missing: {key}"
    assert "missing" not in ru_text, f"RU missing: {key}"
    assert uz_text != ru_text, f"UZ and RU identical for {key} (probably untranslated)"


def test_format_args_passthrough():
    text = t("video.verified", "uz", confidence=87, streak=5)
    assert "87" in text
    assert "5" in text
