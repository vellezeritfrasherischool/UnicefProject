import React, { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, CheckCircle2, GraduationCap,
  Headphones, Image, Sparkles, Upload, User, Users, Wand2,
} from "lucide-react";
import { AppLogo } from "./AppLogo";
import { APP_NAME } from "./brand";

type DemoRole = "teacher" | "student";

function TeacherDemo() {
  return (
    <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-6 items-stretch">
      <div className="rounded-3xl bg-primary text-primary-foreground p-7 sm:p-9 overflow-hidden relative">
        <div className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full bg-white/10" />
        <GraduationCap size={36} className="mb-6" />
        <p className="text-sm font-bold uppercase tracking-widest opacity-75 mb-2">Demonstrim për mësuesen</p>
        <h2 className="text-3xl font-extrabold leading-tight mb-4">Një material. Versioni i duhur për secilin nxënës.</h2>
        <p className="opacity-85 leading-relaxed">Ngarko tekstin, kontrollo adaptimin e AI-së dhe publikoje vetëm kur je e kënaqur.</p>
        <div className="mt-8 flex items-center gap-3 text-sm font-semibold">
          <Users size={18} /> Klasa VI-1 · 24 nxënës
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Material i ri · Biologji</p>
            <h3 className="text-xl font-bold mt-1">Si funksionon fotosinteza?</h3>
          </div>
          <span className="rounded-full bg-warning-muted text-warning-muted-foreground px-3 py-1 text-xs font-bold">Në shqyrtim</span>
        </div>
        <div className="space-y-3">
          {[
            { icon: Upload, title: "1. Ngarko tekstin", text: "Bima përdor dritën, ujin dhe dioksidin e karbonit…", done: true },
            { icon: Wand2, title: "2. Adapto me AI", text: "Tekst i thjeshtuar, përmbledhje, fjalor dhe kuiz.", done: true },
            { icon: CheckCircle2, title: "3. Kontrollo dhe publiko", text: "Mësuesja ruan kontrollin përfundimtar.", done: false },
          ].map(step => (
            <div key={step.title} className={`flex gap-4 rounded-2xl border p-4 ${step.done ? "border-primary/20 bg-primary/5" : "border-border"}`}>
              <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                <step.icon size={18} className={step.done ? "text-primary" : "text-muted-foreground"} />
              </div>
              <div><p className="font-bold text-sm">{step.title}</p><p className="text-sm text-muted-foreground mt-1">{step.text}</p></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5 text-center">
          {["Lexim bazë", "Mbështetje", "Sfidë"].map((label, index) => (
            <div key={label} className="rounded-xl bg-muted p-3"><p className="text-lg font-extrabold text-primary">{[8, 10, 6][index]}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentDemo() {
  return (
    <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-6 items-stretch">
      <div className="rounded-3xl bg-[#0F766E] text-white p-7 sm:p-9 overflow-hidden relative">
        <div className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full bg-white/10" />
        <User size={36} className="mb-6" />
        <p className="text-sm font-bold uppercase tracking-widest opacity-75 mb-2">Demonstrim për nxënësin</p>
        <h2 className="text-3xl font-extrabold leading-tight mb-4">Lexo, dëgjo dhe kupto me ritmin tënd.</h2>
        <p className="opacity-85 leading-relaxed">Fjali më të qarta, fjalë të shpjeguara dhe audio që e bëjnë mësimin më të lehtë.</p>
        <div className="mt-8 flex items-center gap-3 text-sm font-semibold">
          <Sparkles size={18} /> +20 XP pas kuizit
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm">
        <div className="flex gap-4 items-center mb-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-emerald-100 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 80 80" className="w-16 h-16" aria-label="Ilustrim i një bime nën diell">
              <circle cx="61" cy="18" r="9" fill="#F59E0B"/><path d="M40 66V39" stroke="#15803D" strokeWidth="4" strokeLinecap="round"/><path d="M40 48c-13 0-16-8-16-13 10-1 16 4 16 13Z" fill="#22C55E"/><path d="M40 41c12 0 16-7 16-13-10-1-16 4-16 13Z" fill="#16A34A"/><path d="M22 67h36" stroke="#92400E" strokeWidth="4" strokeLinecap="round"/></svg>
          </div>
          <div><p className="text-xs text-muted-foreground font-semibold">BIOLOGJI · 7 MINUTA</p><h3 className="text-xl font-bold mt-1">Fotosinteza</h3></div>
        </div>
        <div className="rounded-2xl bg-muted/60 p-5 leading-8 text-lg">
          Bimët krijojnë ushqimin e tyre me ndihmën e <span className="bg-amber-200/80 px-1.5 py-0.5 rounded-lg font-semibold">dritës së diellit</span>. Ato marrin ujë nga toka dhe një gaz nga ajri.
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="ui-btn-primary"><Headphones size={17} /> Dëgjo tekstin</button>
          <button type="button" className="ui-btn-secondary"><Image size={17} /> Shiko ilustrimin</button>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <p className="font-bold text-sm mb-3"><Brain size={17} className="inline mr-2 text-primary" />Pyetje e shpejtë</p>
          <p className="text-sm mb-3">Çfarë u nevojitet bimëve për të krijuar ushqim?</p>
          <div className="grid sm:grid-cols-2 gap-2 text-sm"><div className="rounded-xl border-2 border-primary bg-primary/5 p-3 font-semibold">Dritë, ujë dhe gaz</div><div className="rounded-xl border border-border p-3 text-muted-foreground">Vetëm tokë</div></div>
        </div>
      </div>
    </div>
  );
}

export default function Demo() {
  const [role, setRole] = useState<DemoRole>("teacher");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5"><AppLogo size={32} /><span className="font-bold">{APP_NAME}</span></Link>
          <Link to="/" className="ml-auto text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2"><ArrowLeft size={16} /> Kryefaqja</Link>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="inline-flex items-center gap-2 text-primary bg-primary/10 rounded-full px-4 py-1.5 text-sm font-bold"><BookOpen size={15} /> Demonstrim publik</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-5 mb-3">Shiko si funksionon {APP_NAME}</h1>
          <p className="text-muted-foreground">Ky demonstrim nuk kërkon llogari dhe nuk ndryshon të dhëna. Zgjidh pamjen që dëshiron të eksplorosh.</p>
        </div>
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-muted rounded-2xl p-1.5 gap-1">
            <button type="button" onClick={() => setRole("teacher")} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${role === "teacher" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}><GraduationCap size={17} /> Për mësuesen</button>
            <button type="button" onClick={() => setRole("student")} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${role === "student" ? "bg-card shadow-sm text-[#0F766E]" : "text-muted-foreground"}`}><User size={17} /> Për nxënësin</button>
          </div>
        </div>
        {role === "teacher" ? <TeacherDemo /> : <StudentDemo />}
        <div className="text-center mt-10"><Link to="/login" className="ui-btn-primary px-7 py-3.5">Vazhdo te hyrja <ArrowRight size={18} /></Link></div>
      </main>
    </div>
  );
}
