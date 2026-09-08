"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const ThemeCtx = createContext<{ dark: boolean; toggle: () => void }>({
  dark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
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
      __html: `try{if(localStorage.getItem('tia-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
    }}
  />
);
