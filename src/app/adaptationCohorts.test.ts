import { describe, expect, it } from "vitest";
import { buildAdaptationCohorts, cohortKeyForStudent } from "./adaptationCohorts";
import type { Student } from "./types";

const student = (id: string, patch: Partial<Student> = {}): Student => ({
  id, name: id, class: "VI-1", age: 12, readingLevel: "Mesatar", score: 0,
  completedMaterials: 0, status: "active", preferredFont: "lexend",
  audioEnabled: false, visualPreferred: false, language: "sq", ...patch,
});

describe("adaptation cohorts", () => {
  it("assigns each learner to the expected deterministic cohort", () => {
    expect(cohortKeyForStudent(student("visual-basic", { visualPreferred: true, readingLevel: "Bazik" }))).toBe("visual-basic");
    expect(cohortKeyForStudent(student("audio", { audioEnabled: true }))).toBe("audio");
    expect(cohortKeyForStudent(student("advanced", { readingLevel: "Avancuar" }))).toBe("advanced");
    expect(cohortKeyForStudent(student("standard"))).toBe("standard");
  });

  it("groups similar learners once without losing or duplicating IDs", () => {
    const learners = [student("a", { readingLevel: "Bazik" }), student("b", { readingLevel: "Bazik" }), student("c")];
    const cohorts = buildAdaptationCohorts(learners, new Map());
    expect(cohorts.map(c => c.key)).toEqual(["basic", "standard"]);
    expect(cohorts.find(c => c.key === "basic")?.studentIds).toEqual(["a", "b"]);
    expect(cohorts.flatMap(c => c.studentIds).sort()).toEqual(["a", "b", "c"]);
  });
});

