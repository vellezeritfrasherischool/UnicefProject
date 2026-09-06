import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import { Users, Search, Filter, Plus, ChevronRight, AlertTriangle, Star, X, Copy, Pencil, Trash2 } from "lucide-react";
import { studentService } from "./services";
import type { Student, ClassGroup } from "./types";
import { toast } from "sonner";
import { useT } from "./useT";
import { useApp } from "./store";
import { isSupabaseEnabled } from "./supabase";

const statusColors: Record<string, string> = {
  "excellent": "bg-success-muted text-success-muted-foreground",
  "active": "bg-secondary text-secondary-foreground",
  "needs-support": "bg-warning-muted text-warning-muted-foreground",
};
const levelColors: Record<string, string> = {
  "Avancuar": "text-success",
  "Mesatar": "text-primary",
  "Bazik": "text-warning",
};
const levelKeys: Record<string, string> = {
  "Avancuar": "level.advanced",
  "Mesatar": "level.medium",
  "Bazik": "level.basic",
};

export default function TeacherClasses() {
  const { t } = useT();
  const { user } = useApp();
  const cloud = isSupabaseEnabled();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    age: "12",
    classId: "",
    readingLevel: "Mesatar",
    audioEnabled: true,
    visualPreferred: true,
  });

  const statusLabels: Record<string, string> = {
    "excellent": t("status.excellent"),
    "active": t("status.active"),
    "needs-support": t("status.needsSupport"),
  };

  const refreshClasses = async () => {
    const list = await studentService.getClasses(user?.id);
    setClasses(list);
    return list;
  };

  useEffect(() => {
    if (!user) return;
    refreshClasses().then(list => {
      if (list.length && !selectedClass) setSelectedClass(list[0]);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    studentService.getByClass(selectedClass.id).then(s => {
      setStudents(s);
      setLoading(false);
    });
  }, [selectedClass]);

  const openAddModal = () => {
    setEditingStudent(null);
    setForm({
      name: "",
      email: "",
      password: "",
      age: "12",
      classId: selectedClass?.id || classes[0]?.id || "",
      readingLevel: "Mesatar",
      audioEnabled: true,
      visualPreferred: true,
    });
    setAddOpen(true);
  };

  const openEditStudent = (student: Student) => {
    setEditingStudent(student);
    setForm({
      name: student.name,
      email: student.email ?? "",
      password: "",
      age: String(student.age),
      classId: student.classId || selectedClass?.id || "",
      readingLevel: student.readingLevel,
      audioEnabled: student.audioEnabled,
      visualPreferred: student.visualPreferred,
    });
    setAddOpen(true);
  };

  const openCreateClass = () => {
    setEditingClass(null);
    setNewClassName("");
    setClassOpen(true);
  };

  const openEditClass = () => {
    if (!selectedClass) return;
    setEditingClass(selectedClass);
    setNewClassName(selectedClass.name);
    setClassOpen(true);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      if (editingClass) {
        await studentService.updateClass(editingClass.id, newClassName);
        toast.success("Klasa u përditësua.");
        const list = await refreshClasses();
        setSelectedClass(list.find(c => c.id === editingClass.id) ?? list[0] ?? null);
      } else {
        const cls = await studentService.createClass(user.id, newClassName);
        toast.success(t("tc.classCreated", { name: cls.name, code: cls.joinCode || "" }));
        const list = await refreshClasses();
        setSelectedClass(list.find(c => c.id === cls.id) || cls);
      }
      setClassOpen(false);
      setNewClassName("");
      setEditingClass(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tc.classFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cls = classes.find(c => c.id === form.classId) || selectedClass;
    if (!cls) {
      toast.error(t("tc.selectClass"));
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const student = editingStudent
        ? await studentService.manageUpdate({ studentId: editingStudent.id, name: form.name, age: Number(form.age), readingLevel: form.readingLevel, targetClassId: cls.id, audioEnabled: form.audioEnabled, visualPreferred: form.visualPreferred })
        : await studentService.create({
            name: form.name, class: cls.name, classId: cls.id, teacherId: user.id,
            age: Number(form.age), readingLevel: form.readingLevel,
            audioEnabled: form.audioEnabled, visualPreferred: form.visualPreferred,
            email: form.email || undefined, password: form.password || undefined,
          });
      toast.success(`${student.name} · ${cls.name}`);
      setAddOpen(false);
      setEditingStudent(null);
      const list = await refreshClasses();
      const updated = list.find(c => c.id === cls.id) || cls;
      setSelectedClass(updated);
      const refreshed = await studentService.getByClass(updated.id);
      setStudents(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("tc.addFailed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass || !window.confirm(`Ta fshijmë klasën “${selectedClass.name}”? Klasa duhet të jetë pa nxënës dhe materiale.`)) return;
    setSaving(true);
    try {
      await studentService.deleteClass(selectedClass.id);
      toast.success("Klasa u fshi.");
      const list = await refreshClasses();
      setSelectedClass(list[0] ?? null);
      setStudents([]);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Klasa nuk u fshi."); }
    finally { setSaving(false); }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Ta fshijmë nxënësin “${student.name}”? Llogaria dhe të dhënat e tij do të fshihen përgjithmonë.`)) return;
    setSaving(true);
    try {
      await studentService.deleteStudent(student.id);
      toast.success("Nxënësi u fshi.");
      if (selectedClass) setStudents(await studentService.getByClass(selectedClass.id));
      await refreshClasses();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Nxënësi nuk u fshi."); }
    finally { setSaving(false); }
  };

  const copyCode = async (code?: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("tc.codeCopied"));
    } catch {
      toast.error(code);
    }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const tableHeaders = [
    t("common.student"),
    t("common.age"),
    t("tc.readingLevel"),
    t("common.materials"),
    t("common.score"),
    t("common.status"),
    t("common.actions"),
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("tc.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("tc.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCreateClass}
            className="flex items-center gap-2 border border-border bg-card font-medium px-4 py-2.5 rounded-xl hover:bg-muted transition-colors min-h-11"
          >
            <Plus size={16} /> {t("tc.addClass")}
          </button>
          <button
            type="button"
            onClick={openAddModal}
            disabled={classes.length === 0}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors min-h-11 disabled:opacity-50"
          >
            <Plus size={16} /> {t("tc.addStudent")}
          </button>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <p className="font-semibold mb-2">{t("tc.noClasses")}</p>
          <p className="text-sm text-muted-foreground mb-4">{t("tc.noClassesHint")}</p>
          <button type="button" onClick={openCreateClass} className="ui-btn-primary inline-flex">
            <Plus size={16} /> {t("tc.addClass")}
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {classes.map(cls => (
          <button key={cls.id} type="button" onClick={() => setSelectedClass(cls)}
            className={`text-left bg-card rounded-2xl border-2 p-5 transition-all hover:shadow-md ${selectedClass?.id === cls.id ? "border-primary shadow-sm shadow-primary/15" : "border-border hover:border-primary/30"}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{cls.name}</p>
                <p className="text-xs text-muted-foreground">{t("tc.studentsCount", { n: cls.studentCount })}</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-muted-foreground shrink-0" />
            </div>
            {cls.joinCode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void copyCode(cls.joinCode); }}
                className="mb-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/70 text-xs font-bold tracking-wider hover:bg-muted"
              >
                <span>{t("tc.joinCode")}: {cls.joinCode}</span>
                <Copy size={14} />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-xs text-muted-foreground">{t("common.materials")}</p>
                <p className="font-semibold">{cls.activeMaterials}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-xs text-muted-foreground">{t("common.average")}</p>
                <p className="font-semibold">{cls.averageScore}%</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedClass && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-3 flex-wrap">
            <h2 className="font-semibold">{selectedClass.name}</h2>
            <button type="button" onClick={openEditClass} className="p-2 rounded-xl text-primary hover:bg-primary/10" aria-label="Ndrysho klasën" title="Ndrysho klasën"><Pencil size={16} /></button>
            <button type="button" onClick={() => void handleDeleteClass()} disabled={saving} className="p-2 rounded-xl text-destructive hover:bg-destructive/10" aria-label="Fshi klasën" title="Fshi klasën"><Trash2 size={16} /></button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <Search size={15} className="text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("tc.search")}
                className="bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground w-full" aria-label={t("tc.search")} />
            </div>
            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
              <Filter size={14} /> {t("tc.filter")}
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
            >
              <Plus size={14} /> {t("tc.addStudent")}
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted-foreground">{t("common.loading")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead className="bg-muted/40">
                  <tr>
                    {tableHeaders.map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {s.name[0]}
                          </div>
                          <div>
                            <span className="font-medium block">{s.name}</span>
                            {s.email && <span className="text-xs text-muted-foreground">{s.email}</span>}
                          </div>
                          {s.status === "needs-support" && <AlertTriangle size={13} className="text-warning" aria-label={t("status.needsSupport")} />}
                          {s.status === "excellent" && <Star size={13} className="text-success" aria-label={t("status.excellent")} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.age}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium text-xs ${levelColors[s.readingLevel] ?? ""}`}>
                          {t(levelKeys[s.readingLevel] ?? "level.medium")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.completedMaterials}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${s.score}%` }} />
                          </div>
                          <span className="font-medium">{s.score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.visualPreferred && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t("common.visual")}</span>
                          )}
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[s.status]}`}>
                            {statusLabels[s.status]}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/teacher/students/${s.id}`} className="text-xs text-primary hover:underline font-medium mr-1">{t("tc.viewProfile")}</Link>
                          <button type="button" onClick={() => openEditStudent(s)} className="p-2 rounded-lg text-primary hover:bg-primary/10" aria-label={`Ndrysho ${s.name}`}><Pencil size={15} /></button>
                          <button type="button" onClick={() => void handleDeleteStudent(s)} disabled={saving} className="p-2 rounded-lg text-destructive hover:bg-destructive/10" aria-label={`Fshi ${s.name}`}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">{t("tc.noStudents")}</div>
              )}
            </div>
          )}
        </div>
      )}

      {classOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => !saving && setClassOpen(false)} />
          <div className="relative w-full max-w-md ui-card p-6 shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold tracking-tight">{editingClass ? "Ndrysho klasën" : t("tc.addClass")}</h2>
              <button type="button" onClick={() => !saving && setClassOpen(false)} className="p-2 rounded-xl hover:bg-muted min-h-10 min-w-10 flex items-center justify-center" aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="mb-2 block" htmlFor="cls-name">{t("tc.className")}</label>
                <input
                  id="cls-name"
                  required
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="p.sh. VI-1"
                  className="ui-input"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setClassOpen(false)} disabled={saving} className="ui-btn-secondary flex-1">
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={saving} className="ui-btn-primary flex-1">
                  {saving ? t("tc.saving") : editingClass ? "Ruaj ndryshimet" : t("tc.createClassBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => !saving && setAddOpen(false)} />
          <div className="relative w-full max-w-md ui-card p-6 shadow-[var(--shadow-lg)] max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="add-student-title">
            <div className="flex items-center justify-between mb-5">
              <h2 id="add-student-title" className="text-lg font-extrabold tracking-tight">{editingStudent ? "Ndrysho nxënësin" : t("tc.addStudent")}</h2>
              <button type="button" onClick={() => !saving && setAddOpen(false)} className="p-2 rounded-xl hover:bg-muted min-h-10 min-w-10 flex items-center justify-center" aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-2 block" htmlFor="stu-name">{t("tc.fullName")}</label>
                <input
                  id="stu-name"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="p.sh. Era Krasniqi"
                  className="ui-input"
                />
              </div>

              {cloud && !editingStudent && (
                <>
                  <div>
                    <label className="mb-2 block" htmlFor="stu-email">{t("login.email")}</label>
                    <input
                      id="stu-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="nxenesi@email.com"
                      className="ui-input"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block" htmlFor="stu-pw">{t("login.password")}</label>
                    <input
                      id="stu-pw"
                      type="password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="min. 6 karaktere"
                      className="ui-input"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">{t("tc.studentPwHint")}</p>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block" htmlFor="stu-age">{t("common.age")}</label>
                  <input
                    id="stu-age"
                    type="number"
                    min={5}
                    max={20}
                    required
                    value={form.age}
                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="mb-2 block" htmlFor="stu-level">{t("tc.readingLevel")}</label>
                  <select
                    id="stu-level"
                    value={form.readingLevel}
                    onChange={e => setForm(f => ({ ...f, readingLevel: e.target.value }))}
                    className="ui-input"
                  >
                    <option value="Bazik">{t("level.basic")}</option>
                    <option value="Mesatar">{t("level.medium")}</option>
                    <option value="Avancuar">{t("level.advanced")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block" htmlFor="stu-class">{t("common.class")}</label>
                <select
                  id="stu-class"
                  required
                  value={form.classId}
                  onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                  className="ui-input"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between px-4 py-3 rounded-2xl border border-primary/25 bg-primary/5 cursor-pointer min-h-12">
                <div>
                  <span className="text-sm font-bold text-foreground block">{t("tc.visualLearn")}</span>
                  <span className="text-xs text-muted-foreground">{t("tc.visualHint")}</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.visualPreferred}
                  onChange={e => setForm(f => ({ ...f, visualPreferred: e.target.checked }))}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              <label className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border cursor-pointer min-h-12">
                <span className="text-sm font-medium">{t("tc.enableAudio")}</span>
                <input
                  type="checkbox"
                  checked={form.audioEnabled}
                  onChange={e => setForm(f => ({ ...f, audioEnabled: e.target.checked }))}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} disabled={saving} className="ui-btn-secondary flex-1">
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={saving} className="ui-btn-primary flex-1">
                  {saving ? t("tc.saving") : editingStudent ? "Ruaj ndryshimet" : t("tc.addStudentBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
