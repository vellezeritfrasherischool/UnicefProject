import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Bell, BookOpen, CheckCircle2, Loader2, Trophy, X } from "lucide-react";
import { assignmentService, materialService, studentService } from "./services";
import type { Assignment, Material, Student } from "./types";
import { useT } from "./useT";

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  to: string;
  kind: "material" | "result";
};

function timeValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayDate(value: string, lang: "sq" | "en"): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "sq-AL", {
    day: "numeric", month: "short", year: "numeric",
  }).format(date);
}

async function loadTeacherItems(userId: string, lang: "sq" | "en"): Promise<NotificationItem[]> {
  const [materials, assignments, students] = await Promise.all([
    materialService.getAll(),
    assignmentService.getAll(),
    studentService.getAll(userId),
  ]);
  const materialMap = new Map(materials.map(material => [material.id, material]));
  const studentMap = new Map(students.map(student => [student.id, student]));
  const published = materials.filter(material => material.status === "published").map(material => ({
    id: `published-${material.id}`,
    title: lang === "en" ? "Material published" : "Material i publikuar",
    detail: `${material.title} · ${material.class}`,
    date: material.createdAt,
    to: `/teacher/materials/${material.id}/review`,
    kind: "material" as const,
  }));
  const results = assignments.filter(assignment => assignment.status === "completed" && assignment.score != null).map(assignment => ({
    id: `result-${assignment.id}-${assignment.attempts ?? 0}`,
    title: lang === "en" ? "New quiz result" : "Rezultat i ri në kuiz",
    detail: `${studentMap.get(assignment.studentId)?.name ?? (lang === "en" ? "Student" : "Nxënës")} · ${materialMap.get(assignment.materialId)?.title ?? (lang === "en" ? "Material" : "Materiali")} · ${assignment.score}%`,
    date: assignment.completedAt || assignment.startDate,
    to: `/teacher/students/${assignment.studentId}`,
    kind: "result" as const,
  }));
  return [...results, ...published].sort((a, b) => timeValue(b.date) - timeValue(a.date)).slice(0, 8);
}

async function loadStudentItems(userId: string, lang: "sq" | "en"): Promise<NotificationItem[]> {
  const assignments = await assignmentService.getForStudent(userId);
  const materials = await Promise.all(
    [...new Set(assignments.map(assignment => assignment.materialId))].map(id => materialService.getById(id))
  );
  const materialMap = new Map(materials.filter((item): item is Material => Boolean(item)).map(item => [item.id, item]));
  return assignments.map(assignment => {
    const material = materialMap.get(assignment.materialId);
    const complete = assignment.status === "completed" && assignment.score != null;
    return {
      id: `${complete ? "result" : "assigned"}-${assignment.id}-${assignment.attempts ?? 0}`,
      title: complete
        ? (lang === "en" ? "Quiz result" : "Rezultati i kuizit")
        : (lang === "en" ? "New material" : "Material i ri"),
      detail: complete
        ? `${material?.title ?? "Material"} · ${assignment.score}%`
        : `${material?.title ?? "Material"} · ${material?.subject ?? ""}`,
      date: complete ? (assignment.completedAt || assignment.startDate) : assignment.startDate,
      to: complete ? `/student/results/${assignment.id}` : `/student/read/${assignment.materialId}`,
      kind: complete ? "result" as const : "material" as const,
    };
  }).sort((a, b) => timeValue(b.date) - timeValue(a.date)).slice(0, 8);
}

export default function NotificationsDropdown({ role, userId }: { role: "teacher" | "student"; userId?: string }) {
  const { t, lang } = useT();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const storageKey = `mesolehte_notifications_seen_${role}_${userId ?? "guest"}`;

  const seenIds = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      return new Set<string>(Array.isArray(value) ? value.map(String) : []);
    } catch {
      return new Set<string>();
    }
  })();

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setItems(role === "teacher" ? await loadTeacherItems(userId, lang) : await loadStudentItems(userId, lang));
    } catch (error) {
      console.warn("[notifications]", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [userId, role, lang]);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const hasUnread = items.some(item => !seenIds.has(item.id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      localStorage.setItem(storageKey, JSON.stringify([...new Set([...seenIds, ...items.map(item => item.id)])].slice(-100)));
      void refresh();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        className="relative p-2.5 rounded-2xl hover:bg-muted transition-colors min-h-11 min-w-11 flex items-center justify-center"
        aria-label={t("nav.notifications")}>
        <Bell size={20} />
        {hasUnread && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />}
      </button>
      {open && (
        <div role="dialog" aria-label={t("nav.notifications")} className="absolute right-0 top-[calc(100%+.5rem)] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)] overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div><p className="font-extrabold text-sm">{t("nav.notifications")}</p><p className="text-xs text-muted-foreground">{role === "teacher" ? (lang === "en" ? "Materials and student results" : "Materiale dhe rezultate të nxënësve") : (lang === "en" ? "Materials and your results" : "Materiale dhe rezultatet e tua")}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted" aria-label={lang === "en" ? "Close" : "Mbyll"}><X size={16} /></button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {loading && items.length === 0 ? (
              <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{lang === "en" ? "No notifications yet." : "Nuk ka ende njoftime."}</p>
            ) : items.map(item => {
              const Icon = item.kind === "material" ? BookOpen : role === "student" ? Trophy : CheckCircle2;
              return (
                <Link key={item.id} to={item.to} className="flex gap-3 p-3 rounded-xl hover:bg-muted transition-colors">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.kind === "material" ? "bg-primary/10 text-primary" : "bg-success-muted text-success-muted-foreground"}`}><Icon size={18} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.title}</span><span className="block text-xs text-muted-foreground truncate mt-0.5">{item.detail}</span><span className="block text-[11px] text-muted-foreground mt-1">{displayDate(item.date, lang)}</span></span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
