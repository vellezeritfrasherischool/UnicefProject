import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "./types";
import { correctOptionIndex, isCorrectQuizAnswer, normalizeQuizQuestionIds } from "./quizScoring";

const question = (correct: string | number): QuizQuestion => ({
  id: "q1", type: "multiple", question: "Test", options: ["Një", "Dy", "Tre"], correct, feedback: "",
});

describe("quiz scoring", () => {
  it("accepts numeric, letter and option-text correct-answer formats", () => {
    expect(correctOptionIndex(question(1))).toBe(1);
    expect(correctOptionIndex(question("1"))).toBe(1);
    expect(correctOptionIndex(question("B"))).toBe(1);
    expect(correctOptionIndex(question("Dy"))).toBe(1);
    expect(isCorrectQuizAnswer(question("B"), 1)).toBe(true);
  });

  it("gives duplicate AI question IDs stable unique answer keys", () => {
    const normalized = normalizeQuizQuestionIds([question(0), question(1), question(2)]);
    expect(normalized.map(item => item.id)).toEqual(["q1", "q1-2", "q1-3"]);
    expect(new Set(normalized.map(item => item.id)).size).toBe(3);
  });
});
