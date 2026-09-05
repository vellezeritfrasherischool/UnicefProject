import type { QuizQuestion } from "./types";

function clean(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("sq-AL").replace(/\s+/g, " ");
}

/** Resolve the answer index even when imported/AI data uses "1", "B", or option text. */
export function correctOptionIndex(question: QuizQuestion): number | null {
  if (!question.options?.length) return null;
  if (typeof question.correct === "number" && Number.isInteger(question.correct)) {
    return question.correct >= 0 && question.correct < question.options.length ? question.correct : null;
  }
  const value = clean(question.correct);
  if (/^\d+$/.test(value)) {
    const index = Number(value);
    if (index >= 0 && index < question.options.length) return index;
  }
  if (/^[a-z]$/.test(value)) {
    const index = value.charCodeAt(0) - 97;
    if (index >= 0 && index < question.options.length) return index;
  }
  const byText = question.options.findIndex(option => clean(option) === value);
  return byText >= 0 ? byText : null;
}

export function isCorrectQuizAnswer(question: QuizQuestion, answer: unknown): boolean {
  if (question.options?.length) {
    const expected = correctOptionIndex(question);
    return expected !== null && Number(answer) === expected;
  }
  const expected = clean(question.correct);
  const actual = clean(answer);
  return Boolean(expected && actual && (actual === expected || actual.includes(expected)));
}

/** Existing AI material may contain duplicate IDs; answers require one unique key per question. */
export function normalizeQuizQuestionIds(questions: QuizQuestion[]): QuizQuestion[] {
  const used = new Set<string>();
  return questions.map((question, index) => {
    const base = String(question.id || `q-${index + 1}`).trim() || `q-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id === question.id ? question : { ...question, id };
  });
}
