import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router";
import { LayoutDashboard, Trophy, Settings, LogOut, Menu, X } from "lucide-react";
import { useApp } from "./store";
import AccessibilityPanel from "./AccessibilityPanel";
import { AccessibilityIcon } from "./AccessibilityIcon";
import { AppLogo } from "./AppLogo";
import { APP_NAME } from "./brand";
import { useT } from "./useT";
import { Toaster } from "sonner";
import NotificationsDropdown from "./NotificationsDropdown";

export default function StudentLayout() {
  const { user, logout, setAccessibilityOpen } = useApp();
  const { t, lang } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  const navItems = [
    { to: "/student/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
    { to: "/student/rewards", icon: Trophy, labelKey: "nav.rewards" },
    { to: "/student/settings", icon: Settings, labelKey: "nav.settings" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  useEffect(() => {
    setHeaderHidden(false);
    lastScrollY.current = 0;
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onScroll = () => {
      const y = el.scrollTop;
      const delta = y - lastScrollY.current;
      if (y < 24) {
        setHeaderHidden(false);
      } else if (delta > 6) {
        setHeaderHidden(true);
      } else if (delta < -6) {
        setHeaderHidden(false);
      }
      lastScrollY.current = y;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 px-3 space-y-1">
      {navItems.map(item => {
        const active = location.pathname.startsWith(item.to);
        return (
          <Link key={item.to} to={item.to} onClick={onNavigate}
            className={`flex items-center gap-3 px-3.5 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 min-h-12 ${
              active
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}>
            <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className="hidden lg:flex flex-col w-60 bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-4 py-5">
          <AppLogo size={40} />
          <div>
            <p className="font-extrabold text-sm text-foreground leading-tight">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground font-medium">{t("nav.studentSpace")}</p>
          </div>
        </div>

        <NavLinks />

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-2xl bg-muted/60">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{lang === "en" ? "Student" : "Nxënës"}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors min-h-11">
            <LogOut size={18} /> {t("nav.logout")}
          </button>
        </div>
      </aside>

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col lg:hidden transition-transform duration-300 shadow-lg ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <AppLogo size={36} />
            <span className="font-extrabold text-sm">{APP_NAME}</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-2.5 hover:bg-muted rounded-2xl min-h-11 min-w-11 flex items-center justify-center" aria-label={t("a11y.close")}>
            <X size={18} />
          </button>
        </div>
        <NavLinks onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className={`h-16 bg-card/90 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 sm:px-6 shrink-0 z-20 transition-transform duration-300 ease-out ${
            headerHidden ? "-translate-y-full -mb-16" : "translate-y-0"
          }`}
        >
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2.5 rounded-2xl hover:bg-muted min-h-11 min-w-11 flex items-center justify-center" aria-label="Menu">
            <Menu size={22} />
          </button>
          <p className="lg:hidden font-bold text-sm text-foreground truncate">
            {lang === "en" ? "Hi" : "Përshëndetje"}, {user?.name?.split(" ")[0]}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsDropdown role="student" userId={user?.id} />
            <button onClick={() => setAccessibilityOpen(true)} className="p-2.5 rounded-2xl hover:bg-muted min-h-11 min-w-11 flex items-center justify-center" aria-label={t("a11y.open")}>
              <AccessibilityIcon size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm ml-1 shadow-sm shadow-primary/30">
              {user?.name?.[0]}
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-border bg-card/95 backdrop-blur-md safe-area-pb px-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-bold transition-colors min-h-14 ${active ? "text-primary" : "text-muted-foreground"}`}>
                <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>

      <AccessibilityPanel />
      <Toaster richColors position="top-right" />
    </div>
  );
}
