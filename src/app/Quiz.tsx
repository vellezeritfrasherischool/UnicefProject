import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ChevronLeft, ChevronRight, Lightbulb, RotateCcw, X, Check, Sparkles, Loader2, Headphones, Volume2, ImageIcon } from "lucide-react";
import { aiService, gamificationService, learningService, materialService, assignmentService, studentService } from "./services";
import { markSessionStart, trackLearningEvent } from "./learningTracker";
import { correctOptionIndex, isCorrectQuizAnswer, normalizeQuizQuestionIds } from "./quizScoring";
import { useApp } from "./store";
import { toast } from "sonner";
import type { Material, QuizQuestion, WrongQuestionDetail, Student } from "./types";
import { useT } from "./useT";

function formatAnswer(q: QuizQuestion, ans: unknown): string {
  if (q.type === "short" || q.type === "mainidea" || !q.options?.length) return String(ans ?? "");
  if (typeof ans === "number" && q.options?.[ans] != null) return q.options[ans];
  return String(ans ?? "");
}

function formatCorrect(q: QuizQuestion): string {
  if (q.type === "short" || q.type === "mainidea" || !q.options?.length) return String(q.correct);
  if (typeof q.correct === "number" && q.options?.[q.correct] != null) return q.options[q.correct];
  return String(q.correct);
}

function isPracticeQuestion(q: QuizQuestion | undefined): boolean {
  return Boolean(q?.id?.startsWith("easy-"));
}

export default function Quiz() {
  const { id } = useParams<{ id: string }>();
  const { user } = useApp();
  const { t } = useT();
  const navigate = useNavigate();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [showHint, setShowHint] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [aiHelp, setAiHelp] = useState<{ explanation: string; newExample: string } | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [resultAssignmentId, setResultAssignmentId] = useState<string | null>(null);
  const wrongRef = React.useRef<WrongQuestionDetail[]>([]);
  const [coreIds, setCoreIds] = useState<Set<string>>(new Set());
  const [coreTotal, setCoreTotal] = useState(0);
  const easyInsertedRef = React.useRef(0);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const visualMode = Boolean(studentProfile?.visualPreferred);

  // Audio + illustration support for reading difficulties
  const [questionAudioLoading, setQuestionAudioLoading] = useState(false);
  const [helpAudioLoading, setHelpAudioLoading] = useState(false);
  const [hintAudioLoading, setHintAudioLoading] = useState(false);
  const [optionAudioLoading, setOptionAudioLoading] = useState<number | null>(null);
  const [playingKind, setPlayingKind] = useState<"question" | "help" | "option" | "hint" | null>(null);
  const [playingOptionIndex, setPlayingOptionIndex] = useState<number | null>(null);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [questionImageLoading, setQuestionImageLoading] = useState(false);
  const [helpImage, setHelpImage] = useState<string | null>(null);
  const [helpImageLoading, setHelpImageLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageCacheRef = useRef<Map<string, string>>(new Map());
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  /** Bumps on stop so in-flight playText() calls never resume audio. */
  const playSessionRef = useRef(0);
  const audioSpeedRef = useRef(audioSpeed);

  useEffect(() => {
    audioSpeedRef.current = audioSpeed;
  }, [audioSpeed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = audioSpeed;
  }, [audioSpeed]);

  const stopAudio = useCallback(() => {
    playSessionRef.current += 1;
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPlayingKind(null);
    setPlayingOptionIndex(null);
    setQuestionAudioLoading(false);
    setHelpAudioLoading(false);
    setHintAudioLoading(false);
    setOptionAudioLoading(null);
  }, []);

  const playText = useCallback(async (
    text: string,
    kind: "question" | "help" | "option" | "hint",
    optionIndex?: number
  ) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;

    stopAudio();
    const session = playSessionRef.current;
    if (kind === "question") setQuestionAudioLoading(true);
    else if (kind === "help") setHelpAudioLoading(true);
    else if (kind === "hint") setHintAudioLoading(true);
    else if (typeof optionIndex === "number") setOptionAudioLoading(optionIndex);

    try {
      let url = audioCacheRef.current.get(clean);
      if (!url) {
        url = await aiService.generateAudio(clean);
        audioCacheRef.current.set(clean, url);
      }
      // User moved on / stopped while TTS was generating
      if (session !== playSessionRef.current) return;

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.pause();
      audio.src = url;
      audio.playbackRate = audioSpeedRef.current;
      audio.onended = () => {
        if (session !== playSessionRef.current) return;
        setPlayingKind(null);
        setPlayingOptionIndex(null);
      };
      audio.onerror = () => {
        if (session !== playSessionRef.current) return;
        setPlayingKind(null);
        setPlayingOptionIndex(null);
        toast.error("Nuk u luajt audio.");
      };
      setPlayingKind(kind);
      setPlayingOptionIndex(kind === "option" && typeof optionIndex === "number" ? optionIndex : null);
      await audio.play();
      if (user && material) {
        trackLearningEvent({
          studentId: user.id,
          materialId: material.id,
          assignmentId: assignmentId ?? undefined,
          type: "audio",
          detail: `quiz_${kind}`,
        });
      }
      if (session !== playSessionRef.current) {
        audio.pause();
      }
    } catch (err) {
      if (session !== playSessionRef.current) return;
      const message = err instanceof Error ? err.message : "Nuk u gjenerua audio.";
      toast.error(message);
      setPlayingKind(null);
      setPlayingOptionIndex(null);
    } finally {
      if (session === playSessionRef.current) {
        setQuestionAudioLoading(false);
        setHelpAudioLoading(false);
        setHintAudioLoading(false);
        setOptionAudioLoading(null);
      }
    }
  }, [assignmentId, material, stopAudio, user]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const m = await materialService.getById(id);
      setMaterial(m ?? null);
      if (m) {
        const normalizedQuiz = normalizeQuizQuestionIds(m.quiz);
        setQueue(normalizedQuiz);
        setCoreIds(new Set(normalizedQuiz.map(q => q.id)));
        setCoreTotal(normalizedQuiz.length);
      }
      if (m && user) {
        markSessionStart(user.id, m.id);
        const [asgn, stu] = await Promise.all([
          assignmentService.getByMaterialForStudent(m.id, user.id),
          studentService.getById(user.id),
        ]);
        if (asgn) setAssignmentId(asgn.id);
        setStudentProfile(stu ?? null);
      }
      setLoading(false);
    })();
  }, [id, user]);

  const loadQuestionImage = useCallback(async (question: QuizQuestion, mat: Material) => {
    const cacheKey = question.id;
    const cached = imageCacheRef.current.get(cacheKey);
    if (cached) {
      setQuestionImage(cached);
      return;
    }
    setQuestionImageLoading(true);
    try {
      const prompt = `${mat.subject || "school"}: ${question.question}. Topic: ${mat.title}. Simple visual that helps a child understand the idea.`;
      const url = await aiService.generateIllustration(prompt);
      imageCacheRef.current.set(cacheKey, url);
      setQuestionImage(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nuk u gjenerua figura.";
      toast.error(message);
      setQuestionImage(null);
    } finally {
      setQuestionImageLoading(false);
    }
  }, []);

  // Reset aids when question changes — do not auto-show figure
  useEffect(() => {
    stopAudio();
    setShowHint(false);
    setHelpImage(null);
    setHelpImageLoading(false);
    setQuestionImage(null);
    setQuestionImageLoading(false);
  }, [queue[currentIdx]?.id, stopAudio]);

  useEffect(() => () => {
    stopAudio();
  }, [stopAudio]);

  const requestHelpImage = async (explanation?: string, example?: string) => {
    const question = queue[currentIdx];
    if (!question || !material || helpImageLoading) return;
    const exp = explanation ?? aiHelp?.explanation;
    if (!exp) return;
    setHelpImageLoading(true);
    try {
      const url = await aiService.generateIllustration(
        `Help a child understand: ${exp}. Example: ${example || aiHelp?.newExample || question.question}. Topic ${material.title}.`
      );
      setHelpImage(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nuk u gjenerua figura.";
      toast.error(message);
      setHelpImage(null);
    } finally {
      setHelpImageLoading(false);
    }
  };

  const coreQuestions = useMemo(
    () => queue.filter(q => coreIds.has(q.id)),
    [queue, coreIds]
  );

  const ensureAssignment = async (): Promise<string | null> => {
    if (!user || !material) return null;
    if (assignmentId) return assignmentId;
    const existing = await assignmentService.getByMaterialForStudent(material.id, user.id);
    if (existing) {
      setAssignmentId(existing.id);
      return existing.id;
    }
    const today = new Date().toISOString().split("T")[0];
    const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const created = await assignmentService.create({
      materialId: material.id,
      studentId: user.id,
      deadline,
      startDate: today,
      allowRetry: true,
      showAnswers: true,
      enableAudio: true,
      status: "in-progress",
      attempts: 0,
    });
    setAssignmentId(created.id);
    return created.id;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!material || queue.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Kuizi nuk u gjet për këtë material.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline text-sm">{t("quiz.back")}</button>
      </div>
    );
  }

  const q = queue[currentIdx];
  const practice = isPracticeQuestion(q);
  const hasOptions = Boolean(q?.options && q.options.length > 0);
  const userAnswer = answers[q?.id];
  const isAnswered = userAnswer !== undefined && String(userAnswer).trim() !== "";
  const answeredCorrect = q ? isCorrectQuizAnswer(q, userAnswer) : false;
  const audioAllowed = material.audioEnabled !== false;

  // Progress against the original N questions (e.g. 8), not adaptive extras
  const corePassed = queue.slice(0, currentIdx).filter(x => coreIds.has(x.id)).length;
  const displayCurrent = practice ? Math.min(corePassed, coreTotal) : Math.min(corePassed + 1, coreTotal || 1);
  const displayTotal = coreTotal || coreQuestions.length || 1;
  const progressPct = Math.min(
    100,
    Math.round(((corePassed + (submitted && !practice ? 1 : 0)) / displayTotal) * 100)
  );

  const handleAnswer = (ans: unknown) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [q.id]: ans }));
  };

  const openHint = () => {
    if (!q) return;
    if (showHint) {
      setShowHint(false);
      stopAudio();
      return;
    }
    setShowHint(true);
    if (user && material) {
      setHintCount(c => c + 1);
      trackLearningEvent({
        studentId: user.id,
        materialId: material.id,
        assignmentId: assignmentId ?? undefined,
        type: "hint",
        detail: q.id,
      });
    }
    if (material) void loadQuestionImage(q, material);
  };

  const submitAnswer = async () => {
    if (!isAnswered || submitted || !q) return;
    const correct = isCorrectQuizAnswer(q, userAnswer);
    setSubmitted(true);

    if (user && material) {
      trackLearningEvent({
        studentId: user.id,
        materialId: material.id,
        assignmentId: assignmentId ?? undefined,
        type: correct ? "quiz_correct" : "quiz_wrong",
        detail: q.id,
      });
    }

    if (correct) {
      setFeedback(t("quiz.correct") + " " + (q.feedback || ""));
      setAiHelp(null);
      return;
    }

    const wrong: WrongQuestionDetail = {
      questionId: q.id,
      question: q.question,
      studentAnswer: formatAnswer(q, userAnswer),
      correctAnswer: formatCorrect(q),
    };
    wrongRef.current = [...wrongRef.current, wrong];
    setFeedback(q.feedback || t("quiz.lookTogether"));
    setAdapting(true);
    try {
      const help = await aiService.explainWrongAnswer({
        question: q.question,
        studentAnswer: wrong.studentAnswer,
        correctAnswer: wrong.correctAnswer,
        topic: material.title,
        visualPreferred: visualMode,
      });
      setAiHelp(help);

      // Visual learners get helper figure automatically (audio stays on-demand via Dëgjo)
      if (visualMode) {
        void requestHelpImage(help.explanation, help.newExample);
      }

      // Max 2 practice questions total — don't turn an 8-question quiz into 10+
      const canInsertPractice =
        coreIds.has(q.id) &&
        !practice &&
        easyInsertedRef.current < 2;

      if (canInsertPractice) {
        const easier = await aiService.generateEasierQuestion({
          original: q,
          topic: material.title,
          subject: material.subject,
          visualPreferred: visualMode,
        });
        easyInsertedRef.current += 1;
        setQueue(prev => {
          const next = [...prev];
          next.splice(currentIdx + 1, 0, easier);
          return next;
        });
        toast.message("Praktikë e shkurtër e shtuar (nuk numërohet në 8 pyetjet).");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nuk u gjenerua ndihma e AI.";
      setAiHelp({ explanation: message, newExample: "" });
    } finally {
      setAdapting(false);
    }
  };

  const next = () => {
    if (currentIdx < queue.length - 1) {
      setCurrentIdx(i => i + 1);
      setSubmitted(false);
      setFeedback("");
      setAiHelp(null);
      setHelpImage(null);
      setShowHint(false);
      stopAudio();
    } else {
      void finishQuiz();
    }
  };

  const buildQuestionSpeech = () => {
    if (!q) return "";
    const opts = hasOptions && q.options
      ? q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(". ")
      : "";
    return [q.question, opts].filter(Boolean).join(". ");
  };

  const toggleQuestionAudio = () => {
    if (playingKind === "question") {
      stopAudio();
      return;
    }
    void playText(buildQuestionSpeech(), "question");
  };

  const toggleOptionAudio = (index: number, text: string) => {
    if (playingKind === "option" && playingOptionIndex === index) {
      stopAudio();
      return;
    }
    void playText(text, "option", index);
  };

  const toggleHintAudio = () => {
    if (!q?.hint?.trim()) return;
    if (playingKind === "hint") {
      stopAudio();
      return;
    }
    void playText(q.hint, "hint");
  };

  const toggleHelpAudio = () => {
    if (!aiHelp) return;
    if (playingKind === "help") {
      stopAudio();
      return;
    }
    const helpSpeech = [aiHelp.explanation, aiHelp.newExample].filter(Boolean).join(". ");
    void playText(helpSpeech, "help");
  };

  const finishQuiz = async () => {
    stopAudio();
    setAudioSpeed(1);
    let correct = 0;
    coreQuestions.forEach(question => {
      if (isCorrectQuizAnswer(question, answers[question.id])) correct++;
    });
    const denom = Math.max(1, coreQuestions.length);
    const pct = Math.round((correct / denom) * 100);
    setScore(pct);
    setDone(true);
    setAnalyzeError("");
    setAnalyzing(true);

    let asgnId: string | null = null;
    try {
      asgnId = await ensureAssignment();
      setResultAssignmentId(asgnId);

      if (user && asgnId) {
        const asgn = await assignmentService.getById(asgnId);
        await learningService.runPostLessonAnalysis({
          studentId: user.id,
          materialId: material.id,
          assignmentId: asgnId,
          score: pct,
          attempts: (asgn?.attempts ?? 0) + 1,
          wrongQuestions: wrongRef.current,
          hintCount,
        });
        toast.success("Raporti AI u dërgua te mësuesja!");
      } else if (user && !asgnId) {
        setAnalyzeError("Nuk u krijua detyra — raporti nuk u ruajt.");
        toast.error("Nuk u ruajt raporti. Provo sërish.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analiza AI dështoi.";
      setAnalyzeError(message);
      toast.error(message);
      if (asgnId) {
        try {
          const saved = await assignmentService.getById(asgnId);
          if (saved?.status !== "completed" || saved.score !== pct) {
            await assignmentService.complete(asgnId, pct, 0, false);
          }
        } catch { /* ignore */ }
      }
    } finally {
      setAnalyzing(false);
    }

    if (user) {
      try {
        await gamificationService.awardXP(user.id, 20, `Plotësoi kuizin e '${material.title}'`, "quiz", material.id);
        if (pct >= 80) {
          await gamificationService.awardXP(user.id, 20, `Rezultat mbi 80% në '${material.title}'`, "quiz", material.id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Yjet nuk u ruajtën.";
        toast.error(msg);
      }
    }

    // Always take student to the full AI report page when we have an assignment
    if (asgnId) {
      navigate(`/student/results/${asgnId}`, { replace: true });
    }
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-10">
        <div className="ui-card p-8 text-center">
          {analyzing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="animate-spin text-primary" size={36} />
              <p className="font-bold text-foreground">{t("quiz.preparingReport")}</p>
              <p className="text-sm text-muted-foreground">{t("quiz.waitReport")}</p>
            </div>
          ) : (
            <>
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-extrabold mb-4 ${score >= 80 ? "bg-success-muted text-success-muted-foreground" : score >= 60 ? "bg-warning-muted text-warning-muted-foreground" : "bg-muted text-muted-foreground"}`}>
                {score}%
              </div>
              <h1 className="text-2xl font-extrabold mb-2">
                {score >= 80 ? t("quiz.great") : score >= 60 ? t("quiz.ok") : t("quiz.tried")}
              </h1>
              <p className="text-muted-foreground text-sm mb-2">
                {analyzeError
                  ? "Rezultati u ruajt, por analiza AI pati problem."
                  : t("quiz.reportSent")}
              </p>
              {analyzeError && (
                <p className="text-xs text-destructive mb-4">{analyzeError}</p>
              )}
            </>
          )}

          {!analyzing && (
            <>
              <div className="bg-muted/40 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-success-muted rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-success-muted-foreground">
                    {coreQuestions.filter(q2 => isCorrectQuizAnswer(q2, answers[q2.id])).length}/{coreQuestions.length}
                  </p>
                  <p className="text-xs text-success font-semibold">{t("quiz.correctLabel")}</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold">{displayTotal}</p>
                  <p className="text-xs text-muted-foreground font-semibold">{t("quiz.questions")}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {(resultAssignmentId || assignmentId) && (
                  <Link to={`/student/results/${resultAssignmentId || assignmentId}`}
                    className="ui-btn-primary w-full">
                    {t("quiz.viewReport")}
                  </Link>
                )}
                <Link to="/student/dashboard" className="ui-btn-secondary w-full">
                  {t("quiz.backDashboard")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => { stopAudio(); setAudioSpeed(1); navigate(`/student/read/${id}`); }} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground min-h-11">
          <ChevronLeft size={16} /> {t("quiz.reading")}
        </button>
        <p className="text-sm font-bold truncate max-w-[45%]">{material.title}</p>
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          {practice ? t("quiz.practice") : `${displayCurrent}/${displayTotal}`}
        </span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {practice && (
        <div className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 rounded-2xl px-4 py-2.5">
          <Sparkles size={14} /> {t("quiz.easyPractice")}
        </div>
      )}

      <div className="ui-card p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-extrabold text-lg sm:text-xl leading-snug tracking-tight flex-1">{q.question}</h2>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {audioAllowed && (
              <div className="flex items-center gap-1 rounded-2xl border border-border p-1" role="group" aria-label={t("quiz.audioSpeed")}>
                {[0.75, 1, 1.5].map(s => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setAudioSpeed(s)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors min-h-9 ${
                      audioSpeed === s
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
            {audioAllowed && (
            <button
              type="button"
              onClick={toggleQuestionAudio}
              disabled={questionAudioLoading}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-2xl transition-colors min-h-11 ${
                playingKind === "question" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted text-primary"
              }`}
              aria-label={t("quiz.listen")}
            >
              {questionAudioLoading ? <Loader2 size={14} className="animate-spin" /> : <Headphones size={14} />}
              {playingKind === "question" ? t("quiz.stop") : t("quiz.listen")}
            </button>
            )}
            <button
              type="button"
              onClick={openHint}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-2xl transition-colors min-h-11 ${showHint ? "bg-warning-muted text-warning-muted-foreground" : "border border-border hover:bg-muted"}`}
            >
              <Lightbulb size={14} /> {t("quiz.help")}
            </button>
          </div>
        </div>

        {/* Hint package: figure + hint text + audio (only when student asks for help) */}
        {showHint && (
          <div className="mb-5 space-y-3">
            {(questionImageLoading || questionImage) && (
              <div className="rounded-2xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
                {questionImageLoading && (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <Loader2 size={22} className="animate-spin text-primary" />
                    <span className="text-xs font-semibold">{t("quiz.creatingImage")}</span>
                  </div>
                )}
                {!questionImageLoading && questionImage && (
                  <img
                    src={questionImage}
                    alt={t("quiz.figure")}
                    className="w-full max-h-56 object-contain bg-white"
                  />
                )}
              </div>
            )}
            {q.hint ? (
              <div className="bg-warning-muted border border-warning/20 rounded-xl p-3 text-sm text-warning-muted-foreground font-medium flex items-start gap-2">
                <p className="flex-1 leading-relaxed">{q.hint}</p>
                {audioAllowed && (
                <button
                  type="button"
                  onClick={toggleHintAudio}
                  disabled={hintAudioLoading}
                  className={`p-2 rounded-xl shrink-0 transition-colors min-h-10 min-w-10 flex items-center justify-center disabled:opacity-60 ${
                    playingKind === "hint"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-warning/15 text-warning-muted-foreground"
                  }`}
                  aria-label={playingKind === "hint" ? t("quiz.stop") : t("quiz.listenHint")}
                  title={playingKind === "hint" ? t("quiz.stop") : t("quiz.listenHint")}
                >
                  {hintAudioLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-1">{t("quiz.noHintText")}</p>
            )}
          </div>
        )}

        {hasOptions && (
          <div className="space-y-2.5">
            {q.options!.map((opt, i) => {
              const selected = userAnswer === i;
              const isCorrect = i === correctOptionIndex(q);
              let cls = "border-2 border-border hover:border-primary/30 hover:bg-primary/5";
              if (submitted && selected && isCorrect) cls = "border-2 border-success bg-success-muted";
              else if (submitted && selected && !isCorrect) cls = "border-2 border-destructive/50 bg-destructive/5";
              else if (submitted && isCorrect) cls = "border-2 border-success bg-success-muted";
              else if (selected) cls = "border-2 border-primary bg-primary/10";

              const optionPlaying = playingKind === "option" && playingOptionIndex === i;
              const optionLoading = optionAudioLoading === i;

              return (
                <div key={i} className={`w-full rounded-2xl transition-all flex items-center gap-1 min-h-14 ${cls}`}>
                  <button
                    type="button"
                    onClick={() => handleAnswer(i)}
                    disabled={submitted}
                    className="flex-1 text-left px-4 py-4 text-sm font-semibold flex items-center gap-3 min-h-14 disabled:cursor-default"
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-primary bg-primary text-white" : "border-current"}`}>
                      {submitted && isCorrect ? <Check size={14} className="text-success" /> :
                       submitted && selected && !isCorrect ? <X size={14} className="text-destructive" /> :
                       <span className="text-xs font-bold">{String.fromCharCode(65 + i)}</span>}
                    </div>
                    <span className="flex-1">{opt}</span>
                  </button>
                  {audioAllowed && (
                  <button
                    type="button"
                    onClick={() => toggleOptionAudio(i, opt)}
                    disabled={optionLoading}
                    className={`mr-2 p-2.5 rounded-xl shrink-0 transition-colors min-h-11 min-w-11 flex items-center justify-center disabled:opacity-60 ${
                      optionPlaying
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-primary"
                    }`}
                    aria-label={optionPlaying ? t("quiz.stop") : t("quiz.listenOption")}
                    title={optionPlaying ? t("quiz.stop") : t("quiz.listenOption")}
                  >
                    {optionLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                  </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!hasOptions && (
          <input
            type="text"
            value={String(userAnswer ?? "")}
            onChange={e => handleAnswer(e.target.value)}
            disabled={submitted}
            placeholder={t("quiz.writeAnswer")}
            className="ui-input"
            aria-label={t("quiz.writeAnswer")}
          />
        )}

        {submitted && feedback && (
          <div className={`mt-4 p-4 rounded-xl text-sm leading-relaxed ${answeredCorrect ? "bg-success-muted border border-success/25 text-success-muted-foreground" : "bg-warning-muted border border-warning/20 text-warning-muted-foreground"}`}>
            {feedback}
          </div>
        )}

        {adapting && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> {t("quiz.aiExplaining")}
          </div>
        )}

        {aiHelp && !answeredCorrect && (
          <div className="mt-4 ai-bubble space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-primary flex items-center gap-1.5 text-sm"><Sparkles size={14} /> {t("quiz.aiExplanation")}</p>
              {audioAllowed && (
              <button
                type="button"
                onClick={toggleHelpAudio}
                disabled={helpAudioLoading}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors min-h-9 ${
                  playingKind === "help" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/15"
                }`}
                aria-label={t("quiz.listen")}
              >
                {helpAudioLoading ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                {playingKind === "help" ? t("quiz.stop") : t("quiz.listen")}
              </button>
              )}
            </div>
            <p className="text-foreground leading-relaxed">{aiHelp.explanation}</p>
            {aiHelp.newExample && (
              <p className="text-muted-foreground"><span className="font-bold text-foreground">{t("quiz.example")}</span> {aiHelp.newExample}</p>
            )}

            {!helpImage && !helpImageLoading && (
              <button
                type="button"
                onClick={() => void requestHelpImage()}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors min-h-9"
              >
                <ImageIcon size={13} /> {t("quiz.showHelper")}
              </button>
            )}

            {(helpImageLoading || helpImage) && (
              <div className="rounded-xl overflow-hidden border border-primary/15 bg-white flex items-center justify-center">
                {helpImageLoading && (
                  <div className="flex items-center gap-2 py-8 text-muted-foreground text-xs font-semibold">
                    <Loader2 size={16} className="animate-spin text-primary" /> {t("quiz.creatingImage")}
                  </div>
                )}
                {!helpImageLoading && helpImage && (
                  <img src={helpImage} alt={t("quiz.figure")} className="w-full max-h-48 object-contain" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center gap-3">
        <button onClick={() => {
          const normalizedQuiz = normalizeQuizQuestionIds(material.quiz);
          setQueue(normalizedQuiz);
          setCoreIds(new Set(normalizedQuiz.map(x => x.id)));
          setCoreTotal(normalizedQuiz.length);
          setCurrentIdx(0);
          setAnswers({});
          setSubmitted(false);
          setFeedback("");
          setAiHelp(null);
          setHelpImage(null);
          setShowHint(false);
          setDone(false);
          wrongRef.current = [];
          easyInsertedRef.current = 0;
          setHintCount(0);
          setAnalyzeError("");
          stopAudio();
          setAudioSpeed(1);
        }}
          className="ui-btn-ghost text-sm">
          <RotateCcw size={14} /> {t("quiz.restart")}
        </button>
        {!submitted ? (
          <button onClick={() => void submitAnswer()} disabled={!isAnswered || adapting}
            className="ui-btn-primary disabled:opacity-50">
            {t("quiz.check")}
          </button>
        ) : (
          <button onClick={next} disabled={adapting}
            className="ui-btn-primary disabled:opacity-50">
            {currentIdx < queue.length - 1 ? <>{t("quiz.continue")} <ChevronRight size={16} /></> : t("quiz.finish")}
          </button>
        )}
      </div>
    </div>
  );
}
