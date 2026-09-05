import {
  MOCK_MATERIALS,
  MOCK_ASSIGNMENTS,
  MOCK_STUDENTS,
  MOCK_CLASSES,
} from "./mockData";
import type {
  Material,
  Assignment,
  Student,
  ClassGroup,
  LearningProfile,
  LearningReport,
  Flashcard,
  MemoryBoosterPack,
} from "./types";
import { planNewAssignments } from "./assignmentPlanning";

const KEYS = {
  materials: "mesolehte_materials_v2",
  assignments: "mesolehte_assignments_v1",
  students: "mesolehte_students_v2",
  classes: "mesolehte_classes_v1",
  profiles: "mesolehte_learning_profiles_v1",
  reports: "mesolehte_learning_reports_v1",
  flashcards: "mesolehte_flashcards_v1",
  memoryBoosters: "mesolehte_memory_boosters_v1",
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return JSON.parse(raw) as T;
  } catch {
    return structuredClone(fallback);
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
    if (quota) {
      throw new Error(
        "Hapësira e ruajtjes u mbush. Fshi materiale të vjetra ose çaktivizo Vizualizimet."
      );
    }
    throw err;
  }
}

/** Seed once from mock data, then always use localStorage. */
export function getMaterials(): Material[] {
  return load(KEYS.materials, MOCK_MATERIALS).map(m => ({
    ...m,
    illustrations: m.illustrations ?? [],
    englishText: m.englishText ?? "",
  }));
}

export function setMaterials(materials: Material[]) {
  save(KEYS.materials, materials);
}

export function getAssignments(): Assignment[] {
  return load(KEYS.assignments, MOCK_ASSIGNMENTS);
}

export function setAssignments(assignments: Assignment[]) {
  save(KEYS.assignments, assignments);
}

export function getStudents(): Student[] {
  const list = load(KEYS.students, MOCK_STUDENTS);
  return list.map(s => ({
    ...s,
    visualPreferred: s.visualPreferred ?? false,
    audioEnabled: s.audioEnabled ?? true,
  }));
}

export function setStudents(students: Student[]) {
  save(KEYS.students, students);
}

export function getClasses(): ClassGroup[] {
  return load(KEYS.classes, MOCK_CLASSES);
}

export function setClasses(classes: ClassGroup[]) {
  save(KEYS.classes, classes);
}

/** Normalize class labels like "Klasa VI-1" / "VI-1". */
export function normalizeClassName(name: string): string {
  return name.replace(/^Klasa\s+/i, "").trim();
}

export function studentsInClass(className: string): Student[] {
  const target = normalizeClassName(className);
  return getStudents().filter(s => normalizeClassName(s.class) === target);
}

/**
 * When a material is published, create pending assignments.
 * If material.targetStudentIds is set, only those students get it
 * (used for personalized adaptation variants). Otherwise: whole class.
 */
export function publishMaterialToStudents(material: Material): Assignment[] {
  const classStudents = studentsInClass(material.class);
  const existing = getAssignments();
  const { students, assignments: created } = planNewAssignments(material, classStudents, existing);

  if (created.length > 0) {
    setAssignments([...created, ...existing]);
  }

  // Update material stats
  const materials = getMaterials().map(m =>
    m.id === material.id
      ? { ...m, status: "published" as const, studentCount: students.length }
      : m
  );
  setMaterials(materials);

  return created;
}

// ── Learning intelligence persistence ─────────────────────────────────────────

export function getLearningProfiles(): LearningProfile[] {
  return load(KEYS.profiles, [] as LearningProfile[]);
}

export function setLearningProfiles(profiles: LearningProfile[]) {
  save(KEYS.profiles, profiles);
}

export function getLearningProfile(studentId: string): LearningProfile | undefined {
  return getLearningProfiles().find(p => p.studentId === studentId);
}

export function upsertLearningProfile(profile: LearningProfile) {
  const all = getLearningProfiles();
  const idx = all.findIndex(p => p.studentId === profile.studentId);
  if (idx >= 0) {
    all[idx] = profile;
  } else {
    all.push(profile);
  }
  setLearningProfiles(all);
}

export function getLearningReports(): LearningReport[] {
  return load(KEYS.reports, [] as LearningReport[]);
}

export function setLearningReports(reports: LearningReport[]) {
  save(KEYS.reports, reports);
}

export function addLearningReport(report: LearningReport) {
  setLearningReports([report, ...getLearningReports()]);
}

export function getReportsForStudent(studentId: string): LearningReport[] {
  return getLearningReports().filter(r => r.studentId === studentId);
}

export function getReportByAssignment(assignmentId: string): LearningReport | undefined {
  return getLearningReports().find(r => r.assignmentId === assignmentId);
}

export function getFlashcards(): Flashcard[] {
  return load(KEYS.flashcards, [] as Flashcard[]);
}

export function setFlashcards(cards: Flashcard[]) {
  save(KEYS.flashcards, cards);
}

export function getFlashcardsForMaterial(materialId: string): Flashcard[] {
  return getFlashcards().filter(c => c.materialId === materialId);
}

export function upsertFlashcardsForMaterial(materialId: string, cards: Flashcard[]) {
  const others = getFlashcards().filter(c => c.materialId !== materialId);
  setFlashcards([...cards, ...others]);
}

export function getMemoryBoosters(): MemoryBoosterPack[] {
  return load(KEYS.memoryBoosters, [] as MemoryBoosterPack[]);
}

export function setMemoryBoosters(packs: MemoryBoosterPack[]) {
  save(KEYS.memoryBoosters, packs);
}

export function addMemoryBooster(pack: MemoryBoosterPack) {
  setMemoryBoosters([pack, ...getMemoryBoosters()]);
}

export function getMemoryBoostersForStudent(studentId: string): MemoryBoosterPack[] {
  return getMemoryBoosters().filter(p => p.studentId === studentId);
}

export function getMemoryBoosterByAssignment(assignmentId: string): MemoryBoosterPack | undefined {
  return getMemoryBoosters().find(p => p.assignmentId === assignmentId);
}
