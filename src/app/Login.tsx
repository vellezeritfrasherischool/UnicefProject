import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, BookOpen, Sparkles, GraduationCap, User } from "lucide-react";
import { useApp } from "./store";
import { authService } from "./services";
import { isSupabaseEnabled } from "./supabase";
import { toast } from "sonner";
import { useT } from "./useT";
import { AppLogo } from "./AppLogo";
import { APP_NAME } from "./brand";

type Mode = "login" | "register-teacher" | "register-student";

export default function Login() {
  const { login } = useApp();
  const { t } = useT();
  const navigate = useNavigate();
  const cloud = isSupabaseEnabled();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [invitation, setInvitation] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finish = (user: { name: string; role: string }) => {
    toast.success(t("login.welcome", { name: user.name }));
    navigate(user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
  };

  const doLogin = async (e?: string, p?: string) => {
    setLoading(true);
    setError("");
    try {
      const user = await authService.login(e ?? email, p ?? password);
      login(user);
      finish(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  const doRegisterTeacher = async () => {
    setLoading(true);
    setError("");
    try {
      const user = await authService.registerTeacher(name, email, password, invitation);
      login(user);
      finish(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const doRegisterStudent = async () => {
    setLoading(true);
    setError("");
    try {
      const user = await authService.registerStudent({
        name,
        email,
        password,
        joinCode: joinCode.trim() || undefined,
      });
      login(user);
      finish(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (mode === "login") void doLogin();
    else if (mode === "register-teacher") void doRegisterTeacher();
    else void doRegisterStudent();
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col bg-primary p-10 xl:p-14 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#5B4FE8] to-[#4338CA] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full">
          <Link to="/" className="flex items-center gap-3 mb-14">
            <AppLogo size={44} />
            <span className="font-extrabold text-xl tracking-tight">{APP_NAME}</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
              <Sparkles size={24} />
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight mb-4 tracking-tight">
              {t("login.tagline")}
            </h1>
            <p className="text-primary-foreground/85 text-base xl:text-lg leading-relaxed max-w-md">
              {t("login.desc")}
            </p>

            <div className="mt-10 space-y-3">
              {[
                { icon: BookOpen, text: t("login.feat1") },
                { icon: GraduationCap, text: t("login.feat2") },
                { icon: Sparkles, text: t("login.feat3") },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <item.icon size={16} />
                  </div>
                  <span className="text-sm font-medium text-primary-foreground/90">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <AppLogo size={36} />
            <span className="font-extrabold">{APP_NAME}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
            {mode === "login" ? t("login.title") : t("login.registerTitle")}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "login"
              ? (cloud ? t("login.subtitleCloud") : t("login.subtitle"))
              : mode === "register-teacher"
                ? t("login.registerTeacherHint")
                : t("login.registerStudentHint")}
          </p>

          {cloud && (
            <div className="flex gap-1 p-1 mb-6 rounded-2xl bg-muted">
              {(
                [
                  ["login", t("login.signIn")],
                  ["register-teacher", t("login.tabTeacher")],
                  ["register-student", t("login.tabStudent")],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors min-h-10 ${
                    mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {!cloud && mode === "login" && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={() => doLogin("mesuesi@mesolehte.com", "demo123")} disabled={loading}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all text-sm font-bold text-primary min-h-[5.5rem]">
                  <GraduationCap size={22} />
                  {t("login.asTeacher")}
                </button>
                <button onClick={() => doLogin("nxenesi@mesolehte.com", "demo123")} disabled={loading}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-success/25 bg-success-muted hover:border-success/40 transition-all text-sm font-bold text-success-muted-foreground min-h-[5.5rem]">
                  <User size={22} />
                  {t("login.asStudent")}
                </button>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("login.or")}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {mode !== "login" && (
              <div>
                <label htmlFor="name" className="block mb-2">{t("login.name")}</label>
                <input id="name" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Emri juaj" required className="ui-input" />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block mb-2">{t("login.email")}</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="emri@shembull.com" required autoComplete="email"
                className="ui-input" />
            </div>

            <div>
              <label htmlFor="password" className="block mb-2">{t("login.password")}</label>
              <div className="relative">
                <input id="password" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="ui-input pr-12" minLength={6} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg" aria-label={showPw ? t("login.hidePw") : t("login.showPw")}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === "register-student" && (
              <div>
                <label htmlFor="join" className="block mb-2">{t("login.joinCodeOptional")}</label>
                <input id="join" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123" className="ui-input tracking-widest font-bold uppercase" maxLength={8} />
                <p className="text-xs text-muted-foreground mt-1.5">{t("login.joinCodeOptionalHint")}</p>
              </div>
            )}

            {mode === "register-teacher" && (
              <div>
                <label htmlFor="invitation" className="block mb-2">Kodi i ftesës</label>
                <input id="invitation" value={invitation} onChange={e => setInvitation(e.target.value.trim())}
                  placeholder="Kodi i dhënë nga administratori" required className="ui-input" autoComplete="off" />
                <p className="text-xs text-muted-foreground mt-1.5">Regjistrimi i mësuesve lejohet vetëm me ftesë nga shkolla.</p>
              </div>
            )}

            {error && (
              <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl p-3.5 font-medium">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="ui-btn-primary w-full mt-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> {t("login.signingIn")}</>
              ) : mode === "login" ? t("login.signIn") : t("login.registerBtn")}
            </button>
          </form>

          {!cloud && (
            <div className="mt-6 p-4 bg-muted/80 rounded-2xl text-xs text-muted-foreground space-y-1 border border-border">
              <p><span className="font-bold text-foreground">{t("login.demoTeacher")}</span> mesuesi@mesolehte.com · demo123</p>
              <p><span className="font-bold text-foreground">{t("login.demoStudent")}</span> nxenesi@mesolehte.com · demo123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
