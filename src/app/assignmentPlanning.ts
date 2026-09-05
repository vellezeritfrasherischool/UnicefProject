import type { Assignment, Material, Student } from "./types";

export function targetStudentsForMaterial(material: Material, classStudents: Student[]): Student[] {
  const targetIds = material.targetStudentIds?.filter(Boolean);
  return targetIds?.length ? classStudents.filter(student => targetIds.includes(student.id)) : classStudents;
}

export function planNewAssignments(
  material: Material,
  classStudents: Student[],
  existing: Assignment[],
  now = new Date(),
  idFactory: (studentId: string) => string = studentId => `asgn-${material.id}-${studentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
): { students: Student[]; assignments: Assignment[] } {
  const students = targetStudentsForMaterial(material, classStudents);
  const existingStudentIds = new Set(existing.filter(item => item.materialId === material.id).map(item => item.studentId));
  const today = now.toISOString().split("T")[0];
  const deadline = new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0];
  const assignments = students.filter(student => !existingStudentIds.has(student.id)).map(student => ({
    id: idFactory(student.id), materialId: material.id, studentId: student.id,
    deadline, startDate: today, allowRetry: true, showAnswers: true,
    enableAudio: material.audioEnabled !== false, status: "pending" as const, attempts: 0,
  }));
  return { students, assignments };
}

