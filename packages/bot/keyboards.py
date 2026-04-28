"""Inline и Reply клавиатуры."""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from i18n import Lang, t


def language_picker() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=t("start.lang_uz", "uz"), callback_data="lang:uz"),
        InlineKeyboardButton(text=t("start.lang_ru", "ru"), callback_data="lang:ru"),
    ]])


def main_menu(lang: Lang) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=t("btn.send_video", lang)),
                KeyboardButton(text=t("btn.my_progress", lang)),
            ],
            [
                KeyboardButton(text=t("btn.report_side_effect", lang)),
                KeyboardButton(text=t("btn.contact_doctor", lang)),
            ],
            [KeyboardButton(text=t("btn.help", lang))],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


def drug_picker(lang: Lang, selected: list[str]) -> InlineKeyboardMarkup:
    drugs = [
        ("rifampicin", "register.drug_rifampicin"),
        ("isoniazid", "register.drug_isoniazid"),
        ("pyrazinamide", "register.drug_pyrazinamide"),
        ("ethambutol", "register.drug_ethambutol"),
        ("combo_fdc", "register.drug_combo"),
    ]
    rows = []
    for code, key in drugs:
        prefix = "✅ " if code in selected else "⬜ "
        rows.append([
            InlineKeyboardButton(text=prefix + t(key, lang), callback_data=f"drug:{code}")
        ])
    rows.append([
        InlineKeyboardButton(text=t("register.drug_done", lang), callback_data="drug:done")
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def phone_request(lang: Lang) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(
            text=("📱 Raqamni ulashish" if lang == "uz" else "📱 Поделиться номером"),
            request_contact=True,
        )]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
