import {
  ALL_BADGES, MOCK_STUDENT_BADGES, MOCK_XP_TRANSACTIONS, LEVEL_THRESHOLDS
} from "./mockData";
import type {
  Material, Student, ClassGroup, Assignment,
  Badge, StudentBadge, XPTransaction, StudentLevel, BadgeProgress, QuizQuestion
} from "./types";
import { planNewAssignments } from "./assignmentPlanning";
import {
  adaptMaterialWithAI,
  explainSentenceWithAI,
  explainWordWithAI,
  translateWithAI,
  synthesizeAlbanianSpeech,
  synthesizeEnglishSpeech,
  chunkTextForTTS,
  generateEducationalIllustration,
  lessonChatWithAI,
  type AdaptMaterialOptions,
  type AdaptedMaterial,
  type LessonChatOptions,
} from "./openai";
import {
  generatePostLessonIntelligence,
  generateFlashcardsFromMaterial,
  explainWrongAnswerWithAI,
  generateEasierQuestionWithAI,
} from "./openaiLearning";
import {
  getMaterials, setMaterials,
  getAssignments, setAssignments,
  getStudents, setStudents, getClasses, setClasses,
  normalizeClassName, studentsInClass,
  publishMaterialToStudents,
  getLearningProfile, upsertLearningProfile,
  addLearningReport, getReportByAssignment, getReportsForStudent,
  upsertFlashcardsForMaterial, getFlashcardsForMaterial,
  addMemoryBooster, getMemoryBoosterByAssignment, getMemoryBoostersForStudent,
} from "./localDb";
import { isSupabaseEnabled } from "./supabase";
import {
  sbGetMaterials,
  sbGetMaterialById,
  sbUpsertMaterial,
  sbDeleteMaterial,
  sbGetAssignments,
  sbGetAssignmentsForStudent,
  sbUpsertAssignments,
  sbDeleteAssignmentsForMaterial,
  sbGetAssignmentById,
  sbRegisterTeacher,
  sbSignIn,
  sbSignOut,
  sbGetSessionUser,
  sbGetClassesForTeacher,
  sbCreateClass,
  sbGetStudentsByClassId,
  sbGetStudentsByClassName,
  sbGetStudentById,
  sbGetStudentsForTeacher,
  sbCreateStudentAccount,
  sbRegisterStudentSelf,
  sbJoinClassWithCode,
  sbUpdateStudent,
  sbGetXpForStudent,
  sbInsertXp,
  sbGetBadgesForStudent,
  sbInsertStudentBadge,
  sbGetLearningProfile,
  sbUpsertLearningProfile,
  sbGetReportsForStudent,
  sbGetReportByAssignment,
  sbInsertLearningReport,
  sbGetFlashcardsForMaterial,
  sbUpsertFlashcardsForMaterial,
  sbGetMemoryBoostersForStudent,
  sbGetMemoryBoosterByAssignment,
  sbInsertMemoryBooster,
  sbCountLearningEvents,
} from "./supabaseDb";
import type { User } from "./types";
import {
  countEvents,
  getSessionMinutes,
  clearSessionStart,
} from "./learningTracker";
import type {
  LearningProfile,
  LearningReport,
  Flashcard,
  MemoryBoosterPack,
  SessionMetrics,
  WrongQuestionDetail,
} from "./types";

export type { AdaptMaterialOptions, AdaptedMaterial };

const delay = (ms = 300) => new Promise(res => setTimeout(res, ms));

// ── Auth ─────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authService = {
  async login(email: string, password: string): Promise<User> {
    if (isSupabaseEnabled()) {
      return sbSignIn(email, password);
    }
    await delay(400);
    if (email === "mesuesi@mesolehte.com") {
      return { id: "teacher-1", name: "Arta Osmani", email, role: "teacher" as const };
    }
    if (email === "nxenesi@mesolehte.com") {
      return { id: "stu-1", name: "Ardi Hoxha", email, role: "student" as const, class: "VI-1" };
    }
    throw new Error("Email ose fjalëkalimi është i gabuar.");
  },

  async registerTeacher(name: string, email: string, password: string, invitation: string): Promise<User> {
    if (!isSupabaseEnabled()) {
      throw new Error("Regjistrimi kërkon Supabase. Aktivizo VITE_USE_SUPABASE në .env.");
    }
    if (password.length < 8) throw new Error("Fjalëkalimi duhet të ketë së paku 8 karaktere.");
    if (!invitation.trim()) throw new Error("Kodi i ftesës është i detyrueshëm.");
    return sbRegisterTeacher(name, email, password, invitation);
  },

  async registerStudent(input: {
    name: string;
    email: string;
    password: string;
    joinCode?: string;
  }): Promise<User> {
    if (!isSupabaseEnabled()) {
      throw new Error("Regjistrimi kërkon Supabase. Aktivizo VITE_USE_SUPABASE në .env.");
    }
    if (input.password.length < 8) throw new Error("Fjalëkalimi duhet të ketë së paku 8 karaktere.");
    return sbRegisterStudentSelf(input);
  },

  async joinClass(userId: string, joinCode: string): Promise<User> {
    if (!isSupabaseEnabled()) {
      throw new Error("Bashkimi me klasën kërkon Supabase.");
    }
    const { user, student } = await sbJoinClassWithCode(userId, joinCode);
    try {
      await ensurePublishedAssignmentsForStudent(student);
    } catch (err) {
      console.warn("[joinClass] assignment backfill failed", err);
    }
    return user;
  },

  async logout(): Promise<void> {
    if (isSupabaseEnabled()) await sbSignOut();
  },

  async getSessionUser(): Promise<User | null> {
    if (!isSupabaseEnabled()) return null;
    try {
      return await sbGetSessionUser();
    } catch {
      return null;
    }
  },
};

// ── Materials ─────────────────────────────────────────────────────────────────

async function publishMaterialCloud(material: Material): Promise<number> {
  const classStudents = await sbGetStudentsByClassName(material.class);
  const existing = await sbGetAssignments();
  const { students, assignments: created } = planNewAssignments(material, classStudents, existing);

  const published: Material = {
    ...material,
    status: "published",
    studentCount: students.length,
  };
  await sbUpsertMaterial(published);
  if (created.length > 0) await sbUpsertAssignments(created);
  return created.length;
}

/** Create missing assignments for published class materials (join-after-publish / reload heal). */
async function ensurePublishedAssignmentsForStudent(student: {
  id: string;
  class: string;
}): Promise<number> {
  const materials = await sbGetMaterials();
  const existing = await sbGetAssignmentsForStudent(student.id);
  const have = new Set(existing.map(a => a.materialId));
  const classNorm = normalizeClassName(student.class);
  const today = new Date().toISOString().split("T")[0];
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const created: Assignment[] = [];

  for (const m of materials) {
    if (m.status !== "published") continue;
    if (normalizeClassName(m.class) !== classNorm) continue;
    if (m.targetStudentIds?.length && !m.targetStudentIds.includes(student.id)) continue;
    if (have.has(m.id)) continue;
    created.push({
      id: `asgn-${m.id}-${student.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      materialId: m.id,
      studentId: student.id,
      deadline,
      startDate: today,
      allowRetry: true,
      showAnswers: true,
      enableAudio: m.audioEnabled !== false,
      status: "pending",
      attempts: 0,
    });
  }

  if (created.length > 0) await sbUpsertAssignments(created);
  return created.length;
}

export const materialService = {
  async getAll(): Promise<Material[]> {
    await delay(150);
    if (isSupabaseEnabled()) return sbGetMaterials();
    return getMaterials();
  },
  async getById(id: string): Promise<Material | undefined> {
    await delay(100);
    if (isSupabaseEnabled()) return sbGetMaterialById(id);
    return getMaterials().find(m => m.id === id);
  },
  async create(data: Partial<Material>): Promise<Material> {
    await delay(200);
    const mat: Material = {
      id: data.id ?? `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: data.title ?? "Material i ri",
      subject: data.subject ?? "",
      class: data.class ?? "",
      originalText: data.originalText ?? "",
      simplifiedText: data.simplifiedText ?? "",
      summary: data.summary ?? "",
      keyPoints: data.keyPoints ?? [],
      vocabulary: data.vocabulary ?? [],
      quiz: data.quiz ?? [],
      teacherNotes: data.teacherNotes ?? "",
      englishText: data.englishText ?? "",
      illustrations: data.illustrations ?? [],
      status: "draft",
      createdAt: new Date().toISOString().split("T")[0],
      studentCount: data.targetStudentIds?.length ?? 0,
      completionRate: 0,
      estimatedMinutes: data.estimatedMinutes ?? 15,
      targetStudentIds: data.targetStudentIds,
      adaptationGroupId: data.adaptationGroupId,
      adaptationKey: data.adaptationKey,
      adaptationLabel: data.adaptationLabel,
      audioEnabled: data.audioEnabled,
      enabledSections: data.enabledSections,
      teacherId: data.teacherId,
    };
    if (isSupabaseEnabled()) return sbUpsertMaterial(mat);
    setMaterials([mat, ...getMaterials()]);
    return mat;
  },
  async update(id: string, patch: Partial<Material>): Promise<Material | undefined> {
    await delay(150);
    if (isSupabaseEnabled()) {
      const current = await sbGetMaterialById(id);
      if (!current) return undefined;
      return sbUpsertMaterial({ ...current, ...patch, id });
    }
    const materials = getMaterials();
    const idx = materials.findIndex(m => m.id === id);
    if (idx < 0) return undefined;
    const updated = { ...materials[idx], ...patch, id };
    const next = [...materials];
    next[idx] = updated;
    setMaterials(next);
    return updated;
  },
  async updateStatus(id: string, status: Material["status"]): Promise<{ assigned: number }> {
    await delay(200);
    if (isSupabaseEnabled()) {
      const mat = await sbGetMaterialById(id);
      if (!mat) return { assigned: 0 };
      if (status === "published") {
        const assigned = await publishMaterialCloud(mat);
        return { assigned };
      }
      await sbUpsertMaterial({ ...mat, status });
      return { assigned: 0 };
    }

    const materials = getMaterials();
    const mat = materials.find(m => m.id === id);
    if (!mat) return { assigned: 0 };

    if (status === "published") {
      const created = publishMaterialToStudents({ ...mat, status: "published" });
      return { assigned: created.length };
    }

    setMaterials(materials.map(m => m.id === id ? { ...m, status } : m));
    return { assigned: 0 };
  },
  async delete(id: string): Promise<void> {
    await delay(150);
    if (isSupabaseEnabled()) {
      await sbDeleteAssignmentsForMaterial(id);
      await sbDeleteMaterial(id);
      return;
    }
    setMaterials(getMaterials().filter(m => m.id !== id));
    setAssignments(getAssignments().filter(a => a.materialId !== id));
  },
};

// ── Students ──────────────────────────────────────────────────────────────────

export const studentService = {
  async getAll(teacherId?: string): Promise<Student[]> {
    await delay(150);
    if (isSupabaseEnabled()) {
      if (!teacherId) return [];
      return sbGetStudentsForTeacher(teacherId);
    }
    return getStudents();
  },
  async getById(id: string): Promise<Student | undefined> {
    await delay(100);
    if (isSupabaseEnabled()) return sbGetStudentById(id);
    return getStudents().find(s => s.id === id);
  },
  async getByClass(classId: string): Promise<Student[]> {
    await delay(100);
    if (isSupabaseEnabled()) return sbGetStudentsByClassId(classId);
    const cls = getClasses().find(c => c.id === classId);
    if (!cls) return [];
    return studentsInClass(cls.name);
  },
  async create(input: {
    name: string;
    class: string;
    age: number;
    readingLevel?: string;
    audioEnabled?: boolean;
    visualPreferred?: boolean;
    email?: string;
    password?: string;
    classId?: string;
    teacherId?: string;
  }): Promise<Student> {
    await delay(150);
    if (isSupabaseEnabled()) {
      if (!input.teacherId || !input.classId) {
        throw new Error("Mungon mësuesi ose klasa.");
      }
      if (!input.email || !input.password) {
        throw new Error("Email dhe fjalëkalimi janë të detyrueshëm për nxënësin.");
      }
      return sbCreateStudentAccount({
        teacherId: input.teacherId,
        classId: input.classId,
        name: input.name,
        email: input.email,
        password: input.password,
        age: input.age,
        readingLevel: input.readingLevel,
        audioEnabled: input.audioEnabled,
        visualPreferred: input.visualPreferred,
      });
    }

    const name = input.name.trim();
    if (!name) throw new Error("Emri i nxënësit është i detyrueshëm.");
    if (!input.class.trim()) throw new Error("Zgjidh klasën.");
    if (!input.age || input.age < 5 || input.age > 20) throw new Error("Mosha duhet të jetë midis 5 dhe 20.");

    const student: Student = {
      id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      class: normalizeClassName(input.class),
      age: input.age,
      readingLevel: input.readingLevel || "Mesatar",
      score: 0,
      completedMaterials: 0,
      status: "active",
      preferredFont: "lexend",
      audioEnabled: input.audioEnabled ?? true,
      visualPreferred: input.visualPreferred ?? false,
      language: "sq",
      email: input.email,
    };
    setStudents([student, ...getStudents()]);

    setClasses(getClasses().map(c => {
      if (normalizeClassName(c.name) !== normalizeClassName(input.class)) return c;
      return { ...c, studentCount: studentsInClass(c.name).length };
    }));

    return student;
  },
  async createClass(teacherId: string, name: string): Promise<ClassGroup> {
    await delay(100);
    if (isSupabaseEnabled()) {
      return sbCreateClass(teacherId, name);
    }
    const cls: ClassGroup = {
      id: `cls-${Date.now()}`,
      name: name.trim(),
      studentCount: 0,
      activeMaterials: 0,
      averageScore: 0,
    };
    setClasses([...getClasses(), cls]);
    return cls;
  },
  async update(id: string, patch: Partial<Student>): Promise<Student | undefined> {
    await delay(100);
    if (isSupabaseEnabled()) return sbUpdateStudent(id, patch);
    const all = getStudents();
    const idx = all.findIndex(s => s.id === id);
    if (idx < 0) return undefined;
    const updated = { ...all[idx], ...patch, id };
    const next = [...all];
    next[idx] = updated;
    setStudents(next);
    return updated;
  },
  async getClasses(teacherId?: string): Promise<ClassGroup[]> {
    await delay(100);
    if (isSupabaseEnabled()) {
      if (!teacherId) return [];
      return sbGetClassesForTeacher(teacherId);
    }
    const classes = getClasses();
    const assignments = getAssignments();
    const materials = getMaterials();
    return classes.map(c => {
      const className = normalizeClassName(c.name);
      const students = studentsInClass(c.name);
      const classMaterials = materials.filter(
        m => normalizeClassName(m.class) === className && m.status === "published"
      );
      const classAsgn = assignments.filter(a => students.some(s => s.id === a.studentId));
      const completed = classAsgn.filter(a => a.status === "completed" && a.score != null);
      const averageScore = completed.length
        ? Math.round(completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length)
        : c.averageScore;
      return {
        ...c,
        studentCount: students.length,
        activeMaterials: classMaterials.length,
        averageScore,
      };
    });
  },
};

// ── Assignments ───────────────────────────────────────────────────────────────

export const assignmentService = {
  async getForStudent(studentId: string): Promise<Assignment[]> {
    await delay(150);
    if (isSupabaseEnabled()) {
      return sbGetAssignmentsForStudent(studentId);
    }
    return getAssignments()
      .filter(a => a.studentId === studentId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },

  /** Heal missing assignments for published materials in the student's class. */
  async syncPublishedForStudent(studentId: string): Promise<number> {
    if (!isSupabaseEnabled()) return 0;
    const student = await sbGetStudentById(studentId);
    if (!student) return 0;
    return ensurePublishedAssignmentsForStudent(student);
  },
  async getById(id: string): Promise<Assignment | undefined> {
    await delay(100);
    if (isSupabaseEnabled()) return sbGetAssignmentById(id);
    return getAssignments().find(a => a.id === id);
  },
  async getByMaterialForStudent(materialId: string, studentId: string): Promise<Assignment | undefined> {
    await delay(80);
    if (isSupabaseEnabled()) {
      const all = await sbGetAssignments();
      return all.find(a => a.materialId === materialId && a.studentId === studentId);
    }
    return getAssignments().find(a => a.materialId === materialId && a.studentId === studentId);
  },
  async create(data: Omit<Assignment, "id">): Promise<Assignment> {
    await delay(150);
    const asgn: Assignment = { ...data, id: `asgn-${Date.now()}` };
    if (isSupabaseEnabled()) {
      await sbUpsertAssignments([asgn]);
      return asgn;
    }
    setAssignments([asgn, ...getAssignments()]);
    return asgn;
  },
  async markInProgress(id: string): Promise<void> {
    await delay(80);
    if (isSupabaseEnabled()) {
      const asgn = await sbGetAssignmentById(id);
      if (!asgn || asgn.status !== "pending") return;
      await sbUpsertAssignments([{ ...asgn, status: "in-progress" }]);
      return;
    }
    setAssignments(getAssignments().map(a =>
      a.id === id && a.status === "pending" ? { ...a, status: "in-progress" as const } : a
    ));
  },
  async complete(
    id: string,
    score: number,
    wordsOpened: number,
    audioUsed: boolean,
    extras?: { timeSpentMinutes?: number }
  ): Promise<void> {
    await delay(150);
    if (isSupabaseEnabled()) {
      const asgn = await sbGetAssignmentById(id);
      if (!asgn) return;
      const updated: Assignment = {
        ...asgn,
        status: "completed",
        score,
        completedAt: new Date().toISOString().split("T")[0],
        wordsOpened,
        audioUsed,
        attempts: (asgn.attempts ?? 0) + 1,
        ...(extras?.timeSpentMinutes != null ? { timeSpentMinutes: extras.timeSpentMinutes } : {}),
      };
      await sbUpsertAssignments([updated]);

      const related = (await sbGetAssignments()).filter(a => a.materialId === asgn.materialId);
      const done = related.filter(a => a.status === "completed").length;
      const rate = related.length ? Math.round((done / related.length) * 100) : 0;
      const mat = await sbGetMaterialById(asgn.materialId);
      if (mat) await sbUpsertMaterial({ ...mat, completionRate: rate });
      return;
    }

    setAssignments(getAssignments().map(a =>
      a.id === id ? {
        ...a,
        status: "completed" as const,
        score,
        completedAt: new Date().toISOString().split("T")[0],
        wordsOpened,
        audioUsed,
        attempts: (a.attempts ?? 0) + 1,
        ...(extras?.timeSpentMinutes != null ? { timeSpentMinutes: extras.timeSpentMinutes } : {}),
      } : a
    ));

    const asgn = getAssignments().find(a => a.id === id);
    if (asgn) {
      const related = getAssignments().filter(a => a.materialId === asgn.materialId);
      const done = related.filter(a => a.status === "completed").length;
      const rate = related.length ? Math.round((done / related.length) * 100) : 0;
      setMaterials(getMaterials().map(m =>
        m.id === asgn.materialId ? { ...m, completionRate: rate } : m
      ));
    }
  },
};

// ── AI Service ────────────────────────────────────────────────────────────────

export const aiService = {
  async simplifyText(text: string): Promise<string> {
    const result = await adaptMaterialWithAI({
      text,
      title: "Material",
      subject: "E përgjithshme",
      level: 2,
      length: "mesatar",
      numQuestions: 0,
      includeSummary: false,
      includeKeyPoints: false,
      includeVocab: false,
      includeQuiz: false,
      includeTeacherNotes: false,
      includeTranslation: false,
    });
    return result.simplifiedText;
  },

  async summarizeText(text: string): Promise<string> {
    const result = await adaptMaterialWithAI({
      text,
      title: "Material",
      subject: "E përgjithshme",
      level: 2,
      length: "shkurtër",
      numQuestions: 0,
      includeSummary: true,
      includeKeyPoints: false,
      includeVocab: false,
      includeQuiz: false,
      includeTeacherNotes: false,
      includeTranslation: false,
    });
    return result.summary;
  },

  async generateQuiz(text: string, numQuestions = 5): Promise<QuizQuestion[]> {
    const result = await adaptMaterialWithAI({
      text,
      title: "Material",
      subject: "E përgjithshme",
      level: 2,
      length: "mesatar",
      numQuestions,
      includeSummary: false,
      includeKeyPoints: false,
      includeVocab: false,
      includeQuiz: true,
      includeTeacherNotes: false,
      includeTranslation: false,
    });
    return result.quiz;
  },

  async adaptMaterial(opts: AdaptMaterialOptions): Promise<AdaptedMaterial> {
    return adaptMaterialWithAI(opts);
  },

  async explainWord(word: string): Promise<{ definition: string; synonym: string; example: string }> {
    return explainWordWithAI(word);
  },

  async explainSentence(sentence: string, action?: string): Promise<string> {
    return explainSentenceWithAI(sentence, action);
  },

  async lessonChat(opts: LessonChatOptions): Promise<string> {
    return lessonChatWithAI(opts);
  },

  async translateText(text: string, lang: string): Promise<string> {
    return translateWithAI(text, lang);
  },

  async generateTeacherNotes(text: string): Promise<string> {
    const result = await adaptMaterialWithAI({
      text,
      title: "Material",
      subject: "E përgjithshme",
      level: 2,
      length: "mesatar",
      numQuestions: 0,
      includeSummary: false,
      includeKeyPoints: false,
      includeVocab: false,
      includeQuiz: false,
      includeTeacherNotes: true,
      includeTranslation: false,
    });
    return result.teacherNotes;
  },

  async generateAudio(text: string, lang: "sq" | "en" = "sq"): Promise<string> {
    const blob = lang === "en"
      ? await synthesizeEnglishSpeech(text)
      : await synthesizeAlbanianSpeech(text);
    return URL.createObjectURL(blob);
  },

  async generateAudioChunks(text: string, lang: "sq" | "en" = "sq"): Promise<string[]> {
    const parts = chunkTextForTTS(text);
    const urls: string[] = [];
    for (const part of parts) {
      const blob = lang === "en"
        ? await synthesizeEnglishSpeech(part)
        : await synthesizeAlbanianSpeech(part);
      urls.push(URL.createObjectURL(blob));
    }
    return urls;
  },

  async generateIllustration(prompt: string): Promise<string> {
    return generateEducationalIllustration(prompt);
  },

  async generateFlashcards(material: {
    id: string;
    title: string;
    subject: string;
    simplifiedText: string;
    keyPoints?: string[];
    vocabulary?: { word: string; definition: string }[];
  }): Promise<Flashcard[]> {
    const raw = await generateFlashcardsFromMaterial({
      title: material.title,
      subject: material.subject,
      text: material.simplifiedText,
      keyPoints: material.keyPoints,
      vocabulary: material.vocabulary,
    });
    const cards: Flashcard[] = raw.map((c, i) => ({
      id: `fc-${material.id}-${i}-${Date.now()}`,
      materialId: material.id,
      front: c.front,
      back: c.back,
      type: c.type,
    }));
    upsertFlashcardsForMaterial(material.id, cards);
    return cards;
  },

  async explainWrongAnswer(input: {
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    topic: string;
    visualPreferred?: boolean;
  }) {
    return explainWrongAnswerWithAI(input);
  },

  async generateEasierQuestion(input: {
    original: QuizQuestion;
    topic: string;
    subject: string;
    visualPreferred?: boolean;
  }): Promise<QuizQuestion> {
    return generateEasierQuestionWithAI(input);
  },
};

// ── Learning intelligence (reports, profile, memory booster) ──────────────────

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

export const learningService = {
  async getProfile(studentId: string): Promise<LearningProfile | undefined> {
    await delay(80);
    if (isSupabaseEnabled()) return sbGetLearningProfile(studentId);
    return getLearningProfile(studentId);
  },

  async getReportsForStudent(studentId: string): Promise<LearningReport[]> {
    await delay(80);
    if (isSupabaseEnabled()) return sbGetReportsForStudent(studentId);
    return getReportsForStudent(studentId);
  },

  async getReportByAssignment(assignmentId: string): Promise<LearningReport | undefined> {
    await delay(80);
    if (isSupabaseEnabled()) return sbGetReportByAssignment(assignmentId);
    return getReportByAssignment(assignmentId);
  },

  async getFlashcards(materialId: string): Promise<Flashcard[]> {
    await delay(80);
    if (isSupabaseEnabled()) return sbGetFlashcardsForMaterial(materialId);
    return getFlashcardsForMaterial(materialId);
  },

  async getMemoryBoosters(studentId: string): Promise<MemoryBoosterPack[]> {
    await delay(80);
    if (isSupabaseEnabled()) return sbGetMemoryBoostersForStudent(studentId);
    return getMemoryBoostersForStudent(studentId);
  },

  async getMemoryBoosterByAssignment(assignmentId: string): Promise<MemoryBoosterPack | undefined> {
    await delay(80);
    if (isSupabaseEnabled()) return sbGetMemoryBoosterByAssignment(assignmentId);
    return getMemoryBoosterByAssignment(assignmentId);
  },

  /** Build metrics from tracked events + quiz outcome, then run AI pipeline. */
  async runPostLessonAnalysis(input: {
    studentId: string;
    materialId: string;
    assignmentId: string;
    score: number;
    attempts: number;
    wrongQuestions: WrongQuestionDetail[];
    hintCount: number;
    /** When true, do not mark/complete the assignment again (e.g. teacher regenerating a missing report). */
    skipAssignmentComplete?: boolean;
  }): Promise<{ report: LearningReport; profile: LearningProfile; booster: MemoryBoosterPack }> {
    const material = isSupabaseEnabled()
      ? await sbGetMaterialById(input.materialId)
      : getMaterials().find(m => m.id === input.materialId);

    let explainCount = countEvents(input.studentId, input.materialId, "explain");
    let audioPlayCount = countEvents(input.studentId, input.materialId, "audio");
    let vocabOpened = countEvents(input.studentId, input.materialId, "vocab");
    let simplifiedViews = countEvents(input.studentId, input.materialId, "simplified_view");

    if (isSupabaseEnabled()) {
      const [cExplain, cAudio, cVocab, cSimp] = await Promise.all([
        sbCountLearningEvents(input.studentId, input.materialId, "explain"),
        sbCountLearningEvents(input.studentId, input.materialId, "audio"),
        sbCountLearningEvents(input.studentId, input.materialId, "vocab"),
        sbCountLearningEvents(input.studentId, input.materialId, "simplified_view"),
      ]);
      // Prefer the higher count (local may be ahead of async cloud inserts)
      explainCount = Math.max(explainCount, cExplain);
      audioPlayCount = Math.max(audioPlayCount, cAudio);
      vocabOpened = Math.max(vocabOpened, cVocab);
      simplifiedViews = Math.max(simplifiedViews, cSimp);
    }

    const simplifiedUsed = simplifiedViews > 0 || Boolean(material?.simplifiedText);
    const timeSpentMinutes = getSessionMinutes(input.studentId, input.materialId);

    const metrics: SessionMetrics = {
      studentId: input.studentId,
      materialId: input.materialId,
      assignmentId: input.assignmentId,
      score: input.score,
      timeSpentMinutes,
      attempts: input.attempts,
      explainCount,
      audioPlayCount,
      simplifiedUsed,
      vocabOpened,
      hintCount: input.hintCount,
      wrongQuestions: input.wrongQuestions,
      topic: material?.title ?? "Material",
      subject: material?.subject ?? "",
    };

    const existing = isSupabaseEnabled()
      ? await sbGetLearningProfile(input.studentId)
      : getLearningProfile(input.studentId);
    const student = isSupabaseEnabled()
      ? await sbGetStudentById(input.studentId)
      : getStudents().find(s => s.id === input.studentId);
    const ai = await generatePostLessonIntelligence(metrics, existing, {
      visualPreferred: Boolean(student?.visualPreferred),
    });

    const report: LearningReport = {
      id: `rep-${Date.now()}`,
      studentId: input.studentId,
      materialId: input.materialId,
      assignmentId: input.assignmentId,
      performanceSummary: ai.performanceSummary,
      strengths: ai.strengths,
      difficulties: ai.difficulties,
      recommendations: ai.recommendations,
      nextLessonSteps: ai.nextLessonSteps,
      patterns: ai.patterns,
      teacherRecommendations: ai.teacherRecommendations,
      studentMessage: ai.studentMessage,
      studyPlan: ai.studyPlan,
      fullTeacherReport: ai.fullTeacherReport,
      createdAt: new Date().toISOString(),
    };

    const profile: LearningProfile = {
      studentId: input.studentId,
      traits: ai.profileUpdate.traits.length ? ai.profileUpdate.traits : (existing?.traits ?? []),
      strengths: ai.profileUpdate.strengths.length ? ai.profileUpdate.strengths : (existing?.strengths ?? []),
      supportNeeds: ai.profileUpdate.supportNeeds.length
        ? ai.profileUpdate.supportNeeds
        : (existing?.supportNeeds ?? []),
      preferredFormats: ai.profileUpdate.preferredFormats.length
        ? ai.profileUpdate.preferredFormats
        : (existing?.preferredFormats ?? []),
      teacherRecommendations: ai.profileUpdate.teacherRecommendations.length
        ? ai.profileUpdate.teacherRecommendations
        : (existing?.teacherRecommendations ?? []),
      updatedAt: new Date().toISOString(),
      sessionCount: (existing?.sessionCount ?? 0) + 1,
    };

    const boosterCards: Flashcard[] = (ai.memoryBooster.flashcards || [])
      .filter(c => c.front && c.back)
      .slice(0, 5)
      .map((c, i) => ({
        id: `mb-fc-${input.assignmentId}-${i}`,
        materialId: input.materialId,
        front: c.front,
        back: c.back,
        type: (c.type === "definition" || c.type === "concept" || c.type === "quick"
          ? c.type
          : "quick") as Flashcard["type"],
      }));

    const existingCards = isSupabaseEnabled()
      ? await sbGetFlashcardsForMaterial(input.materialId)
      : getFlashcardsForMaterial(input.materialId);
    if (existingCards.length === 0 && boosterCards.length) {
      const materialCards = boosterCards.map((c, i) => ({
        ...c,
        id: `fc-${input.materialId}-mb-${i}`,
      }));
      if (!isSupabaseEnabled()) {
        upsertFlashcardsForMaterial(input.materialId, materialCards);
      }
    }

    const booster: MemoryBoosterPack = {
      id: `mb-${Date.now()}`,
      studentId: input.studentId,
      materialId: input.materialId,
      assignmentId: input.assignmentId,
      shortSummary: ai.memoryBooster.shortSummary,
      flashcards: boosterCards,
      reviewQuestions: (ai.memoryBooster.reviewQuestions || []).slice(0, 5),
      reviewSchedule: {
        after1Day: isoPlusDays(1),
        after3Days: isoPlusDays(3),
        after7Days: isoPlusDays(7),
      },
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseEnabled()) {
      await sbInsertLearningReport(report);
      await sbUpsertLearningProfile(profile);
      await sbInsertMemoryBooster(booster);
    } else {
      addLearningReport(report);
      upsertLearningProfile(profile);
      addMemoryBooster(booster);
    }

    if (!input.skipAssignmentComplete) {
      await assignmentService.complete(
        input.assignmentId,
        input.score,
        vocabOpened,
        audioPlayCount > 0,
        { timeSpentMinutes }
      );
    }

    clearSessionStart(input.studentId, input.materialId);

    return { report, profile, booster };
  },

  /**
   * Create AI reports for completed assignments that have no cloud/local report yet
   * (e.g. finished before learning_reports table existed).
   */
  async generateMissingReportsForStudent(studentId: string): Promise<number> {
    const asgns = await assignmentService.getForStudent(studentId);
    const completed = asgns.filter(a => a.status === "completed" && a.score != null);
    let created = 0;
    for (const asgn of completed) {
      const existing = await this.getReportByAssignment(asgn.id);
      if (existing) continue;
      await this.runPostLessonAnalysis({
        studentId,
        materialId: asgn.materialId,
        assignmentId: asgn.id,
        score: asgn.score ?? 0,
        attempts: asgn.attempts ?? 1,
        wrongQuestions: [],
        hintCount: 0,
        skipAssignmentComplete: true,
      });
      created += 1;
    }
    return created;
  },
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analyticsService = {
  async getClassOverview(teacherId?: string) {
    await delay(150);
    let assignments: Assignment[] = [];
    let students: Student[] = [];
    let materials: Material[] = [];

    if (isSupabaseEnabled()) {
      if (!teacherId) {
        return {
          averageScore: 0,
          completionRate: 0,
          averageTimeMinutes: 0,
          wordsExplained: 0,
          audioUsage: 0,
          averageAttempts: 0,
          studentCount: 0,
          activeMaterials: 0,
          completedTasks: 0,
          students: [] as Student[],
          classScores: [] as { name: string; score: number }[],
          weeklyProgress: [] as { week: string; score: number; completion: number }[],
          audioByMaterial: [] as { name: string; usage: number }[],
          recentActivity: [] as { id: string; text: string; time: string }[],
        };
      }
      students = await sbGetStudentsForTeacher(teacherId);
      materials = (await sbGetMaterials()).filter(
        m => m.teacherId === teacherId || students.some(s => normalizeClassName(s.class) === normalizeClassName(m.class))
      );
      const ids = new Set(students.map(s => s.id));
      assignments = (await sbGetAssignments()).filter(a => ids.has(a.studentId));
    } else {
      students = getStudents();
      materials = getMaterials();
      assignments = getAssignments();
    }

    const completed = assignments.filter(a => a.status === "completed" && a.score != null);
    const averageScore = completed.length
      ? Math.round(completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length)
      : 0;
    const completionRate = assignments.length
      ? Math.round((completed.length / assignments.length) * 100)
      : 0;
    const averageTimeMinutes = completed.length
      ? Math.round(completed.reduce((s, a) => s + (a.timeSpentMinutes ?? 15), 0) / completed.length)
      : 0;
    const wordsExplained = completed.reduce((s, a) => s + (a.wordsOpened ?? 0), 0);
    const withAudio = completed.filter(a => a.audioUsed).length;
    const audioUsage = completed.length ? Math.round((withAudio / completed.length) * 100) : 0;
    const averageAttempts = assignments.length
      ? Math.round((assignments.reduce((s, a) => s + (a.attempts ?? 0), 0) / assignments.length) * 10) / 10
      : 0;

    const byClass = new Map<string, number[]>();
    for (const s of students) {
      const list = byClass.get(s.class) ?? [];
      list.push(s.score);
      byClass.set(s.class, list);
    }
    const classScores = [...byClass.entries()].map(([name, scores]) => ({
      name,
      score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    }));

    const weekBuckets = new Map<string, { scores: number[]; done: number; total: number }>();
    for (const a of assignments) {
      const key = a.completedAt || a.startDate || "—";
      const bucket = weekBuckets.get(key) ?? { scores: [], done: 0, total: 0 };
      bucket.total += 1;
      if (a.status === "completed") {
        bucket.done += 1;
        if (a.score != null) bucket.scores.push(a.score);
      }
      weekBuckets.set(key, bucket);
    }
    const weeklyProgress = [...weekBuckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([week, b]) => ({
        week: week.slice(5) || week,
        score: b.scores.length ? Math.round(b.scores.reduce((x, y) => x + y, 0) / b.scores.length) : 0,
        completion: b.total ? Math.round((b.done / b.total) * 100) : 0,
      }));

    const matById = new Map(materials.map(m => [m.id, m]));
    const audioByMaterial = materials
      .filter(m => m.status === "published")
      .slice(0, 8)
      .map(m => {
        const related = assignments.filter(a => a.materialId === m.id && a.status === "completed");
        const used = related.filter(a => a.audioUsed).length;
        return {
          name: m.title.slice(0, 22) || m.id,
          usage: related.length ? Math.round((used / related.length) * 100) : 0,
        };
      });

    const recentActivity = completed
      .slice()
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 6)
      .map(a => {
        const stu = students.find(s => s.id === a.studentId);
        const mat = matById.get(a.materialId);
        return {
          id: a.id,
          text: `${stu?.name ?? "Nxënës"} · ${mat?.title ?? "Material"} · ${a.score}%`,
          time: a.completedAt ?? "",
        };
      });

    // Enrich student scores from assignments when student.score is 0
    const enrichedStudents = students.map(s => {
      const theirs = completed.filter(a => a.studentId === s.id);
      const score = theirs.length
        ? Math.round(theirs.reduce((x, a) => x + (a.score ?? 0), 0) / theirs.length)
        : s.score;
      const completedMaterials = theirs.length || s.completedMaterials;
      let status = s.status;
      if (score > 0 && score < 55) status = "needs-support";
      else if (score >= 85) status = "excellent";
      else if (score > 0) status = "active";
      return {
        ...s,
        score,
        completedMaterials,
        status,
        alertReason: status === "needs-support" ? "Rezultate të ulëta në detyrat e fundit" : s.alertReason,
      };
    });

    return {
      averageScore,
      completionRate,
      averageTimeMinutes,
      wordsExplained,
      audioUsage,
      averageAttempts,
      studentCount: students.length,
      activeMaterials: materials.filter(m => m.status === "published").length,
      completedTasks: completed.length,
      students: enrichedStudents,
      classScores,
      weeklyProgress,
      audioByMaterial,
      recentActivity,
    };
  },
};

// ── Gamification ──────────────────────────────────────────────────────────────

const LS_XP_KEY = "mesolehte_xp";
const LS_BADGES_KEY = "mesolehte_badges";

function loadXP(): XPTransaction[] {
  try {
    const raw = localStorage.getItem(LS_XP_KEY);
    return raw ? JSON.parse(raw) : [...MOCK_XP_TRANSACTIONS];
  } catch { return [...MOCK_XP_TRANSACTIONS]; }
}

function saveXP(txs: XPTransaction[]) {
  localStorage.setItem(LS_XP_KEY, JSON.stringify(txs));
}

function loadStudentBadges(): StudentBadge[] {
  try {
    const raw = localStorage.getItem(LS_BADGES_KEY);
    return raw ? JSON.parse(raw) : [...MOCK_STUDENT_BADGES];
  } catch { return [...MOCK_STUDENT_BADGES]; }
}

function saveStudentBadges(badges: StudentBadge[]) {
  localStorage.setItem(LS_BADGES_KEY, JSON.stringify(badges));
}

function calculateLevel(totalXP: number): { level: number; currentLevelXP: number; nextLevelXP: number; progressPercentage: number } {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  const currentLevelXP = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextLevelXP = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const xpInLevel = totalXP - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  const progressPercentage = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
  return { level, currentLevelXP, nextLevelXP, progressPercentage };
}

export const gamificationService = {
  async getStudentLevel(studentId: string): Promise<StudentLevel> {
    await delay(150);
    const txs = isSupabaseEnabled()
      ? await sbGetXpForStudent(studentId)
      : loadXP().filter(t => t.studentId === studentId);
    const totalXP = txs.reduce((sum, t) => sum + t.amount, 0);
    const { level, currentLevelXP, nextLevelXP, progressPercentage } = calculateLevel(totalXP);
    return { studentId, level, totalXP, currentLevelXP, nextLevelXP, progressPercentage };
  },

  async getXPHistory(studentId: string): Promise<XPTransaction[]> {
    await delay(100);
    if (isSupabaseEnabled()) return sbGetXpForStudent(studentId);
    return loadXP().filter(t => t.studentId === studentId).reverse();
  },

  async awardXP(studentId: string, amount: number, reason: string, sourceType: XPTransaction["sourceType"], sourceId?: string, awardedBy: "system" | "teacher" = "system", teacherId?: string): Promise<{ newTotal: number; levelUp: boolean; newLevel: number; previousLevel: number }> {
    await delay(200);
    const prev = await this.getStudentLevel(studentId);
    const prevTotal = prev.totalXP;
    const prevLevel = prev.level;
    const newTx: XPTransaction = {
      id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId, amount, reason, sourceType, sourceId, awardedBy, teacherId,
      createdAt: new Date().toISOString(),
    };
    if (isSupabaseEnabled()) {
      await sbInsertXp(newTx);
    } else {
      saveXP([...loadXP(), newTx]);
    }
    const newTotal = prevTotal + amount;
    const newLevel = calculateLevel(newTotal).level;
    return { newTotal, levelUp: newLevel > prevLevel, newLevel, previousLevel: prevLevel };
  },

  async getBadges(): Promise<Badge[]> {
    await delay(100);
    return [...ALL_BADGES];
  },

  async getStudentBadges(studentId: string): Promise<StudentBadge[]> {
    await delay(100);
    if (isSupabaseEnabled()) return sbGetBadgesForStudent(studentId);
    return loadStudentBadges().filter(b => b.studentId === studentId);
  },

  async getBadgeProgress(studentId: string): Promise<BadgeProgress[]> {
    await delay(100);
    const txs = isSupabaseEnabled()
      ? await sbGetXpForStudent(studentId)
      : loadXP().filter(t => t.studentId === studentId);
    const earned = (isSupabaseEnabled()
      ? await sbGetBadgesForStudent(studentId)
      : loadStudentBadges().filter(b => b.studentId === studentId)
    ).map(b => b.badgeId);
    const wordsOpened = txs.filter(t => t.sourceType === "vocabulary").length * 3;
    return ALL_BADGES
      .filter(b => !earned.includes(b.id) && b.isAutomatic && b.conditionValue !== undefined)
      .map(b => {
        let current = 0;
        if (b.conditionType === "materials_completed") current = 3;
        if (b.conditionType === "words_opened") current = wordsOpened;
        return {
          studentId, badgeId: b.id,
          currentValue: Math.min(current, b.conditionValue!),
          targetValue: b.conditionValue!,
          progressPercentage: Math.min(100, Math.round((current / b.conditionValue!) * 100)),
        };
      });
  },

  async unlockBadge(studentId: string, badgeId: string, awardedBy: "system" | "teacher" = "system", teacherId?: string, teacherMessage?: string): Promise<void> {
    await delay(150);
    const existing = isSupabaseEnabled()
      ? await sbGetBadgesForStudent(studentId)
      : loadStudentBadges();
    if (existing.some(b => b.studentId === studentId && b.badgeId === badgeId)) return;
    const newBadge: StudentBadge = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId, badgeId,
      earnedAt: new Date().toISOString().split("T")[0],
      awardedBy, teacherId, teacherMessage,
    };
    if (isSupabaseEnabled()) {
      await sbInsertStudentBadge(newBadge);
    } else {
      saveStudentBadges([...loadStudentBadges(), newBadge]);
    }
  },

  async awardTeacherBadge(studentId: string, badgeId: string, teacherId: string, message: string, xpBonus: number): Promise<void> {
    await delay(200);
    await this.unlockBadge(studentId, badgeId, "teacher", teacherId, message);
    if (xpBonus > 0) {
      await this.awardXP(studentId, xpBonus, "Shpërblim nga mësuesja", "teacher", undefined, "teacher", teacherId);
    }
  },

  async getTeacherRewardsOverview(studentIds: string[]) {
    await delay(150);
    return Promise.all(studentIds.map(async id => {
      const level = await this.getStudentLevel(id);
      const badges = await this.getStudentBadges(id);
      return { ...level, badgeCount: badges.length };
    }));
  },

  async getRecentRewards(studentId: string) {
    await delay(100);
    const txs = await this.getXPHistory(studentId);
    const badges = await this.getStudentBadges(studentId);
    return {
      recentXP: txs.slice(0, 5),
      recentBadges: badges.slice(0, 3),
      weeklyXP: txs.filter(t => {
        const d = new Date(t.createdAt);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }).reduce((s, t) => s + t.amount, 0),
    };
  },
};
