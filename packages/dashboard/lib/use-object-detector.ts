"use client";

/**
 * useObjectDetector — Mediapipe ObjectDetector (EfficientDet-Lite0 on COCO).
 *
 * 80 classes including: bottle, cup, cell phone, scissors, book, remote,
 * toothbrush. The pill-box is not in COCO, but rectangular packaging often
 * triggers "book" or "cell phone" — for the demo we accept any high-confidence
 * detection in the center of the frame as "object present".
 *
 * Used on:
 *  - show_box / open_box: detect a held object at all
 *  - show_glass: detect "cup" or "bottle" specifically
 *
 * For accurate brand recognition (Ascorutin / Trahisan), we still need
 * server-side YOLO trained on those specific boxes — this hook just confirms
 * the patient is HOLDING SOMETHING in front of the camera.
 *
 * Model loaded from Google CDN (~5 MB), GPU delegate.
 */

import { useEffect, useState, type RefObject } from "react";
import type { ObjectDetector, Detection } from "@mediapipe/tasks-vision";

export interface DetectedObject {
  label: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
}

export interface ObjectDetection {
  objects: DetectedObject[];
  detected: boolean;
}

const EMPTY: ObjectDetection = { objects: [], detected: false };

let detectorInstance: ObjectDetector | null = null;
let initPromise: Promise<ObjectDetector> | null = null;

async function getDetector(): Promise<ObjectDetector> {
  if (detectorInstance) return detectorInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { ObjectDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );
    const detector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        // EfficientDet-Lite0 on COCO — fast, ~5 MB. For higher accuracy
        // would use Lite2 but it's 12 MB.
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
        delegate: "GPU",
      },
      scoreThreshold: 0.4,
      maxResults: 5,
      runningMode: "VIDEO",
    });
    detectorInstance = detector;
    return detector;
  })();
  return initPromise;
}

export function useObjectDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): ObjectDetection {
  const [detection, setDetection] = useState<ObjectDetection>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setDetection(EMPTY);
      return;
    }
    let cancelled = false;
    let lastTimestamp = -1;

    (async () => {
      const detector = await getDetector();

      while (!cancelled) {
        const video = videoRef.current;
        if (video && video.videoWidth > 0) {
          const ts = performance.now();
          if (ts > lastTimestamp) {
            lastTimestamp = ts;
            try {
              const result = detector.detectForVideo(video, ts);
              if (cancelled) break;

              if (result.detections && result.detections.length > 0) {
                const W = video.videoWidth;
                const H = video.videoHeight;
                const objects: DetectedObject[] = result.detections.map((d: Detection) => ({
                  label: d.categories?.[0]?.categoryName ?? "object",
                  confidence: d.categories?.[0]?.score ?? 0.5,
                  box: {
                    x: (d.boundingBox?.originX ?? 0) / W,
                    y: (d.boundingBox?.originY ?? 0) / H,
                    width: (d.boundingBox?.width ?? 0) / W,
                    height: (d.boundingBox?.height ?? 0) / H,
                  },
                }));
                setDetection({ objects, detected: true });
              } else {
                setDetection((prev) => (prev.detected ? EMPTY : prev));
              }
            } catch (err) {
              console.error("Object detection error:", err);
            }
          }
        }
        await new Promise((r) => setTimeout(r, 200)); // 5 FPS — light
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, videoRef]);

  return detection;
}
