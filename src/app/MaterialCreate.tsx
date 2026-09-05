import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Upload, ChevronRight, ChevronLeft, Check, Wand2,
  X, File,
} from "lucide-react";
import { toast } from "sonner";
import { materialService, aiService, learningService, studentService } from "./services";
import { buildAdaptationCohorts } from "./adaptationCohorts";
import type { ClassGroup, Student } from "./types";
import { useT } from "./useT";
import { useApp } from "./store";
import { extractPdfText, MAX_PDF_BYTES, PdfExtractionError } from "./pdfExtraction";

class AiAbortedError extends Error {
  constructor() {
    super("AI_ABORTED");
    this.name = "AiAbortedError";
  }
}

const AI_STEPS_BASE = [
  "Duke analizuar materialin...",
  "Duke thjeshtësuar tekstin...",
  "Duke krijuar përmbledhjen...",
  "Duke identifikuar fjalët e vështira...",
  "Duke krijuar pyetjet...",
  "Duke krijuar vizualizimet...",
];

export default function MaterialCreate() {
  const navigate = useNavigate();
  const { t } = useT();
  const { user } = useApp();
  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [aiStepIdx, setAiStepIdx] = useState(-1);
  const [variantProgress, setVariantProgress] = useState("");
  const [abortConfirmOpen, setAbortConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const progressTimerRef = useRef<number | null>(null);

  // Step 1
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [extractingFile, setExtractingFile] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");

  // Step 2
  const [audience, setAudience] = useState<"class" | "student">("class");
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [personalizeByNeeds, setPersonalizeByNeeds] = useState(true);

  // Step 3
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState(2);
  const [length, setLength] = useState("mesatar");
  const [numQ, setNumQ] = useState(5);
  const [switches, setSwitches] = useState({
    summary: true,
    keyPoints: true,
    vocab: true,
    quiz: true,
    translate: false,
    audio: false,
    teacherNotes: true,
    visualizations: true,
  });

  const STEPS = [
    t("mc.stepUpload"),
    t("mc.stepAudience"),
    t("mc.stepAdapt"),
    t("mc.stepConfirm"),
    t("mc.stepProcessing"),
  ];
  const activeStep = processing ? 4 : step;
  const AI_STEPS = [...AI_STEPS_BASE, t("mc.aiReady")];
  const simplificationLabels = [t("mc.easy"), t("mc.medAdapt"), t("mc.advAdapt")];
  const lengthOptions = [
    { val: "shkurtër", label: t("mc.short") },
    { val: "mesatar", label: t("mc.medium") },
    { val: "gjatë", label: t("mc.long") },
  ];
  const switchLabels: Record<string, string> = {
    summary: t("mc.summary"),
    keyPoints: t("mc.keyPoints"),
    vocab: t("mc.vocab"),
    quiz: t("mc.quiz"),
    translate: t("mc.translate"),
    audio: t("mc.audio"),
    teacherNotes: t("mc.teacherNotes"),
    visualizations: t("mc.visuals"),
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    studentService.getClasses(user.id).then(list => {
      if (cancelled) return;
      setClasses(list);
      setSelectedClass(prev => prev || list[0]?.id || "");
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedClass) {
      setClassStudents([]);
      return;
    }
    let cancelled = false;
    studentService.getByClass(selectedClass).then(list => {
      if (cancelled) return;
      setClassStudents(list);
      setSelectedStudents(prev => prev.filter(id => list.some(s => s.id === id)));
    });
    return () => { cancelled = true; };
  }, [selectedClass]);

  const handleFile = async (f: File) => {
    if (f.size > MAX_PDF_BYTES) {
      toast.error("Skedari është më i madh se kufiri 10 MB.");
      return;
    }
    setExtractingFile(true);
    setExtractionProgress("Duke lexuar skedarin…");
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const content = await extractPdfText(f, (page, total) => {
          setExtractionProgress(`Duke nxjerrë tekstin: faqja ${page}/${total}`);
        });
        setText(content);
      } else if (f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name)) {
        const content = await f.text();
        if (!content.trim()) throw new Error("empty");
        setText(content);
      } else {
        toast.error("Për momentin mbështeten vetëm PDF, TXT dhe Markdown.");
        return;
      }
      setFile(f);
      toast.success("Teksti u nxor. Kontrolloje dhe redaktoje para adaptimit.");
    } catch (error) {
      setFile(null);
      setText("");
      if (error instanceof PdfExtractionError && error.code === "password") {
        toast.error("PDF-ja është e mbrojtur me fjalëkalim.");
      } else if (error instanceof PdfExtractionError && error.code === "empty") {
        toast.error("PDF-ja nuk ka tekst të lexueshëm dhe mund të jetë e skanuar. OCR nuk mbështetet ende.");
      } else if (error instanceof PdfExtractionError && error.code === "type") {
        toast.error("Skedari nuk është PDF i vlefshëm.");
      } else {
        toast.error("Teksti nuk u nxor nga skedari. Kontrollo skedarin dhe provo sërish.");
      }
    } finally {
      setExtractingFile(false);
      setExtractionProgress("");
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const clearStudentSelection = () => {
    setSelectedStudents([]);
  };

  const targetStudentIds = useMemo(() => {
    if (audience === "student" && selectedStudents.length > 0) return selectedStudents;
    return classStudents.map(s => s.id);
  }, [audience, selectedStudents, classStudents]);

  const canProceed = () => {
    if (step === 0) return !extractingFile && text.trim().length > 0;
    if (step === 1) {
      if (audience === "class") return true;
      return selectedStudents.length > 0;
    }
    if (step === 2) return true;
    return true;
  };

  const resolveTitle = () => {
    if (title.trim()) return title.trim();
    if (file) return file.name.replace(/\.[^.]+$/, "");
    const fromText = text.trim().split(/[.\n]/)[0]?.trim().slice(0, 60);
    return fromText || "Material i ri";
  };

  const resolveSubject = () => subject.trim() || "Lëndë e përgjithshme";

  const handleContinue = () => {
    if (!canProceed()) return;
    if (step === 2) {
      const nextTitle = resolveTitle();
      const nextSubject = resolveSubject();
      if (nextTitle !== title) setTitle(nextTitle);
      if (nextSubject !== subject) setSubject(nextSubject);
    }
    setStep(s => s + 1);
  };

  const clearProgressTimer = () => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const throwIfAborted = () => {
    if (abortRef.current) throw new AiAbortedError();
  };

  const stopProcessingKeepForm = () => {
    clearProgressTimer();
    setProcessing(false);
    setAiStepIdx(-1);
    setVariantProgress("");
  };

  const handleBack = () => {
    if (processing) {
      setAbortConfirmOpen(true);
      return;
    }
    if (step === 0) {
      navigate("/teacher/materials");
      return;
    }
    setStep(s => s - 1);
  };

  const confirmAbortBack = () => {
    abortRef.current = true;
    setAbortConfirmOpen(false);
    stopProcessingKeepForm();
  };

  const createOneVariant = async (opts: {
    sourceText: string;
    finalTitle: string;
    finalSubject: string;
    className: string;
    learnerHints: string[];
    levelForCohort: number;
    includeVisuals: boolean;
    targetIds: string[];
    adaptationGroupId: string;
    adaptationKey?: string;
    adaptationLabel?: string;
  }) => {
    const adapted = await aiService.adaptMaterial({
      text: opts.sourceText,
      title: opts.finalTitle,
      subject: opts.finalSubject,
      level: opts.levelForCohort,
      length,
      numQuestions: numQ,
      includeSummary: switches.summary,
      includeKeyPoints: switches.keyPoints,
      includeVocab: switches.vocab,
      includeQuiz: switches.quiz,
      includeTeacherNotes: switches.teacherNotes,
      includeTranslation: switches.translate,
      includeVisualizations: opts.includeVisuals,
      learnerHints: opts.learnerHints,
    });

    let illustrations: string[] = [];
    if (opts.includeVisuals) {
      const prompts =
        adapted.visualPrompts && adapted.visualPrompts.length > 0
          ? adapted.visualPrompts
          : [
              `Educational illustration about ${opts.finalTitle}. Subject: ${opts.finalSubject}. Key idea: ${adapted.summary || adapted.keyPoints?.[0] || adapted.simplifiedText.slice(0, 180)}`,
            ];
      try {
        const url = await aiService.generateIllustration(prompts[0]);
        illustrations.push(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gjenerimi i figurës dështoi.";
        toast.error(`Vizualizimet: ${message}`);
      }
    }

    let englishText = "";
    if (switches.translate) {
      try {
        englishText =
          (adapted.translation && adapted.translation.length > 40
            ? adapted.translation
            : await aiService.translateText(adapted.simplifiedText, "en")
          ).trim();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Përkthimi dështoi.";
        toast.error(`Përkthimi: ${message}`);
      }
    }

    const titleWithLabel = opts.adaptationLabel
      ? `${opts.finalTitle} (${opts.adaptationLabel})`
      : opts.finalTitle;

    const mat = await materialService.create({
      title: titleWithLabel,
      subject: opts.finalSubject,
      class: opts.className,
      originalText: opts.sourceText,
      simplifiedText: adapted.simplifiedText,
      summary: switches.summary ? adapted.summary : "",
      keyPoints: switches.keyPoints ? adapted.keyPoints : [],
      vocabulary: switches.vocab ? adapted.vocabulary : [],
      quiz: switches.quiz ? adapted.quiz : [],
      teacherNotes: switches.teacherNotes ? adapted.teacherNotes : "",
      englishText: switches.translate ? englishText : "",
      illustrations: opts.includeVisuals ? illustrations : [],
      estimatedMinutes: Math.max(10, Math.round(adapted.simplifiedText.split(/\s+/).length / 120) * 5),
      targetStudentIds: opts.targetIds,
      adaptationGroupId: opts.adaptationGroupId,
      adaptationKey: opts.adaptationKey,
      adaptationLabel: opts.adaptationLabel,
      audioEnabled: switches.audio,
      teacherId: user?.id,
      enabledSections: {
        summary: switches.summary,
        keyPoints: switches.keyPoints,
        vocab: switches.vocab,
        quiz: switches.quiz,
        translate: switches.translate,
        teacherNotes: switches.teacherNotes,
        visualizations: switches.visualizations && opts.includeVisuals,
      },
    });

    if (switches.vocab || switches.keyPoints) {
      try {
        await aiService.generateFlashcards({
          id: mat.id,
          title: mat.title,
          subject: mat.subject,
          simplifiedText: mat.simplifiedText,
          keyPoints: mat.keyPoints,
          vocabulary: mat.vocabulary,
        });
      } catch {
        // optional
      }
    }

    return mat;
  };

  const runAI = async () => {
    const finalTitle = resolveTitle();
    const finalSubject = resolveSubject();
    if (!title.trim()) setTitle(finalTitle);
    if (!subject.trim()) setSubject(finalSubject);

    const sourceText = text.trim() || (file ? `Material nga skedari: ${file.name}` : "");
    if (sourceText.length < 20) {
      toast.error("Shto tekst më të gjatë (të paktën 20 karaktere) para se të adaptohet me AI.");
      return;
    }

    const targets = targetStudentIds;
    if (targets.length === 0) {
      toast.error(t("mc.noStudents"));
      return;
    }

    abortRef.current = false;
    setProcessing(true);
    setAiStepIdx(0);
    setVariantProgress("");

    clearProgressTimer();
    progressTimerRef.current = window.setInterval(() => {
      setAiStepIdx(prev => (prev < AI_STEPS.length - 2 ? prev + 1 : prev));
    }, 1800);

    const className =
      classes.find(c => c.id === selectedClass)?.name.replace(/^Klasa\s+/i, "") ?? "VI-1";
    const adaptationGroupId = `ag-${Date.now()}`;

    try {
      const profilesByStudentId = new Map<string, Awaited<ReturnType<typeof learningService.getProfile>>>();
      const studentsForTargets: Student[] = [];
      for (const sid of targets) {
        throwIfAborted();
        const [prof, stu] = await Promise.all([
          learningService.getProfile(sid),
          studentService.getById(sid),
        ]);
        profilesByStudentId.set(sid, prof);
        if (stu) studentsForTargets.push(stu);
      }

      let createdIds: string[] = [];

      if (personalizeByNeeds && studentsForTargets.length > 0) {
        const cohorts = buildAdaptationCohorts(studentsForTargets, profilesByStudentId);
        for (let i = 0; i < cohorts.length; i++) {
          throwIfAborted();
          const cohort = cohorts[i];
          setVariantProgress(
            t("mc.variantProgress", {
              current: String(i + 1),
              total: String(cohorts.length),
              label: cohort.label,
              n: String(cohort.studentIds.length),
            })
          );
          setAiStepIdx(0);

          const levelForCohort = cohort.levelOverride ?? level;
          const includeVisuals = switches.visualizations;

          const mat = await createOneVariant({
            sourceText,
            finalTitle,
            finalSubject,
            className,
            learnerHints: cohort.learnerHints,
            levelForCohort,
            includeVisuals,
            targetIds: cohort.studentIds,
            adaptationGroupId,
            adaptationKey: cohort.key,
            adaptationLabel: cohort.label,
          });
          throwIfAborted();
          createdIds.push(mat.id);
        }

        clearProgressTimer();
        throwIfAborted();
        setAiStepIdx(AI_STEPS.length - 1);
        toast.success(t("mc.successVariants", { n: String(createdIds.length) }));
        await new Promise(r => setTimeout(r, 400));
        throwIfAborted();
        navigate(`/teacher/materials/${createdIds[0]}/review`);
      } else {
        // Single shared adaptation (legacy behaviour) — still only assign selected targets
        const hintSet = new Set<string>();
        for (const sid of targets) {
          const stu = studentsForTargets.find(s => s.id === sid);
          const prof = profilesByStudentId.get(sid);
          if (stu?.visualPreferred) {
            hintSet.add(
              "Mëson më mirë me figura dhe ilustrime — përfshi shembuj vizualë, përshkrime konkrete dhe gjuhë që lehtëson imagjinimin e koncepteve."
            );
          }
          if (!prof) continue;
          [...prof.preferredFormats, ...prof.supportNeeds, ...prof.teacherRecommendations]
            .filter(Boolean)
            .forEach(h => hintSet.add(h));
        }

        throwIfAborted();
        const mat = await createOneVariant({
          sourceText,
          finalTitle,
          finalSubject,
          className,
          learnerHints: Array.from(hintSet).slice(0, 12),
          levelForCohort: level,
          includeVisuals: switches.visualizations,
          targetIds: targets,
          adaptationGroupId,
        });
        throwIfAborted();
        createdIds = [mat.id];

        clearProgressTimer();
        setAiStepIdx(AI_STEPS.length - 1);
        toast.success(t("mc.success"));
        await new Promise(r => setTimeout(r, 500));
        throwIfAborted();
        navigate(`/teacher/materials/${mat.id}/review`);
      }
    } catch (err) {
      clearProgressTimer();
      if (err instanceof AiAbortedError) {
        stopProcessingKeepForm();
        return;
      }
      setProcessing(false);
      setAiStepIdx(-1);
      setVariantProgress("");
      const message = err instanceof Error ? err.message : "Diçka shkoi keq me AI.";
      toast.error(message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("mc.title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("mc.subtitle")}</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < activeStep ? "bg-primary text-primary-foreground" : i === activeStep ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"}`}>
                {i < activeStep ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] sm:text-xs text-center leading-tight max-w-[4.5rem] sm:max-w-none ${i === activeStep ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 sm:mx-2 ${i < activeStep ? "bg-primary" : "bg-border"}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card rounded-2xl border border-border p-6">
        {step === 0 && !processing && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">{t("mc.stepUpload")}</h2>
            <div className="flex gap-2 mb-4">
              {[{ id: "text", label: t("mc.typePaste") }, { id: "file", label: t("mc.uploadFile") }].map(opt => (
                <button key={opt.id} onClick={() => setInputMode(opt.id as "text" | "file")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${inputMode === opt.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {inputMode === "text" ? (
              <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
                placeholder="Ngjit ose shkruaj tekstin mësimor këtu..."
                className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground resize-none"
                aria-label="Teksti mësimor" />
            ) : (
              <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
                onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
                aria-label="Zona e ngarkimit të skedarit">
                <Upload size={32} className="text-muted-foreground mx-auto mb-3" />
                {extractingFile ? (
                  <div className="text-sm text-primary font-medium">{extractionProgress}</div>
                ) : file ? (
                  <div className="flex items-center gap-2 justify-center text-sm">
                    <File size={16} className="text-primary" />
                    <span className="font-medium">{file.name}</span>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-muted-foreground hover:text-destructive" aria-label="Hiq skedarin">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-sm mb-1">{t("mc.drag")}</p>
                    <p className="text-xs text-muted-foreground">PDF, TXT, Markdown · Maksimumi 10 MB</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} aria-label="Zgjidh skedar" />
              </div>
            )}
            {inputMode === "file" && text && !extractingFile && (
              <div>
                <label className="text-sm font-medium mb-2 block">Teksti i nxjerrë — kontrollo dhe redakto</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={10}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-y"
                  aria-label="Teksti i nxjerrë nga skedari"
                />
              </div>
            )}
          </div>
        )}

        {step === 1 && !processing && (
          <div className="space-y-5">
            <h2 className="font-semibold text-lg">{t("mc.stepAudience")}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[{ id: "class", label: t("mc.wholeClass") }, { id: "student", label: t("mc.selectedStudents") }].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const next = opt.id as "class" | "student";
                    setAudience(next);
                    if (next === "class") setSelectedStudents([]);
                    else setSelectedStudents([]); // start empty — teacher picks manually
                  }}
                  className={`py-3 rounded-xl text-sm font-medium border-2 transition-colors ${audience === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t("common.class")}</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                className="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 text-foreground" aria-label={t("common.class")}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={personalizeByNeeds}
                onChange={e => setPersonalizeByNeeds(e.target.checked)}
                className="accent-primary w-4 h-4 shrink-0"
              />
              <span className="text-sm text-muted-foreground">{t("mc.personalizeTitle")}</span>
            </label>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <label className="text-sm font-medium">{t("mc.selectStudents")}</label>
                <div className="flex items-center gap-2">
                  {audience === "class" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAudience("student");
                        clearStudentSelection();
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {t("mc.deselectAll")}
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t("mc.studentsCount", { n: targetStudentIds.length })}
                  </span>
                </div>
              </div>

              {audience === "class" && (
                <p className="text-xs text-muted-foreground mb-2">{t("mc.classMeansAll")}</p>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {classStudents.map(s => {
                  const checked =
                    audience === "class" ? true : selectedStudents.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (audience === "class") {
                            setAudience("student");
                            setSelectedStudents(classStudents.map(x => x.id).filter(id => id !== s.id));
                            return;
                          }
                          toggleStudent(s.id);
                        }}
                        className="accent-primary w-4 h-4"
                      />
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">{s.name[0]}</div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium block truncate">{s.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {s.visualPreferred ? "Vizual · " : ""}
                          {s.audioEnabled ? "Audio · " : ""}
                          {s.readingLevel}
                        </span>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{s.readingLevel}</span>
                    </label>
                  );
                })}
                {classStudents.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t("mc.noStudents")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && !processing && (
          <div className="space-y-5">
            <h2 className="font-semibold text-lg">{t("mc.stepAdapt")}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("mc.materialTitle")}</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="p.sh. Fotosinteza"
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground placeholder:text-muted-foreground" aria-label={t("mc.titleLabel")} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("mc.subject")}</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="p.sh. Biologji"
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground placeholder:text-muted-foreground" aria-label={t("mc.subjectLabel")} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t("mc.simpLevel")}</label>
              <div className="grid grid-cols-3 gap-2">
                {simplificationLabels.map((label, i) => (
                  <button key={i} onClick={() => setLevel(i + 1)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border-2 transition-colors ${level === i + 1 ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {personalizeByNeeds && (
                <p className="text-xs text-muted-foreground mt-2">{t("mc.levelMayVary")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t("mc.length")}</label>
              <div className="flex gap-2">
                {lengthOptions.map(opt => (
                  <button key={opt.val} onClick={() => setLength(opt.val)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-colors capitalize ${length === opt.val ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}>
                    {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t("mc.numQuestions")}: {numQ}</label>
              <input type="range" min={3} max={10} value={numQ} onChange={e => setNumQ(Number(e.target.value))}
                className="w-full accent-primary" aria-label={t("mc.numQuestions")} />
            </div>

            <div>
              <p className="text-sm font-medium mb-3">{t("mc.genElements")}</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {Object.entries(switches).map(([key, val]) => (
                  <label key={key} className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${val ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                    <span className="text-sm">{switchLabels[key]}</span>
                    <div onClick={() => setSwitches(prev => ({ ...prev, [key]: !prev[key as keyof typeof switches] }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${val ? "bg-primary" : "bg-muted-foreground/30"}`} role="switch" aria-checked={val}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${val ? "left-5" : "left-0.5"}`} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && !processing && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">{t("mc.stepConfirm")}</h2>
            <div className="bg-warning-muted border border-warning/20 rounded-xl p-4 text-sm text-warning-muted-foreground">
              {t("mc.aiReviewNote")}
            </div>
            <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("mc.titleLabel")}</span><span className="font-medium">{title}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("mc.subjectLabel")}</span><span className="font-medium">{subject}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("mc.simpLabel")}</span><span className="font-medium">{simplificationLabels[level - 1]}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("mc.questionsLabel")}</span><span className="font-medium">{numQ}</span></div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">{t("mc.audienceLabel")}</span>
                <span className="font-medium text-right">
                  {audience === "class" && selectedStudents.length === 0
                    ? classes.find(c => c.id === selectedClass)?.name
                    : t("mc.studentsCount", { n: targetStudentIds.length })}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">{t("mc.modeLabel")}</span>
                <span className="font-medium text-right">
                  {personalizeByNeeds ? t("mc.modePersonalized") : t("mc.modeShared")}
                </span>
              </div>
            </div>
          </div>
        )}

        {processing && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Wand2 size={28} className="text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="font-semibold text-lg mb-1">{t("mc.processing")}</h2>
              <p className="text-sm text-muted-foreground">{t("mc.wait")}</p>
              {variantProgress && (
                <p className="text-sm font-semibold text-primary mt-2">{variantProgress}</p>
              )}
            </div>
            <div className="space-y-2 max-w-xs mx-auto">
              {AI_STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm transition-all ${i <= aiStepIdx ? "opacity-100" : "opacity-30"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${i < aiStepIdx ? "bg-success" : i === aiStepIdx ? "bg-primary animate-pulse" : "bg-muted"}`}>
                    {i < aiStepIdx ? <Check size={10} className="text-white" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className={i <= aiStepIdx ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation — always visible, including during AI processing */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium"
        >
          <ChevronLeft size={16} /> {t("mc.back")}
        </button>
        {!processing && (
          step < 3 ? (
            <button type="button" onClick={handleContinue} disabled={!canProceed()}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none">
              {t("mc.continue")} <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={runAI}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
              <Wand2 size={16} /> {personalizeByNeeds ? t("mc.adaptAll") : t("mc.adaptAI")}
            </button>
          )
        )}
      </div>

      <Dialog.Root open={abortConfirmOpen} onOpenChange={setAbortConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-card rounded-2xl border border-border shadow-2xl p-6 z-50">
            <Dialog.Title className="font-semibold text-lg mb-2">{t("mc.abortTitle")}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground whitespace-pre-line mb-6">
              {t("mc.abortBody")}
            </Dialog.Description>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={confirmAbortBack}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {t("mc.abortConfirm")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
