import React from "react";
import { Link } from "react-router";
import { BookOpen, Sparkles, ArrowRight, Upload, Wand2, Eye, Share2, Check, Shield, Users, Zap, Brain, Headphones } from "lucide-react";
import { useT } from "./useT";
import { AppLogo } from "./AppLogo";
import { APP_NAME } from "./brand";

const features = [
  { icon: Wand2, title: "Thjeshtësim me AI", desc: "Tekstet adaptohen automatikisht sipas nivelit të leximit të çdo nxënësi." },
  { icon: Brain, title: "Pyetje inteligjente", desc: "AI krijon kuize dhe pyetje që testojnë kuptimin real të materialit." },
  { icon: Headphones, title: "Lexim me zë", desc: "Çdo material mund të dëgjohet me zë të gjeneruar nga AI." },
  { icon: Users, title: "Profil individual", desc: "Çdo nxënës ka preferencat e tij: font, madhësi, gjuhë, nivel." },
  { icon: Shield, title: "Kontroll i mësueses", desc: "Çdo material shikohet dhe aprovohet nga mësuesi para publikimit." },
  { icon: Zap, title: "Analitikë e detajuar", desc: "Gjurmo progresin e çdo nxënësi dhe identifiko nevojat për mbështetje." },
];

const stepMeta = [
  { n: "01", icon: Upload, titleKey: "landing.step1", desc: "Shto tekst ose PDF të materialit mësimor." },
  { n: "02", icon: Wand2, titleKey: "landing.step2", desc: "AI thjeshtëson, përmbledh, krijon fjalor dhe pyetje." },
  { n: "03", icon: Eye, titleKey: "landing.step3", desc: "Mësuesi kontrollon dhe aprovat materialin e adaptuar." },
  { n: "04", icon: Share2, titleKey: "landing.step4", desc: "Nxënësi merr materialin të personalizuar për të." },
];

export default function Landing() {
  const { t } = useT();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <AppLogo size={32} className="rounded-xl" />
            <span className="font-bold text-foreground">{APP_NAME}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/login" className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
              {t("landing.signIn")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-20 px-5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/5 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Sparkles size={14} /> {t("landing.poweredBy")}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            {t("landing.hero")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            MësoLehtë AI ndihmon mësuesit të thjeshtësojnë, përmbledhin dhe adaptojnë materialet mësimore për nxënësit që kanë vështirësi me leximin dhe kuptimin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="ui-btn-primary px-7 py-3.5 text-base">
              {t("landing.startNow")} <ArrowRight size={18} />
            </Link>
            <Link to="/demo" className="ui-btn-secondary px-7 py-3.5 text-base">
              {t("landing.watchDemo")}
            </Link>
          </div>
        </div>

        {/* App mockup */}
        <div className="max-w-4xl mx-auto mt-14 relative">
          <div className="rounded-2xl border border-border shadow-2xl bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-2.5 flex items-center gap-2 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
              </div>
              <div className="flex-1 mx-3 bg-background rounded-md px-3 py-1 text-xs text-muted-foreground">mesolehte.ai/teacher/dashboard</div>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Nxënës", value: "24", color: "bg-primary/10 text-primary" },
                { label: "Materiale aktive", value: "8", color: "bg-success-muted text-success-muted-foreground" },
                { label: "Detyra", value: "16", color: "bg-secondary text-secondary-foreground" },
                { label: "Mesatare", value: "74%", color: "bg-warning-muted text-warning-muted-foreground" },
              ].map(card => (
                <div key={card.label} className={`${card.color} rounded-xl p-3`}>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs font-medium mt-0.5 opacity-80">{card.label}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-sm font-semibold mb-3">Aktiviteti i fundit</p>
                {["Ardi përfundoi kuizin 'Fotosinteza'", "Sara kërkoi shpjegime për 4 fjalë"].map(activity => (
                  <div key={activity} className="flex items-center gap-2 text-xs text-muted-foreground py-1.5 border-b border-border last:border-0">
                    <Check size={12} className="text-success shrink-0" /> {activity}
                  </div>
                ))}
              </div>
              <div className="bg-primary/5 rounded-xl p-4">
                <p className="text-sm font-semibold mb-2">Materiali i fundit</p>
                <p className="text-base font-bold text-primary">Fotosinteza</p>
                <p className="text-xs text-muted-foreground mb-3">Biologji · Klasa VI · Publikuar</p>
                <div className="bg-background rounded-lg h-1.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: "78%" }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">78% e nxënësve e përfunduan</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section className="py-20 px-5 bg-card">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t("landing.problem")}</h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            1 nga 5 nxënës has vështirësi me leximin. Materialet standarde shpesh janë tepër komplekse. Mësuesit nuk kanë kohë të krijojnë versione individuale për çdo nxënës.
          </p>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              { pct: "20%", label: "e nxënësve kanë vështirësi leximi" },
              { pct: "3x", label: "më gjatë për të kuptuar tekstet komplekse" },
              { pct: "68%", label: "e mësuesve nuk kanë kohë të adaptojnë materiale" },
            ].map(s => (
              <div key={s.pct} className="bg-background rounded-2xl p-5 border border-border">
                <p className="text-4xl font-bold text-primary mb-2">{s.pct}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">{t("landing.how")}</h2>
            <p className="text-muted-foreground">{t("landing.howSub")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {stepMeta.map((step, i) => (
              <div key={step.n} className="relative">
                {i < stepMeta.length - 1 && <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border z-0" />}
                <div className="bg-card border border-border rounded-2xl p-5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <step.icon size={20} className="text-primary" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{step.n}</span>
                  <h3 className="font-semibold mt-1 mb-2">{t(step.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-5 bg-card">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">{t("landing.features")}</h2>
            <p className="text-muted-foreground">Gjithçka për të mbështetur nxënës dhe mësues.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div key={f.title} className="bg-background rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <f.icon size={18} className="text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-primary rounded-3xl p-10 text-primary-foreground">
            <BookOpen size={36} className="mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl font-bold mb-3">{t("landing.cta")}</h2>
            <p className="text-primary-foreground/80 mb-6">Shikoni demonstrimin publik pa krijuar llogari.</p>
            <Link to="/demo" className="bg-white text-primary font-semibold px-8 py-3.5 rounded-2xl hover:bg-primary-foreground/90 transition-colors inline-flex items-center gap-2">
              {t("landing.watchDemo")} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-5 text-center text-sm text-muted-foreground">
        <p>© 2026 {APP_NAME} — Çdo tekst, në nivelin e duhur për çdo nxënës.</p>
      </footer>
    </div>
  );
}
