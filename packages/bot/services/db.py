"""Async SQLAlchemy ORM-слой для Davo-AI."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Optional

from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import settings


class Base(DeclarativeBase):
    pass


# ─── Models ─────────────────────────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)

    full_name: Mapped[str] = mapped_column(String(200))
    birth_year: Mapped[int] = mapped_column(SmallInteger)
    phone: Mapped[Optional[str]] = mapped_column(String(30))

    language: Mapped[str] = mapped_column(String(2), default="uz")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Tashkent")

    treatment_started_at: Mapped[Optional[dt.date]] = mapped_column(Date)
    drugs: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    reminder_time: Mapped[dt.time] = mapped_column(Time, default=dt.time(8, 0))

    enrolled_face_path: Mapped[Optional[str]] = mapped_column(Text)
    enrolled_face_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))

    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    consent_cross_border: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.now)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.now)
    deleted_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))


class IntakeVideo(Base):
    __tablename__ = "intake_videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    dose_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    mime_type: Mapped[str] = mapped_column(String(50), default="video/mp4")

    status: Mapped[str] = mapped_column(String(30), default="pending")
    overall_confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))
    face_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    face_match_confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))
    pill_visible: Mapped[Optional[bool]] = mapped_column(Boolean)
    pill_drugs_detected: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))
    pill_confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))
    swallow_detected: Mapped[Optional[bool]] = mapped_column(Boolean)
    swallow_confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))

    raw_ai_findings: Mapped[Optional[dict]] = mapped_column(JSON)

    received_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.now)
    processed_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))


class SideEffect(Base):
    __tablename__ = "side_effects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))

    raw_text: Mapped[str] = mapped_column(Text)
    raw_voice_path: Mapped[Optional[str]] = mapped_column(Text)
    transcription_language: Mapped[Optional[str]] = mapped_column(String(2))

    severity: Mapped[str] = mapped_column(String(20), default="low")
    is_expected: Mapped[Optional[bool]] = mapped_column(Boolean)
    advice_uz: Mapped[Optional[str]] = mapped_column(Text)
    advice_ru: Mapped[Optional[str]] = mapped_column(Text)
    escalated_to_doctor: Mapped[bool] = mapped_column(Boolean, default=False)

    related_drugs: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))

    reported_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.now)


class AdherenceMetrics(Base):
    __tablename__ = "adherence_metrics"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    total_doses_scheduled: Mapped[int] = mapped_column(Integer, default=0)
    total_doses_verified: Mapped[int] = mapped_column(Integer, default=0)
    total_doses_missed: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_verified_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))
    adherence_rate: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))
    drop_off_risk_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.now)


# ─── Engine + session factory ───────────────────────────────────────────────
engine = create_async_engine(settings.database_url, echo=False, pool_size=10)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# ─── Helpers ────────────────────────────────────────────────────────────────
async def get_patient_by_tg(session: AsyncSession, telegram_id: int) -> Patient | None:
    result = await session.execute(
        select(Patient).where(Patient.telegram_id == telegram_id, Patient.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def upsert_patient(session: AsyncSession, telegram_id: int, **fields) -> Patient:
    """Create or update patient by telegram_id."""
    patient = await get_patient_by_tg(session, telegram_id)
    if patient is None:
        patient = Patient(telegram_id=telegram_id, **fields)
        session.add(patient)
    else:
        for key, value in fields.items():
            setattr(patient, key, value)
    await session.flush()
    return patient


async def update_streak(session: AsyncSession, patient_id: uuid.UUID, verified: bool) -> int:
    """Обновляет streak. Возвращает новый streak."""
    metrics = await session.get(AdherenceMetrics, patient_id)
    if metrics is None:
        metrics = AdherenceMetrics(patient_id=patient_id)
        session.add(metrics)

    if verified:
        metrics.current_streak += 1
        metrics.total_doses_verified += 1
        if metrics.current_streak > metrics.longest_streak:
            metrics.longest_streak = metrics.current_streak
        metrics.last_verified_at = dt.datetime.now(dt.timezone.utc)
    else:
        metrics.current_streak = 0
        metrics.total_doses_missed += 1

    metrics.total_doses_scheduled = metrics.total_doses_verified + metrics.total_doses_missed
    if metrics.total_doses_scheduled > 0:
        metrics.adherence_rate = metrics.total_doses_verified / metrics.total_doses_scheduled

    await session.flush()
    return metrics.current_streak
