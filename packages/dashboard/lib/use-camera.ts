"use client";

/**
 * useCamera — encapsulates getUserMedia setup, MediaStream cleanup,
 * and async frame capture (un-mirrored canvas blob for AI).
 *
 * The CSS `transform: scaleX(-1)` on the <video> element only mirrors visible
 * pixels for selfie UX — `drawImage` reads the un-mirrored buffer, which is
 * what AI models need (text on box reads correctly).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Permission/availability error if camera couldn't start */
  error: string | null;
  /** True once first stream has actually started playing */
  ready: boolean;
  /** Capture current video frame as JPEG blob (un-mirrored, for AI). */
  captureFrame: () => Promise<Blob | null>;
}

export function useCamera(enabled = true): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    (async () => {
      try {
        // Request highest resolution the webcam can deliver — better source frames
        // help every downstream model (face-api, Mediapipe Hands, server YOLO).
        // Modern webcams support 1080p; we accept whatever the device offers up to 4K.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1080, max: 2160 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // Wait until the video element actually has frames before declaring ready
          const onPlaying = () => {
            if (mounted) setReady(true);
            video.removeEventListener("playing", onPlaying);
          };
          video.addEventListener("playing", onPlaying);
        }
      } catch (err) {
        if (mounted) setError((err as Error).message || "Camera unavailable");
      }
    })();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [enabled]);

  const captureFrame = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return resolve(null);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0);
      // Quality 0.95 — near-lossless JPEG. Better source for backend YOLO/Vision LLM.
      // Trade-off: ~3× file size vs 0.85, still <2 MB at 1080p, fine for upload.
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
    });
  }, []);

  return { videoRef, canvasRef, error, ready, captureFrame };
}
