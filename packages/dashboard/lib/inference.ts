/**
 * Inference adapter — proxies to vast.ai (production) or mocks (demo without GPU).
 *
 * Endpoints (vast.ai RTX 5090):
 *   8001 → LLM Qwen 2.5-14B AWQ (chat assistant)
 *   8002 → Vision Qwen-VL 7B AWQ (pill closeup verification)
 *   8003 → Whisper Large-v3 (STT)
 *   8004 → YOLO fine-tuned (TB pill detection)
 *
 * For demo: USE_MOCK=true returns realistic timed mocks without network.
 */

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_INFERENCE !== "false";

const VAST_BASE = process.env.NEXT_PUBLIC_VAST_INFERENCE_URL || "http://localhost";

export interface YoloDetection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];   // [x1, y1, x2, y2] normalized
}

export interface YoloResponse {
  detections: YoloDetection[];
  inferenceMs: number;
}

export interface FaceMatchResponse {
  match: boolean;
  similarity: number;
  detected: boolean;
}

export interface VisionVerifyResponse {
  matches: boolean;
  confidence: number;
  reasoning: string;
}

// ────────────────────────────────────────────────────────────────────────────
// YOLO pill detection (port 8004)
// ────────────────────────────────────────────────────────────────────────────

export async function detectPills(imageBlob: Blob): Promise<YoloResponse> {
  if (USE_MOCK) {
    await sleep(800 + Math.random() * 600);
    return {
      detections: [
        { label: "rifampicin", confidence: 0.91, bbox: [0.3, 0.4, 0.5, 0.6] },
        { label: "isoniazid",  confidence: 0.86, bbox: [0.5, 0.4, 0.7, 0.6] },
      ],
      inferenceMs: 1100,
    };
  }
  const fd = new FormData();
  fd.append("image", imageBlob, "frame.jpg");
  const res = await fetch(`${VAST_BASE}:8004/detect`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`YOLO detect failed: ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Face matching — face-api.js client-side (real 128-d descriptors).
// Compares live frame against enrolled embedding stored in localStorage.
// Falls back to mock if no enrollment exists for the given patientId.
// ────────────────────────────────────────────────────────────────────────────

export async function verifyFace(
  inputElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  patientId: string,
): Promise<FaceMatchResponse> {
  if (typeof window === "undefined") {
    return { match: false, similarity: 0, detected: false };
  }
  // Lazy import — face-api is a sizable client-only dep
  const {
    initFaceApi,
    extractFaceDescriptor,
    loadEnrollments,
    faceDistance,
    distanceToSimilarity,
  } = await import("@/lib/face-api-loader");

  await initFaceApi();
  const enrollments = loadEnrollments();
  const enrolled = enrollments[patientId];

  const result = await extractFaceDescriptor(inputElement);
  if (!result) {
    return { match: false, similarity: 0, detected: false };
  }

  if (!enrolled) {
    // No reference yet — return "trust mode" with low confidence + flag-worthy
    return { match: true, similarity: 0.5, detected: true };
  }

  const distance = faceDistance(result.descriptor, enrolled.embedding);
  const similarity = distanceToSimilarity(distance);
  // face-api convention: distance < 0.4 = same person (high conf),
  // 0.4-0.6 = likely same, > 0.6 = different
  const match = distance < 0.55;

  return { match, similarity, detected: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Vision LLM verification (closeup, "is this the right pill?")
// ────────────────────────────────────────────────────────────────────────────

export async function verifyPillCloseup(
  imageBlob: Blob,
  expectedDrugs: string[],
): Promise<VisionVerifyResponse> {
  if (USE_MOCK) {
    await sleep(1800 + Math.random() * 800);
    return {
      matches: true,
      confidence: 0.88,
      reasoning: `Detected pills consistent with ${expectedDrugs.join(", ")}`,
    };
  }
  const fd = new FormData();
  fd.append("image", imageBlob, "frame.jpg");
  fd.append("expected_drugs", JSON.stringify(expectedDrugs));
  const res = await fetch(`${VAST_BASE}:8002/verify`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Vision verify failed: ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// LLM chat (AI assistant, port 8001)
// ────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  language: "uz" | "ru" | "en",
): Promise<string> {
  const sysPrompt = SYSTEM_PROMPTS[language];
  if (USE_MOCK) {
    await sleep(1000 + Math.random() * 1500);
    return mockChatReply(messages[messages.length - 1]?.content ?? "", language);
  }
  const res = await fetch(`${VAST_BASE}:8001/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "davoai-llm",
      messages: [{ role: "system", content: sysPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`LLM chat failed: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const SYSTEM_PROMPTS = {
  uz: `Sen TB Control ilovasining tibbiy AI yordamchisisan. Sil (tuberkulyoz) davolanishi bo'yicha bemorlarga maslahat berasan. Faqat sil va uning dorilari haqida javob ber: rifampitsin, izoniazid, pirazinamid, etambutol va boshqalar. Yon ta'sirlar, dozalash, davolanish davomiyligi, oziq-ovqat bilan o'zaro ta'siri haqida ma'lumot ber. Tibbiy holatlarda darhol shifokorga murojaat qilishni tavsiya qil. Javoblar qisqa va aniq bo'lsin.`,
  ru: `Ты медицинский AI-ассистент приложения TB Control. Консультируешь пациентов по вопросам лечения туберкулёза. Отвечай только про ТБ и его препараты: рифампицин, изониазид, пиразинамид, этамбутол и др. Информируй о побочных эффектах, дозировках, длительности лечения, взаимодействии с пищей. При тревожных симптомах рекомендуй немедленно обратиться к лечащему врачу. Отвечай кратко и по делу.`,
  en: `You are the medical AI assistant of TB Control app. You advise patients on TB treatment. Answer only about TB and its medications: rifampicin, isoniazid, pyrazinamide, ethambutol, etc. Inform about side effects, dosages, treatment duration, food interactions. For alarming symptoms, recommend immediate consultation with the treating physician. Keep replies short and clear.`,
};

function mockChatReply(userMsg: string, lang: "uz" | "ru" | "en"): string {
  const lc = userMsg.toLowerCase();

  // Pattern-matched mock replies for demo
  if (lc.match(/sariq|жёлт|желт|yellow|jaundice/)) {
    return {
      uz: "Sariqlik (terining va ko'zlarning sarg'ishishi) jiddiy belgi — bu jigar zararlanishini bildirishi mumkin. Iltimos, BUGUN shifokoringizga murojaat qiling. Bu vaqtda dorilarni davom ettirmang.",
      ru: "Желтизна кожи и глаз — серьёзный признак, может означать поражение печени. Пожалуйста, СЕГОДНЯ обратитесь к врачу и прекратите приём препаратов до его консультации.",
      en: "Yellow skin or eyes is a serious sign — may indicate liver damage. Please contact your doctor TODAY and stop taking pills until consulted.",
    }[lang];
  }
  if (lc.match(/og'ri|болит|боль|pain|боли/)) {
    return {
      uz: "Og'riq qaerda? Qornda og'rilik rifampitsindan keyin odatiy. Agar 3-4 kunda o'tmasa yoki kuchaysa — shifokorga murojaat qiling.",
      ru: "Где боль? Лёгкая боль в животе после рифампицина — обычное явление. Если не проходит за 3-4 дня или усиливается — обратитесь к врачу.",
      en: "Where is the pain? Mild abdominal discomfort after rifampicin is common. If it persists 3-4 days or worsens — see your doctor.",
    }[lang];
  }
  if (lc.match(/rifam/)) {
    return {
      uz: "Rifampitsin sil davolanishidagi asosiy dorilardan biri. Bo'sh oshqozonga ertalab qabul qiladi (nahoring oldidan 1 soat). Siydikni qizg'ish-to'q sariq rangga bo'yashi normal.",
      ru: "Рифампицин — основной препарат лечения ТБ. Принимать утром натощак (за 1 час до еды). Окрашивание мочи в красновато-оранжевый цвет — норма, не пугайтесь.",
      en: "Rifampicin is a core TB drug. Take in the morning on an empty stomach (1 hour before food). Reddish-orange urine is normal and harmless.",
    }[lang];
  }
  return {
    uz: "Yaxshi savol. Rasmiy maslahat uchun shifokoringiz bilan bog'laning. Men sil dorilari, yon ta'sirlari va davolanish jarayoni haqida ma'lumot berishim mumkin.",
    ru: "Хороший вопрос. Для официальной консультации свяжитесь с лечащим врачом. Я могу дать общую информацию о препаратах, побочных эффектах и режиме лечения.",
    en: "Good question. For formal advice, contact your treating doctor. I can give general info about TB drugs, side effects, and treatment regimen.",
  }[lang];
}
