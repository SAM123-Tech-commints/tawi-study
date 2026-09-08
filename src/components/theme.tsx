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

const ThemeCtx = createContext<{ dark: boolean; toggle: () => void }>({
  dark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    try {
      const a = localStorage.getItem("tia-accent");
      if (a) applyAccent(a);
    } catch {
      /* ignore */
    }
    setMounted(true);
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
      return next;
    });
  }, []);

  if (!mounted) {
    return <ThemeCtx.Provider value={{ dark, toggle }}>{children}</ThemeCtx.Provider>;
  }
  return <ThemeCtx.Provider value={{ dark, toggle }}>{children}</ThemeCtx.Provider>;
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
      __html: `try{if(localStorage.getItem('tia-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}try{var a=localStorage.getItem('tia-accent');if(a&&a!=='lime'){document.documentElement.setAttribute('data-accent',a)}}catch(e){}`,
    }}
  />
);
