/**
 * Inference adapter — proxies to Kaggle / vast.ai / mocks.
 *
 * URL resolution priority:
 *   1. NEXT_PUBLIC_KAGGLE_INFERENCE_URL set → use prefixed routing:
 *        ${URL}/llm/v1/chat/completions
 *        ${URL}/vision/v1/chat/completions
 *        ${URL}/yolo/detect
 *   2. NEXT_PUBLIC_VAST_INFERENCE_URL set → use port routing (legacy):
 *        ${URL}:8001/v1/...   ${URL}:8002/v1/...   ${URL}:8004/detect
 *   3. NEXT_PUBLIC_USE_MOCK_INFERENCE=true (or anything not 'false') → mock
 */

const KAGGLE_URL = process.env.NEXT_PUBLIC_KAGGLE_INFERENCE_URL?.replace(/\/$/, "");
const VAST_URL = process.env.NEXT_PUBLIC_VAST_INFERENCE_URL?.replace(/\/$/, "");

export const USE_MOCK =
  !KAGGLE_URL && !VAST_URL && process.env.NEXT_PUBLIC_USE_MOCK_INFERENCE !== "false";

function endpoint(service: "llm" | "vision" | "yolo", path: string): string {
  if (KAGGLE_URL) return `${KAGGLE_URL}/${service}${path}`;
  const port = service === "llm" ? 8001 : service === "vision" ? 8002 : 8004;
  const base = VAST_URL || "http://localhost";
  return `${base}:${port}${path}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface YoloDetection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
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

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ────────────────────────────────────────────────────────────────────────────
// YOLO pill detection
// ────────────────────────────────────────────────────────────────────────────

export async function detectPills(imageBlob: Blob): Promise<YoloResponse> {
  if (USE_MOCK) {
    await sleep(800 + Math.random() * 600);
    return {
      detections: [
        { label: "rifampicin", confidence: 0.91, bbox: [0.3, 0.4, 0.5, 0.6] },
        { label: "isoniazid", confidence: 0.86, bbox: [0.5, 0.4, 0.7, 0.6] },
      ],
      inferenceMs: 1100,
    };
  }
  const fd = new FormData();
  fd.append("image", imageBlob, "frame.jpg");
  const res = await fetch(endpoint("yolo", "/detect"), { method: "POST", body: fd });
  if (!res.ok) throw new Error(`YOLO detect failed: ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Face matching — face-api.js client-side (real 128-d descriptors).
// ────────────────────────────────────────────────────────────────────────────

export async function verifyFace(
  inputElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  patientId: string,
): Promise<FaceMatchResponse> {
  if (typeof window === "undefined") {
    return { match: false, similarity: 0, detected: false };
  }
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
  if (!result) return { match: false, similarity: 0, detected: false };
  if (!enrolled) return { match: true, similarity: 0.5, detected: true };

  const distance = faceDistance(result.descriptor, enrolled.embedding);
  const similarity = distanceToSimilarity(distance);
  const match = distance < 0.55;
  return { match, similarity, detected: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Vision LLM — pill closeup verification via OpenAI-compatible vision API.
// Sends base64 image embedded in chat message; parses model's yes/no.
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

  const dataUrl = await blobToDataUrl(imageBlob);
  const prompt =
    `You are a medical pill verification AI. The patient was prescribed: ${expectedDrugs.join(", ")}.\n` +
    `Look at the image and answer ONLY with JSON in this exact format:\n` +
    `{"matches": true|false, "confidence": 0.0-1.0, "reasoning": "<brief explanation>"}\n` +
    `Be strict: only return matches=true if you're confident the visible pill matches one of the prescribed drugs.`;

  const res = await fetch(endpoint("vision", "/v1/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "davoai-vision",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`Vision API failed: ${res.status}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return parseVisionVerdict(text, expectedDrugs);
}

function parseVisionVerdict(text: string, expectedDrugs: string[]): VisionVerifyResponse {
  // Try to extract JSON from response (model may wrap in markdown or extra text)
  const match = text.match(/\{[\s\S]*?"matches"[\s\S]*?\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return {
        matches: Boolean(parsed.matches),
        confidence: Number(parsed.confidence) || 0.5,
        reasoning: String(parsed.reasoning || ""),
      };
    } catch {
      /* fall through */
    }
  }
  // Fallback: keyword scan
  const lc = text.toLowerCase();
  const positive = lc.includes("matches") || expectedDrugs.some((d) => lc.includes(d.toLowerCase()));
  return {
    matches: positive,
    confidence: positive ? 0.7 : 0.3,
    reasoning: text.slice(0, 200),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// LLM chat (AI assistant)
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  uz: `Sen TB Control ilovasining tibbiy AI yordamchisisan. Sil (tuberkulyoz) davolanishi bo'yicha bemorlarga maslahat berasan. Faqat sil va uning dorilari haqida javob ber: rifampitsin, izoniazid, pirazinamid, etambutol va boshqalar. Yon ta'sirlar, dozalash, davolanish davomiyligi, oziq-ovqat bilan o'zaro ta'siri haqida ma'lumot ber. Tibbiy holatlarda darhol shifokorga murojaat qilishni tavsiya qil. Javoblar qisqa va aniq bo'lsin.`,
  ru: `Ты медицинский AI-ассистент приложения TB Control. Консультируешь пациентов по вопросам лечения туберкулёза. Отвечай только про ТБ и его препараты: рифампицин, изониазид, пиразинамид, этамбутол и др. Информируй о побочных эффектах, дозировках, длительности лечения, взаимодействии с пищей. При тревожных симптомах рекомендуй немедленно обратиться к лечащему врачу. Отвечай кратко и по делу.`,
  en: `You are the medical AI assistant of TB Control app. You advise patients on TB treatment. Answer only about TB and its medications: rifampicin, isoniazid, pyrazinamide, ethambutol, etc. Inform about side effects, dosages, treatment duration, food interactions. For alarming symptoms, recommend immediate consultation with the treating physician. Keep replies short and clear.`,
};

export async function chatWithAssistant(
  messages: ChatMessage[],
  language: "uz" | "ru" | "en",
): Promise<string> {
  const sysPrompt = SYSTEM_PROMPTS[language];
  if (USE_MOCK) {
    await sleep(1000 + Math.random() * 1500);
    return mockChatReply(messages[messages.length - 1]?.content ?? "", language);
  }
  const res = await fetch(endpoint("llm", "/v1/chat/completions"), {
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

function mockChatReply(userMsg: string, lang: "uz" | "ru" | "en"): string {
  const lc = userMsg.toLowerCase();
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
