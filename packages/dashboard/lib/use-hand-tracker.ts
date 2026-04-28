"use client";

/**
 * useHandTracker — Mediapipe Hands real-time tracking via @mediapipe/tasks-vision.
 *
 * Detects up to 2 hands at ~10 FPS. Returns:
 *  - hands: array of { box, landmarks (21 points), handedness, confidence }
 *  - detected: false when no hand in frame
 *
 * Used by:
 *  - "Руки видны" rule (real signal — not random mock)
 *  - show_pills / pill_closeup steps (palm bbox follows real hand)
 *  - swallow step (hand-to-mouth motion validation)
 */

import { useEffect, useState, type RefObject } from "react";
import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

export interface HandDetection {
  box: { x: number; y: number; width: number; height: number };
  landmarks: Array<{ x: number; y: number; z: number }>;
  handedness: "Left" | "Right";
  confidence: number;
}

export interface HandTracking {
  hands: HandDetection[];
  detected: boolean;
}

const EMPTY: HandTracking = { hands: [], detected: false };

let landmarkerInstance: HandLandmarker | null = null;
let initPromise: Promise<HandLandmarker> | null = null;

async function getHandLandmarker(): Promise<HandLandmarker> {
  if (landmarkerInstance) return landmarkerInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      // Use jsdelivr for the WASM runtime — npm package only ships JS glue
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );
    // Load model from Google's CDN (public, ~7.6 MB float16). Avoids committing
    // a binary >2 MB to git. Cached by browser after first request.
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      numHands: 2,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    landmarkerInstance = lm;
    return lm;
  })();
  return initPromise;
}

export function useHandTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): HandTracking {
  const [tracking, setTracking] = useState<HandTracking>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setTracking(EMPTY);
      return;
    }
    let cancelled = false;
    let lastTimestamp = -1;

    (async () => {
      const lm = await getHandLandmarker();

      while (!cancelled) {
        const video = videoRef.current;
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          // Mediapipe requires monotonically increasing timestamps
          const ts = performance.now();
          if (ts > lastTimestamp) {
            lastTimestamp = ts;
            try {
              const result: HandLandmarkerResult = lm.detectForVideo(video, ts);
              if (cancelled) break;

              if (result.landmarks && result.landmarks.length > 0) {
                const W = video.videoWidth;
                const H = video.videoHeight;
                const hands: HandDetection[] = result.landmarks.map((lms, i) => {
                  // Compute bbox from landmarks
                  const xs = lms.map((p) => p.x);
                  const ys = lms.map((p) => p.y);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);
                  const handedness =
                    result.handedness?.[i]?.[0]?.categoryName === "Right" ? "Right" : "Left";
                  const confidence = result.handedness?.[i]?.[0]?.score ?? 0.8;
                  return {
                    box: {
                      x: minX,
                      y: minY,
                      width: maxX - minX,
                      height: maxY - minY,
                    },
                    landmarks: lms.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
                    handedness,
                    confidence,
                  };
                });
                setTracking({ hands, detected: true });
              } else {
                setTracking((prev) => (prev.detected ? EMPTY : prev));
              }
            } catch (err) {
              console.error("Hand detection error:", err);
            }
          }
        }
        await new Promise((r) => setTimeout(r, 100)); // ~10 FPS
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, videoRef]);

  return tracking;
}
