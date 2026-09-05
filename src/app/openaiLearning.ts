/**
 * Modular AI learning intelligence (reports, profiles, adaptive quiz, flashcards).
 * Reuses the same OpenAI chat helper pattern as openai.ts — no architecture change.
 */
import type {
  Flashcard,
  LearningProfile,
  QuizQuestion,
  SessionMetrics,
} from "./types";
import { invokeAi } from "./aiGateway";

const PEDAGOGY_RULES = `Rregulla të rëndësishme:
- Përgjigju GJITHMONË në shqip.
- Mos jep diagnoza mjekësore (mos thuaj disleksi, ADHD, autizëm, etj.).
- Fol vetëm për sjellje mësimore dhe rekomandime pedagogjike.
- Nëse mungojnë të dhëna, përdor vetëm ato që ke dhe mos invento fakte.`;

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

function safeJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("AI nuk ktheu JSON të vlefshëm. Provo sërish.");
  }
}

export interface PostLessonAIResult {
  performanceSummary: string;
  strengths: string[];
  difficulties: string[];
  recommendations: string[];
  nextLessonSteps: string[];
  patterns: string[];
  teacherRecommendations: string[];
  studentMessage: string;
  studyPlan: string[];
  fullTeacherReport: string;
  profileUpdate: {
    traits: string[];
    strengths: string[];
    supportNeeds: string[];
    preferredFormats: string[];
    teacherRecommendations: string[];
  };
  memoryBooster: {
    shortSummary: string;
    flashcards: { front: string; back: string; type: string }[];
    reviewQuestions: string[];
  };
}

function metricsBlock(m: SessionMetrics): string {
  const wrong = m.wrongQuestions.length
    ? m.wrongQuestions
        .map(
          (w, i) =>
            `${i + 1}. "${w.question}" | përgjigja: ${w.studentAnswer} | e saktë: ${w.correctAnswer}`
        )
        .join("\n")
    : "Asnjë gabim i regjistruar.";

  return `Tema: ${m.topic}
Lënda: ${m.subject}
Rezultati: ${m.score}%
Kohë (min): ${m.timeSpentMinutes}
Tentativa: ${m.attempts}
Shpjegime të kërkuara: ${m.explainCount}
Luajtje audio: ${m.audioPlayCount}
Material i thjeshtuar i përdorur: ${m.simplifiedUsed ? "po" : "jo / e panjohur"}
Fjalë të hapura: ${m.vocabOpened}
Ndihma (hint) në kuiz: ${m.hintCount}

Pyetjet e gabuara:
${wrong}`;
}

/** One combined call: teacher report, student message, study plan, patterns, profile, memory booster. */
export async function generatePostLessonIntelligence(
  metrics: SessionMetrics,
  existingProfile?: LearningProfile | null,
  opts?: { visualPreferred?: boolean }
): Promise<PostLessonAIResult> {
  const profileCtx = existingProfile
    ? `Profili aktual i nxënësit:
traits: ${existingProfile.traits.join("; ") || "—"}
strengths: ${existingProfile.strengths.join("; ") || "—"}
supportNeeds: ${existingProfile.supportNeeds.join("; ") || "—"}
preferredFormats: ${existingProfile.preferredFormats.join("; ") || "—"}
sessionCount: ${existingProfile.sessionCount}`
    : "Nuk ka profil të mëparshëm.";

  const visualNote = opts?.visualPreferred
    ? "\nKy nxënës preferon mënyrën vizuale (figura, ilustrime). Në preferredFormats dhe teacherRecommendations thekso mbështetjen me figura dhe shpjegime vizuale."
    : "";

  const system = `Je asistent pedagogjik për MësoLehtë AI.
${PEDAGOGY_RULES}
Kthen VETËM JSON. Raporti për mësuesen (fullTeacherReport) duhet 200-250 fjalë.`;

  const user = `Analizo këtë sesion mësimor dhe përditëso profilin.

${metricsBlock(metrics)}

${profileCtx}${visualNote}

Kthe JSON:
{
  "performanceSummary": "2-3 fjali",
  "strengths": ["..."],
  "difficulties": ["..."],
  "recommendations": ["rekomandime për mësuesen"],
  "nextLessonSteps": ["hapa për mësimin tjetër"],
  "patterns": ["modele sjelljeje mësimore, pa diagnoza"],
  "teacherRecommendations": ["fjali të shkurtra si: Përfiton nga audio."],
  "studentMessage": "mesazh motivues 4-6 fjali, pozitiv",
  "studyPlan": ["1. ...", "2. ...", "3. ...", "4. ...", "5. ..."],
  "fullTeacherReport": "raport i plotë 200-250 fjalë që përfshin përmbledhje, pika të forta, vështirësi, rekomandime, hapa",
  "profileUpdate": {
    "traits": ["..."],
    "strengths": ["..."],
    "supportNeeds": ["..."],
    "preferredFormats": ["audio|tekst i shkurtër|figura/vizual|hap pas hapi|përsëritje|ushtrime të shkurtra|..."],
    "teacherRecommendations": ["..."]
  },
  "memoryBooster": {
    "shortSummary": "përmbledhje shumë e shkurtër e temës",
    "flashcards": [
      {"front": "...", "back": "...", "type": "definition|concept|quick"}
    ],
    "reviewQuestions": ["pyetje1", "pyetje2", "pyetje3", "pyetje4", "pyetje5"]
  }
}

Kërkesa: saktësisht 5 flashcards dhe 5 reviewQuestions në memoryBooster.`;

  const raw = await chat(system, user, { json: true, temperature: 0.35 });
  const parsed = safeJson<Partial<PostLessonAIResult>>(raw);

  const mb = parsed.memoryBooster ?? { shortSummary: "", flashcards: [], reviewQuestions: [] };
  const pu = parsed.profileUpdate ?? {
    traits: [],
    strengths: [],
    supportNeeds: [],
    preferredFormats: [],
    teacherRecommendations: [],
  };

  return {
    performanceSummary: parsed.performanceSummary?.trim() || `Rezultati: ${metrics.score}%.`,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : [],
    difficulties: Array.isArray(parsed.difficulties) ? parsed.difficulties.filter(Boolean) : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter(Boolean) : [],
    nextLessonSteps: Array.isArray(parsed.nextLessonSteps) ? parsed.nextLessonSteps.filter(Boolean) : [],
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns.filter(Boolean) : [],
    teacherRecommendations: Array.isArray(parsed.teacherRecommendations)
      ? parsed.teacherRecommendations.filter(Boolean)
      : [],
    studentMessage:
      parsed.studentMessage?.trim() ||
      "Sot ke bërë përpjekje të mirë. Vazhdo kështu — çdo hap të çon më përpara!",
    studyPlan: Array.isArray(parsed.studyPlan) ? parsed.studyPlan.filter(Boolean) : [],
    fullTeacherReport:
      parsed.fullTeacherReport?.trim() ||
      parsed.performanceSummary?.trim() ||
      "Raporti nuk u gjenerua plotësisht.",
    profileUpdate: {
      traits: Array.isArray(pu.traits) ? pu.traits.filter(Boolean) : [],
      strengths: Array.isArray(pu.strengths) ? pu.strengths.filter(Boolean) : [],
      supportNeeds: Array.isArray(pu.supportNeeds) ? pu.supportNeeds.filter(Boolean) : [],
      preferredFormats: Array.isArray(pu.preferredFormats) ? pu.preferredFormats.filter(Boolean) : [],
      teacherRecommendations: Array.isArray(pu.teacherRecommendations)
        ? pu.teacherRecommendations.filter(Boolean)
        : [],
    },
    memoryBooster: {
      shortSummary: mb.shortSummary?.trim() || metrics.topic,
      flashcards: Array.isArray(mb.flashcards) ? mb.flashcards : [],
      reviewQuestions: Array.isArray(mb.reviewQuestions) ? mb.reviewQuestions.filter(Boolean) : [],
    },
  };
}

export async function generateFlashcardsFromMaterial(input: {
  title: string;
  subject: string;
  text: string;
  keyPoints?: string[];
  vocabulary?: { word: string; definition: string }[];
}): Promise<Omit<Flashcard, "id" | "materialId">[]> {
  const system = `Je asistent pedagogjik. ${PEDAGOGY_RULES} Kthe vetëm JSON.`;
  const user = `Krijo flashcards për përsëritje nga ky material.

Titulli: ${input.title}
Lënda: ${input.subject}
Pika kryesore: ${(input.keyPoints ?? []).join("; ")}
Fjalor: ${(input.vocabulary ?? []).map(v => `${v.word}: ${v.definition}`).join("; ")}

Teksti (i shkurtuar):
"""
${input.text.slice(0, 6000)}
"""

JSON:
{
  "flashcards": [
    {"front": "pyetje ose term", "back": "përgjigje ose përkufizim", "type": "definition|concept|quick"}
  ]
}
Krijo 8-12 flashcards: definicione, koncepte, pyetje të shpejta.`;

  const raw = await chat(system, user, { json: true, temperature: 0.35 });
  const parsed = safeJson<{ flashcards?: { front: string; back: string; type?: string }[] }>(raw);
  const list = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
  return list
    .filter(c => c.front && c.back)
    .map(c => ({
      front: c.front,
      back: c.back,
      type: (c.type === "definition" || c.type === "concept" || c.type === "quick"
        ? c.type
        : "concept") as Flashcard["type"],
    }));
}

export async function explainWrongAnswerWithAI(input: {
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  topic: string;
  visualPreferred?: boolean;
}): Promise<{ explanation: string; newExample: string }> {
  const system = `Je mësues ndihmës i butë. ${PEDAGOGY_RULES} Kthe vetëm JSON.`;
  const visualHint = input.visualPreferred
    ? "Përdor gjuhë vizuale: përshkruaj si të ishte një figurë ose skenë e thjeshtë që nxënësi e imagjinon."
    : "";
  const user = `Nxënësi gaboi në kuiz.

Tema: ${input.topic}
Pyetja: ${input.question}
Përgjigja e nxënësit: ${input.studentAnswer}
Përgjigja e saktë: ${input.correctAnswer}
${visualHint}

JSON: {"explanation":"pse ishte gabim, 2-3 fjali, inkurajuese","newExample":"shembull i ri i thjeshtë"}`;

  const raw = await chat(system, user, { json: true, temperature: 0.4 });
  const parsed = safeJson<{ explanation?: string; newExample?: string }>(raw);
  return {
    explanation: parsed.explanation?.trim() || "Le ta shohim së bashku. Provo përsëri me kujdes.",
    newExample: parsed.newExample?.trim() || "",
  };
}

export async function generateEasierQuestionWithAI(input: {
  original: QuizQuestion;
  topic: string;
  subject: string;
  visualPreferred?: boolean;
}): Promise<QuizQuestion> {
  const system = `Je mësues që krijon pyetje më të lehta. ${PEDAGOGY_RULES} Kthe vetëm JSON.`;
  const visualHint = input.visualPreferred
    ? "Bëje pyetjen konkrete dhe vizuale (objekte, vende, situata që mund të imagjinohen si figurë)."
    : "";
  const user = `Krijo një pyetje MË TË LEHTË mbi të njëjtën ide.

Tema: ${input.topic}
Lënda: ${input.subject}
Pyetja origjinale: ${input.original.question}
Opsionet: ${(input.original.options ?? []).join(" | ")}
Përgjigja e saktë: ${String(input.original.correct)}
${visualHint}

JSON:
{
  "id": "easy-...",
  "type": "multiple",
  "question": "...",
  "options": ["A","B","C","D"],
  "correct": 0,
  "hint": "...",
  "feedback": "..."
}
correct është indeksi 0-based. Pyetja duhet të jetë e thjeshtë, me fjalor bazë.`;

  const raw = await chat(system, user, { json: true, temperature: 0.35 });
  const parsed = safeJson<Partial<QuizQuestion>>(raw);
  return {
    id: parsed.id || `easy-${Date.now()}`,
    type: (parsed.type as QuizQuestion["type"]) || "multiple",
    question: parsed.question || `Cila është ideja kryesore e temës "${input.topic}"?`,
    options: parsed.options?.length
      ? parsed.options
      : ["Ideja kryesore", "Diçka tjetër", "Nuk e di", "Asnjëra"],
    correct: typeof parsed.correct === "number" ? parsed.correct : 0,
    hint: parsed.hint || "Mendo për idenë kryesore.",
    feedback: parsed.feedback || "Mirë! Vazhdojmë hap pas hapi.",
  };
}
