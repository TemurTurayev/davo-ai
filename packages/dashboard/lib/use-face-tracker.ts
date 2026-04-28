"use client";

/**
 * Real-time face tracker — wraps face-api.js TinyFaceDetector + 68pt landmarks.
 *
 * Updates ~6-8 times per second (every 150ms), gentle on CPU. Returns:
 *  - box: face bbox in normalized 0-1 coords (relative to video)
 *  - landmarks: 68 points in normalized coords
 *  - detected: false during gaps where no face is in frame
 *
 * The dose-flow uses this on the face_id step so the overlay (mesh + bbox)
 * actually FOLLOWS the user's face instead of sitting in the center.
 */

import { useEffect, useState, type RefObject } from "react";

export interface FaceTracking {
  box: { x: number; y: number; width: number; height: number } | null;
  landmarks: Array<{ x: number; y: number }>;
  detected: boolean;
  /** Detection confidence 0-1 from face-api */
  score: number;
}

const EMPTY_STATE: FaceTracking = { box: null, landmarks: [], detected: false, score: 0 };

export function useFaceTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FaceTracking {
  const [tracking, setTracking] = useState<FaceTracking>(EMPTY_STATE);

  useEffect(() => {
    if (!enabled) {
      setTracking(EMPTY_STATE);
      return;
    }
    let cancelled = false;

    (async () => {
      const { initFaceApi } = await import("@/lib/face-api-loader");
      const faceapi = await import("@vladmandic/face-api");
      await initFaceApi();
      // 416 inputSize ≈ 30% more CPU but tighter landmark localization
      // (the 320 setting drifted during head turns). M-class hardware handles
      // this comfortably; for low-end devices we'd revert to 320.
      const detectorOpts = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5,
      });

      while (!cancelled) {
        const video = videoRef.current;
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            const result = await faceapi
              .detectSingleFace(video, detectorOpts)
              .withFaceLandmarks();

            if (cancelled) break;

            if (result) {
              const W = video.videoWidth;
              const H = video.videoHeight;
              const b = result.detection.box;
              setTracking({
                box: {
                  x: Math.max(0, b.x / W),
                  y: Math.max(0, b.y / H),
                  width: Math.min(1, b.width / W),
                  height: Math.min(1, b.height / H),
                },
                landmarks: result.landmarks.positions.map((p) => ({
                  x: p.x / W,
                  y: p.y / H,
                })),
                detected: true,
                score: result.detection.score,
              });
            } else {
              setTracking((prev) => (prev.detected ? { ...EMPTY_STATE, score: prev.score * 0.7 } : prev));
            }
          } catch {
            // Detection sometimes throws on first frame — ignore, retry next loop
          }
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, videoRef]);

  return tracking;
}
