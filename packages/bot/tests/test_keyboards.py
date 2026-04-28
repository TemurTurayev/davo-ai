"""Keyboards tests."""

from __future__ import annotations

from aiogram.types import InlineKeyboardMarkup, ReplyKeyboardMarkup
from keyboards import drug_picker, language_picker, main_menu, phone_request


def test_language_picker_has_two_options():
    kb = language_picker()
    assert isinstance(kb, InlineKeyboardMarkup)
    buttons = kb.inline_keyboard[0]
    callbacks = {b.callback_data for b in buttons}
    assert callbacks == {"lang:uz", "lang:ru"}


def test_main_menu_uz_has_5_buttons():
    kb = main_menu("uz")
    assert isinstance(kb, ReplyKeyboardMarkup)
    # 3 ряда: 2 + 2 + 1 = 5 кнопок
    total = sum(len(row) for row in kb.keyboard)
    assert total == 5


def test_main_menu_ru_has_5_buttons():
    kb = main_menu("ru")
    total = sum(len(row) for row in kb.keyboard)
    assert total == 5


def test_drug_picker_marks_selected():
    kb = drug_picker("uz", ["rifampicin", "isoniazid"])
    flat = [b.text for row in kb.inline_keyboard for b in row]
    rifampicin_btn = next(t for t in flat if "Rifampitsin" in t)
    pza_btn = next(t for t in flat if "Pirazinamid" in t)
    assert rifampicin_btn.startswith("✅")
    assert pza_btn.startswith("⬜")


def test_drug_picker_done_callback():
    kb = drug_picker("uz", [])
    callbacks = [b.callback_data for row in kb.inline_keyboard for b in row]
    assert "drug:done" in callbacks


def test_phone_request_uz():
    kb = phone_request("uz")
    btn = kb.keyboard[0][0]
    assert btn.request_contact is True
    assert "Raqamni" in btn.text


def test_phone_request_ru():
    kb = phone_request("ru")
    btn = kb.keyboard[0][0]
    assert btn.request_contact is True
    assert "номером" in btn.text
