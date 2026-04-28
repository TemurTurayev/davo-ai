"use client";

/**
 * Record Screen — 15-second video capture for VOT verification.
 * UX per research:
 * - Hold-to-record OR auto-stop at 15s
 * - Progress ring around button
 * - Preview before send (re-record option)
 * - HapticFeedback on start/stop
 * - Big touch targets (80px+)
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Square, RefreshCw, Send, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNafasStore } from "@/lib/store";
import { getWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const MAX_DURATION_MS = 15_000;
const MIN_DURATION_MS = 5_000;

type Phase = "ready" | "recording" | "preview" | "uploading" | "done";

export function RecordScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("daily");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTsRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { recordDose } = useNafasStore();

  // Request camera on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: true,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
      } catch (e) {
        setError(tErrors("camera_denied"));
      }
    })();
    return () => {
      active = false;
    };
  }, [tErrors]);

  // Attach stream to <video>
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stream, recordedUrl]);

  const startRecording = () => {
    if (!stream) return;
    getWebApp()?.HapticFeedback.impactOccurred("medium");

    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_000_000 });
    recorderRef.current = recorder;

    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setPhase("preview");
      getWebApp()?.HapticFeedback.notificationOccurred("success");
    };

    recorder.start(250);
    setPhase("recording");
    startTsRef.current = Date.now();

    // Progress ring updater
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTsRef.current;
      const p = Math.min(1, elapsed / MAX_DURATION_MS);
      setProgress(p);
      if (elapsed >= MAX_DURATION_MS) {
        stopRecording();
      }
    }, 100);
  };

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    const elapsed = Date.now() - startTsRef.current;
    if (elapsed < MIN_DURATION_MS) {
      // too short — keep going (or warn). For now require min duration to stop.
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current.stop();
    getWebApp()?.HapticFeedback.impactOccurred("light");
  };

  const retake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setProgress(0);
    setPhase("ready");
    getWebApp()?.HapticFeedback.selectionChanged();
  };

  const sendToServer = async () => {
    if (!recordedBlob) return;
    setPhase("uploading");
    getWebApp()?.HapticFeedback.impactOccurred("medium");

    // Mock upload — in real, POST to /api/intake-video → which calls verifier_orchestrator
    // For now we just simulate verification + record success
    await new Promise((r) => setTimeout(r, 2000));

    const today = new Date().toISOString().slice(0, 10);
    recordDose({
      date: today,
      status: "taken",
      confidence: 0.92,
    });

    setPhase("done");
    getWebApp()?.HapticFeedback.notificationOccurred("success");

    setTimeout(() => router.push(`/${locale}/today`), 1500);
  };

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Camera size={64} className="text-[var(--color-slate-400)] mb-4" />
        <h2 className="text-xl font-heading font-bold mb-2">{error}</h2>
        <Button onClick={() => router.back()} variant="secondary" className="mt-4">
          {tCommon("back")}
        </Button>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gradient-to-br from-[var(--color-success)] to-emerald-500 text-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="w-32 h-32 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-6"
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <h1 className="text-2xl font-heading font-extrabold mb-2">{t("verified")}</h1>
        <p className="text-white/85">{t("review")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-black text-white">
      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
          <ChevronLeft size={22} />
        </button>
        {phase === "recording" && (
          <div className="px-3 py-1 rounded-full bg-[var(--color-danger)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-bold tabular">
              {Math.ceil((MAX_DURATION_MS - (Date.now() - startTsRef.current)) / 1000)}s
            </span>
          </div>
        )}
        <div className="w-10" />
      </header>

      {/* Camera preview / video */}
      <div className="flex-1 relative flex items-center justify-center">
        {phase === "preview" && recordedUrl ? (
          <video
            ref={previewRef}
            src={recordedUrl}
            controls
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Top instruction (only ready state) */}
        {phase === "ready" && (
          <div className="absolute top-20 left-4 right-4 text-center">
            <p className="text-sm bg-black/50 backdrop-blur rounded-full px-4 py-2 inline-block">
              {t("ready_to_record")}
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 tg-safe-bottom">
        {phase === "ready" && (
          <div className="flex justify-center">
            <RecordButton onClick={startRecording} />
          </div>
        )}

        {phase === "recording" && (
          <div className="flex justify-center">
            <RecordButton recording progress={progress} onClick={stopRecording} />
          </div>
        )}

        {phase === "preview" && (
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <Button onClick={sendToServer} size="lg" block>
              <Send size={20} />
              {t("send")}
            </Button>
            <Button onClick={retake} size="md" variant="ghost" block className="text-white hover:bg-white/10">
              <RefreshCw size={18} />
              {t("rerecord")}
            </Button>
          </div>
        )}

        {phase === "uploading" && (
          <div className="text-center">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur px-5 py-3 rounded-full">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">{t("verifying")}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function RecordButton({
  onClick,
  recording = false,
  progress = 0,
}: {
  onClick: () => void;
  recording?: boolean;
  progress?: number;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95",
        recording ? "bg-[var(--color-danger)]" : "bg-white",
      )}
      aria-label={recording ? "Stop" : "Record"}
    >
      {recording && (
        <svg className="absolute inset-0 -rotate-90" width="96" height="96">
          <circle cx="48" cy="48" r={radius} stroke="white" strokeWidth="4" fill="none" opacity="0.3" />
          <circle
            cx="48" cy="48" r={radius}
            stroke="white" strokeWidth="4" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
      )}
      {recording ? (
        <Square size={28} fill="white" stroke="none" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger)]" />
      )}
    </button>
  );
}
