import type { QuizQuestion, VocabWord } from "./types";
import { invokeAi } from "./aiGateway";

async function chat(
  system: string,
  user: string,
  options?: { json?: boolean; temperature?: number }
): Promise<string> {
  const data = await invokeAi<{ content?: string }>("chat", {
    json: options?.json ?? false,
    temperature: options?.temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = data?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Përgjigja e AI ishte e zbrazët.");
  }
  return content.trim();
}

export interface AdaptMaterialOptions {
  text: string;
  title: string;
  subject: string;
  level: number; // 1 easy, 2 medium, 3 advanced
  length: string;
  numQuestions: number;
  includeSummary: boolean;
  includeKeyPoints: boolean;
  includeVocab: boolean;
  includeQuiz: boolean;
  includeTeacherNotes: boolean;
  includeTranslation: boolean;
  /** Generate illustration scene prompts for educational images. */
  includeVisualizations?: boolean;
  /** Pedagogical hints from student learning profiles (no diagnoses). */
  learnerHints?: string[];
}

export interface AdaptedMaterial {
  simplifiedText: string;
  summary: string;
  keyPoints: string[];
  vocabulary: VocabWord[];
  quiz: QuizQuestion[];
  teacherNotes: string;
  translation?: string;
  /** Short English scene prompts for DALL·E (when visualizations enabled). */
  visualPrompts?: string[];
}

const levelGuide: Record<number, string> = {
  1: "thjeshtësim i lehtë për nxënës me vështirësi leximi (fjali të shkurtra, fjalor bazë)",
  2: "thjeshtësim mesatar, i qartë dhe i kuptueshëm për klasën e mesme",
  3: "adaptim i avancuar: ruaj më shumë detaje, por mbaje gjuhën të qartë",
};

export async function adaptMaterialWithAI(opts: AdaptMaterialOptions): Promise<AdaptedMaterial> {
  const system = `Je një asistent pedagogjik për platformën MësoLehtë AI në Shqipëri/Kosovë.
Përgjigju GJITHMONË në shqip.
Kthen VETËM JSON të vlefshëm sipas skemës së kërkuar.
Mos shto markdown, komente apo tekst jashtë JSON.`;

  const user = `Adapto këtë material mësimor për nxënës.

Titulli: ${opts.title}
Lënda: ${opts.subject}
Niveli i thjeshtësimit: ${levelGuide[opts.level] ?? levelGuide[2]}
Gjatësia e dëshiruar: ${opts.length}
Numri i pyetjeve të kuizit: ${opts.numQuestions}
${
  opts.learnerHints?.length
    ? `\nUdhëzime nga profili mësimor i klasës (pedagogjike, JO diagnoza):\n- ${opts.learnerHints.join("\n- ")}\nPërshtat tekstin, fjalorin dhe kuizin sipas këtyre nevojave.\n`
    : ""
}
Teksti origjinal:
"""
${opts.text.slice(0, 12000)}
"""

Kthe JSON me këto fusha:
{
  "simplifiedText": "teksti i plotë i thjeshtësuar në shqip",
  "summary": ${opts.includeSummary ? '"përmbledhje e shkurtër (2-4 fjali)"' : '""'},
  "keyPoints": ${opts.includeKeyPoints ? '["pikë kryesore 1", "pikë kryesore 2", "..."] (3-6 pika)' : "[]"},
  "vocabulary": ${opts.includeVocab ? `[{
    "word": "fjala",
    "definition": "përkufizim i thjeshtë",
    "synonym": "sinonimi",
    "example": "shembull në fjali",
    "translation": "përkthim i shkurtër në anglisht"
  }] (5-8 fjalë të vështira nga teksti)` : "[]"},
  "quiz": ${opts.includeQuiz ? `[{
    "id": "q1",
    "type": "multiple",
    "question": "pyetja",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "hint": "ndihmë e shkurtër",
    "feedback": "shpjegim pas përgjigjes"
  }] (saktësisht ${opts.numQuestions} pyetje; type mund të jetë multiple, yesno, short ose mainidea; për multiple correct është indeksi 0-based; për yesno options ["Po","Jo"] dhe correct 0 ose 1; për short correct është string)` : "[]"},
  "teacherNotes": ${opts.includeTeacherNotes ? '"shënime praktike për mësuesen"' : '""'},
  "translation": ${opts.includeTranslation ? '"full English translation of simplifiedText, clear and suitable for children, no Albanian leftover"' : '""'},
  "visualPrompts": ${opts.includeVisualizations ? '["English scene description 1 for a simple educational illustration, no text in image", "English scene description 2"] (exactly 2 short prompts about the main ideas)' : "[]"}
}`;

  const raw = await chat(system, user, { json: true, temperature: 0.35 });
  let parsed: Partial<AdaptedMaterial>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI nuk ktheu JSON të vlefshëm. Provo sërish.");
  }

  const quiz: QuizQuestion[] = Array.isArray(parsed.quiz)
    ? parsed.quiz.map((q, i) => ({
        id: q.id || `q-${i + 1}`,
        type: (q.type as QuizQuestion["type"]) || "multiple",
        question: q.question || `Pyetja ${i + 1}`,
        options: q.options,
        correct: q.correct ?? 0,
        hint: q.hint,
        feedback: q.feedback || "Kontrollo përgjigjen në tekst.",
      }))
    : [];

  const vocabulary: VocabWord[] = Array.isArray(parsed.vocabulary)
    ? parsed.vocabulary.map(v => ({
        word: v.word || "",
        definition: v.definition || "",
        synonym: v.synonym || "",
        example: v.example || "",
        translation: v.translation || "",
      })).filter(v => v.word)
    : [];

  const visualPrompts = Array.isArray((parsed as { visualPrompts?: unknown }).visualPrompts)
    ? ((parsed as { visualPrompts: unknown[] }).visualPrompts
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .map(p => p.trim())
        .slice(0, 2))
    : [];

  return {
    simplifiedText: parsed.simplifiedText?.trim() || opts.text,
    summary: opts.includeSummary ? (parsed.summary?.trim() || "") : "",
    keyPoints: opts.includeKeyPoints
      ? (Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter(Boolean) : [])
      : [],
    vocabulary: opts.includeVocab ? vocabulary : [],
    quiz: opts.includeQuiz ? quiz : [],
    teacherNotes: opts.includeTeacherNotes ? (parsed.teacherNotes?.trim() || "") : "",
    translation: opts.includeTranslation ? (parsed.translation?.trim() || undefined) : undefined,
    visualPrompts: opts.includeVisualizations ? visualPrompts : [],
  };
}

export async function explainSentenceWithAI(sentence: string, action?: string): Promise<string> {
  const actionHint =
    action === "Thjeshtëso"
      ? "Thjeshtëso fjalinë me fjalë më të lehta."
      : action === "Shpjego"
      ? "Shpjego kuptimin e fjalisë me gjuhë të thjeshtë."
      : action === "Shembull"
      ? "Jep një shembull të ngjashëm që e bën kuptimin më të qartë."
      : "Shpjego ose thjeshtëso tekstin e zgjedhur.";

  return chat(
    "Je mësues ndihmës për nxënës me vështirësi leximi. Përgjigju në shqip, shkurt dhe qartë (2-4 fjali).",
    `${actionHint}\n\nTeksti: """${sentence.slice(0, 2000)}"""`,
    { temperature: 0.4 }
  );
}

export async function explainWordWithAI(word: string): Promise<{
  definition: string;
  synonym: string;
  example: string;
}> {
  const raw = await chat(
    "Je mësues ndihmës. Përgjigju në shqip. Kthe vetëm JSON.",
    `Shpjego fjalën "${word}" për nxënës. JSON: {"definition":"...","synonym":"...","example":"..."}`,
    { json: true, temperature: 0.3 }
  );
  try {
    const parsed = JSON.parse(raw);
    return {
      definition: parsed.definition || `Shpjegim për "${word}".`,
      synonym: parsed.synonym || "",
      example: parsed.example || "",
    };
  } catch {
    return {
      definition: raw,
      synonym: "",
      example: "",
    };
  }
}

export async function translateWithAI(text: string, lang: string): Promise<string> {
  const target = lang.toLowerCase().startsWith("en") ? "English" : lang;
  return chat(
    "You are a translator for children's educational materials. Return ONLY the translated text, no explanations, no quotes, no markdown.",
    `Translate the following Albanian educational text into clear ${target} suitable for ages 8-12:\n\n${text.slice(0, 8000)}`,
    { temperature: 0.2 }
  );
}

/**
 * Generate spoken audio for English text via OpenAI TTS.
 */
export async function synthesizeEnglishSpeech(text: string): Promise<Blob> {
  const input = text.trim().slice(0, MAX_TTS_CHARS);
  if (!input) throw new Error("No text for audio.");

  return invokeAi<Blob>("speech", { input, language: "en" });
}

const MAX_TTS_CHARS = 3500;

/** Split long Albanian text into TTS-sized chunks (prefer sentence boundaries). */
export function chunkTextForTTS(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= MAX_TTS_CHARS) return [clean];

  const sentences = clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= MAX_TTS_CHARS) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= MAX_TTS_CHARS) {
        current = sentence;
      } else {
        // Hard-split very long sentences
        for (let i = 0; i < sentence.length; i += MAX_TTS_CHARS) {
          chunks.push(sentence.slice(i, i + MAX_TTS_CHARS));
        }
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Generate spoken audio for Albanian text via OpenAI TTS.
 * Uses gpt-4o-mini-tts with Albanian instructions when available; falls back to tts-1.
 */
export async function synthesizeAlbanianSpeech(text: string): Promise<Blob> {
  const input = text.trim().slice(0, MAX_TTS_CHARS);
  if (!input) throw new Error("Nuk ka tekst për audio.");

  return invokeAi<Blob>("speech", { input, language: "sq" });
}

/** Shrink image data URLs so materials fit in localStorage (~5MB). */
async function compressIllustrationDataUrl(
  dataUrl: string,
  maxSide = 768,
  quality = 0.7
): Promise<string> {
  if (!dataUrl.startsWith("data:image/") || typeof document === "undefined") {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Simple educational illustration for children (no text in image).
 * Uses gpt-image-1 (current Images API). Falls back to dall-e-3 URL mode.
 */
export async function generateEducationalIllustration(prompt: string): Promise<string> {
  const safePrompt = `Simple educational illustration for children ages 8-12, clear and friendly, soft colors, no text, no letters, no words, no watermark. Scene: ${prompt.slice(0, 400)}`;
  const { image: raw } = await invokeAi<{ image: string }>("image", { prompt: safePrompt });
  if (!raw) throw new Error("Nuk u kthye figurë.");
  return compressIllustrationDataUrl(raw);
}

export type LessonChatRole = "teacher" | "student";

export interface LessonChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LessonChatOptions {
  role: LessonChatRole;
  materialTitle: string;
  subject: string;
  className?: string;
  simplifiedText: string;
  summary?: string;
  keyPoints?: string[];
  vocabulary?: Array<{ word: string; definition?: string }>;
  previousLessons?: Array<{ title: string; summary?: string }>;
  history: LessonChatMessage[];
  userMessage: string;
}

async function chatMultiTurn(
  system: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
): Promise<string> {
  const data = await invokeAi<{ content?: string }>("chat", {
    temperature: 0.5,
    messages: [{ role: "system", content: system }, ...messages],
  });
  const content = data?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Përgjigja e AI ishte e zbrazët.");
  }
  return content.trim();
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Lesson-scoped chatbot: answers only about the current material
 * (and optional previous lessons for students).
 */
export async function lessonChatWithAI(opts: LessonChatOptions): Promise<string> {
  const text = truncate(opts.simplifiedText || "", 9000);
  const summary = truncate(opts.summary || "", 1200);
  const keyPoints = (opts.keyPoints || []).slice(0, 12).join("\n- ");
  const vocab = (opts.vocabulary || [])
    .slice(0, 20)
    .map(v => `${v.word}${v.definition ? `: ${v.definition}` : ""}`)
    .join("\n- ");

  const previousBlock =
    opts.previousLessons && opts.previousLessons.length > 0
      ? opts.previousLessons
          .slice(0, 8)
          .map(
            (l, i) =>
              `${i + 1}. ${l.title}${l.summary ? ` — ${truncate(l.summary, 220)}` : ""}`
          )
          .join("\n")
      : "(nuk ka mësime të mëparshme të dhëna)";

  const teacherSystem = `Ti je asistenti pedagogjik i platformës MësoLehtë AI.
Ndiumo mësuesen/mësuesin të shqyrtojë dhe përmirësojë materialin mësimor.

RREGULLA:
- Përgjigju vetëm për këtë material (përmbajtje, nivel, qartësi, kuiz, fjalor, përmbledhje, ide për përmirësim).
- Nëse pyetja është jashtë temës së materialit, thuaj shkurt që mund të ndihmosh vetëm për këtë mësim.
- Jepi përgjigje praktike, të qarta, në shqip (ose anglisht nëse mësuesja shkruan anglisht).
- Mos invento fakte që nuk mbështeten nga teksti i materialit.
- Mos jep diagnostikime mjekësore; vetëm këshilla pedagogjike.

MATERIALI:
Titulli: ${opts.materialTitle}
Lënda: ${opts.subject}
Klasa: ${opts.className || "—"}
Përmbledhje: ${summary || "—"}
Pikat kryesore:
- ${keyPoints || "—"}
Fjalor:
- ${vocab || "—"}
Teksti i thjeshtësuar:
${text || "(bosh)"}`;

  const studentSystem = `Ti je miku mësimor i platformës MësoLehtë AI për nxënës (zakonisht 8–14 vjeç).
Ndiumo nxënësin të kuptojë mësimin aktual.

RREGULLA TË RËNDËSISHME:
1. Përgjigju VETËM për mësimin aktual ose mësimet e mëparshme të listuara më poshtë.
2. Nëse pyetja është jashtë temës (lojëra, politika, kodim, tema personale jo-mësimore, etj.), refuzo me dashamirësi në shqip dhe ftoje të pyesë për mësimin.
3. Përdor shqip të thjeshtë, fjali të shkurtra, shembuj të lehtë.
4. Mos jep përgjigjet e gatshme të kuizit — udhëzoje të mendojë me pyetje ndihmëse.
5. Mos invento informacion që nuk është në material; nëse nuk e di nga teksti, thuaj qartë.
6. Nëse pyet për një mësim të mëparshëm, përdor vetëm informacionin e dhënë te lista e mësimëve të mëparshme.

MËSIMI AKTUAL:
Titulli: ${opts.materialTitle}
Lënda: ${opts.subject}
Përmbledhje: ${summary || "—"}
Pikat kryesore:
- ${keyPoints || "—"}
Fjalor:
- ${vocab || "—"}
Teksti:
${text || "(bosh)"}

MËSIME TË MËPARSHME (kontekst i kufizuar):
${previousBlock}`;

  const system = opts.role === "teacher" ? teacherSystem : studentSystem;

  const history = opts.history.slice(-12).map(m => ({
    role: m.role,
    content: truncate(m.content, 2000),
  }));

  return chatMultiTurn(system, [
    ...history,
    { role: "user", content: truncate(opts.userMessage, 1500) },
  ]);
}
