"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Flame,
  Gamepad2,
  Keyboard,
  Layers,
  ListChecks,
  PencilLine,
  Puzzle,
  RotateCcw,
  Shuffle,
  SquareCheckBig,
  TextCursorInput,
  Trophy,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Button, cn, Input, ProgressBar, ScoreRing, Textarea } from "@/components/ui";
import {
  encodeList,
  encodeMatchAnswer,
  enumerationItems,
  gradeAnswer,
  multiResponseCorrect,
  normAnswer,
  orderingItems,
  parseMatchPairs,
  splitList,
} from "@/lib/quiz";

export interface GameCard {
  term: string;
  definition: string;
}

/** Minimal shape shared with KitQuestionRow. */
export interface GameQuestion {
  id?: string;
  type: string;
  question: string;
  options: string[] | null;
  answer: string;
  explanation?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/* ------------------------------ Win overlay ------------------------------ */

function WinOverlay({
  title,
  score,
  total,
  onReplay,
  onExit,
}: {
  title: string;
  score: number;
  total: number;
  onReplay: () => void;
  onExit: () => void;
}) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl bg-surface/95 px-6 text-center backdrop-blur-sm animate-fade dark:bg-surface-dark/95">
      <ScoreRing pct={pct} size={130} label="score" />
      <p className="text-xl font-bold text-ink dark:text-cream">{title}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink/60 dark:text-cream/60">
        <Trophy size={15} /> {score} of {total} correct
      </p>
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

function GameHeader({
  onExit,
  score,
  total,
  streak,
}: {
  onExit: () => void;
  score: number;
  total: number;
  streak?: number;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onExit}>
        <ArrowLeft size={15} /> All games
      </Button>
      <div className="flex items-center gap-3 text-sm font-semibold text-ink/60 dark:text-cream/60">
        {streak !== undefined && streak >= 2 && (
          <span className="inline-flex items-center gap-1 text-amber-500">
            <Flame size={14} /> {streak}
          </span>
        )}
        <span>
          {score} / {total}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ Memory Match ----------------------------- */

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
      <GameHeader onExit={onExit} score={moves} total={tiles.length / 2} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => {
          const isUp = flipped.includes(t.id) || matched.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => click(t.id)}
              className={cn(
                "min-h-[92px] rounded-2xl border p-3 text-left text-[12px] font-semibold leading-snug transition-all duration-300",
                matched.has(t.id)
                  ? "border-brand-400 bg-brand-100 text-ink opacity-80 dark:bg-brand-500/15 dark:text-brand-300"
                  : isUp
                    ? "border-ink/15 bg-surface text-ink shadow-md dark:border-cream/20 dark:bg-surface-dark dark:text-cream"
                    : "border-ink/10 bg-ink text-cream hover:bg-ink/85 dark:border-cream/15 dark:bg-cream/15"
              )}
            >
              {isUp ? (
                <span className={cn("line-clamp-4", t.kind === "term" && "text-[13px] font-bold")}>{t.text}</span>
              ) : (
                <Layers size={18} className="opacity-70" />
              )}
            </button>
          );
        })}
      </div>
      {done && (
        <WinOverlay
          title="You matched them all!"
          score={tiles.length / 2}
          total={tiles.length / 2}
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

/* -------------------------------- Type It -------------------------------- */

function GameIdentify({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => shuffle(cards).slice(0, Math.min(10, cards.length)), [round]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const done = idx >= questions.length;
  const q = questions[idx];

  const check = () => {
    const ok =
      slug(value) === slug(q.term) || (slug(value).length > 3 && slug(q.term).includes(slug(value)));
    setChecked(ok);
    if (ok) setScore((s) => s + 1);
    setTimeout(() => {
      setChecked(null);
      setValue("");
      setIdx((i) => i + 1);
    }, 1100);
  };

  return (
    <div className="relative">
      <GameHeader onExit={onExit} score={score} total={questions.length} />
      {!done && q && (
        <>
          <ProgressBar value={idx} max={questions.length} className="mb-5" />
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
            <Keyboard size={14} /> Identify the term
          </p>
          <p className="mb-5 rounded-2xl bg-ink/4 p-4 text-[15px] font-medium leading-relaxed text-ink/80 dark:bg-cream/5 dark:text-cream/80">
            {q.definition}
          </p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && checked === null && check()}
            placeholder="Type the exact term…"
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
            <p className="mt-3 text-sm font-semibold text-red-500">It was “{q.term}”.</p>
          )}
          <Button onClick={check} disabled={!value.trim() || checked !== null} className="mt-4 w-full">
            Check
          </Button>
        </>
      )}
      {done && (
        <WinOverlay
          title="Identification complete!"
          score={score}
          total={questions.length}
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

/* ----------------------------- True or False ----------------------------- */

function GameTrueFalse({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    return shuffle(cards)
      .slice(0, Math.min(10, cards.length))
      .map((c) => {
        const others = cards.filter((x) => x.term !== c.term);
        // eslint-disable-next-line react-hooks/purity
        const other = others.length ? others[Math.floor(Math.random() * others.length)] : undefined;
        // eslint-disable-next-line react-hooks/purity
        const doFlip = Math.random() < 0.5 && !!other;
        return {
          term: doFlip && other ? other.term : c.term,
          definition: c.definition,
          answer: !doFlip,
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
      <GameHeader onExit={onExit} score={score} total={questions.length} />
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
                picked === true &&
                  (q.answer
                    ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                    : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"),
                picked === false && "opacity-40",
                picked === null && "border-ink/12 bg-surface hover:border-green-400 dark:border-cream/15 dark:bg-surface-dark"
              )}
            >
              True
            </button>
            <button
              onClick={() => choose(false)}
              className={cn(
                "rounded-2xl border-2 py-4 text-base font-bold transition",
                picked === false &&
                  (!q.answer
                    ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                    : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"),
                picked === true && "opacity-40",
                picked === null && "border-ink/12 bg-surface hover:border-red-400 dark:border-cream/15 dark:bg-surface-dark"
              )}
            >
              False
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
          title="True or False complete!"
          score={score}
          total={questions.length}
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

/* ------------------------------- Speed Quiz ------------------------------ */

function GameSpeedQuiz({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    return shuffle(cards)
      .slice(0, Math.min(12, cards.length))
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
    }, 850);
  };

  return (
    <div className="relative">
      <GameHeader onExit={onExit} score={score} total={questions.length} streak={streak} />
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
          {best >= 2 && (
            <p className="mt-3 text-center text-xs font-bold uppercase tracking-wide text-ink/40 dark:text-cream/40">
              Best streak {best}
            </p>
          )}
        </>
      )}
      {done && (
        <WinOverlay
          title="Speed quiz complete!"
          score={score}
          total={questions.length}
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

/* ------------------------------ Word Scramble ---------------------------- */

function scrambleWord(seg: string): string {
  const chars = [...seg];
  const letterPos = chars.map((c, i) => (/[a-zA-Z]/.test(c) ? i : -1)).filter((i) => i >= 0);
  if (letterPos.length <= 2) return seg;
  const letters = letterPos.map((i) => chars[i]);
  let shuffled = shuffle(letters);
  if (shuffled.join("") === letters.join("")) shuffled = [...letters].reverse();
  letterPos.forEach((pos, k) => {
    chars[pos] = shuffled[k];
  });
  return chars.join("");
}

function scrambleTerm(term: string): string {
  return term
    .split(/(\s+)/)
    .map((part) => (/\S/.test(part) ? scrambleWord(part) : part))
    .join("");
}

function GameScramble({ cards, onExit }: { cards: GameCard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const words = useMemo(() => shuffle(cards).slice(0, Math.min(8, cards.length)), [round]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [gaveUp, setGaveUp] = useState(false);
  const [score, setScore] = useState(0);
  const done = idx >= words.length;
  const q = words[idx];
  const scrambled = useMemo(() => (q ? scrambleTerm(q.term) : ""), [q]);

  const check = () => {
    const ok = slug(value) === slug(q.term) || (slug(value).length > 3 && slug(q.term).includes(slug(value)));
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
      <GameHeader onExit={onExit} score={score} total={words.length} />
      {!done && q && (
        <>
          <ProgressBar value={idx} max={words.length} className="mb-5" />
          <p className="mb-1 text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
            Unscramble the term
          </p>
          <p className="mb-5 rounded-2xl bg-ink/4 p-4 text-[15px] font-medium leading-relaxed text-ink/80 dark:bg-cream/5 dark:text-cream/80">
            Hint: {q.definition}
          </p>
          <p className="mb-5 text-center text-3xl font-bold tracking-[0.3em] text-ink dark:text-cream">
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
                ? slug(value).length > 3 && slug(q.term).includes(slug(value))
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
          title="Scramble complete!"
          score={score}
          total={words.length}
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

/* --------------------------- Question-input mini -------------------------- */

function MatchMini({
  q,
  value,
  setValue,
  reveal,
}: {
  q: GameQuestion;
  value: string;
  setValue: (v: string) => void;
  reveal: boolean;
}) {
  const pairs = useMemo(() => parseMatchPairs(q.options), [q.options]);
  const meanings = useMemo(() => {
    const ms = pairs.map((p) => p.meaning);
    for (let i = ms.length - 1; i > 0; i--) {
      // eslint-disable-next-line react-hooks/purity
      const j = Math.floor(Math.random() * (i + 1));
      [ms[i], ms[j]] = [ms[j], ms[i]];
    }
    return ms;
  }, [pairs]);
  const chosen = new Map(parseMatchPairs(value).map((p) => [p.term, p.meaning]));
  const setPair = (term: string, meaning: string) => {
    const next = pairs.map((p) => ({
      term: p.term,
      meaning: p.term === term ? meaning : chosen.get(p.term) ?? "",
    }));
    setValue(encodeMatchAnswer(next));
  };
  return (
    <div className="grid gap-2.5">
      {pairs.map((p) => {
        const sel = chosen.get(p.term) ?? "";
        const isCorrect = reveal && normAnswer(sel) === normAnswer(p.meaning);
        const isWrong = reveal && !!sel && !isCorrect;
        return (
          <div
            key={p.term}
            className={cn(
              "grid gap-2 rounded-2xl border px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center",
              isCorrect
                ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                : isWrong
                  ? "border-red-400 bg-red-50 dark:bg-red-500/10"
                  : "border-ink/12 bg-surface dark:border-cream/15 dark:bg-surface-dark"
            )}
          >
            <span className="text-sm font-bold text-ink dark:text-cream">{p.term}</span>
            <select
              value={sel}
              disabled={reveal}
              onChange={(e) => setPair(p.term, e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand-500 disabled:opacity-70 dark:border-cream/15 dark:bg-surface-dark dark:text-cream"
            >
              <option value="">Choose a match…</option>
              {meanings.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function QuestionInputMini({
  q,
  value,
  setValue,
  reveal,
}: {
  q: GameQuestion;
  value: string;
  setValue: (v: string) => void;
  reveal: boolean;
}) {
  if (q.type === "mcq" && q.options?.length) {
    return (
      <div className="grid gap-2.5">
        {q.options.map((opt) => {
          const selected = value === opt;
          const isCorrect = reveal && opt === q.answer;
          const wrongPick = reveal && selected && opt !== q.answer;
          return (
            <button
              key={opt}
              onClick={() => !reveal && setValue(opt)}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                isCorrect
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : wrongPick
                    ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                    : selected
                      ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-ink/12 bg-surface hover:border-ink/30 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40"
              )}
            >
              {opt}
              {isCorrect && <Check size={16} />}
              {wrongPick && <XCircle size={16} />}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "true_false" || q.type === "modified_true_false") {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3">
          {["True", "False"].map((opt) => {
            const selected = value === opt;
            const isCorrect = reveal && opt === q.answer;
            return (
              <button
                key={opt}
                onClick={() => !reveal && setValue(opt)}
                className={cn(
                  "rounded-2xl border-2 py-4 text-base font-bold transition",
                  isCorrect
                    ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                    : selected
                      ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-ink/12 bg-surface hover:border-brand-400 dark:border-cream/15 dark:bg-surface-dark"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {reveal && q.type === "modified_true_false" && q.answer === "False" && q.options?.[0] && (
          <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-500/10 dark:text-green-300">
            Correct statement: {q.options[0]}
          </p>
        )}
      </div>
    );
  }

  if (q.type === "matching") {
    return <MatchMini q={q} value={value} setValue={setValue} reveal={reveal} />;
  }

  if (q.type === "multiple_response") {
    const correct = multiResponseCorrect(q).map(normAnswer);
    const chosen = splitList(value);
    const toggle = (opt: string) => {
      if (reveal) return;
      const has = chosen.includes(opt);
      setValue(encodeList(has ? chosen.filter((c) => c !== opt) : [...chosen, opt]));
    };
    return (
      <div className="grid gap-2.5">
        {q.options?.map((opt) => {
          const selected = chosen.includes(opt);
          const isCorrect = reveal && correct.includes(normAnswer(opt));
          const wrongPick = reveal && selected && !correct.includes(normAnswer(opt));
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                isCorrect
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : wrongPick
                    ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                    : selected
                      ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-ink/12 bg-surface hover:border-ink/30 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40"
              )}
            >
              <span
                className={cn(
                  "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border-2",
                  selected || isCorrect ? "border-brand-500 bg-brand-500 text-ink" : "border-ink/25 dark:border-cream/30"
                )}
              >
                {(selected || isCorrect) && <Check size={12} />}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "ordering") {
    const items = orderingItems(q);
    const chosen = splitList(value);
    const remaining = items.filter((it) => !chosen.some((c) => normAnswer(c) === normAnswer(it)));
    return (
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-cream/45">
          {reveal ? "Your order" : "Tap the items in the correct order"}
        </p>
        <div className="grid gap-2">
          {chosen.map((it, i) => (
            <div
              key={`${it}-${i}`}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold",
                reveal
                  ? normAnswer(chosen[i]) === normAnswer(items[i])
                    ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300"
                    : "border-red-400 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                  : "border-brand-500/40 bg-brand-50 dark:bg-brand-500/10"
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-cream dark:bg-cream dark:text-ink">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{it}</span>
              {!reveal && (
                <button
                  onClick={() => setValue(encodeList(chosen.filter((_, j) => j !== i)))}
                  className="rounded-full p-1 text-ink/40 hover:bg-ink/10 dark:text-cream/40 dark:hover:bg-cream/10"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {chosen.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-sm text-ink/45 dark:border-cream/15 dark:text-cream/45">
              No items ordered yet.
            </p>
          )}
        </div>
        {!reveal && remaining.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {remaining.map((it) => (
              <button
                key={it}
                onClick={() => setValue(encodeList([...chosen, it]))}
                className="rounded-full border border-ink/15 bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink transition hover:border-brand-500 dark:border-cream/20 dark:bg-surface-dark dark:text-cream"
              >
                + {it}
              </button>
            ))}
          </div>
        )}
        {reveal && (
          <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-500/10 dark:text-green-300">
            Correct order: {items.join(" → ")}
          </p>
        )}
      </div>
    );
  }

  if (q.type === "enumeration") {
    const items = enumerationItems(q);
    const got = normAnswer(value);
    return (
      <div>
        <Textarea
          rows={Math.max(3, Math.min(8, items.length + 1))}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={reveal}
          placeholder="List each item — one per line, or separated by commas…"
        />
        {reveal && (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((it) => {
              const hit = got.includes(normAnswer(it));
              return (
                <span
                  key={it}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                    hit
                      ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  )}
                >
                  {hit ? <Check size={12} /> : <X size={12} />}
                  {it}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // identification, short, fill_blank, essay
  const placeholder =
    q.type === "identification"
      ? "Type the exact term…"
      : q.type === "fill_blank"
        ? "Type the missing word or phrase…"
        : q.type === "essay"
          ? "Write your answer in a few sentences…"
          : "Type your answer…";
  if (q.type === "essay") {
    return (
      <Textarea
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={reveal}
        placeholder={placeholder}
      />
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={reveal}
      placeholder={placeholder}
      className={cn(
        reveal &&
          (gradeAnswer(q, value)
            ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
            : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300")
      )}
    />
  );
}

/* ----------------------------- Question game ----------------------------- */

function QuestionGame({
  questions,
  icon: Icon,
  title,
  onExit,
  written = false,
}: {
  questions: GameQuestion[];
  icon: typeof ListChecks;
  title: string;
  onExit: () => void;
  written?: boolean;
}) {
  const [round, setRound] = useState(0);
  const list = useMemo(() => shuffle(questions).slice(0, Math.min(12, questions.length)), [round, questions]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [score, setScore] = useState(0);
  const done = idx >= list.length;
  const q = list[idx];

  const check = () => {
    if (!q) return;
    const ok = gradeAnswer(q, value);
    setWasRight(ok);
    if (ok) setScore((s) => s + 1);
    setReveal(true);
    if (!written) {
      setTimeout(next, 1400);
    }
  };

  const next = () => {
    setReveal(false);
    setWasRight(false);
    setValue("");
    setIdx((i) => i + 1);
  };

  return (
    <div className="relative">
      <GameHeader onExit={onExit} score={score} total={list.length} />
      {!done && q && (
        <>
          <ProgressBar value={idx} max={list.length} className="mb-5" />
          <div className="mb-5 rounded-2xl bg-ink/4 p-4 dark:bg-cream/5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">
              <Icon size={13} /> {title}
            </p>
            <p className="text-[15px] font-semibold leading-relaxed text-ink dark:text-cream">{q.question}</p>
          </div>
          <QuestionInputMini q={q} value={value} setValue={setValue} reveal={reveal} />
          {!reveal ? (
            <Button onClick={check} disabled={!value.trim()} className="mt-4 w-full">
              Check answer
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <div
                className={cn(
                  "rounded-2xl p-4 text-sm leading-relaxed",
                  wasRight
                    ? "bg-green-50 text-green-900 dark:bg-green-500/10 dark:text-green-300"
                    : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                )}
              >
                <span className="mb-1 flex items-center gap-1.5 font-bold">
                  {wasRight ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {wasRight ? "Correct" : "Review this"}
                </span>
                <span className="font-semibold">Answer: </span>
                {q.type === "multiple_response"
                  ? multiResponseCorrect(q).join(", ")
                  : q.type === "ordering"
                    ? orderingItems(q).join(" → ")
                    : q.type === "modified_true_false"
                      ? q.answer === "False" && q.options?.[0]
                        ? `False — ${q.options[0]}`
                        : "True"
                      : q.answer}
                {q.explanation && (
                  <span className="mt-1 block border-t border-black/5 pt-1.5 opacity-90 dark:border-white/10">
                    {q.explanation}
                  </span>
                )}
              </div>
              {written ? (
                <Button onClick={next} className="w-full">
                  Next question
                </Button>
              ) : (
                <p className="text-center text-xs font-semibold text-ink/45 dark:text-cream/45">
                  Next question…
                </p>
              )}
            </div>
          )}
        </>
      )}
      {done && (
        <WinOverlay
          title={`${title} complete!`}
          score={score}
          total={list.length}
          onReplay={() => {
            setRound((r) => r + 1);
            setIdx(0);
            setScore(0);
            setReveal(false);
            setValue("");
          }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* --------------------------------- Hub ----------------------------------- */

type ModeDef = {
  id: string;
  name: string;
  desc: string;
  Icon: typeof ListChecks;
  color: string;
  kind: "card" | "question" | "mixed";
  types?: string[];
  written?: boolean;
};

const CARD_MODES: ModeDef[] = [
  { id: "match", name: "Memory Match", desc: "Flip and match each term to its definition.", Icon: Puzzle, color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", kind: "card" },
  { id: "identify", name: "Identification", desc: "Read the meaning and type the exact term.", Icon: Keyboard, color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", kind: "card" },
  { id: "truefalse", name: "True or False", desc: "Judge whether the term matches its meaning.", Icon: CheckCircle2, color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300", kind: "card" },
  { id: "mcq", name: "Multiple Choice", desc: "Pick the right term — speed counts.", Icon: Zap, color: "bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300", kind: "card" },
  { id: "scramble", name: "Word Scramble", desc: "Unscramble the letters of each term.", Icon: Shuffle, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", kind: "card" },
];

const QUESTION_MODES: ModeDef[] = [
  { id: "enumeration", name: "Enumeration", desc: "List every item of a set from memory.", Icon: ListChecks, color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300", kind: "question", types: ["enumeration"] },
  { id: "ordering", name: "Ordering", desc: "Arrange steps and items in the correct sequence.", Icon: ArrowUpDown, color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", kind: "question", types: ["ordering"] },
  { id: "multiple_response", name: "Multiple Response", desc: "Select every correct option.", Icon: SquareCheckBig, color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", kind: "question", types: ["multiple_response"] },
  { id: "fill_blank", name: "Fill in the Blanks", desc: "Complete each sentence with the exact term.", Icon: TextCursorInput, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", kind: "question", types: ["fill_blank"] },
  { id: "modified", name: "Modified True / False", desc: "Spot the false statement and correct it.", Icon: PencilLine, color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", kind: "question", types: ["modified_true_false"] },
  { id: "written", name: "Essay & Short Answer", desc: "Write full answers, then compare to the model.", Icon: PencilLine, color: "bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300", kind: "question", types: ["short", "essay"], written: true },
];

export function GameHub({
  cards,
  questions = [],
  onExit,
}: {
  cards: GameCard[];
  questions?: GameQuestion[];
  onExit: () => void;
}) {
  const [game, setGame] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [game]);

  const byTypes = (types: string[]) =>
    questions.filter((q) => types.includes(q.type) && q.answer);

  const start = (id: string) => setGame(id);
  const exit = () => setGame(null);

  if (game === "match") return <GameMatch cards={cards} onExit={exit} />;
  if (game === "identify") return <GameIdentify cards={cards} onExit={exit} />;
  if (game === "truefalse") return <GameTrueFalse cards={cards} onExit={exit} />;
  if (game === "mcq") return <GameSpeedQuiz cards={cards} onExit={exit} />;
  if (game === "scramble") return <GameScramble cards={cards} onExit={exit} />;

  const qMode = QUESTION_MODES.find((m) => m.id === game);
  if (qMode) {
    const list = byTypes(qMode.types ?? []);
    return (
      <QuestionGame
        questions={list}
        icon={qMode.Icon}
        title={qMode.name}
        onExit={exit}
        written={qMode.written}
      />
    );
  }
  if (game === "mixed") {
    const list = questions.length
      ? questions.filter((q) => q.answer)
      : cards.map((c) => ({
          type: "mcq",
          question: c.definition,
          options: shuffle([c.term, ...shuffle(cards.filter((x) => x.term !== c.term)).slice(0, 3).map((x) => x.term)]),
          answer: c.term,
          explanation: "",
        })) as GameQuestion[];
    return <QuestionGame questions={list} icon={Gamepad2} title="Mixed All" onExit={exit} />;
  }

  const canPlayCards = cards.length >= 4;
  const modes: (ModeDef & { available: boolean })[] = [
    ...CARD_MODES.map((m) => ({ ...m, available: canPlayCards })),
    ...QUESTION_MODES.map((m) => ({ ...m, available: byTypes(m.types ?? []).length > 0 })),
    {
      id: "mixed",
      name: "Mixed — All Types",
      desc: "A random mix of every question type in this kit.",
      Icon: Gamepad2,
      color: "bg-ink text-cream dark:bg-cream dark:text-ink",
      kind: "mixed",
      available: canPlayCards || questions.length > 0,
    },
  ];

  const anyAvailable = modes.some((m) => m.available);

  return (
    <div>
      {onExit && (
        <Button variant="ghost" size="sm" onClick={onExit} className="mb-4">
          <ArrowLeft size={15} /> Back to study kit
        </Button>
      )}
      <div className="mb-6 text-center">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink dark:text-cream">
          <Gamepad2 size={24} /> Practice arcade
        </h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-cream/60">
          Every quiz format from your material — {cards.length} flashcards · {questions.length} questions.
        </p>
      </div>

      {!anyAvailable ? (
        <p className="rounded-2xl bg-amber-100 p-4 text-center text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          Add at least 4 flashcards (or generate questions) to play.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">
            From your flashcards
          </p>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modes
              .filter((m) => m.kind === "card")
              .map((m) => (
                <ModeCard key={m.id} m={m} onStart={start} />
              ))}
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">
            From your practice questions
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modes
              .filter((m) => m.kind !== "card")
              .map((m) => (
                <ModeCard key={m.id} m={m} onStart={start} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModeCard({
  m,
  onStart,
}: {
  m: ModeDef & { available: boolean };
  onStart: (id: string) => void;
}) {
  return (
    <button
      onClick={() => m.available && onStart(m.id)}
      disabled={!m.available}
      className={cn(
        "group rounded-3xl border border-ink/10 bg-surface p-5 text-left transition dark:border-cream/10 dark:bg-surface-dark",
        m.available
          ? "hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg"
          : "cursor-not-allowed opacity-50"
      )}
    >
      <div className={cn("mb-4 grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-110", m.color)}>
        <m.Icon size={22} />
      </div>
      <p className="text-base font-bold text-ink dark:text-cream">{m.name}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink/60 dark:text-cream/60">{m.desc}</p>
      <p className="mt-3 text-[13px] font-bold text-brand-700 dark:text-brand-400">
        {m.available ? "Play" : "Generate questions to unlock"}
      </p>
    </button>
  );
}
