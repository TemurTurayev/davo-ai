"""
Davo-AI · Uzbek Pitch Deck PDF Generator
=========================================

Генерирует презентацию на узбекском языке (9 слайдов, 16:9) для жюри.
Контент основан на docs/PITCH_UZ.md.

Использование:
    python scripts/generate_pitch_uz.py --output assets/pitch/davo-ai-pitch-uz.pdf

Зависимости:
    pip install reportlab matplotlib
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import matplotlib
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ─── Шрифты ─────────────────────────────────────────────────────────────────
MPL_FONTS = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data/fonts/ttf")
pdfmetrics.registerFont(TTFont("DV", os.path.join(MPL_FONTS, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DV-B", os.path.join(MPL_FONTS, "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("DV-I", os.path.join(MPL_FONTS, "DejaVuSans-Oblique.ttf")))
pdfmetrics.registerFont(TTFont("DV-BI", os.path.join(MPL_FONTS, "DejaVuSans-BoldOblique.ttf")))
registerFontFamily("DV", normal="DV", bold="DV-B", italic="DV-I", boldItalic="DV-BI")

# ─── 16:9 Slide size ────────────────────────────────────────────────────────
SLIDE_W = 33.87 * cm  # 13.33 in
SLIDE_H = 19.05 * cm  # 7.5 in

# ─── Цветовая палитра ───────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#1e40af")
PRIMARY_DARK = colors.HexColor("#1e3a8a")
ACCENT = colors.HexColor("#059669")
WARN = colors.HexColor("#d97706")
DANGER = colors.HexColor("#dc2626")
TEXT = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
BG = colors.HexColor("#f8fafc")
LIGHT = colors.HexColor("#e2e8f0")
WHITE = colors.white
BLACK = colors.HexColor("#020617")

# ─── Layout helpers ─────────────────────────────────────────────────────────
M_LEFT = 1.5 * cm
M_RIGHT = 1.5 * cm
M_TOP = 1.5 * cm
M_BOTTOM = 1.2 * cm
CONTENT_W = SLIDE_W - M_LEFT - M_RIGHT


def slide_frame(
    c: canvas.Canvas, slide_num: int, total: int, color_strip: colors.Color = PRIMARY
) -> None:
    """Рамка слайда: цветная полоска слева + футер."""
    # Цветная полоска слева (8mm)
    c.setFillColor(color_strip)
    c.rect(0, 0, 0.8 * cm, SLIDE_H, fill=1, stroke=0)

    # Футер
    c.setFillColor(MUTED)
    c.setFont("DV", 7)
    c.drawString(M_LEFT, 0.5 * cm, "Davo-AI · MindTech · AI HEALTH Hackathon 2026")
    c.drawRightString(SLIDE_W - M_RIGHT, 0.5 * cm, f"{slide_num} / {total}")


def header(
    c: canvas.Canvas, title: str, eyebrow: str | None = None, color: colors.Color = PRIMARY
) -> float:
    """Шапка слайда, возвращает Y-координату конца."""
    y = SLIDE_H - M_TOP
    if eyebrow:
        c.setFillColor(MUTED)
        c.setFont("DV-B", 9)
        c.drawString(M_LEFT, y, eyebrow.upper())
        y -= 0.5 * cm

    c.setFillColor(color)
    c.setFont("DV-B", 22)
    c.drawString(M_LEFT, y - 0.4 * cm, title)

    # Подчёркивание
    c.setStrokeColor(color)
    c.setLineWidth(2)
    c.line(M_LEFT, y - 0.7 * cm, M_LEFT + 4 * cm, y - 0.7 * cm)

    return y - 1.4 * cm


def callout_box(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: str,
    color: colors.Color = PRIMARY,
    text_color: colors.Color = WHITE,
) -> None:
    c.setFillColor(color)
    c.roundRect(x, y - h, w, h, 0.3 * cm, fill=1, stroke=0)

    c.setFillColor(text_color)
    c.setFont("DV-B", 11)
    c.drawString(x + 0.5 * cm, y - 0.7 * cm, title)

    c.setFont("DV", 9)
    text_y = y - 1.2 * cm
    for line in body.split("\n"):
        c.drawString(x + 0.5 * cm, text_y, line)
        text_y -= 0.4 * cm


def stat_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    big_value: str,
    label: str,
    color: colors.Color = PRIMARY,
) -> None:
    c.setFillColor(WHITE)
    c.roundRect(x, y - h, w, h, 0.2 * cm, fill=1, stroke=0)
    c.setStrokeColor(LIGHT)
    c.setLineWidth(0.8)
    c.roundRect(x, y - h, w, h, 0.2 * cm, fill=0, stroke=1)

    c.setFillColor(color)
    c.setFont("DV-B", 24)
    c.drawString(x + 0.4 * cm, y - 1.3 * cm, big_value)

    c.setFillColor(MUTED)
    c.setFont("DV", 8)
    # Word wrap
    if len(label) > 22:
        words = label.split()
        line1 = ""
        for w_ in words:
            if len(line1) + len(w_) < 22:
                line1 += w_ + " "
            else:
                break
        line2 = label[len(line1) :]
        c.drawString(x + 0.4 * cm, y - 1.9 * cm, line1.strip())
        c.drawString(x + 0.4 * cm, y - 2.3 * cm, line2.strip())
    else:
        c.drawString(x + 0.4 * cm, y - 1.9 * cm, label)


def bullet_line(
    c: canvas.Canvas, x: float, y: float, text: str, size: int = 11, color: colors.Color = TEXT
) -> None:
    c.setFillColor(color)
    c.setFont("DV", size)
    c.circle(x + 0.1 * cm, y + 0.1 * cm, 0.07 * cm, fill=1, stroke=0)
    c.drawString(x + 0.4 * cm, y, text)


def quote_box(c: canvas.Canvas, x: float, y: float, w: float, text: str, source: str = "") -> None:
    c.setFillColor(BG)
    h = 1.6 * cm if not source else 2.0 * cm
    c.roundRect(x, y - h, w, h, 0.2 * cm, fill=1, stroke=0)
    # Левая цветная полоска
    c.setFillColor(PRIMARY)
    c.rect(x, y - h, 0.15 * cm, h, fill=1, stroke=0)

    c.setFillColor(TEXT)
    c.setFont("DV-I", 10)
    c.drawString(x + 0.4 * cm, y - 0.6 * cm, f"«{text}»")
    if source:
        c.setFillColor(MUTED)
        c.setFont("DV", 8)
        c.drawString(x + 0.4 * cm, y - h + 0.3 * cm, f"— {source}")


# ════════════════════════════════════════════════════════════════════════════
# SLIDES
# ════════════════════════════════════════════════════════════════════════════


def slide_1_cover(c: canvas.Canvas) -> None:
    """Cover — Davo-AI logo + tagline."""
    # Фон
    c.setFillColor(PRIMARY)
    c.rect(0, 0, SLIDE_W, SLIDE_H, fill=1, stroke=0)

    # Decorative circles
    c.setFillColor(PRIMARY_DARK)
    c.circle(SLIDE_W * 0.85, SLIDE_H * 0.85, 4 * cm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#3b82f6"))
    c.circle(SLIDE_W * 0.92, SLIDE_H * 0.15, 3 * cm, fill=1, stroke=0)

    # Logo placeholder (D)
    c.setFillColor(WHITE)
    c.roundRect(M_LEFT, SLIDE_H - 5 * cm, 2.5 * cm, 2.5 * cm, 0.4 * cm, fill=1, stroke=0)
    c.setFillColor(PRIMARY)
    c.setFont("DV-B", 36)
    c.drawCentredString(M_LEFT + 1.25 * cm, SLIDE_H - 4.2 * cm, "D")

    # Заголовок
    c.setFillColor(WHITE)
    c.setFont("DV-B", 56)
    c.drawString(M_LEFT, SLIDE_H - 8.5 * cm, "Davo-AI")

    c.setFont("DV", 18)
    c.drawString(M_LEFT, SLIDE_H - 9.8 * cm, "Sun'iy intellect bilan sil kasalligini davolash")

    # Tagline
    c.setFont("DV-B", 13)
    c.setFillColor(colors.HexColor("#a5b4fc"))
    c.drawString(
        M_LEFT,
        SLIDE_H - 11.5 * cm,
        "DOT → VOT · Telegram · Lokal AI · O'zbekistonda, o'zbek tilida",
    )

    # Команда
    c.setFillColor(WHITE)
    c.setFont("DV", 11)
    c.drawString(M_LEFT, 2.5 * cm, "Команда MindTech")
    c.setFont("DV", 9)
    c.setFillColor(colors.HexColor("#cbd5e1"))
    c.drawString(M_LEFT, 2.0 * cm, "Темур Тураев · Дилшода · Мухаммад · Саида")
    c.drawString(M_LEFT, 1.6 * cm, "AI HEALTH Hackathon 2026 · Central Asian University · Tashkent")


def slide_2_problem(c: canvas.Canvas) -> None:
    slide_frame(c, 2, 9, DANGER)
    y = header(c, "O'zbekiston — silga qarshi eng og'ir jangda", "Muammo")

    # Левая часть: статистика
    stat_card(c, M_LEFT, y, 7 * cm, 3 * cm, "Top 30", "ВОЗ ро'yxatida eng og'ir TB yuki", DANGER)
    stat_card(
        c,
        M_LEFT + 7.5 * cm,
        y,
        7 * cm,
        3 * cm,
        "27%",
        "MDR-TB davolanishni tashlab ketadi (Qoraqalpog'iston)",
        DANGER,
    )
    stat_card(
        c, M_LEFT + 15 * cm, y, 7 * cm, 3 * cm, "300", "случаев на 100K в Qoraqalpog'istonda", WARN
    )

    y -= 4 * cm

    # Цитата
    quote_box(
        c,
        M_LEFT,
        y,
        CONTENT_W,
        "27% MDR-TB пациентов в Қарақалпағстан тинча беради давалашды — ҳар тўртинчи!",
        "Karakalpakstan MDR-TB cohort 2009-2012, n=1190 (PLOS PMC4964095)",
    )

    y -= 3 * cm

    # Bullets
    c.setFillColor(TEXT)
    c.setFont("DV-B", 12)
    c.drawString(M_LEFT, y, "Сабаби:")
    y -= 0.7 * cm
    for line in [
        "Ҳар куни диспансерга бориш — DOT (Directly Observed Therapy)",
        "Даволанишнинг давомийлиги: 6–24 oy",
        "Симптомлар яхшилангач — бемор «соғлом» деб ўйлайди → ташлайди",
        "Бошланғич ёки сезиларсиз ёрдам тизими",
    ]:
        bullet_line(c, M_LEFT, y, line, 11)
        y -= 0.6 * cm


def slide_3_economics(c: canvas.Canvas) -> None:
    slide_frame(c, 3, 9, DANGER)
    y = header(c, "Bir bemor 35× qimmat", "Iqtisod")

    # Big comparison
    c.setFillColor(BG)
    c.roundRect(M_LEFT, y - 6 * cm, CONTENT_W, 6 * cm, 0.3 * cm, fill=1, stroke=0)

    # Левая колонка: DS-TB
    c.setFillColor(ACCENT)
    c.setFont("DV-B", 60)
    c.drawString(M_LEFT + 1.5 * cm, y - 3 * cm, "$50")
    c.setFillColor(MUTED)
    c.setFont("DV", 12)
    c.drawString(M_LEFT + 1.5 * cm, y - 4 * cm, "Oddiy ТБ davolash")
    c.drawString(M_LEFT + 1.5 * cm, y - 4.5 * cm, "(6 oy, ambulator)")

    # Стрелка
    c.setStrokeColor(DANGER)
    c.setLineWidth(3)
    c.line(M_LEFT + 12 * cm, y - 3.5 * cm, M_LEFT + 16 * cm, y - 3.5 * cm)
    c.setFillColor(DANGER)
    p = c.beginPath()
    p.moveTo(M_LEFT + 16 * cm, y - 3.5 * cm)
    p.lineTo(M_LEFT + 15.4 * cm, y - 3.2 * cm)
    p.lineTo(M_LEFT + 15.4 * cm, y - 3.8 * cm)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    c.setFont("DV-B", 11)
    c.drawString(M_LEFT + 12.5 * cm, y - 3.0 * cm, "35× more")

    # Правая колонка: MDR-TB
    c.setFillColor(DANGER)
    c.setFont("DV-B", 60)
    c.drawString(M_LEFT + 17 * cm, y - 3 * cm, "$1,773")
    c.setFillColor(MUTED)
    c.setFont("DV", 12)
    c.drawString(M_LEFT + 17 * cm, y - 4 * cm, "MDR-TB davolash")
    c.drawString(M_LEFT + 17 * cm, y - 4.5 * cm, "(20 oy + 8 oy kasalxona)")

    y -= 6.8 * cm

    # Bullets
    bullets = [
        ("17 000+ yangi holat / yil", DANGER),
        ("243 ta in'ektsiya / MDR-bemor", DANGER),
        ("8 oy kasalxonada → ish, oila yo'qotish", WARN),
    ]
    for text, color in bullets:
        bullet_line(c, M_LEFT, y, text, 11, color)
        y -= 0.6 * cm

    # Source
    c.setFillColor(MUTED)
    c.setFont("DV-I", 8)
    c.drawString(M_LEFT, 1.0 * cm, "Manba: PLOS Global Public Health 2022, ERJ Open Research 2022")


def slide_4_solution(c: canvas.Canvas) -> None:
    slide_frame(c, 4, 9, ACCENT)
    y = header(c, "Davo-AI: DOT o'rniga AI-tasdiqlangan VOT", "Yechim", ACCENT)

    # Flow diagram (boxes)
    boxes = [
        ("Bemor", "Telegram bot", PRIMARY),
        ("15 sek video", "Dori qabuli", WARN),
        ("AI lokal", "Yuz + dori + yutish", ACCENT),
        ("Shifokor", "Faqat shubhali", colors.HexColor("#7c3aed")),
    ]
    box_w = (CONTENT_W - 3 * 0.8 * cm) / 4
    box_h = 3 * cm
    box_y = y - box_h
    for i, (title, sub, color) in enumerate(boxes):
        x = M_LEFT + i * (box_w + 0.8 * cm)
        c.setFillColor(color)
        c.roundRect(x, box_y, box_w, box_h, 0.3 * cm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("DV-B", 13)
        c.drawString(x + 0.4 * cm, box_y + box_h - 1.2 * cm, title)
        c.setFont("DV", 10)
        c.drawString(x + 0.4 * cm, box_y + box_h - 1.8 * cm, sub)

        # Стрелка между боксами
        if i < 3:
            arrow_x = x + box_w
            c.setStrokeColor(MUTED)
            c.setLineWidth(2)
            c.line(arrow_x + 0.05 * cm, box_y + box_h / 2, arrow_x + 0.7 * cm, box_y + box_h / 2)
            p = c.beginPath()
            p.moveTo(arrow_x + 0.7 * cm, box_y + box_h / 2)
            p.lineTo(arrow_x + 0.5 * cm, box_y + box_h / 2 + 0.15 * cm)
            p.lineTo(arrow_x + 0.5 * cm, box_y + box_h / 2 - 0.15 * cm)
            p.close()
            c.setFillColor(MUTED)
            c.drawPath(p, fill=1, stroke=0)

    y = box_y - 1 * cm

    # Научная база (зелёная callout)
    c.setFillColor(colors.HexColor("#d1fae5"))
    c.roundRect(M_LEFT, y - 4 * cm, CONTENT_W, 4 * cm, 0.3 * cm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.setFont("DV-B", 14)
    c.drawString(M_LEFT + 0.6 * cm, y - 0.8 * cm, "Ilmiy asos")

    c.setFillColor(TEXT)
    c.setFont("DV-B", 28)
    c.drawString(M_LEFT + 0.6 * cm, y - 2.2 * cm, "VOT 2.79× ≫ DOT")
    c.setFont("DV", 11)
    c.drawString(M_LEFT + 0.6 * cm, y - 3 * cm, "Adherence relative risk = 2.79 (95% CI 2.26–3.45)")
    c.setFont("DV-I", 9)
    c.setFillColor(MUTED)
    c.drawString(
        M_LEFT + 0.6 * cm,
        y - 3.5 * cm,
        "Cureus systematic review 2024 · CDC признал VDOT эквивалентом DOT в 2023",
    )


def slide_5_ai_architecture(c: canvas.Canvas) -> None:
    """KEY SLIDE — local AI на RTX 5090 (vast.ai)."""
    slide_frame(c, 5, 9, PRIMARY)
    y = header(
        c, "Lokal AI · O'zbekistonda · O'zbek tilida", "Texnologiya · Ключевой слайд", PRIMARY
    )

    # Big RTX 5090 (vast.ai) callout
    c.setFillColor(BLACK)
    c.roundRect(M_LEFT, y - 3 * cm, CONTENT_W, 3 * cm, 0.3 * cm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#76b900"))  # NVIDIA green
    c.setFont("DV-B", 22)
    c.drawString(M_LEFT + 0.6 * cm, y - 1.4 * cm, "NVIDIA RTX 5090")
    c.setFillColor(WHITE)
    c.setFont("DV", 11)
    c.drawString(
        M_LEFT + 0.6 * cm,
        y - 2.2 * cm,
        "GB10 Grace Blackwell · 128 GB unified memory · 1 PFLOP FP4",
    )
    c.setFont("DV", 10)
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.drawString(
        M_LEFT + 0.6 * cm, y - 2.7 * cm, "Hech qanday ma'lumot O'zbekistondan chiqib ketmaydi"
    )

    y -= 3.5 * cm

    # 4 AI modules
    modules = [
        ("YOLOv8", "ТБ-tabletkalari", "RHZE detection", colors.HexColor("#0ea5e9")),
        ("Qwen2.5-VL", "Vision verifier", "Yuz + yutish", colors.HexColor("#7c3aed")),
        ("Aya 32B", "LLM (Cohere)", "O'zbek qo'llab-quvvatlash", ACCENT),
        ("Whisper L-v3", "Speech-to-text", "O'zbek + русский", WARN),
    ]
    mw = (CONTENT_W - 3 * 0.5 * cm) / 4
    mh = 3 * cm
    for i, (model, role, sub, color) in enumerate(modules):
        x = M_LEFT + i * (mw + 0.5 * cm)
        c.setFillColor(WHITE)
        c.setStrokeColor(color)
        c.setLineWidth(1.5)
        c.roundRect(x, y - mh, mw, mh, 0.2 * cm, fill=1, stroke=1)
        c.setFillColor(color)
        c.setFont("DV-B", 13)
        c.drawString(x + 0.4 * cm, y - 0.9 * cm, model)
        c.setFillColor(TEXT)
        c.setFont("DV-B", 10)
        c.drawString(x + 0.4 * cm, y - 1.5 * cm, role)
        c.setFont("DV", 9)
        c.setFillColor(MUTED)
        c.drawString(x + 0.4 * cm, y - 2.3 * cm, sub)

    y -= mh + 0.7 * cm

    # Regulatory advantage
    c.setFillColor(colors.HexColor("#fef3c7"))
    c.roundRect(M_LEFT, y - 1.6 * cm, CONTENT_W, 1.6 * cm, 0.2 * cm, fill=1, stroke=0)
    c.setFillColor(WARN)
    c.setFont("DV-B", 11)
    c.drawString(M_LEFT + 0.4 * cm, y - 0.6 * cm, "ZRU-547 muvofiqlik · 2021 lokalizatsiya talabi")
    c.setFillColor(TEXT)
    c.setFont("DV", 9)
    c.drawString(
        M_LEFT + 0.4 * cm,
        y - 1.2 * cm,
        "Hech bir raqobatchi (99DOTS · Scene · AICure · MSF) bu talabni qondirmaydi — biz qondiramiz",
    )


def slide_6_demo(c: canvas.Canvas) -> None:
    slide_frame(c, 6, 9, PRIMARY)
    y = header(c, "Demo · Real flow", "Foydalanuvchi sayohati")

    # Timeline
    steps = [
        ("1", "Ro'yxat", "Telegram → ism, fotosurat", "10 sek"),
        ("2", "Eslatma", "08:00 — bot xabar yuboradi", "auto"),
        ("3", "Video", "15 sek qabul qilish", "≤30 sek"),
        ("4", "AI tekshiradi", "yuz · dori · yutish", "5 sek"),
        ("5", "✓ Tasdiq", "+1 streak, motivatsiya", "instant"),
        ("6", "Yon ta'sir", "ovoz/matn → AI maslahat", "10 sek"),
        ("7", "Shifokor", "dashboard · faqat shubhali", "real-time"),
    ]

    step_h = 1.1 * cm
    for i, (num, title, desc, time) in enumerate(steps):
        sy = y - i * (step_h + 0.2 * cm)
        # Timeline circle
        c.setFillColor(PRIMARY)
        c.circle(M_LEFT + 0.5 * cm, sy - 0.5 * cm, 0.4 * cm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("DV-B", 12)
        c.drawCentredString(M_LEFT + 0.5 * cm, sy - 0.7 * cm, num)

        # Text
        c.setFillColor(TEXT)
        c.setFont("DV-B", 12)
        c.drawString(M_LEFT + 1.4 * cm, sy - 0.3 * cm, title)
        c.setFont("DV", 10)
        c.setFillColor(MUTED)
        c.drawString(M_LEFT + 1.4 * cm, sy - 0.8 * cm, desc)

        # Time badge
        c.setFillColor(BG)
        c.roundRect(
            SLIDE_W - M_RIGHT - 2.5 * cm,
            sy - 0.9 * cm,
            2.2 * cm,
            0.7 * cm,
            0.15 * cm,
            fill=1,
            stroke=0,
        )
        c.setFillColor(MUTED)
        c.setFont("DV-B", 9)
        c.drawCentredString(SLIDE_W - M_RIGHT - 1.4 * cm, sy - 0.6 * cm, time)


def slide_7_market(c: canvas.Canvas) -> None:
    slide_frame(c, 7, 9, ACCENT)
    y = header(c, "Bozor & Monetizatsiya", "Biznes-model", ACCENT)

    # 3 stat cards
    stat_card(c, M_LEFT, y, 9.5 * cm, 3 * cm, "$1.4M", "TB Узбекистан TAM (yillik)", PRIMARY)
    stat_card(
        c, M_LEFT + 10 * cm, y, 9.5 * cm, 3 * cm, "$300M+", "Multi-disease TAM (CIS, 5 yil)", ACCENT
    )
    stat_card(c, M_LEFT + 20 * cm, y, 7 * cm, 3 * cm, "3:1", "LTV/CAC ratio", WARN)

    y -= 4 * cm

    # Revenue model
    c.setFillColor(TEXT)
    c.setFont("DV-B", 14)
    c.drawString(M_LEFT, y, "Daromad оқимлари")
    y -= 0.8 * cm

    rows = [
        ("B2B Klinika SaaS", "$5–10 / bemor / oy", "100 bemor × 50 klinika = $35K MRR"),
        ("B2G TB Programma", "Республика TB Маркази", "Xarid.uz orqali · upside"),
        ("B2B Pharma", "Adherence ma'lumotlari", "Klinik tadqiqotlar uchun"),
    ]
    for title, price, calc in rows:
        c.setFillColor(WHITE)
        c.setStrokeColor(LIGHT)
        c.setLineWidth(0.8)
        c.roundRect(M_LEFT, y - 1.4 * cm, CONTENT_W, 1.4 * cm, 0.15 * cm, fill=1, stroke=1)

        c.setFillColor(TEXT)
        c.setFont("DV-B", 12)
        c.drawString(M_LEFT + 0.5 * cm, y - 0.6 * cm, title)
        c.setFillColor(ACCENT)
        c.setFont("DV-B", 11)
        c.drawString(M_LEFT + 8 * cm, y - 0.6 * cm, price)
        c.setFillColor(MUTED)
        c.setFont("DV", 10)
        c.drawString(M_LEFT + 0.5 * cm, y - 1.1 * cm, calc)
        y -= 1.6 * cm

    # Roadmap
    c.setFillColor(MUTED)
    c.setFont("DV-I", 9)
    c.drawString(
        M_LEFT, 1.1 * cm, "Roadmap: TB → diabet (1.2M bemor UZ) → gipertoniya (3M) → pediatric"
    )


def slide_8_competitors(c: canvas.Canvas) -> None:
    slide_frame(c, 8, 9, PRIMARY)
    y = header(c, "Raqobatchilar — biz farq qilamiz", "Pozitsionalashtirish")

    # Comparison table
    rows = [
        ("", "AI tasdiq", "Telegram", "O'zbekcha", "Lokal AI", "Public TB"),
        ("99DOTS", "✗", "✗", "✗", "✗", "✓"),
        ("Scene Health", "✗", "✗", "✗", "✗", "✓"),
        ("AICure", "✓", "✗", "✗", "✗", "✗ (pharma)"),
        ("MSF VDOT (UZ)", "✗ (sync)", "✗", "via medsestra", "✗", "✓"),
        ("Davo-AI", "✓", "✓", "✓", "✓", "✓"),
    ]

    cell_w = [4.5 * cm, 3.4 * cm, 3.4 * cm, 3.4 * cm, 3.4 * cm, 4.0 * cm]
    cell_h = 1.1 * cm
    table_y = y

    for ri, row in enumerate(rows):
        x = M_LEFT
        is_header = ri == 0
        is_us = ri == len(rows) - 1
        for ci, val in enumerate(row):
            # Background
            if is_header:
                c.setFillColor(PRIMARY)
            elif is_us:
                c.setFillColor(ACCENT)
            else:
                c.setFillColor(WHITE if ri % 2 else BG)
            c.rect(x, table_y - cell_h, cell_w[ci], cell_h, fill=1, stroke=0)
            # Border
            c.setStrokeColor(LIGHT)
            c.setLineWidth(0.4)
            c.rect(x, table_y - cell_h, cell_w[ci], cell_h, fill=0, stroke=1)
            # Text
            if is_header or is_us:
                c.setFillColor(WHITE)
                c.setFont("DV-B", 11)
            elif ci == 0:
                c.setFillColor(TEXT)
                c.setFont("DV-B", 11)
            else:
                c.setFillColor(TEXT)
                c.setFont("DV", 11)
            c.drawString(x + 0.3 * cm, table_y - 0.7 * cm, val)
            x += cell_w[ci]
        table_y -= cell_h

    # Killer fact
    table_y -= 0.5 * cm
    c.setFillColor(colors.HexColor("#fef3c7"))
    c.roundRect(M_LEFT, table_y - 2 * cm, CONTENT_W, 2 * cm, 0.2 * cm, fill=1, stroke=0)
    c.setFillColor(DANGER)
    c.setFont("DV-B", 13)
    c.drawString(
        M_LEFT + 0.5 * cm,
        table_y - 0.7 * cm,
        "99DOTS qo'ng'iroqni ko'rsatadi · Davo-AI yutishni ko'radi",
    )
    c.setFillColor(TEXT)
    c.setFont("DV", 10)
    c.drawString(
        M_LEFT + 0.5 * cm,
        table_y - 1.4 * cm,
        "99DOTS пропускает 40–60% non-adherent (Oxford CID 2020, urine isoniazid validation)",
    )


def slide_9_team_close(c: canvas.Canvas) -> None:
    slide_frame(c, 9, 9, PRIMARY)
    y = header(c, "Команда + Roadmap + Sizning ovozingiz", "Yakun")

    # Team
    members = [
        ("Темур Тураев", "Tibbiy Lider", "TashPMI 5-курс · Pediatr"),
        ("Дилшода", "AI / ML", "Computer Vision · LLM"),
        ("Мухаммад", "Backend", "Python · Telegram · Postgres"),
        ("Саида", "Presenter", "Data Science · UX"),
    ]
    mw = (CONTENT_W - 3 * 0.4 * cm) / 4
    mh = 3 * cm
    for i, (name, role, sub) in enumerate(members):
        x = M_LEFT + i * (mw + 0.4 * cm)
        c.setFillColor(WHITE)
        c.setStrokeColor(LIGHT)
        c.setLineWidth(0.8)
        c.roundRect(x, y - mh, mw, mh, 0.2 * cm, fill=1, stroke=1)

        # Avatar circle
        c.setFillColor(PRIMARY)
        c.circle(x + mw / 2, y - 1 * cm, 0.55 * cm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("DV-B", 14)
        c.drawCentredString(x + mw / 2, y - 1.15 * cm, name[0])

        c.setFillColor(TEXT)
        c.setFont("DV-B", 11)
        c.drawCentredString(x + mw / 2, y - 1.9 * cm, name)
        c.setFont("DV-B", 9)
        c.setFillColor(PRIMARY)
        c.drawCentredString(x + mw / 2, y - 2.3 * cm, role)
        c.setFont("DV", 8)
        c.setFillColor(MUTED)
        c.drawCentredString(x + mw / 2, y - 2.7 * cm, sub)

    y -= mh + 0.5 * cm

    # Roadmap
    c.setFillColor(TEXT)
    c.setFont("DV-B", 13)
    c.drawString(M_LEFT, y, "Roadmap")
    y -= 0.6 * cm
    timeline = [
        ("Q3 2026", "ТБ MVP пилот · Toshkent", PRIMARY),
        ("Q4 2026", "Qoraqalpog'iston regional rollout", PRIMARY),
        ("2027", "Pediatric module · 80K bola бенефит", ACCENT),
        ("2027–28", "Diabet, gipertoniya · multi-disease", ACCENT),
    ]
    for year, desc, color in timeline:
        c.setFillColor(color)
        c.setFont("DV-B", 11)
        c.drawString(M_LEFT, y, year)
        c.setFillColor(TEXT)
        c.setFont("DV", 11)
        c.drawString(M_LEFT + 3 * cm, y, desc)
        y -= 0.5 * cm

    y -= 0.3 * cm

    # Closing CTA
    c.setFillColor(PRIMARY)
    c.roundRect(M_LEFT, y - 2.5 * cm, CONTENT_W, 2.5 * cm, 0.3 * cm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("DV-B", 18)
    c.drawString(M_LEFT + 0.6 * cm, y - 1.0 * cm, "Bizga investitsiya emas — birinchi pilot kerak.")
    c.setFont("DV", 12)
    c.drawString(M_LEFT + 0.6 * cm, y - 1.7 * cm, "Republika ТБ-Маркази bilan suhbat boshlandi.")
    c.setFont("DV-B", 13)
    c.setFillColor(colors.HexColor("#fef3c7"))
    c.drawString(M_LEFT + 0.6 * cm, y - 2.3 * cm, "Keyingi qadam — sizning ovozingiz · Rahmat!")


# ════════════════════════════════════════════════════════════════════════════


def build_pitch(output_path: Path) -> None:
    c = canvas.Canvas(
        str(output_path),
        pagesize=(SLIDE_W, SLIDE_H),
    )
    c.setTitle("Davo-AI · Pitch · MindTech")
    c.setAuthor("Темур Тураев")
    c.setSubject("AI HEALTH Hackathon 2026 · Davo-AI · 5 min pitch in Uzbek")

    slides = [
        slide_1_cover,
        slide_2_problem,
        slide_3_economics,
        slide_4_solution,
        slide_5_ai_architecture,
        slide_6_demo,
        slide_7_market,
        slide_8_competitors,
        slide_9_team_close,
    ]

    for slide_fn in slides:
        slide_fn(c)
        c.showPage()

    c.save()
    print(f"✓ Pitch deck создан: {output_path}")
    print(f"   Size: {output_path.stat().st_size / 1024:.0f} KB")
    print(f"   Slides: {len(slides)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/pitch/davo-ai-pitch-uz.pdf"),
    )
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    build_pitch(args.output)


if __name__ == "__main__":
    main()
