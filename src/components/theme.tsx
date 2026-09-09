"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const ACCENTS = [
  { id: "lime", label: "Lime", swatch: "#B7E938" },
  { id: "violet", label: "Violet", swatch: "#9D6BFF" },
  { id: "sky", label: "Sky", swatch: "#22B8F5" },
  { id: "amber", label: "Amber", swatch: "#F5A31B" },
  { id: "rose", label: "Rose", swatch: "#F9627D" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";

/** Paint the whole UI in an accent color instantly + remember it. */
export function applyAccent(accent: string) {
  try {
    const id = ACCENTS.some((a) => a.id === accent) ? accent : "lime";
    if (id === "lime") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", id);
    localStorage.setItem("tia-accent", id);
  } catch {
    /* ignore */
  }
}

function systemDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Apply a theme mode RIGHT NOW: light, dark, or follow the OS (system). */
export function applyTheme(mode: string) {
  const m: ThemeMode = mode === "dark" ? "dark" : mode === "light" ? "light" : "system";
  const dark = m === "dark" || (m === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (m === "system") localStorage.removeItem("tia-theme");
    else localStorage.setItem("tia-theme", m);
  } catch {
    /* ignore */
  }
  return { mode: m, dark };
}

const ThemeCtx = createContext<{ dark: boolean; mode: ThemeMode; toggle: () => void; setMode: (m: ThemeMode) => void }>({
  dark: false,
  mode: "system",
  toggle: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("tia-theme");
    } catch {
      /* ignore */
    }
    const applied = applyTheme(stored ?? "system");
    setModeState(applied.mode);
    setDark(applied.dark);
    try {
      const a = localStorage.getItem("tia-accent");
      if (a) applyAccent(a);
    } catch {
      /* ignore */
    }
    // Follow the OS live while in system mode.
    let mq: MediaQueryList | null = null;
    const onChange = () => {
      try {
        if (!localStorage.getItem("tia-theme")) {
          const d = systemDark();
          document.documentElement.classList.toggle("dark", d);
          setDark(d);
        }
      } catch {
        /* ignore */
      }
    };
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
    } catch {
      /* ignore */
    }
    setMounted(true);
    return () => {
      try {
        mq?.removeEventListener("change", onChange);
      } catch {
        /* ignore */
      }
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    const applied = applyTheme(m);
    setModeState(applied.mode);
    setDark(applied.dark);
  }, []);

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("tia-theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      setModeState(next ? "dark" : "light");
      return next;
    });
  }, []);

  if (!mounted) {
    return <ThemeCtx.Provider value={{ dark, mode, toggle, setMode }}>{children}</ThemeCtx.Provider>;
  }
  return <ThemeCtx.Provider value={{ dark, mode, toggle, setMode }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/60 transition-all duration-300 hover:bg-ink/5 hover:rotate-12 active:scale-90 active:-rotate-12 dark:text-cream/70 dark:hover:bg-cream/10 ${className ?? ""}`}
      aria-label="Toggle dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span key={dark ? "sun" : "moon"} className="animate-in-scale inline-flex">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}

export const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `try{var t=localStorage.getItem('tia-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}}catch(e){}try{var a=localStorage.getItem('tia-accent');if(a&&a!=='lime'){document.documentElement.setAttribute('data-accent',a)}}catch(e){}`,
    }}
  />
);
