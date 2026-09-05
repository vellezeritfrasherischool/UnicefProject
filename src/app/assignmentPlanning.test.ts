import { describe, expect, it } from "vitest";
import { planNewAssignments } from "./assignmentPlanning";
import type { Assignment, Material, Student } from "./types";

const material = (targets?: string[]): Material => ({
  id: "material-1", title: "M", subject: "S", class: "VI-1", originalText: "",
  simplifiedText: "", summary: "", keyPoints: [], vocabulary: [], quiz: [], englishText: "",
  teacherNotes: "", illustrations: [], status: "approved", createdAt: "2026-09-05",
  studentCount: 0, completionRate: 0, estimatedMinutes: 10, targetStudentIds: targets,
});
const student = (id: string): Student => ({ id, name: id, class: "VI-1", age: 12, readingLevel: "Mesatar", score: 0,
  completedMaterials: 0, status: "active", preferredFont: "lexend", audioEnabled: true, visualPreferred: false, language: "sq" });

describe("assignment planning", () => {
  it("targets only selected cohort students", () => {
    const result = planNewAssignments(material(["b"]), [student("a"), student("b")], [], new Date("2026-09-05T00:00:00Z"), id => id);
    expect(result.assignments.map(item => item.studentId)).toEqual(["b"]);
  });

  it("does not duplicate an existing material/student assignment", () => {
    const existing = [{ materialId: "material-1", studentId: "a" }] as Assignment[];
    const result = planNewAssignments(material(), [student("a"), student("b")], existing, new Date("2026-09-05T00:00:00Z"), id => id);
    expect(result.assignments.map(item => item.studentId)).toEqual(["b"]);
    expect(result.assignments[0].deadline).toBe("2026-09-19");
  });
});
