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

function readStoredMode(): ThemeMode {
  try {
    const t = localStorage.getItem("tia-theme");
    if (t === "dark" || t === "light") return t;
  } catch {
    /* ignore */
  }
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Single source of truth for light/dark: lazy init from storage (no
  // mount-time overwrite races with pages that apply their saved theme).
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? "system" : readStoredMode()
  );
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const m = readStoredMode();
    return m === "dark" || (m === "system" && systemDark());
  });
  const [mounted, setMounted] = useState(false);

  // Paint the class whenever the resolved value changes.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    try {
      const a = localStorage.getItem("tia-accent");
      if (a) applyAccent(a);
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  // Follow the OS live, but only while the user chose "system".
  useEffect(() => {
    if (mode !== "system") return;
    let mq: MediaQueryList | null = null;
    const onChange = () => setDark(systemDark());
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        mq?.removeEventListener("change", onChange);
      } catch {
        /* ignore */
      }
    };
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setDark(m === "dark" || (m === "system" && systemDark()));
    try {
      if (m === "system") localStorage.removeItem("tia-theme");
      else localStorage.setItem("tia-theme", m);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(dark ? "light" : "dark");
  }, [dark, setMode]);

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

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Light → Dark: circle expands from upper-right
    // Dark → Light: circle expands from upper-left
    const goingDark = !dark;
    const originX = goingDark ? window.innerWidth : 0;
    const originY = 0;
    const maxDim = Math.hypot(window.innerWidth, window.innerHeight) * 1.5;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1; pointer-events: none;
      background: ${goingDark ? "#1c1917" : "#fafaf9"};
      clip-path: circle(0% at ${originX}px ${originY}px);
      transition: clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(overlay);

    // Force reflow then animate
    overlay.getBoundingClientRect();
    requestAnimationFrame(() => {
      overlay.style.clipPath = `circle(${maxDim}px at ${originX}px ${originY}px)`;
    });

    // Flip theme mid-animation
    setTimeout(() => toggle(), 250);

    // Clean up after animation
    setTimeout(() => {
      overlay.style.transition = "opacity 0.2s";
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 250);
    }, 600);
  };

  return (
    <button
      onClick={handleToggle}
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
