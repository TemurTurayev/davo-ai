"use client";

/**
 * face-api.js loader — singleton init, pre-loads models from /public/models/face-api.
 *
 * Used by:
 *  - /enroll page (extract reference embedding)
 *  - Dose flow face_id step (live frame → embedding → cosine similarity)
 *
 * face-api is dynamically imported (browser-only) — top-level import would crash
 * Next.js SSR with "TextEncoder is not a constructor".
 */

type FaceApi = typeof import("@vladmandic/face-api");

let faceapi: FaceApi | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

async function getFaceApi(): Promise<FaceApi> {
  if (faceapi) return faceapi;
  faceapi = await import("@vladmandic/face-api");
  return faceapi;
}

export async function initFaceApi(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const api = await getFaceApi();
    const url = "/models/face-api";
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(url),
      api.nets.faceLandmark68Net.loadFromUri(url),
      api.nets.faceRecognitionNet.loadFromUri(url),
    ]);
    initialized = true;
  })();
  return initPromise;
}

export interface FaceEnrollment {
  patientId: string;
  embedding: number[];
  enrolledAt: string;
  imagePreviewDataUrl?: string;
}

const STORAGE_KEY = "tb-control:face-enrollments";

export function loadEnrollments(): Record<string, FaceEnrollment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveEnrollment(e: FaceEnrollment): void {
  const all = loadEnrollments();
  all[e.patientId] = e;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteEnrollment(patientId: string): void {
  const all = loadEnrollments();
  delete all[patientId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Detect the largest face in an image/video element and return its 128-d descriptor.
 * Returns null if no face detected.
 */
export async function extractFaceDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<{ descriptor: Float32Array; box: { x: number; y: number; width: number; height: number } } | null> {
  await initFaceApi();
  const api = await getFaceApi();
  const result = await api
    .detectSingleFace(input, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;
  const b = result.detection.box;
  return {
    descriptor: result.descriptor,
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
  };
}

/**
 * Compare two 128-d descriptors via Euclidean distance (face-api convention).
 * < 0.4 = same person (very high confidence)
 * 0.4 - 0.6 = likely same
 * > 0.6 = different people
 */
export function faceDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  const aa = a instanceof Float32Array ? a : new Float32Array(a);
  const bb = b instanceof Float32Array ? b : new Float32Array(b);
  let sum = 0;
  for (let i = 0; i < aa.length; i++) {
    const d = aa[i] - bb[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Convert distance to "similarity" 0-1 for UI (higher = better match) */
export function distanceToSimilarity(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance / 0.6));
}
