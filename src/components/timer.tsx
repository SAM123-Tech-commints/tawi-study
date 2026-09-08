"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";
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

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="rounded-full"
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          onClick={() => setRunning(!running)}
          className="h-12 w-12 rounded-full"
          size="lg"
        >
          {running ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMuted(!muted)}
          className="rounded-full"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
        {onSettingsClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            className="rounded-full"
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
