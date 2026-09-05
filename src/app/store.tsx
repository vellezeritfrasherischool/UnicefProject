import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User, AccessibilitySettings } from "./types";
import { authService } from "./services";
import { getSupabase, isSupabaseEnabled } from "./supabase";
import { enrichUserFromRoster, sbGetProfile } from "./supabaseDb";

interface AppState {
  user: User | null;
  authReady: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  accessibility: AccessibilitySettings;
  setAccessibility: (s: Partial<AccessibilitySettings>) => void;
  accessibilityOpen: boolean;
  setAccessibilityOpen: (v: boolean) => void;
}

const defaults: AccessibilitySettings = {
  fontSize: 16,
  lineSpacing: 1.6,
  letterSpacing: 0,
  highContrast: false,
  darkMode: false,
  readingFont: "inter",
  reducedMotion: false,
  appLanguage: "sq",
};

const AppContext = createContext<AppState>({
  user: null,
  authReady: true,
  login: () => {},
  logout: async () => {},
  accessibility: defaults,
  setAccessibility: () => {},
  accessibilityOpen: false,
  setAccessibilityOpen: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Supabase Auth is the only identity source in cloud mode. Never render a
    // cached demo/local user while the real session is being restored.
    if (isSupabaseEnabled()) return null;
    try { return JSON.parse(localStorage.getItem("mesolehte_user") ?? "null"); } catch { return null; }
  });
  const [authReady, setAuthReady] = useState(!isSupabaseEnabled());
  /** Bumped on login so a late signOut cannot wipe a fresh session in the UI. */
  const authEpoch = useRef(0);

  const [accessibility, setAccessibilityState] = useState<AccessibilitySettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mesolehte_a11y") ?? "{}") as Partial<AccessibilitySettings>;
      return {
        ...defaults,
        ...saved,
        appLanguage: saved.appLanguage === "en" ? "en" : "sq",
      };
    } catch {
      return defaults;
    }
  });

  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  const applyUser = useCallback((u: User | null) => {
    setUser(u);
    if (isSupabaseEnabled()) {
      localStorage.removeItem("mesolehte_user");
    } else if (u) {
      localStorage.setItem("mesolehte_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("mesolehte_user");
    }
  }, []);

  const login = useCallback((u: User) => {
    authEpoch.current += 1;
    applyUser(u);
  }, [applyUser]);

  const logout = useCallback(async () => {
    const epoch = ++authEpoch.current;
    applyUser(null);
    if (!isSupabaseEnabled()) return;
    try {
      await authService.logout();
    } catch {
      /* ignore */
    }
    // A login that started after this logout began owns the epoch now
    if (epoch !== authEpoch.current) return;
  }, [applyUser]);

  useEffect(() => {
    if (!isSupabaseEnabled()) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    const sb = getSupabase();

    (async () => {
      try {
        const sessionUser = await authService.getSessionUser();
        if (cancelled) return;
        if (sessionUser) applyUser(sessionUser);
        else applyUser(null);
      } catch {
        if (!cancelled) applyUser(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === "SIGNED_OUT") {
        const { data } = await sb.auth.getSession();
        if (cancelled) return;
        // Only clear UI if there is truly no session (avoids stale late signOut after re-login)
        if (!data.session) applyUser(null);
        setAuthReady(true);
        return;
      }

      if (!session?.user) return;
      try {
        let profile = await sbGetProfile(session.user.id);
        if (!profile || cancelled) return;
        profile = await enrichUserFromRoster(profile);
        if (cancelled) return;
        applyUser(profile);
      } catch {
        /* keep current */
      }
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [applyUser]);

  const setAccessibility = useCallback((s: Partial<AccessibilitySettings>) => {
    setAccessibilityState(prev => {
      const next = { ...prev, ...s };
      localStorage.setItem("mesolehte_a11y", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${accessibility.fontSize}px`;
    root.lang = accessibility.appLanguage === "en" ? "en" : "sq";
    if (accessibility.darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    if (accessibility.highContrast) root.setAttribute("data-high-contrast", "true");
    else root.removeAttribute("data-high-contrast");
  }, [accessibility]);

  return (
    <AppContext.Provider value={{ user, authReady, login, logout, accessibility, setAccessibility, accessibilityOpen, setAccessibilityOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
