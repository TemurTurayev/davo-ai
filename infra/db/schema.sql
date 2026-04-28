-- ════════════════════════════════════════════════════════════════════════
--  Davo-AI · Database Schema (PostgreSQL 15+)
--  Команда: MindTech · AI HEALTH Hackathon 2026
-- ════════════════════════════════════════════════════════════════════════
-- Принципы:
--   • Минимум PII в логах
--   • UUID primary keys
--   • Soft-delete через deleted_at
--   • Все timestamps с TZ
--   • RLS будет добавлен отдельной миграцией (если используем Supabase)
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────────────────
CREATE TYPE language_code AS ENUM ('uz', 'ru', 'kk', 'en');
CREATE TYPE drug_code AS ENUM (
    'rifampicin',
    'isoniazid',
    'pyrazinamide',
    'ethambutol',
    'combo_fdc',
    'moxifloxacin',
    'bedaquiline',
    'linezolid'
);
CREATE TYPE verification_status AS ENUM (
    'pending',          -- ожидает обработки AI
    'verified',         -- AI подтвердил
    'unverified',       -- AI отклонил
    'review_required',  -- AI неуверен — врач смотрит
    'doctor_approved',  -- врач подтвердил
    'doctor_rejected'   -- врач отклонил
);
CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'emergency');
CREATE TYPE event_type AS ENUM (
    'registered',
    'reminder_sent',
    'video_received',
    'video_verified',
    'video_rejected',
    'side_effect_reported',
    'doctor_message',
    'streak_milestone',
    'drop_off_alert'
);

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Patients (пациенты)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,

    -- PII (encrypted в продакшне)
    full_name VARCHAR(200) NOT NULL,
    birth_year SMALLINT NOT NULL CHECK (birth_year BETWEEN 1900 AND 2030),
    phone VARCHAR(30),

    -- Локализация
    language language_code NOT NULL DEFAULT 'uz',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Tashkent',

    -- Лечение
    treatment_started_at DATE,
    drugs drug_code[] NOT NULL DEFAULT '{}',
    reminder_time TIME NOT NULL DEFAULT '08:00',

    -- Лицо для face match
    enrolled_face_path TEXT,        -- путь к файлу или URL
    enrolled_face_at TIMESTAMPTZ,

    -- Привязка к врачу
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,

    -- Метаданные
    consent_cross_border BOOLEAN NOT NULL DEFAULT FALSE,
    consent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_patients_telegram_id ON patients(telegram_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_doctor ON patients(doctor_id) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Doctors (врачи)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(100) UNIQUE,        -- Clerk auth
    email VARCHAR(200) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(30),
    speciality VARCHAR(100),                  -- "phthisiologist", "general"
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    languages language_code[] NOT NULL DEFAULT '{uz,ru}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_clinic ON doctors(clinic_id) WHERE is_active;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Clinics (клиники / диспансеры)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    region VARCHAR(100),                      -- "Tashkent", "Karakalpakstan"
    address TEXT,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Doses (запланированные дозы — генерируются на каждый день)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE doses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    expected_drugs drug_code[] NOT NULL,
    status verification_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, scheduled_for)
);

CREATE INDEX idx_doses_patient_date ON doses(patient_id, scheduled_for DESC);
CREATE INDEX idx_doses_pending ON doses(status, scheduled_for) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Intake videos (видео приёма)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE intake_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dose_id UUID REFERENCES doses(id) ON DELETE SET NULL,

    file_path TEXT NOT NULL,                  -- локальный путь или URL
    file_size_bytes BIGINT,
    duration_seconds NUMERIC(5,2),
    mime_type VARCHAR(50) DEFAULT 'video/mp4',

    -- AI verification result
    status verification_status NOT NULL DEFAULT 'pending',
    overall_confidence NUMERIC(4,3),
    face_match BOOLEAN,
    face_match_confidence NUMERIC(4,3),
    pill_visible BOOLEAN,
    pill_drugs_detected drug_code[],
    pill_confidence NUMERIC(4,3),
    swallow_detected BOOLEAN,
    swallow_confidence NUMERIC(4,3),

    -- Сырые findings от AI (JSON для аудита)
    raw_ai_findings JSONB,

    -- Если ушло на review
    reviewed_by UUID REFERENCES doctors(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    doctor_notes TEXT,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_videos_patient ON intake_videos(patient_id, received_at DESC);
CREATE INDEX idx_videos_review_queue ON intake_videos(received_at)
    WHERE status = 'review_required' AND reviewed_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Side effect reports
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE side_effects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    raw_text TEXT NOT NULL,                   -- что написал/сказал пациент
    raw_voice_path TEXT,                      -- путь к голосовому, если был
    transcription_language language_code,

    -- AI triage
    severity severity_level NOT NULL DEFAULT 'low',
    is_expected BOOLEAN,                      -- ожидаемая ли побочка
    advice_uz TEXT,
    advice_ru TEXT,
    escalated_to_doctor BOOLEAN NOT NULL DEFAULT FALSE,

    -- Связь с препаратами
    related_drugs drug_code[],

    -- Reviewed by doctor
    reviewed_by UUID REFERENCES doctors(id),
    reviewed_at TIMESTAMPTZ,
    doctor_response TEXT,

    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_side_effects_patient ON side_effects(patient_id, reported_at DESC);
CREATE INDEX idx_side_effects_urgent ON side_effects(severity, reported_at DESC)
    WHERE severity IN ('high', 'emergency');

-- ═══════════════════════════════════════════════════════════════════════
-- 7. Reminders log (для отладки и анализа)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE reminder_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dose_id UUID REFERENCES doses(id) ON DELETE CASCADE,

    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_status VARCHAR(50),              -- 'sent','delivered','read','failed'
    response_received_at TIMESTAMPTZ,
    response_seconds NUMERIC,                 -- латентность реакции
    retry_count SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_reminders_patient ON reminder_log(patient_id, sent_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Adherence metrics (агрегированные показатели)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE adherence_metrics (
    patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,

    total_doses_scheduled INTEGER NOT NULL DEFAULT 0,
    total_doses_verified INTEGER NOT NULL DEFAULT 0,
    total_doses_missed INTEGER NOT NULL DEFAULT 0,

    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_verified_at TIMESTAMPTZ,

    adherence_rate NUMERIC(4,3),              -- 0..1
    drop_off_risk_score NUMERIC(4,3),         -- 0..1, predicted by ML/rules

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 9. Events log (audit trail)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    event_type event_type NOT NULL,
    payload JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_patient ON events(patient_id, occurred_at DESC);
CREATE INDEX idx_events_type ON events(event_type, occurred_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Helper: триггер для updated_at
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER adherence_updated_at BEFORE UPDATE ON adherence_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- Seed data (для демо)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO clinics (id, name, region, phone) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Республиканский ТБ-центр', 'Tashkent', '+998711234567'),
    ('22222222-2222-2222-2222-222222222222', 'Каракалпакский ТБ-диспансер', 'Karakalpakstan', '+99861220XXXX'),
    ('33333333-3333-3333-3333-333333333333', 'Демо-клиника MindTech', 'Tashkent', '+998901234567')
ON CONFLICT DO NOTHING;
