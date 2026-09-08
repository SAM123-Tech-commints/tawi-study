"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Minimize2, Pause, Play, RotateCcw, Settings, Square, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui";

type TimerMode = "work" | "break" | "longBreak";

interface TimerSettings {
  work: number;
  break: number;
  longBreak: number;
  rounds: number;
}

export function PomodoroTimer({
  settings,
  onSettingsClick,
}: {
  settings: TimerSettings;
  onSettingsClick?: () => void;
}) {
  const [mode, setMode] = useState<TimerMode>("work");
  const [secondsLeft, setSecondsLeft] = useState(settings.work * 60);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [muted, setMuted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset when settings change
  useEffect(() => {
    if (!running) {
      setSecondsLeft(mode === "work" ? settings.work * 60 : mode === "break" ? settings.break * 60 : settings.longBreak * 60);
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

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          playSound();
          // Auto-switch mode
          if (mode === "work") {
            if (round >= settings.rounds) {
              setMode("longBreak");
              setSecondsLeft(settings.longBreak * 60);
              setRound(1);
            } else {
              setMode("break");
              setSecondsLeft(settings.break * 60);
            }
          } else {
            setMode("work");
            setSecondsLeft(settings.work * 60);
            if (mode === "longBreak") setRound(1);
            else setRound((r) => r + 1);
          }
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running, mode, round, settings, playSound]);

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
  const modeColor = mode === "work" ? "text-brand-600 dark:text-brand-400" : mode === "break" ? "text-green-600 dark:text-green-400" : "text-violet-600 dark:text-violet-400";
  const ringColor = mode === "work" ? "stroke-[#B7E938]" : mode === "break" ? "stroke-green-500" : "stroke-violet-500";

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

      {/* Round indicator */}
      <p className="text-[12px] font-medium text-ink/45 dark:text-cream/45">
        Round {round} / {settings.rounds}
      </p>
    </div>
  );
}

/* ------------------------- Floating popup ------------------------- */
/* Draggable by its header, minimizable to a pill, closable. The dashboard
 * re-opens it through its own "Focus timer" pill. */

export function TimerPopup({
  settings,
  onSettingsClick,
  onClose,
}: {
  settings: TimerSettings;
  onSettingsClick?: () => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (pos === null) {
      // Convert the docked corner into absolute coordinates, then drag.
      const el = (e.currentTarget as HTMLElement).closest("[data-timer-popup]") as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (!r) return;
      drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      setPos({ x: r.left, y: r.top });
    } else {
      drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.min(Math.max(8, e.clientX - drag.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(8, e.clientY - drag.current.dy), window.innerHeight - 80),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      data-timer-popup
      className="fixed z-40 no-print"
      style={pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: 20 }}
    >
      {min ? (
        <button
          onClick={() => setMin(false)}
          className="flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-4 py-2.5 text-sm font-bold text-ink shadow-xl transition hover:scale-105 active:scale-95 dark:border-cream/15 dark:bg-surface-dark dark:text-cream"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" /> Focus timer — expand
        </button>
      ) : (
        <div className="w-[300px] rounded-3xl border border-ink/10 bg-surface p-4 shadow-2xl dark:border-cream/15 dark:bg-surface-dark">
          <div
            className="mb-1 flex cursor-grab touch-none items-center justify-between active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            title="Hold and drag me anywhere"
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
