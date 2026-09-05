import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Settings,
  ChevronLeft, ChevronRight, LogOut,
  Award, Menu, ShieldCheck,
} from "lucide-react";
import { useApp } from "./store";
import AccessibilityPanel from "./AccessibilityPanel";
import { AccessibilityIcon } from "./AccessibilityIcon";
import { AppLogo } from "./AppLogo";
import { APP_NAME } from "./brand";
import { useT } from "./useT";
import { Toaster } from "sonner";
import { getSupabase, isSupabaseEnabled } from "./supabase";
import NotificationsDropdown from "./NotificationsDropdown";

export default function TeacherLayout() {
  const { user, logout, setAccessibilityOpen } = useApp();
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  const navItems = [
    { to: "/teacher/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
    { to: "/teacher/classes", icon: Users, labelKey: "nav.classes" },
    { to: "/teacher/materials", icon: BookOpen, labelKey: "nav.materials" },
    { to: "/teacher/analytics", icon: BarChart3, labelKey: "nav.analytics" },
    { to: "/teacher/rewards", icon: Award, labelKey: "nav.rewardsTeacher" },
    { to: "/teacher/settings", icon: Settings, labelKey: "nav.settings" },
    ...(isSchoolAdmin ? [{ to: "/teacher/admin", icon: ShieldCheck, labelKey: "Administrimi" }] : []),
  ];

  useEffect(() => {
    if (!user || !isSupabaseEnabled()) return;
    getSupabase().from("school_members").select("role,active").eq("user_id", user.id).eq("active", true).maybeSingle()
      .then(({ data }) => setIsSchoolAdmin(data?.role === "school_admin"));
  }, [user?.id]);

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
        <AppLogo size={40} className="shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-extrabold text-sm text-foreground leading-tight truncate">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground font-medium">{t("nav.teacherSpace")}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 min-h-11 ${
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}>
              <item.icon size={20} className="shrink-0" strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span>{item.labelKey.includes(".") ? t(item.labelKey) : item.labelKey}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`p-3 border-t border-sidebar-border ${collapsed ? "flex justify-center" : ""}`}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-2xl bg-muted/60">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors min-h-11 ${collapsed ? "justify-center" : ""}`}>
          <LogOut size={18} />
          {!collapsed && t("nav.logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`hidden lg:flex relative flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0 ${collapsed ? "w-[4.5rem]" : "w-64"}`}>
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-7 z-10 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-muted transition-colors"
          aria-label={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <SidebarContent />
      </aside>

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col lg:hidden transition-transform duration-300 shadow-lg ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent />
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
          <div className="ml-auto flex items-center gap-1">
            <NotificationsDropdown role="teacher" userId={user?.id} />
            <button onClick={() => setAccessibilityOpen(true)} className="p-2.5 rounded-2xl hover:bg-muted transition-colors min-h-11 min-w-11 flex items-center justify-center" aria-label={t("a11y.open")}>
              <AccessibilityIcon size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm ml-1 shadow-sm shadow-primary/30">
              {user?.name?.[0]}
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <AccessibilityPanel />
      <Toaster richColors position="top-right" />
    </div>
  );
}
