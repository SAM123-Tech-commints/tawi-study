"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Gamepad2, Keyboard, Puzzle, RotateCcw, Shuffle, Trophy, X, Zap } from "lucide-react";
import { Button, cn, ProgressBar, ScoreRing } from "@/components/ui";

export interface GameCard {
  term: string;
  definition: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function WinOverlay({ label, score, onReplay, onExit }: { label: string; score: string; onReplay: () => void; onExit: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl bg-surface/95 backdrop-blur-sm animate-fade dark:bg-surface-dark/95">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-400 text-ink">
        <Trophy size={28} />
      </div>
      <p className="text-xl font-bold text-ink dark:text-cream">{label}</p>
      <p className="text-sm font-semibold text-ink/60 dark:text-cream/60">{score}</p>
      <div className="flex gap-2">
        <Button onClick={onReplay}>
          <RotateCcw size={15} /> Play again
        </Button>
        <Button variant="outline" onClick={onExit}>
          All games
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ Match ------------------------------- */

function GameMatch({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const tiles = useMemo(() => {
    const pool = shuffle(cards).slice(0, 8);
    return shuffle([
      ...pool.map((c, i) => ({ id: i * 2, kind: "term" as const, text: c.term, pair: i })),
      ...pool.map((c, i) => ({ id: i * 2 + 1, kind: "def" as const, text: c.definition, pair: i })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);

  const click = (id: number) => {
    if (busy || matched.has(id) || flipped.includes(id)) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((f) => tiles.find((t) => t.id === f)!);
      if (a.pair === b.pair) {
        setMatched((s) => new Set([...s, a.id, b.id]));
        setFlipped([]);
      } else {
        setBusy(true);
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 850);
      }
    }
  };

  const done = matched.size === tiles.length && tiles.length > 0;
  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft size={15} /> All games
        </Button>
        <p className="text-sm font-semibold text-ink/60 dark:text-cream/60">Moves: {moves}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => {
          const isUp = flipped.includes(t.id) || matched.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => click(t.id)}
              className={cn(
                "min-h-[92px] rounded-2xl border p-3 text-left text-[12px] font-semibold leading-snug transition-all duration-300 [transform-style:preserve-3d]",
                matched.has(t.id)
                  ? "border-brand-400 bg-brand-100 text-ink opacity-80 dark:bg-brand-500/15 dark:text-brand-300"
                  : isUp
                    ? "border-ink/15 bg-surface text-ink shadow-md dark:border-cream/20 dark:bg-surface-dark dark:text-cream"
                    : "border-ink/10 bg-ink text-cream hover:bg-ink/85 dark:border-cream/15 dark:bg-cream/15"
              )}
            >
              {isUp ? (
                <span className={cn("line-clamp-4", t.kind === "term" && "text-[13px] font-bold")}>
                  {t.text}
                </span>
              ) : (
                <span className="text-xl">✨</span>
              )}
            </button>
          );
        })}
      </div>
      {done && (
        <WinOverlay
          label="You matched them all!"
          score={`${moves} moves`}
          onReplay={() => {
            setRound((r) => r + 1);
            setMatched(new Set());
            setFlipped([]);
            setMoves(0);
          }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* ------------------------------ Quiz -------------------------------- */

function GameQuiz({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    return shuffle(cards)
      .slice(0, Math.min(10, cards.length))
      .map((c) => ({
        definition: c.definition,
        options: shuffle([c.term, ...shuffle(cards.filter((x) => x.term !== c.term)).slice(0, 3).map((x) => x.term)]),
        answer: c.term,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const done = idx >= questions.length;
  const q = questions[idx];

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.answer) {
      setScore((s) => s + 1);
      setStreak((s) => {
        setBest((b) => Math.max(b, s + 1));
        return s + 1;
      });
    } else {
      setStreak(0);
    }
    setTimeout(() => {
      setPicked(null);
      setIdx((i) => i + 1);
    }, 900);
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft size={15} /> All games
        </Button>
        <div className="flex items-center gap-3 text-sm font-semibold text-ink/60 dark:text-cream/60">
          {streak >= 2 && <span className="text-amber-500">🔥 {streak} streak</span>}
          <span>
            {score}/{idx}
          </span>
        </div>
      </div>
      {!done && q && (
        <>
          <ProgressBar value={idx} max={questions.length} className="mb-5" />
          <p className="mb-5 rounded-2xl bg-ink/4 p-4 text-[15px] font-medium leading-relaxed text-ink/80 dark:bg-cream/5 dark:text-cream/80">
            {q.definition}
          </p>
          <div className="grid gap-2.5">
            {q.options.map((opt) => {
              const state =
                picked === null ? "idle" : opt === q.answer ? "correct" : picked === opt ? "wrong" : "dim";
              return (
                <button
                  key={opt}
                  onClick={() => choose(opt)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                    state === "idle" &&
                      "border-ink/12 bg-surface hover:border-ink/30 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40",
                    state === "correct" && "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
                    state === "wrong" && "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
                    state === "dim" && "border-ink/10 bg-surface opacity-50 dark:border-cream/10 dark:bg-surface-dark"
                  )}
                >
                  {opt}
                  {state === "correct" && <Check size={16} />}
                  {state === "wrong" && <X size={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
      {done && (
        <WinOverlay
          label="Quiz complete!"
          score={`${score} / ${questions.length} correct · best streak ${best}`}
          onReplay={() => {
            setRound((r) => r + 1);
            setIdx(0);
            setScore(0);
            setStreak(0);
            setBest(0);
          }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* --------------------------- True / False --------------------------- */

function GameTrueFalse({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    return shuffle(cards)
      .slice(0, Math.min(10, cards.length))
      .map((c) => {
        const flip = Math.random() < 0.5;
        const others = cards.filter((x) => x.term !== c.term);
        const other = others[Math.floor(Math.random() * others.length)];
        return {
          term: flip && other ? other.term : c.term,
          definition: c.definition,
          answer: !flip,
          correctTerm: c.term,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const done = idx >= questions.length;
  const q = questions[idx];

  const choose = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    if (v === q.answer) setScore((s) => s + 1);
    setTimeout(() => {
      setPicked(null);
      setIdx((i) => i + 1);
    }, 1100);
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft size={15} /> All games
        </Button>
        <p className="text-sm font-semibold text-ink/60 dark:text-cream/60">
          {score}/{idx}
        </p>
      </div>
      {!done && q && (
        <>
          <ProgressBar value={idx} max={questions.length} className="mb-5" />
          <div className="mb-5 rounded-2xl bg-ink/4 p-4 dark:bg-cream/5">
            <p className="text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
              “{q.term}”
            </p>
            <p className="mt-1 text-[15px] font-medium leading-relaxed text-ink/80 dark:text-cream/80">
              {q.definition}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => choose(true)}
              className={cn(
                "rounded-2xl border-2 py-4 text-base font-bold transition",
                picked === true && (q.answer ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300" : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"),
                picked === false && "opacity-40",
                picked === null && "border-ink/12 bg-surface hover:border-green-400 dark:border-cream/15 dark:bg-surface-dark"
              )}
            >
              ✅ True
            </button>
            <button
              onClick={() => choose(false)}
              className={cn(
                "rounded-2xl border-2 py-4 text-base font-bold transition",
                picked === false && (!q.answer ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300" : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"),
                picked === true && "opacity-40",
                picked === null && "border-ink/12 bg-surface hover:border-red-400 dark:border-cream/15 dark:bg-surface-dark"
              )}
            >
              ❌ False
            </button>
          </div>
          {picked !== null && (
            <p className="mt-4 rounded-xl bg-brand-100 p-3 text-sm font-semibold text-ink dark:bg-brand-500/15 dark:text-brand-300">
              The correct term is “{q.correctTerm}”.
            </p>
          )}
        </>
      )}
      {done && (
        <WinOverlay
          label="True or False complete!"
          score={`${score} / ${questions.length} correct`}
          onReplay={() => {
            setRound((r) => r + 1);
            setIdx(0);
            setScore(0);
          }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* ------------------------------ Typing ------------------------------ */

function GameTyping({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => shuffle(cards).slice(0, Math.min(10, cards.length)), [round]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const done = idx >= questions.length;
  const q = questions[idx];

  const check = () => {
    const a = q.term.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const b = value.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const correct = a === b || (b.length > 3 && a.includes(b)) || (a.length > 3 && b.includes(a));
    setChecked(correct);
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      setChecked(null);
      setValue("");
      setIdx((i) => i + 1);
    }, 1100);
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft size={15} /> All games
        </Button>
        <p className="text-sm font-semibold text-ink/60 dark:text-cream/60">
          {score}/{idx}
        </p>
      </div>
      {!done && q && (
        <>
          <ProgressBar value={idx} max={questions.length} className="mb-5" />
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
            Type the term
          </p>
          <p className="mb-5 rounded-2xl bg-ink/4 p-4 text-[15px] font-medium leading-relaxed text-ink/80 dark:bg-cream/5 dark:text-cream/80">
            {q.definition}
          </p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && checked === null && check()}
            placeholder="Start typing…"
            className={cn(
              "h-12 w-full rounded-2xl border-2 px-4 text-[15px] font-semibold outline-none transition",
              checked === true
                ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                : checked === false
                  ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  : "border-ink/15 bg-surface text-ink focus:border-brand-500 dark:border-cream/15 dark:bg-surface-dark dark:text-cream"
            )}
          />
          {checked === false && (
            <p className="mt-3 text-sm font-semibold text-red-500">
              It was “{q.term}”.
            </p>
          )}
          <Button onClick={check} disabled={!value.trim() || checked !== null} className="mt-4 w-full">
            Check
          </Button>
        </>
      )}
      {done && (
        <WinOverlay
          label="Typing master!"
          score={`${score} / ${questions.length} correct`}
          onReplay={() => {
            setRound((r) => r + 1);
            setIdx(0);
            setScore(0);
          }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* ----------------------------- Scramble ----------------------------- */

function GameScramble({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const words = useMemo(() => shuffle(cards).slice(0, Math.min(8, cards.length)), [round]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [gaveUp, setGaveUp] = useState(false);
  const [score, setScore] = useState(0);
  const done = idx >= words.length;
  const q = words[idx];
  const scrambled = useMemo(() => {
    if (!q) return "";
    const letters = q.term.replace(/[^a-zA-Z]/g, "").split("");
    const sh = shuffle(letters);
    return sh.join("") === q.term ? letters.reverse().join("") : sh.join("");
  }, [q]);

  const check = () => {
    const ok = value.trim().toLowerCase() === q.term.toLowerCase();
    if (ok) setScore((s) => s + 1);
    setGaveUp(true);
    setTimeout(() => {
      setGaveUp(false);
      setValue("");
      setIdx((i) => i + 1);
    }, 1300);
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft size={15} /> All games
        </Button>
        <p className="text-sm font-semibold text-ink/60 dark:text-cream/60">
          {score}/{idx}
        </p>
      </div>
      {!done && q && (
        <>
          <ProgressBar value={idx} max={words.length} className="mb-5" />
          <p className="mb-1 text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
            Unscramble the term
          </p>
          <p className="mb-5 rounded-2xl bg-ink/4 p-4 text-[15px] font-medium leading-relaxed text-ink/80 dark:bg-cream/5 dark:text-cream/80">
            Hint: {q.definition}
          </p>
          <p className="mb-5 text-center text-4xl font-bold tracking-[0.3em] text-ink dark:text-cream">
            {scrambled}
          </p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && !gaveUp && check()}
            placeholder="Your answer…"
            className={cn(
              "h-12 w-full rounded-2xl border-2 px-4 text-center text-[15px] font-bold outline-none transition",
              gaveUp
                ? value.trim().toLowerCase() === q.term.toLowerCase()
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                : "border-ink/15 bg-surface text-ink focus:border-brand-500 dark:border-cream/15 dark:bg-surface-dark dark:text-cream"
            )}
          />
          {gaveUp && (
            <p className="mt-3 text-sm font-semibold text-ink/60 dark:text-cream/60">
              The word was <span className="text-brand-600 dark:text-brand-400">{q.term}</span>
            </p>
          )}
          <Button onClick={check} disabled={!value.trim() || gaveUp} className="mt-4 w-full">
            Check
          </Button>
        </>
      )}
      {done && (
        <WinOverlay
          label="Scramble complete!"
          score={`${score} / ${words.length} correct`}
          onReplay={() => {
            setRound((r) => r + 1);
            setIdx(0);
            setScore(0);
          }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* ------------------------------- Hub -------------------------------- */

const GAMES = [
  { id: "match", name: "Match", Icon: Puzzle, desc: "Match every term with its definition.", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { id: "quiz", name: "Speed Quiz", Icon: Zap, desc: "Answer multiple-choice questions fast.", color: "bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300" },
  { id: "truefalse", name: "True or False", Icon: CheckCircle2, desc: "Spot the statement that doesn't belong.", color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  { id: "typing", name: "Type It", Icon: Keyboard, desc: "Type the term from its definition.", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { id: "scramble", name: "Word Scramble", Icon: Shuffle, desc: "Unscramble the letters of each term.", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
];

export function GameHub({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [game, setGame] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [game]);

  if (game === "match") return <GameMatch cards={cards} onExit={() => setGame(null)} />;
  if (game === "quiz") return <GameQuiz cards={cards} onExit={() => setGame(null)} />;
  if (game === "truefalse") return <GameTrueFalse cards={cards} onExit={() => setGame(null)} />;
  if (game === "typing") return <GameTyping cards={cards} onExit={() => setGame(null)} />;
  if (game === "scramble") return <GameScramble cards={cards} onExit={() => setGame(null)} />;

  return (
    <div>
      {onExit && (
        <Button variant="ghost" size="sm" onClick={onExit} className="mb-4">
          <ArrowLeft size={15} /> Back to study kit
        </Button>
      )}
      <div className="mb-6 text-center">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink dark:text-cream">
          <Gamepad2 size={24} /> Pick a game
        </h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-cream/60">
          Five quick memory games built from your {cards.length} flashcards.
        </p>
      </div>
      {cards.length < 4 ? (
        <p className="rounded-2xl bg-amber-100 p-4 text-center text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          Add at least 4 flashcards to play games.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className="group rounded-3xl border border-ink/10 bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg dark:border-cream/10 dark:bg-surface-dark"
            >
              <div className={cn("mb-4 grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-110", g.color)}>
                <g.Icon size={22} />
              </div>
              <p className="text-base font-bold text-ink dark:text-cream">{g.name}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink/60 dark:text-cream/60">{g.desc}</p>
              <p className="mt-3 text-[13px] font-bold text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-400">
                Play →
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
