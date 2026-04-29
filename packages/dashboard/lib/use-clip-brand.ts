"use client";

/**
 * useClipBrand — open-vocabulary brand recognition via OWLv2 on M4 Pro.
 *
 * Renamed semantics (kept the function name to avoid touching dose-flow.tsx):
 * earlier this hook ran CLIP-vit-base in the browser via transformers.js
 * (~80 MB download, 5-10s first inference, model download often failed
 * over Cloudflare Tunnel). Replaced with a server call to the OWLv2 model
 * (google/owlv2-base-patch16-ensemble) running on M4 Pro Metal/MPS.
 *
 * Endpoint: /ai/owlv2/detect — Next.js rewrites this to localhost:7860/owlv2/*
 * which is a tiny Air-side reverse proxy forwarding to 192.168.68.112:7860
 * (Pro), where the actual model runs. ~250-400ms per inference vs 5-10s CLIP.
 *
 * Open-vocabulary: takes natural-language prompts as text, returns bbox + score
 * per prompt. Replaces both Mediapipe ObjectDetector (COCO 80-class) and
 * browser CLIP — one model does location AND brand classification.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

const BRAND_PROMPTS: { id: string; text: string }[] = [
  { id: "trahisan", text: "a box of Trahisan throat lozenges" },
  { id: "ascorutin", text: "a box of Ascorutin vitamin tablets" },
  { id: "rifampicin", text: "a box of Rifampicin antibiotic capsules" },
  { id: "isoniazid", text: "a box of Isoniazid tuberculosis pills" },
  { id: "blister", text: "a pharmaceutical blister pack of pills" },
  { id: "glass", text: "a transparent glass with water" },
  { id: "book", text: "a book" },
  { id: "phone", text: "a cell phone" },
];

const PROMPT_STR = BRAND_PROMPTS.map((p) => p.text).join("|");

export interface ClipResult {
  topId: string;
  topLabel: string;
  topConfidence: number;
  ranked: { id: string; confidence: number }[];
  status: "loading" | "ready" | "running" | "error";
  /** Set when OWLv2 returns a bbox — used by detection-overlay fusion */
  topBbox?: [number, number, number, number];
}

const EMPTY: ClipResult = {
  topId: "",
  topLabel: "",
  topConfidence: 0,
  ranked: [],
  status: "loading",
};

function canvasFromVideo(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    const c = document.createElement("canvas");
    // OWLv2 input is 960×960; we send center-cropped 720×720 JPEG, server resizes.
    const min = Math.min(video.videoWidth, video.videoHeight);
    c.width = c.height = Math.min(720, min);
    const ctx = c.getContext("2d")!;
    const sx = (video.videoWidth - min) / 2;
    const sy = (video.videoHeight - min) / 2;
    ctx.drawImage(video, sx, sy, min, min, 0, 0, c.width, c.height);
    c.toBlob((b) => resolve(b), "image/jpeg", 0.85);
  });
}

export function useClipBrand(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): ClipResult {
  const [result, setResult] = useState<ClipResult>({ ...EMPTY, status: "ready" });
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setResult({ ...EMPTY, status: "ready" });
      return;
    }
    let cancelled = false;

    (async () => {
      while (!cancelled) {
        const video = videoRef.current;
        const now = Date.now();
        if (
          video &&
          video.videoWidth > 0 &&
          now - lastRunRef.current > 1000 // 1s rate limit (OWLv2 is ~250-400ms)
        ) {
          lastRunRef.current = now;
          try {
            const blob = await canvasFromVideo(video);
            if (!blob) continue;
            const fd = new FormData();
            fd.append("image", blob, "frame.jpg");
            fd.append("prompts", PROMPT_STR);
            setResult((r) => ({ ...r, status: "running" }));
            const res = await fetch("/ai/owlv2/detect", { method: "POST", body: fd });
            if (cancelled) break;
            if (!res.ok) {
              setResult({ ...EMPTY, status: "error" });
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            const data: {
              detections: { label: string; confidence: number; bbox: [number, number, number, number] }[];
              inferenceMs: number;
            } = await res.json();

            if (data.detections.length === 0) {
              setResult({ ...EMPTY, status: "ready" });
              continue;
            }
            // Map prompt text → our id
            const ranked = data.detections
              .map((d) => {
                const match = BRAND_PROMPTS.find((p) => p.text === d.label);
                return {
                  id: match?.id ?? "unknown",
                  confidence: d.confidence,
                  bbox: d.bbox,
                };
              })
              .sort((a, b) => b.confidence - a.confidence);
            const top = ranked[0];
            setResult({
              topId: top.id,
              topLabel: BRAND_PROMPTS.find((p) => p.id === top.id)?.text ?? top.id,
              topConfidence: top.confidence,
              topBbox: top.bbox,
              ranked: ranked.slice(0, 3).map((r) => ({ id: r.id, confidence: r.confidence })),
              status: "ready",
            });
          } catch (err) {
            console.error("OWLv2 fetch error:", err);
            if (!cancelled) setResult((r) => ({ ...r, status: "error" }));
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, videoRef]);

  return result;
}
