import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
  Star, Clock, BookOpen, Headphones, RotateCcw, ChevronRight, Check, RefreshCw,
  Sparkles, ListChecks, Brain, Heart, Layers, Send,
} from "lucide-react";
import { assignmentService, learningService, materialService } from "./services";
import type { Assignment, LearningReport, Material, MemoryBoosterPack } from "./types";
import { useT } from "./useT";

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [report, setReport] = useState<LearningReport | null>(null);
  const [booster, setBooster] = useState<MemoryBoosterPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipIdx, setFlipIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      const asgn = await assignmentService.getById(id);
      if (cancelled) return;
      setAssignment(asgn ?? null);
      if (!asgn) {
        setLoading(false);
        return;
      }
      const mat = await materialService.getById(asgn.materialId);
      if (cancelled) return;
      setMaterial(mat ?? null);

      // Retry briefly — report may still be writing right after quiz finish
      let rep = await learningService.getReportByAssignment(asgn.id);
      let mb = await learningService.getMemoryBoosterByAssignment(asgn.id);
      for (let i = 0; i < 4 && !rep; i++) {
        await new Promise(r => setTimeout(r, 400));
        if (cancelled) return;
        rep = await learningService.getReportByAssignment(asgn.id);
        mb = mb ?? (await learningService.getMemoryBoosterByAssignment(asgn.id));
      }
      if (cancelled) return;
      setReport(rep ?? null);
      setBooster(mb ?? null);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!assignment || !material) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{t("res.notFound")}</p>
        <Link to="/student/dashboard" className="mt-4 text-primary hover:underline text-sm inline-block">{t("res.backDashboard")}</Link>
      </div>
    );
  }

  const score = assignment.score ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2 sm:py-4">
      <div className={`rounded-3xl p-7 sm:p-8 text-center text-white shadow-[var(--shadow-md)] ${score >= 80 ? "bg-gradient-to-br from-primary to-[#8B7CF7]" : score >= 60 ? "bg-gradient-to-br from-primary to-[#5B52C7]" : "bg-gradient-to-br from-[#C4A35A] to-[#B8954A]"}`}>
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
          <Star size={28} fill="currentColor" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1 tracking-tight">
          {score >= 80 ? t("quiz.great") : score >= 60 ? t("quiz.ok") : t("quiz.tried")}
        </h1>
        <p className="text-white/85 mb-4 text-sm">{t("res.completed")} <strong>{material.title}</strong></p>
        <div className="text-5xl font-extrabold mb-1 tracking-tight">{score}%</div>
      </div>

      {report && (
        <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success-muted p-4">
          <Send size={18} className="text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-success-muted-foreground">{t("res.reportSent")}</p>
            <p className="text-xs text-success-muted-foreground/90 mt-0.5">
              Mësuesja e sheh te profili yt: përmbledhje, vështirësi, rekomandime dhe hapat e radhës.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Clock, label: t("res.duration"), value: `${assignment.timeSpentMinutes ?? "—"} min` },
          { icon: BookOpen, label: t("res.wordsOpened"), value: `${assignment.wordsOpened ?? 0}` },
          { icon: Headphones, label: t("res.audioUsed"), value: assignment.audioUsed ? t("common.yes") : t("common.no") },
          { icon: RefreshCw, label: t("res.attempts"), value: `${Math.max(1, assignment.attempts ?? 0)}` },
        ].map(stat => (
          <div key={stat.label} className="ui-card p-4 text-center">
            <stat.icon size={18} className="text-muted-foreground mx-auto mb-2" />
            <p className="font-extrabold text-lg text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {report?.studentMessage && (
        <div className="ui-card p-5 sm:p-6">
          <h2 className="ui-section-title flex items-center gap-2 mb-3">
            <Heart size={16} className="text-primary" /> {t("res.aiMessage")}
          </h2>
          <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-line">{report.studentMessage}</p>
        </div>
      )}

      {report?.studyPlan && report.studyPlan.length > 0 && (
        <div className="ui-card p-5 sm:p-6">
          <h2 className="ui-section-title flex items-center gap-2 mb-4">
            <ListChecks size={16} className="text-primary" /> {t("res.studyPlan")}
          </h2>
          <ol className="space-y-3">
            {report.studyPlan.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-foreground pt-1 font-medium">{step.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {booster && (
        <div className="ui-card p-5 sm:p-6 space-y-4">
          <h2 className="ui-section-title flex items-center gap-2">
            <Brain size={16} className="text-primary" /> Memory Booster
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{booster.shortSummary}</p>

          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">{t("sd.flashcards")}</p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {booster.flashcards.map((card, i) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setFlipIdx(flipIdx === i ? null : i)}
                  className="text-left p-4 rounded-2xl border border-border hover:border-primary/40 bg-muted/40 transition-colors min-h-[80px]"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-bold">{card.type}</p>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {flipIdx === i ? card.back : card.front}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {booster.reviewQuestions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">{t("res.reviewQs")}</p>
              <ul className="space-y-1.5">
                {booster.reviewQuestions.map((rq, i) => (
                  <li key={i} className="text-sm flex gap-2 font-medium">
                    <Check size={14} className="text-primary mt-0.5 shrink-0" />
                    <span>{rq}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">Përsërit: {booster.reviewSchedule.after1Day}</span>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">+3 ditë: {booster.reviewSchedule.after3Days}</span>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">+7 ditë: {booster.reviewSchedule.after7Days}</span>
          </div>
        </div>
      )}

      {report && (
        <div className="ui-card p-5 sm:p-6 space-y-4">
          <h2 className="ui-section-title flex items-center gap-2 text-primary">
            <Sparkles size={16} /> {t("res.learningReport")}
          </h2>
          <p className="text-sm text-foreground leading-relaxed">{report.performanceSummary}</p>

          {report.strengths.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">{t("res.strengths")}</p>
              <ul className="space-y-1.5">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2"><Check size={13} className="text-success mt-0.5 shrink-0" />{s}</li>
                ))}
              </ul>
            </div>
          )}

          {report.difficulties.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">{t("res.improve")}</p>
              <ul className="space-y-1.5">
                {report.difficulties.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2"><RefreshCw size={13} className="text-warning mt-0.5 shrink-0" />{s}</li>
                ))}
              </ul>
            </div>
          )}

          {report.nextLessonSteps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">{t("res.nextSteps")}</p>
              <ul className="space-y-1.5">
                {report.nextLessonSteps.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2"><ChevronRight size={13} className="text-primary mt-0.5 shrink-0" />{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!report && (
        <div className="bg-muted/40 rounded-2xl p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Layers size={16} /> Raporti AI nuk u gjet ende. Nëse sapo e mbarove kuizin, rifresko faqen.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <Link to={`/student/read/${material.id}`} className="ui-btn-secondary flex-1">
          <RotateCcw size={14} /> {t("res.readAgain")}
        </Link>
        <Link to={`/student/practice/${material.id}`} className="ui-btn-secondary flex-1">
          <Brain size={14} /> {t("sd.flashcards")}
        </Link>
        <Link to="/student/dashboard" className="ui-btn-primary flex-1">
          {t("res.backTasks")} <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
