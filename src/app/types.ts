export type UserRole = "teacher" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  class?: string;
}

export interface VocabWord {
  word: string;
  definition: string;
  synonym: string;
  example: string;
  translation: string;
}

export type QuestionType = "multiple" | "yesno" | "short" | "mainidea";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correct: string | number;
  hint?: string;
  feedback: string;
}

export type MaterialStatus = "draft" | "review" | "approved" | "published";

export interface Material {
  id: string;
  title: string;
  subject: string;
  class: string;
  originalText: string;
  simplifiedText: string;
  summary: string;
  keyPoints: string[];
  vocabulary: VocabWord[];
  quiz: QuizQuestion[];
  /** Full English translation of the simplified text (when teacher enables Përkthim). */
  englishText: string;
  teacherNotes: string;
  /** AI-generated educational illustrations (data URLs or remote URLs). */
  illustrations: string[];
  status: MaterialStatus;
  createdAt: string;
  studentCount: number;
  completionRate: number;
  estimatedMinutes: number;
  teacherId?: string;
  schoolId?: string;
  /**
   * If set, publish assigns only these students (personalized variants).
   * If empty/undefined, publish assigns the whole class.
   */
  targetStudentIds?: string[];
  /** Shared id for all variants generated from one source in one batch. */
  adaptationGroupId?: string;
  /** Machine key for the preference cohort (e.g. visual-basic). */
  adaptationKey?: string;
  /** Label shown to the teacher (e.g. "Vizual · Bazik"). */
  adaptationLabel?: string;
  /**
   * When false, reading/quiz TTS controls are hidden.
   * Undefined = legacy materials → treat as enabled.
   */
  audioEnabled?: boolean;
  /** Which generation options the teacher enabled. Used to hide sections even when empty. */
  enabledSections?: {
    summary?: boolean;
    keyPoints?: boolean;
    vocab?: boolean;
    quiz?: boolean;
    translate?: boolean;
    teacherNotes?: boolean;
    visualizations?: boolean;
  };
}

export interface Student {
  id: string;
  name: string;
  class: string;
  age: number;
  readingLevel: string;
  score: number;
  completedMaterials: number;
  status: "active" | "needs-support" | "excellent";
  alertReason?: string;
  preferredFont: string;
  audioEnabled: boolean;
  /** Learns better with pictures / diagrams than audio alone. */
  visualPreferred: boolean;
  language: string;
  email?: string;
  classId?: string;
  teacherId?: string;
  schoolId?: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  studentCount: number;
  activeMaterials: number;
  averageScore: number;
  joinCode?: string;
  teacherId?: string;
  schoolId?: string;
}

export interface Assignment {
  id: string;
  materialId: string;
  studentId: string;
  deadline: string;
  startDate: string;
  allowRetry: boolean;
  showAnswers: boolean;
  enableAudio: boolean;
  message?: string;
  status: "pending" | "in-progress" | "completed";
  score?: number;
  completedAt?: string;
  timeSpentMinutes?: number;
  wordsOpened?: number;
  audioUsed?: boolean;
  attempts?: number;
}

export type XPSourceType = "material" | "quiz" | "vocabulary" | "level" | "badge" | "teacher" | "improvement";

export interface XPTransaction {
  id: string;
  studentId: string;
  amount: number;
  reason: string;
  sourceType: XPSourceType;
  sourceId?: string;
  awardedBy: "system" | "teacher";
  teacherId?: string;
  createdAt: string;
}

export interface StudentLevel {
  studentId: string;
  level: number;
  totalXP: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressPercentage: number;
}

export type BadgeCategory = "reading" | "comprehension" | "vocabulary" | "progress" | "audio" | "quiz" | "level" | "teacher" | "special";
export type BadgeRarity = "common" | "uncommon" | "rare" | "special" | "teacher";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  conditionType: string;
  conditionValue?: number;
  xpReward: number;
  isAutomatic: boolean;
  isSecret: boolean;
  isEnabled: boolean;
}

export interface StudentBadge {
  id: string;
  studentId: string;
  badgeId: string;
  earnedAt: string;
  awardedBy: "system" | "teacher";
  teacherId?: string;
  teacherMessage?: string;
}

export interface BadgeProgress {
  studentId: string;
  badgeId: string;
  currentValue: number;
  targetValue: number;
  progressPercentage: number;
}

export interface AccessibilitySettings {
  fontSize: number;
  lineSpacing: number;
  letterSpacing: number;
  highContrast: boolean;
  darkMode: boolean;
  readingFont: "inter" | "lexend" | "atkinson";
  reducedMotion: boolean;
  /** Application UI language: Albanian (sq) or English (en). */
  appLanguage: "sq" | "en";
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
  icon: string;
}

/** Behavioral signals collected during reading / quiz (no medical diagnoses). */
export type LearningEventType =
  | "explain"
  | "audio"
  | "vocab"
  | "simplified_view"
  | "hint"
  | "quiz_wrong"
  | "quiz_correct";

export interface LearningEvent {
  id: string;
  studentId: string;
  materialId: string;
  assignmentId?: string;
  type: LearningEventType;
  detail?: string;
  createdAt: string;
}

export interface WrongQuestionDetail {
  questionId: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
}

export interface SessionMetrics {
  studentId: string;
  materialId: string;
  assignmentId: string;
  score: number;
  timeSpentMinutes: number;
  attempts: number;
  explainCount: number;
  audioPlayCount: number;
  simplifiedUsed: boolean;
  vocabOpened: number;
  hintCount: number;
  wrongQuestions: WrongQuestionDetail[];
  topic: string;
  subject: string;
}

export interface LearningReport {
  id: string;
  studentId: string;
  materialId: string;
  assignmentId: string;
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
  createdAt: string;
}

export interface LearningProfile {
  studentId: string;
  traits: string[];
  strengths: string[];
  supportNeeds: string[];
  preferredFormats: string[];
  teacherRecommendations: string[];
  updatedAt: string;
  sessionCount: number;
}

export type FlashcardType = "definition" | "concept" | "quick";

export interface Flashcard {
  id: string;
  materialId: string;
  front: string;
  back: string;
  type: FlashcardType;
}

export interface MemoryBoosterPack {
  id: string;
  studentId: string;
  materialId: string;
  assignmentId: string;
  shortSummary: string;
  flashcards: Flashcard[];
  reviewQuestions: string[];
  reviewSchedule: { after1Day: string; after3Days: string; after7Days: string };
  createdAt: string;
}
