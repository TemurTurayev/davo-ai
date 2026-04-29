"use client";

/**
 * useClipBrand — zero-shot brand recognition via CLIP in the browser.
 *
 * Uses transformers.js v2 `pipeline("zero-shot-image-classification")` with
 * `Xenova/clip-vit-base-patch16` quantized (~80 MB, cached after first load).
 *
 * Ranks the live frame against TB/demo drug labels:
 *   "a box of Trahisan throat lozenges"  ← demo
 *   "a box of Ascorutin vitamin tablets" ← demo
 *   "a box of Rifampicin antibiotic"
 *   "a book", "a phone", "an empty hand"
 *
 * Returns the top label + confidence. Used on show_box and pill_closeup
 * to discriminate prescribed medication from random objects — something
 * Mediapipe ObjectDetector (generic COCO) can't do.
 *
 * Pure client-side. No backend. WebGPU when available, WASM fallback.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

const BRAND_PROMPTS: { id: string; text: string }[] = [
  { id: "trahisan", text: "a box of Trahisan throat lozenges" },
  { id: "ascorutin", text: "a box of Ascorutin vitamin tablets" },
  { id: "rifampicin", text: "a box of Rifampicin antibiotic capsules" },
  { id: "isoniazid", text: "a box of Isoniazid tuberculosis pills" },
  { id: "blister", text: "a pharmaceutical blister pack of pills" },
  { id: "book", text: "a book" },
  { id: "phone", text: "a cell phone" },
  { id: "background", text: "an empty wall or background" },
];

export interface ClipResult {
  topId: string;
  topLabel: string;
  topConfidence: number;
  ranked: { id: string; confidence: number }[];
  status: "loading" | "ready" | "running" | "error";
}

const EMPTY: ClipResult = {
  topId: "",
  topLabel: "",
  topConfidence: 0,
  ranked: [],
  status: "loading",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifierPromise: Promise<any> | null = null;

async function getClassifier() {
  if (classifierPromise) return classifierPromise;
  classifierPromise = (async () => {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    return pipeline(
      "zero-shot-image-classification",
      "Xenova/clip-vit-base-patch16",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { quantized: true } as any,
    );
  })();
  return classifierPromise;
}

function canvasFromVideo(video: HTMLVideoElement): string {
  const c = document.createElement("canvas");
  c.width = 224;
  c.height = 224;
  const ctx = c.getContext("2d")!;
  // Center-crop to square then resize to CLIP's 224×224
  const min = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - min) / 2;
  const sy = (video.videoHeight - min) / 2;
  ctx.drawImage(video, sx, sy, min, min, 0, 0, 224, 224);
  return c.toDataURL("image/jpeg", 0.9);
}

export function useClipBrand(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): ClipResult {
  const [result, setResult] = useState<ClipResult>(EMPTY);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setResult({ ...EMPTY, status: "ready" });
      return;
    }
    let cancelled = false;
    const labels = BRAND_PROMPTS.map((p) => p.text);

    (async () => {
      let classifier;
      try {
        classifier = await getClassifier();
        if (cancelled) return;
        setResult((r) => ({ ...r, status: "ready" }));
      } catch (err) {
        console.error("CLIP load failed:", err);
        if (!cancelled) setResult({ ...EMPTY, status: "error" });
        return;
      }

      while (!cancelled) {
        const video = videoRef.current;
        const now = Date.now();
        if (
          video &&
          video.videoWidth > 0 &&
          now - lastRunRef.current > 1500 // ~1 inference / 1.5s, CLIP is heavy
        ) {
          lastRunRef.current = now;
          try {
            const dataUrl = canvasFromVideo(video);
            const out = await classifier(dataUrl, labels);
            if (cancelled) break;
            // out: [{score, label}, ...] sorted by score desc
            const ranked = (out as { score: number; label: string }[])
              .map((r) => {
                const match = BRAND_PROMPTS.find((p) => p.text === r.label);
                return { id: match?.id ?? r.label, confidence: r.score };
              })
              .slice(0, 3);
            const top = ranked[0];
            setResult({
              topId: top.id,
              topLabel: BRAND_PROMPTS.find((p) => p.id === top.id)?.text ?? top.id,
              topConfidence: top.confidence,
              ranked,
              status: "ready",
            });
          } catch (err) {
            console.error("CLIP infer error:", err);
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
