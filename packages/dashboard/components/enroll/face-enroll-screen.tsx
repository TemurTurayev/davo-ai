"use client";

/**
 * Face Enrollment — registers a patient's face for AI verification.
 *
 * Two enrollment methods:
 *   1. Webcam: live capture, 5-frame averaging for robust embedding
 *   2. Upload: pick existing photo from device
 *
 * Output: 128-d face descriptor stored in localStorage under patientId.
 * Used by dose flow face_id step (cosine distance < 0.4 = match).
 *
 * face-api.js runs entirely client-side (~12 MB models loaded once,
 * cached by browser thereafter).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera as CameraIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  initFaceApi,
  extractFaceDescriptor,
  saveEnrollment,
  loadEnrollments,
  deleteEnrollment,
  type FaceEnrollment,
} from "@/lib/face-api-loader";
import { useTBControlStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Mode = "select" | "webcam" | "upload" | "success";

export function FaceEnrollScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const { prescription } = useTBControlStore();
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // Default patientId = current prescription patient, or "demo-patient-1"
  const patientId = prescription?.patientId || "demo-patient-1";
  const patientName = prescription?.patientName || t("Demo bemor", "Демо-пациент", "Demo patient");

  const [mode, setMode] = useState<Mode>("select");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [enrolled, setEnrolled] = useState<Record<string, FaceEnrollment>>({});

  // Load existing enrollments + init face-api
  useEffect(() => {
    setEnrolled(loadEnrollments());
    initFaceApi().then(() => {
      setModelsLoaded(true);
      setModelLoadProgress(100);
    });
    // Fake progressive loading bar
    const interval = setInterval(() => {
      setModelLoadProgress((p) => (p < 90 ? p + 8 : p));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="bg-aurora min-h-screen relative overflow-hidden pb-12">
      <div className="orb orb-brand w-72 h-72 -top-20 -right-20 animate-float-slow" />

      <div className="relative z-10 max-w-md mx-auto px-5 pt-6 pb-6">
        <header className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-extrabold text-2xl">
              {t("Yuzni ro'yxatdan o'tkazish", "Регистрация лица", "Face enrollment")}
            </h1>
            <p className="text-xs text-[var(--color-slate-500)]">
              {patientName} · {patientId}
            </p>
          </div>
        </header>

        {!modelsLoaded ? (
          <ModelsLoader progress={modelLoadProgress} t={t} />
        ) : (
          <AnimatePresence mode="wait">
            {mode === "select" && (
              <motion.section
                key="select"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {enrolled[patientId] && (
                  <GlassCard variant="brand" className="p-4 mb-4 text-white flex items-center gap-3">
                    <CheckCircle2 size={28} />
                    <div className="flex-1">
                      <p className="font-bold text-sm">
                        {t("Allaqachon ro'yxatdan o'tgan", "Уже зарегистрировано", "Already enrolled")}
                      </p>
                      <p className="text-xs opacity-90">
                        {new Date(enrolled[patientId].enrolledAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        deleteEnrollment(patientId);
                        setEnrolled(loadEnrollments());
                      }}
                      className="px-2 py-1 rounded text-[10px] bg-white/20 hover:bg-white/30"
                    >
                      <RefreshCw size={12} className="inline mr-1" />
                      {t("Qayta", "Заново", "Re-enroll")}
                    </button>
                  </GlassCard>
                )}

                <p className="text-sm text-[var(--color-slate-600)] mb-4 leading-relaxed">
                  {t(
                    "Tanlang: kameradan suratga olish yoki mavjud rasmni yuklash. AI yuzdan 128 o'lchovli vektor hisoblaydi va xavfsiz saqlaydi.",
                    "Выберите: снять с камеры или загрузить готовое фото. ИИ извлечёт 128-мерный вектор из лица и сохранит безопасно.",
                    "Choose: take from camera or upload existing photo. AI extracts a 128-D embedding and stores it securely.",
                  )}
                </p>

                <button
                  onClick={() => setMode("webcam")}
                  className="w-full mb-3 p-5 rounded-2xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-dark)] text-white shadow-lg active:scale-[0.98] transition flex items-center gap-4 text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center shrink-0">
                    <CameraIcon size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-heading font-bold">{t("Kamera", "Камера", "Camera")}</p>
                    <p className="text-xs opacity-90">
                      {t("Hozirgi kameradan suratga olish", "Снять прямо сейчас", "Capture from webcam now")}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setMode("upload")}
                  className="w-full p-5 rounded-2xl bg-white shadow-md active:scale-[0.98] transition flex items-center gap-4 text-left border border-[var(--color-slate-200)]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center shrink-0">
                    <Upload size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-heading font-bold">
                      {t("Rasmni yuklash", "Загрузить фото", "Upload photo")}
                    </p>
                    <p className="text-xs text-[var(--color-slate-500)]">
                      {t("JPEG/PNG, lm 1 MB", "JPEG/PNG, до 1 МБ", "JPEG/PNG, ≤ 1 MB")}
                    </p>
                  </div>
                </button>
              </motion.section>
            )}

            {mode === "webcam" && (
              <WebcamCapture
                key="webcam"
                patientId={patientId}
                t={t}
                onSuccess={() => {
                  setEnrolled(loadEnrollments());
                  setMode("success");
                }}
                onCancel={() => setMode("select")}
              />
            )}

            {mode === "upload" && (
              <UploadCapture
                key="upload"
                patientId={patientId}
                t={t}
                onSuccess={() => {
                  setEnrolled(loadEnrollments());
                  setMode("success");
                }}
                onCancel={() => setMode("select")}
              />
            )}

            {mode === "success" && (
              <motion.section
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <CheckCircle2 size={72} className="text-[var(--color-success)] mx-auto mb-4" />
                <h2 className="font-heading font-extrabold text-2xl mb-2">
                  {t("Ro'yxatga kiritildi", "Зарегистрировано", "Enrolled")}
                </h2>
                <p className="text-[var(--color-slate-500)] mb-6">
                  {t(
                    "AI endi sizning yuzingizni taniydi.",
                    "ИИ теперь узнает ваше лицо.",
                    "AI now recognizes your face.",
                  )}
                </p>
                <Button onClick={() => router.push(`/${locale}/today`)} block size="lg">
                  {t("Bosh sahifaga", "На главную", "Back to home")}
                </Button>
              </motion.section>
            )}
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}

function ModelsLoader({ progress, t }: { progress: number; t: (uz: string, ru: string, en: string) => string }) {
  return (
    <GlassCard className="p-6 text-center">
      <Loader2 size={36} className="animate-spin mx-auto mb-3 text-[var(--color-brand)]" />
      <p className="font-heading font-bold mb-1">
        {t("AI modellarini yuklash…", "Загрузка AI-моделей…", "Loading AI models…")}
      </p>
      <p className="text-xs text-[var(--color-slate-500)] mb-3 font-mono">
        face-api.js · 12 MB · 3 networks
      </p>
      <div className="h-1.5 bg-[var(--color-mist)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-brand)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </GlassCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Webcam capture
// ────────────────────────────────────────────────────────────────────────────

function WebcamCapture({
  patientId,
  t,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  t: (uz: string, ru: string, en: string) => string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"detecting" | "ready" | "capturing" | "error">("detecting");
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [framesCaptured, setFramesCaptured] = useState(0);
  const FRAMES_NEEDED = 5;

  // Setup camera
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError(t("Kameraga ruxsat berilmagan", "Камера недоступна", "Camera unavailable"));
        setStatus("error");
      }
    })();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [t]);

  // Continuous face detection loop
  useEffect(() => {
    if (status === "capturing" || status === "error") return;
    let cancelled = false;
    const loop = async () => {
      while (!cancelled) {
        const video = videoRef.current;
        if (video && video.videoWidth > 0) {
          const result = await extractFaceDescriptor(video).catch(() => null);
          if (cancelled) break;
          if (result) {
            setFaceBox(result.box);
            setStatus("ready");
          } else {
            setFaceBox(null);
            setStatus("detecting");
          }
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const capture = async () => {
    setStatus("capturing");
    const descriptors: Float32Array[] = [];
    let lastBoxFrame: string | undefined;
    for (let i = 0; i < FRAMES_NEEDED; i++) {
      const video = videoRef.current;
      if (!video) break;
      const r = await extractFaceDescriptor(video);
      if (r) {
        descriptors.push(r.descriptor);
        setFramesCaptured(i + 1);
        // Save preview from middle frame
        if (i === Math.floor(FRAMES_NEEDED / 2) && canvasRef.current) {
          const c = canvasRef.current;
          c.width = video.videoWidth;
          c.height = video.videoHeight;
          c.getContext("2d")?.drawImage(video, 0, 0);
          lastBoxFrame = c.toDataURL("image/jpeg", 0.5);
        }
      }
      await new Promise((res) => setTimeout(res, 200));
    }

    if (descriptors.length < 3) {
      setError(t(
        "Yuz aniq ko'rinmadi — yorug'roq joyga o'ting",
        "Лицо не захвачено чётко — больше света",
        "Face not captured clearly — better lighting",
      ));
      setStatus("error");
      return;
    }

    // Average descriptors for robustness
    const avg = new Float32Array(128);
    for (const d of descriptors) for (let i = 0; i < 128; i++) avg[i] += d[i];
    for (let i = 0; i < 128; i++) avg[i] /= descriptors.length;

    saveEnrollment({
      patientId,
      embedding: Array.from(avg),
      enrolledAt: new Date().toISOString(),
      imagePreviewDataUrl: lastBoxFrame,
    });
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    onSuccess();
  };

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-3 mb-4">
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Face guide circle */}
          <div className="absolute inset-0 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <ellipse
                cx="50"
                cy="46"
                rx="22"
                ry="28"
                fill="none"
                stroke={status === "ready" ? "#10B981" : "rgba(255,255,255,0.5)"}
                strokeWidth="0.7"
                strokeDasharray={status === "ready" ? "0" : "2 2"}
              />
            </svg>
          </div>

          {/* Status overlay */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <div className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold font-mono backdrop-blur flex items-center gap-1.5",
              status === "ready" ? "bg-emerald-500/90 text-white" : "bg-black/60 text-white",
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {status === "ready"
                ? t("Yuz topildi", "Лицо найдено", "Face detected")
                : status === "detecting"
                ? t("Qidirilmoqda…", "Поиск…", "Looking…")
                : status === "capturing"
                ? `${framesCaptured}/${FRAMES_NEEDED}`
                : "Error"}
            </div>
          </div>
        </div>
      </GlassCard>

      <p className="text-sm text-[var(--color-slate-600)] mb-3 px-1 leading-relaxed">
        {t(
          "Yuzingizni doiraga joylashtiring va kameraga qarang. Yorug' joyda turing.",
          "Расположите лицо в овале и смотрите в камеру. Стойте при хорошем свете.",
          "Position your face inside the oval and look at the camera. Use good light.",
        )}
      </p>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onCancel} variant="ghost" className="flex-1">
          {t("Orqaga", "Назад", "Back")}
        </Button>
        <Button
          onClick={capture}
          disabled={status !== "ready"}
          size="lg"
          className="flex-[2]"
        >
          {status === "capturing" ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {framesCaptured}/{FRAMES_NEEDED}
            </>
          ) : (
            <>
              <CameraIcon size={18} />
              {t("Suratga olish", "Сделать снимок", "Capture")}
            </>
          )}
        </Button>
      </div>
    </motion.section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Upload from device
// ────────────────────────────────────────────────────────────────────────────

function UploadCapture({
  patientId,
  t,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  t: (uz: string, ru: string, en: string) => string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setProcessing(true);
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    setPreview(dataUrl);

    // Load into HTMLImageElement
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res) => (img.onload = res));

    const r = await extractFaceDescriptor(img);
    if (!r) {
      setError(t(
        "Rasmda yuz topilmadi. Boshqa rasm tanlang.",
        "На фото не найдено лицо. Выберите другое.",
        "No face found in image. Pick another.",
      ));
      setProcessing(false);
      return;
    }

    saveEnrollment({
      patientId,
      embedding: Array.from(r.descriptor),
      enrolledAt: new Date().toISOString(),
      imagePreviewDataUrl: dataUrl,
    });
    setProcessing(false);
    onSuccess();
  };

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-4 mb-4">
        {!preview ? (
          <label className="block aspect-square rounded-2xl border-2 border-dashed border-[var(--color-slate-300)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]/20 transition flex flex-col items-center justify-center cursor-pointer p-6">
            <Upload size={36} className="text-[var(--color-slate-400)] mb-3" />
            <p className="font-heading font-bold text-sm">
              {t("Rasm tanlang", "Выберите фото", "Choose photo")}
            </p>
            <p className="text-xs text-[var(--color-slate-500)] mt-1 text-center">
              {t("JPEG yoki PNG", "JPEG или PNG", "JPEG or PNG")}
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        ) : (
          <div className="relative aspect-square rounded-2xl overflow-hidden">
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            {processing && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                <Loader2 size={32} className="animate-spin text-white mb-2" />
                <p className="text-white text-sm font-mono">
                  {t("AI analiz qilmoqda…", "ИИ анализирует…", "AI analyzing…")}
                </p>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onCancel} variant="ghost" className="flex-1" disabled={processing}>
          {t("Orqaga", "Назад", "Back")}
        </Button>
        {preview && (
          <Button onClick={() => setPreview(null)} variant="outline" className="flex-1" disabled={processing}>
            <RefreshCw size={16} />
            {t("Boshqa", "Другое", "Other")}
          </Button>
        )}
      </div>
    </motion.section>
  );
}
