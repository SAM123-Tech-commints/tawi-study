"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Minimize2, Pause, Play, Repeat, RotateCcw, Settings, Square, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui";

type TimerMode = "work" | "break" | "longBreak";

interface TimerSettings {
  work: number;
  break: number;
  longBreak: number;
  rounds: number;
}

const TIMER_KEY = "tia-timer";

type SavedTimer = {
  mode: TimerMode;
  secondsLeft: number;
  round: number;
  running: boolean;
  savedAt: number;
};

function loadSavedTimer(): SavedTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SavedTimer>;
    if (!["work", "break", "longBreak"].includes(String(s.mode))) return null;
    if (typeof s.secondsLeft !== "number" || typeof s.round !== "number" || typeof s.savedAt !== "number") return null;
    return {
      mode: s.mode as TimerMode,
      secondsLeft: Math.max(0, Math.min(7200, Math.floor(s.secondsLeft))),
      round: Math.max(1, Math.min(20, Math.floor(s.round))),
      running: s.running === true,
      savedAt: s.savedAt,
    };
  } catch {
    return null;
  }
}

export function PomodoroTimer({
  settings,
  onSettingsClick,
}: {
  settings: TimerSettings;
  onSettingsClick?: () => void;
}) {
  const [saved] = useState<SavedTimer | null>(() =>
    typeof window === "undefined" ? null : loadSavedTimer()
  );
  const [mode, setMode] = useState<TimerMode>(saved?.mode ?? "work");
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!saved) return settings.work * 60;
    if (saved.running) {
      // The timer kept conceptually running while the page was closed.
      const elapsed = Math.floor((Date.now() - saved.savedAt) / 1000);
      const left = saved.secondsLeft - elapsed;
      if (left > 0) return left;
    }
    return saved.secondsLeft;
  });
  const [running, setRunning] = useState(() => {
    if (!saved?.running) return false;
    return saved.secondsLeft - Math.floor((Date.now() - saved.savedAt) / 1000) > 0;
  });
  const [round, setRound] = useState(saved?.round ?? 1);
  const [muted, setMuted] = useState(false);
  // Auto-continue is what makes it a real Pomodoro: focus → break → focus …
  // rolls on its own. A toggle lets someone pause the auto-flow if they want to
  // start each phase by hand.
  const [autoContinue, setAutoContinue] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Persist every tick/change so a reload or navigation never loses the session.
  useEffect(() => {
    try {
      localStorage.setItem(
        TIMER_KEY,
        JSON.stringify({ mode, secondsLeft, round, running, savedAt: Date.now() })
      );
    } catch {
      /* ignore */
    }
  }, [mode, secondsLeft, round, running]);

  // Refit the current phase ONLY when the durations actually change while idle.
  // (The old version keyed on `running`, so hitting Pause refilled the clock to
  // full and a restored mid-session was wiped on mount — both fixed here.)
  const settingsRef = useRef(settings);
  useEffect(() => {
    const prev = settingsRef.current;
    settingsRef.current = settings;
    const changed =
      prev.work !== settings.work ||
      prev.break !== settings.break ||
      prev.longBreak !== settings.longBreak;
    if (changed && !running) {
      setSecondsLeft(
        mode === "work"
          ? settings.work * 60
          : mode === "break"
          ? settings.break * 60
          : settings.longBreak * 60
      );
    }
  }, [settings, mode, running]);

  const totalSeconds = mode === "work" ? settings.work * 60 : mode === "break" ? settings.break * 60 : settings.longBreak * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const playSound = useCallback(() => {
    if (muted) return;
    try {
      const audio = audioRef.current ?? new Audio();
      audio.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPnuqy8+udWVRR3WnxsqldGpYV3OjwL6kfHdeW22ewLqig3xiXWmUvbWkh4BnYmGLubCiiYRqZmCDt6yliIdsaGOEsqlnkoZva2aBrqVpmYx2cWlne5+Wm5aEe3VwdH+QkoyLh4WDeHd2fYaMkYyJhoF9e3t+g4qRkY2JhYF9e3t+g4qRkY6JhYF9e3t+g4qRkY6JhYJ+e3t+g4qRkY6JhYJ+e3x/g4qRkY6JhYJ+e3x/g4qRkY6JhYN/e3x/g4qRkY6JhYN/e31/g4qRkY6JhYN/e31/g4qRkY6JhYR/e31/g4qRkY6JhYR/e35/hIqRkY6JhYR/e35/hIqRkY6JhYV/e35/hIqRkY6JhYV/fH+AhIqRkY6JhYV/fH+AhIqRkY6JhYV/fH+AhIqRkY6JhYV/fH+AhIqRkY6JhYV/fH+AhA==";
      audioRef.current = audio;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }, [muted]);

  // Tick once a second. The interval only cares whether we're running, so it is
  // NOT torn down and rebuilt on every mode/round change (that was what made the
  // old timer stutter). It just counts the current phase down to zero.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // When the current phase reaches zero, chime and roll into the next one.
  // Because `running` stays true, the next phase starts on its own — a real
  // Pomodoro cycle (focus → break → focus → … → long break → focus).
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    playSound();
    const next = () => {
      if (mode === "work") {
        if (round >= settings.rounds) {
          setMode("longBreak");
          setSecondsLeft(settings.longBreak * 60);
          setRound(1);
        } else {
          setMode("break");
          setSecondsLeft(settings.break * 60);
        }
      } else if (mode === "longBreak") {
        setMode("work");
        setSecondsLeft(settings.work * 60);
        setRound(1);
      } else {
        // A finished break advances the round counter and returns to focus.
        setMode("work");
        setSecondsLeft(settings.work * 60);
        setRound((r) => r + 1);
      }
    };
    next();
    // If the user turned off auto-flow, land on the next phase but wait for a tap.
    if (!autoContinue) setRunning(false);
  }, [secondsLeft, running, mode, round, settings, autoContinue, playSound]);

  const reset = () => {
    setRunning(false);
    setMode("work");
    setSecondsLeft(settings.work * 60);
    setRound(1);
  };

  const stop = () => {
    // Stop = pause + refill the current session (mode and round are kept).
    setRunning(false);
    setSecondsLeft(totalSeconds);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const modeLabel = mode === "work" ? "Focus" : mode === "break" ? "Break" : "Long Break";
  // All timer colors ride the UI accent (Profile → Accent color): ring,
  // label and buttons recolor with the theme in both modes.
  const modeColor = "text-brand-700 dark:text-brand-300";
  const ringColor = mode === "work" ? "stroke-brand-500" : mode === "break" ? "stroke-brand-300" : "stroke-brand-700";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Mode selector */}
      <div className="flex gap-1 rounded-full bg-ink/5 p-1 dark:bg-cream/5">
        {(["work", "break", "longBreak"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              if (!running) {
                setMode(m);
                setSecondsLeft(m === "work" ? settings.work * 60 : m === "break" ? settings.break * 60 : settings.longBreak * 60);
              }
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              mode === m
                ? "bg-surface text-ink shadow-sm dark:bg-cream/15 dark:text-cream"
                : "text-ink/45 hover:text-ink dark:text-cream/45 dark:hover:text-cream"
            }`}
          >
            {m === "work" ? "Focus" : m === "break" ? "Break" : "Long"}
          </button>
        ))}
      </div>

      {/* Timer ring */}
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="6" className="text-ink/8 dark:text-cream/10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={ringColor}
            strokeDasharray={339.292}
            strokeDashoffset={339.292 * (1 - progress / 100)}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`text-4xl font-bold tabular-nums text-ink dark:text-cream`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
          <p className={`text-xs font-bold ${modeColor}`}>{modeLabel}</p>
        </div>
      </div>

      {/* Controls — big unmissable start/pause + explicit stop */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="rounded-full"
          title="Reset everything"
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={stop}
          className="rounded-full"
          title="Stop (pause + refill this session)"
        >
          <Square size={15} fill="currentColor" />
        </Button>
        <Button
          onClick={() => setRunning(!running)}
          className="h-14 min-w-14 rounded-full px-5"
          size="lg"
          title={running ? "Pause" : "Start"}
        >
          {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
          <span className="text-sm font-extrabold">{running ? "Pause" : "Start"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMuted(!muted)}
          className="rounded-full"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
        {onSettingsClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            className="rounded-full"
            title="Timer settings"
          >
            <Settings size={16} />
          </Button>
        )}
      </div>

      {/* Round indicator + auto-continue toggle */}
      <div className="flex items-center gap-2 text-[12px] font-medium text-ink/45 dark:text-cream/45">
        <span>
          Round {round} / {settings.rounds}
        </span>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={() => setAutoContinue((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${
            autoContinue
              ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
              : "text-ink/40 hover:text-ink dark:text-cream/40 dark:hover:text-cream"
          }`}
          title={
            autoContinue
              ? "Auto-continue is ON — phases roll automatically like a real Pomodoro"
              : "Auto-continue is OFF — the next phase waits for you to tap Start"
          }
        >
          <Repeat size={11} /> Auto {autoContinue ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------- Floating popup ------------------------- */
/* Draggable by its header, minimizable to a pill, closable. The dashboard
 * re-opens it through its own "Focus timer" pill. */

/** Minimized live clock: mirrors the running timer from storage every second. */
function MiniClock() {
  const [label, setLabel] = useState("--:--");
  const [live, setLive] = useState(false);
  useEffect(() => {
    const tick = () => {
      try {
        const s = JSON.parse(localStorage.getItem(TIMER_KEY) ?? "null") as SavedTimer | null;
        if (!s) {
          setLabel("--:--");
          setLive(false);
          return;
        }
        let left = s.secondsLeft;
        if (s.running) left = Math.max(0, s.secondsLeft - Math.floor((Date.now() - s.savedAt) / 1000));
        setLabel(`${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`);
        setLive(s.running && left > 0);
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="flex items-center gap-2 text-sm font-extrabold tabular-nums text-ink dark:text-cream" title="Focus timer">
      <span className={`h-2.5 w-2.5 rounded-full ${live ? "animate-pulse bg-brand-500" : "bg-ink/20 dark:bg-cream/25"}`} />
      {label}
    </span>
  );
}

export function TimerPopup({
  settings,
  onSettingsClick,
  onClose,
}: {
  settings: TimerSettings;
  onSettingsClick?: () => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const p = JSON.parse(localStorage.getItem("tia-timer-ui") ?? "{}")?.pos;
      if (p && typeof p.x === "number" && typeof p.y === "number") return p;
    } catch {
      /* ignore */
    }
    return null;
  });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("tia-timer-ui", JSON.stringify({ min, pos }));
    } catch {
      /* ignore */
    }
  }, [min, pos]);

  const [dragging, setDragging] = useState(false);

  // Keep the popup fully on-screen given its real measured size.
  const clampPos = (x: number, y: number, w = 300, h = 140) => ({
    x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
    y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
  });

  // If the viewport shrinks (rotate / resize), pull a free-floating popup back
  // into view so it can never get stranded off an edge.
  useEffect(() => {
    if (!pos) return;
    const onResize = () =>
      setPos((p) =>
        p
          ? {
              x: Math.max(8, Math.min(window.innerWidth - 308, p.x)),
              y: Math.max(8, Math.min(window.innerHeight - 148, p.y)),
            }
          : p
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  // Rock-solid drag: we capture the pointer on the grab handle, so every move
  // event is delivered to that element even when the cursor races outside the
  // popup or off the window entirely. 1:1 tracking on mouse, touch and pen.
  const beginDrag = (e: React.PointerEvent) => {
    // Never start a drag from a button — let buttons click.
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const host = el.closest("[data-timer-popup]") as HTMLElement | null;
    const r = host?.getBoundingClientRect();
    const w = r?.width ?? 300;
    const h = r?.height ?? 140;
    // Anchor to where the popup actually is (docked corner or free position).
    const baseX = pos?.x ?? r?.left ?? window.innerWidth - w - 20;
    const baseY = pos?.y ?? r?.top ?? window.innerHeight - h - 20;
    let moved = false;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* older browsers still work via the element listeners below */
    }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < 5) return; // ignore a shaky click
        moved = true;
        setDragging(true);
      }
      setPos(clampPos(baseX + dx, baseY + dy, w, h));
    };
    const end = () => {
      setDragging(false);
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };

  const snapBack = () => setPos(null);

  return (
    <div
      data-timer-popup
      className="fixed z-40 no-print"
      style={
        pos
          ? {
              left: pos.x,
              top: pos.y,
              transition: dragging ? "none" : "left 0.35s cubic-bezier(0.22, 1, 0.36, 1), top 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
            }
          : { right: 20, bottom: 20 }
      }
    >
      {min ? (
        <div
          className="flex cursor-grab touch-none items-center gap-1 rounded-full border border-ink/10 bg-surface py-1.5 pl-4 pr-1.5 shadow-xl active:cursor-grabbing dark:border-cream/15 dark:bg-surface-dark"
          onPointerDown={beginDrag}
          onDoubleClick={snapBack}
          title="Drag to move · double-click to dock bottom-right · tap ▶ to expand"
        >
          <MiniClock />
          <button
            onClick={() => setMin(false)}
            className="rounded-full p-1.5 text-ink/55 transition hover:bg-ink/5 active:scale-90 dark:text-cream/55 dark:hover:bg-cream/10"
            aria-label="Expand timer"
            title="Expand"
          >
            <Play size={14} fill="currentColor" />
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/45 transition hover:bg-ink/5 active:scale-90 dark:text-cream/45 dark:hover:bg-cream/10"
            aria-label="Close timer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          ref={boxRef}
          className="w-[300px] rounded-3xl border border-ink/10 bg-surface p-4 shadow-2xl dark:border-cream/15 dark:bg-surface-dark"
        >
          <div
            className="mb-1 flex cursor-grab touch-none items-center justify-between active:cursor-grabbing"
            onPointerDown={beginDrag}
            onDoubleClick={snapBack}
            title="Hold and drag me anywhere · double-click to dock bottom-right"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">
              <GripVertical size={13} /> Drag me
            </span>
            <span className="flex items-center gap-0.5">
              <button
                onClick={() => setMin(true)}
                className="rounded-full p-1.5 text-ink/45 transition hover:bg-ink/5 active:scale-90 dark:text-cream/45 dark:hover:bg-cream/10"
                aria-label="Minimize timer"
                title="Minimize"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-ink/45 transition hover:bg-ink/5 active:scale-90 dark:text-cream/45 dark:hover:bg-cream/10"
                aria-label="Close timer"
                title="Close (reopen with the Focus timer pill)"
              >
                <X size={15} />
              </button>
            </span>
          </div>
          <PomodoroTimer settings={settings} onSettingsClick={onSettingsClick} />
        </div>
      )}
    </div>
  );
}
