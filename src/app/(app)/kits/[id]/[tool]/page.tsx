"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Frown,
  Gamepad2,
  Layers,
  Lightbulb,
  List,
  Meh,
  NotebookPen,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Smile,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  addCardAction,
  cleanupExactTextAction,
  deleteCardAction,
  deleteKitQuestionAction,
  getKitData,
  learnMoreAction,
  rateCardAction,
  regenerateKitAction,
  regenerateNotesAction,
  resetProgressAction,
  suggestGuideTermsAction,
} from "@/lib/actions";
import { formatInterval } from "@/lib/srs";
import {
  Badge,
  Button,
  Card,
  cn,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  RichText,
  ScoreRing,
  Spinner,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { GameHub, type GameCard } from "@/components/games";
import { extractTerms, keyTerms, splitSentences } from "@/lib/text";
import {
  encodeList,
  encodeMatchAnswer,
  enumerationItems,
  gradeAnswer,
  multiResponseCorrect,
  normAnswer,
  orderingItems,
  parseMatchPairs,
  questionTypeLabel,
  splitList,
} from "@/lib/quiz";
import type { CardRow, KitQuestionRow } from "@/db/schema";

type KitData = NonNullable<Awaited<ReturnType<typeof getKitData>>>;
type Tool = "flashcards" | "smart-study" | "study-guide" | "games";

const TOOL_META: Record<Tool, { name: string; icon: typeof Layers }> = {
  flashcards: { name: "Flashcards", icon: Layers },
  "smart-study": { name: "Smart Study", icon: Brain },
  "study-guide": { name: "Study guide", icon: NotebookPen },
  games: { name: "Games", icon: Gamepad2 },
};

export default function KitToolPage() {
  const { id, tool: toolParam } = useParams<{ id: string; tool: string }>();
  const tool = TOOL_META[toolParam as Tool] ? (toolParam as Tool) : "flashcards";
  const router = useRouter();
  const [data, setData] = useState<KitData | null>(null);

  const load = useCallback(async () => {
    const d = await getKitData(id);
    setData(d);
    if (!d) router.push("/kits");
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const meta = TOOL_META[tool];
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}${data.shareUrl}` : data.shareUrl;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/kits/${id}`} className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream">
            <ArrowLeft size={15} /> {data.kit.title}
          </Link>
          <h1 className="font-display flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ink dark:text-cream">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-ink">
              <meta.icon size={17} />
            </span>
            {meta.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <CopyButton text={shareLink} label="Share" size="sm" />
          <Link href={`/kits/${id}`}>
            <Button variant="outline" size="sm">All tools</Button>
          </Link>
        </div>
      </div>

      {tool === "flashcards" && <FlashcardsTool data={data} onChanged={load} />}
      {tool === "smart-study" && <SmartStudyTool data={data} />}
      {tool === "study-guide" && <StudyGuideTool data={data} onChanged={load} shareLink={shareLink} />}
      {tool === "games" && (
        <GameHub
          cards={data.cards as GameCard[]}
          questions={data.questions}
          onExit={() => router.push(`/kits/${id}`)}
        />
      )}
    </div>
  );
}

/* ============================ FLASHCARDS ============================ */

function DefSourceToggle({
  value,
  onChange,
  aiCount,
}: {
  value: "exact" | "ai";
  onChange: (v: "exact" | "ai") => void;
  aiCount: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-ink/5 p-1 dark:border-cream/10 dark:bg-cream/5" title="Choose where card definitions come from">
      {(
        [
          ["exact", "Exact text"],
          ["ai", `AI summary${aiCount ? ` (${aiCount})` : ""}`],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold transition-all active:scale-95",
            value === id
              ? "bg-surface text-ink shadow-sm dark:bg-cream/15 dark:text-cream"
              : "text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FlashcardsTool({ data, onChanged }: { data: KitData; onChanged: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"deck" | "list">("deck");
  const [defSource, setDefSource] = useState<"exact" | "ai">("exact");
  const [intro, setIntro] = useState(false);
  const [queue, setQueue] = useState<CardRow[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState({ got: 0, unsure: 0, again: 0 });

  const buildQueue = () => {
    const now = Date.now();
    const rated = data.cards.filter((c) => {
      const p = data.progress[c.id];
      return p && new Date(p.dueAt).getTime() <= now;
    });
    const unrated = data.cards.filter((c) => !data.progress[c.id]);
    setQueue([...unrated, ...rated]);
    setPos(0);
    setFlipped(false);
    setSession({ got: 0, unsure: 0, again: 0 });
  };

  useEffect(() => {
    try {
      if (!localStorage.getItem("tia-flash-intro")) {
        setIntro(true);
        localStorage.setItem("tia-flash-intro", "1");
      }
    } catch {
      /* ignore */
    }
    buildQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = queue[pos];
  const done = queue.length === 0 || pos >= queue.length;

  // AI-summary definitions come from the kit's key terms; anything without a
  // match falls back to the exact-text definition. Exact stays the default.
  const aiDefs = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of data.kit.summary?.keyTerms ?? []) {
      const key = k.term.trim().toLowerCase();
      if (key && k.meaning && !m.has(key)) m.set(key, k.meaning);
    }
    return m;
  }, [data.kit.summary]);
  const aiCount = aiDefs.size;
  const defFor = (card: CardRow): { text: string; ai: boolean } => {
    if (defSource === "ai") {
      const hit = aiDefs.get(card.term.trim().toLowerCase());
      if (hit) return { text: hit, ai: true };
    }
    return { text: card.definition, ai: false };
  };

  const rate = async (rating: "again" | "unsure" | "got") => {
    if (!current) return;
    setSession((s) => ({ ...s, [rating]: s[rating] + 1 }));
    const res = await rateCardAction({ cardId: current.id, rating });
    if (res.ok) toast(`Due again in ${formatInterval(res.dueInMinutes)}`);
    setFlipped(false);
    setPos((p) => p + 1);
    onChanged();
  };

  // Keyboard shortcuts — space/enter flips; 1/2/3 rate once the card is flipped.
  useEffect(() => {
    if (mode !== "deck") return;
    const onKey = (e: KeyboardEvent) => {
      if (done || !current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        rate(e.key === "1" ? "again" : e.key === "2" ? "unsure" : "got");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, flipped, done, current]);

  /* ------- list mode ------- */
  if (mode === "list") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Tabs
            tabs={[
              { id: "deck", label: "Deck" },
              { id: "list", label: "List" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as "deck" | "list")}
          />
          <div className="flex items-center gap-2">
            <DefSourceToggle value={defSource} onChange={setDefSource} aiCount={aiCount} />
            <span className="text-sm font-semibold text-ink/50 dark:text-cream/50">{data.cards.length} cards</span>
          </div>
        </div>
        <AddCardForm kitId={data.kit.id} onAdded={onChanged} />
        <div className="mt-4 space-y-3">
          {data.cards.map((c) => {
            const d = defFor(c);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-ink dark:text-cream">{c.term}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink/60 dark:text-cream/60">{d.text}</p>
                    <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${d.ai ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "bg-ink/5 text-ink/50 dark:bg-cream/10 dark:text-cream/50"}`}>
                      {d.ai ? "AI definition" : "Exact text"}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      await deleteCardAction(c.id);
                      toast("Card deleted");
                      onChanged();
                    }}
                    className="rounded-full p-2 text-ink/35 transition hover:bg-red-50 hover:text-red-500 active:scale-90 dark:hover:bg-red-500/10"
                    aria-label="Delete card"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  /* ------- deck mode ------- */
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          tabs={[
            { id: "deck", label: "Deck" },
            { id: "list", label: "List" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "deck" | "list")}
        />
        <div className="flex items-center gap-3">
          <DefSourceToggle value={defSource} onChange={setDefSource} aiCount={aiCount} />
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
              <Smile size={14} /> {session.got}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-500">
              <Meh size={14} /> {session.unsure}
            </span>
            <span className="inline-flex items-center gap-1 text-red-500">
              <Frown size={14} /> {session.again}
            </span>
          </div>
        </div>
      </div>

      {!done && current ? (
        <>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-ink/60 dark:text-cream/60">
            <span>Card {pos + 1} of {queue.length}</span>
            <button
              onClick={() => {
                setQueue((q) => [...q].sort(() => Math.random() - 0.5));
                setPos(0);
                setFlipped(false);
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-ink/55 transition hover:bg-ink/5 hover:text-ink dark:text-cream/55 dark:hover:bg-cream/10 dark:hover:text-cream"
            >
              <Shuffle size={13} /> Shuffle
            </button>
          </div>
          <ProgressBar value={pos} max={queue.length} className="mb-5" tone="violet" />
          <div className="flip-scene h-[340px] cursor-pointer" onClick={() => setFlipped((f) => !f)}>
            <div className={cn("flip-inner", flipped && "flipped")}>
              <div className="flip-face flex flex-col items-center justify-center rounded-3xl border border-ink/8 bg-surface p-8 shadow-sm dark:border-cream/10 dark:bg-surface-dark">
                <p className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">Tap to flip</p>
                <p className="font-display mt-4 text-center text-2xl font-bold leading-snug text-ink dark:text-cream">{current.term}</p>
              </div>
              <div className="flip-face flip-back flex flex-col items-center justify-center rounded-3xl border border-brand-500/50 bg-brand-50 p-8 dark:bg-brand-500/10">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">
                  Definition · {defFor(current).ai ? "AI summary" : "Exact text"}
                </p>
                <p className="mt-3 max-h-56 overflow-auto text-center text-[17px] font-medium leading-relaxed text-ink/85 dark:text-cream/85">
                  {defFor(current).text}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {(
              [
                ["again", Frown, "Again", "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-300"],
                ["unsure", Meh, "Unsure", "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300"],
                ["got", Smile, "Got it", "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/15 dark:text-green-300"],
              ] as const
            ).map(([r, Icon, label, cls]) => (
              <button
                key={r}
                onClick={() => rate(r)}
                className={cn("inline-flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-bold transition", cls)}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-ink/45 dark:text-cream/45">
            Spaced repetition: “Again” cards come back in 2 minutes, “Got it” cards go further out each time.
          </p>
        </>
      ) : (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-500 text-ink">
            <Trophy size={30} />
          </span>
          <h3 className="font-display mt-4 text-xl font-bold text-ink dark:text-cream">All caught up!</h3>
          <p className="mt-1 max-w-sm text-sm text-ink/60 dark:text-cream/60">
            You reviewed {session.got + session.unsure + session.again} cards. “Again” cards will reappear
            in your queue when they&apos;re due.
          </p>
          <div className="mt-5 flex gap-2">
            <Button onClick={buildQueue}>
              <RotateCcw size={15} /> Restart queue
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await resetProgressAction(data.kit.id);
                toast("Progress reset");
                onChanged();
                buildQueue();
              }}
            >
              Reset all progress
            </Button>
          </div>
        </Card>
      )}

      <Modal open={intro} onClose={() => setIntro(false)}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-ink">
          <Layers size={24} />
        </span>
        <h3 className="font-display mt-4 text-xl font-bold text-ink dark:text-cream">How flashcards work</h3>
        <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink/70 dark:text-cream/70">
          <p>1. Read the <strong>term</strong>, then tap the card to flip it.</p>
          <p>2. Rate yourself honestly:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Got it</strong> — you knew it instantly</li>
            <li><strong>Unsure</strong> — you sort of knew it</li>
            <li><strong>Again</strong> — no idea, show me soon</li>
          </ul>
          <p>3. Spaced repetition brings hard cards back sooner and pushes easy cards further out — that&apos;s how you remember for exams.</p>
        </div>
        <Button className="mt-6 w-full" onClick={() => setIntro(false)}>Continue</Button>
      </Modal>
    </div>
  );
}

function AddCardForm({ kitId, onAdded }: { kitId: string; onAdded: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");

  const add = async () => {
    if (!term.trim() || !definition.trim()) return;
    const res = await addCardAction({ kitId, term, definition });
    if (res.ok) {
      toast("Flashcard added ");
      setTerm("");
      setDefinition("");
      setOpen(false);
      onAdded();
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus size={15} /> Add flashcard
      </Button>
    );
  }
  return (
    <Card className="space-y-3">
      <Field label="Term">
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Mitosis" autoFocus />
      </Field>
      <Field label="Definition">
        <Textarea rows={3} value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Cell division that produces two identical daughter cells…" />
      </Field>
      <div className="flex gap-2">
        <Button onClick={add} disabled={!term.trim() || !definition.trim()}>
          <Check size={15} /> Add card
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}

/* ============================ SMART STUDY ============================ */

/** Matching input for the self-graded Smart Study player. Kept as its own
 *  component (remounted per question via `key`) so the shuffle useMemo has a
 *  stable hook order. */
function SmartMatchInput({
  q,
  value,
  onChange,
  reveal,
}: {
  q: KitQuestionRow;
  value: string;
  onChange: (v: string) => void;
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
    onChange(encodeMatchAnswer(next));
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
              "grid grid-cols-1 gap-2 rounded-2xl border px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center",
              isCorrect
                ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                : isWrong
                  ? "border-red-400 bg-red-50 dark:bg-red-500/10"
                  : "border-ink/12 bg-surface dark:border-cream/15 dark:bg-surface-dark"
            )}
          >
            <span className="text-sm font-bold text-ink dark:text-cream">{p.term}</span>
            <div>
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
              {isWrong && (
                <p className="mt-1 text-xs font-semibold text-green-700 dark:text-green-300">
                  Correct: {p.meaning}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmartStudyTool({ data }: { data: KitData }) {
  const { toast } = useToast();
  const [intro, setIntro] = useState(false);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<KitQuestionRow[]>([]);
  const [learning, setLearning] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem("tia-smart-intro")) {
        setIntro(true);
        localStorage.setItem("tia-smart-intro", "1");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const questions = data.questions;
  const q = questions[idx];
  const finished = idx >= questions.length;

  const advance = () => {
    setIdx((i) => i + 1);
    setInput("");
    setRevealed(false);
    setGraded(false);
    setExplanation(null);
    setLearning(false);
  };

  const grade = (gotIt: boolean) => {
    setGraded(true);
    if (gotIt) setCorrect((c) => c + 1);
    else setMissed((m) => [...m, q]);
    setTimeout(advance, 650);
  };

  const learnMore = async () => {
    if (learning) return;
    setLearning(true);
    const text = await learnMoreAction({ kitId: data.kit.id, questionId: q.id });
    setExplanation(text ?? "Could not generate an explanation right now.");
    setLearning(false);
  };

  const restart = () => {
    setIdx(0);
    setCorrect(0);
    setMissed([]);
    setInput("");
    setRevealed(false);
    setGraded(false);
    setExplanation(null);
  };

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<Brain size={22} />}
        title="No questions yet"
        desc="Regenerate the kit from the kit page to create Smart Study questions."
        action={
          <Link href={`/kits/${data.kit.id}`}>
            <Button>
              <RefreshCw size={15} /> Go to kit
            </Button>
          </Link>
        }
      />
    );
  }

  if (finished) {
    const pct = questions.length ? (correct / questions.length) * 100 : 0;
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center py-12 text-center">
          <ScoreRing pct={pct} size={150} label="mastery" />
          <h3 className="font-display mt-5 text-xl font-bold text-ink dark:text-cream">
            {pct >= 80 ? "Amazing recall!" : pct >= 50 ? "Solid session!" : "Great practice — keep going!"}
          </h3>
          <p className="mt-2 text-sm text-ink/60 dark:text-cream/60">
            You answered {correct} of {questions.length} correctly. Missed questions are listed below —
            try the “Learn more” explanations next round.
          </p>
          {missed.length > 0 && (
            <div className="mt-5 w-full space-y-2 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">Review these</p>
              {missed.map((m, i) => (
                <div key={i} className="rounded-2xl bg-ink/4 p-3.5 text-[13px] font-medium text-ink/75 dark:bg-cream/5 dark:text-cream/75">
                  <span className="font-bold">{m.question}</span>
                  <span className="mt-1 flex items-center gap-1 text-brand-700 dark:text-brand-400">
                    <Check size={12} /> {m.answer}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <Button onClick={restart}>
              <RotateCcw size={15} /> Study again
            </Button>
            <Link href={`/kits/${data.kit.id}/study-guide`}>
              <Button variant="outline">
                <BookOpen size={15} /> Read study guide
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const canShow = revealed || graded;
  const mcqCorrect = q.type === "mcq" && input === q.answer;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-bold text-ink dark:text-cream">
          Question {idx + 1} <span className="font-medium text-ink/45 dark:text-cream/45">of {questions.length}</span>
        </p>
        <Badge tone="violet">{questionTypeLabel(q.type)}</Badge>
      </div>
      <ProgressBar value={idx} max={questions.length} className="mb-6" tone="violet" />

      <Card className="p-6 sm:p-8">
        <h2 className="mb-6 text-lg font-bold leading-relaxed text-ink dark:text-cream">{q.question}</h2>

        {q.type === "mcq" && q.options && (
          <div className="grid gap-2.5">
            {q.options.map((opt) => {
              const selected = input === opt;
              const isCorrect = canShow && opt === q.answer;
              const isWrong = canShow && selected && opt !== q.answer;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (graded) return;
                    setInput(opt);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                    isCorrect
                      ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                      : isWrong
                        ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : selected
                          ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                          : "border-ink/12 bg-surface hover:border-ink/30 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40"
                  )}
                >
                  {opt}
                  {isCorrect && <Check size={16} />}
                  {isWrong && <X size={16} />}
                </button>
              );
            })}
          </div>
        )}

        {(q.type === "true_false" || q.type === "modified_true_false") && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              {["True", "False"].map((opt) => {
                const selected = input === opt;
                const isCorrect = canShow && opt === q.answer;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (graded) return;
                      setInput(opt);
                    }}
                    className={cn(
                      "rounded-2xl border-2 py-4 text-base font-bold transition",
                      isCorrect
                        ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                        : selected
                          ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                          : "border-ink/12 bg-surface hover:border-brand-400 dark:border-cream/15 dark:bg-surface-dark"
                    )}
                  >
                    {opt === "True" ? "▲ True" : "▼ False"}
                  </button>
                );
              })}
            </div>
            {canShow && q.type === "modified_true_false" && q.answer === "False" && q.options?.[0] && (
              <p className="mt-3 rounded-xl bg-ink/4 p-3 text-sm font-semibold text-ink/80 dark:bg-cream/5 dark:text-cream/80">
                Correct statement: {q.options[0]}
              </p>
            )}
          </div>
        )}

        {(q.type === "short" || q.type === "identification" || q.type === "essay") && (
          <Textarea
            rows={q.type === "essay" ? 6 : 3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={graded}
            placeholder={
              q.type === "identification"
                ? "Type the exact term, then check…"
                : q.type === "essay"
                  ? "Write your answer in a few sentences…"
                  : "Answer in your own words, then check…"
            }
            className={cn(
              graded &&
                (gradeAnswer(q, input)
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200")
            )}
          />
        )}

        {q.type === "fill_blank" && (
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={graded}
            placeholder="Type the missing word or phrase…"
            className={cn(
              graded &&
                (gradeAnswer(q, input)
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300")
            )}
          />
        )}

        {q.type === "enumeration" && (
          <div>
            <Textarea
              rows={Math.max(3, Math.min(8, enumerationItems(q).length + 1))}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={graded}
              placeholder="List each item — one per line, or separated by commas…"
            />
            {canShow && (
              <div className="mt-3 flex flex-wrap gap-2">
                {enumerationItems(q).map((it) => {
                  const hit = normAnswer(input).includes(normAnswer(it));
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
        )}

        {q.type === "multiple_response" && (
          <div className="grid gap-2.5">
            {q.options?.map((opt) => {
              const chosen = splitList(input);
              const selected = chosen.includes(opt);
              const correct = multiResponseCorrect(q).map(normAnswer);
              const isCorrect = canShow && correct.includes(normAnswer(opt));
              const wrongPick = canShow && selected && !correct.includes(normAnswer(opt));
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (graded) return;
                    setInput(encodeList(selected ? chosen.filter((c) => c !== opt) : [...chosen, opt]));
                  }}
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
        )}

        {q.type === "ordering" && (() => {
          const items = orderingItems(q);
          const chosen = splitList(input);
          const remaining = items.filter((it) => !chosen.some((c) => normAnswer(c) === normAnswer(it)));
          return (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-cream/45">
                {canShow ? "Your order" : "Tap the items in the correct order"}
              </p>
              <div className="grid gap-2">
                {chosen.map((it, i) => (
                  <div
                    key={`${it}-${i}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold",
                      canShow
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
                    {!graded && (
                      <button
                        onClick={() => setInput(encodeList(chosen.filter((_, j) => j !== i)))}
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
              {!canShow && remaining.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {remaining.map((it) => (
                    <button
                      key={it}
                      onClick={() => setInput(encodeList([...chosen, it]))}
                      className="rounded-full border border-ink/15 bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink transition hover:border-brand-500 dark:border-cream/20 dark:bg-surface-dark dark:text-cream"
                    >
                      + {it}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {q.type === "matching" && (          <SmartMatchInput key={q.id} q={q} value={input} onChange={setInput} reveal={canShow} />
        )}

        {canShow && (
          <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm leading-relaxed text-green-900 dark:bg-green-500/10 dark:text-green-300 animate-pop">
            <span className="mb-1 flex items-center gap-1.5 font-bold">
              <Check size={14} /> Correct answer
            </span>
            {q.type === "matching" ? (
              <ul className="mt-1 space-y-0.5">
                {parseMatchPairs(q.options).map((p) => (
                  <li key={p.term}>
                    <span className="font-semibold">{p.term}</span> → {p.meaning}
                  </li>
                ))}
              </ul>
            ) : q.type === "multiple_response" ? (
              multiResponseCorrect(q).join(", ")
            ) : q.type === "ordering" ? (
              orderingItems(q).join(" → ")
            ) : q.type === "modified_true_false" ? (
              q.answer === "False" && q.options?.[0] ? `False — ${q.options[0]}` : "True"
            ) : (
              q.answer
            )}
            {q.explanation && (
              <span className="mt-2 block border-t border-green-200/70 pt-2 text-green-800/80 dark:border-green-500/20 dark:text-green-300/80">
                {q.explanation}
              </span>
            )}
          </div>
        )}

        {!graded ? (
          <div className="mt-6 flex items-center gap-2.5">
            <Button onClick={() => setRevealed(true)} disabled={!input.trim()} className="flex-1">
              Show answer
            </Button>
            {revealed && (
              <Button variant="dark" onClick={learnMore} disabled={learning} className="flex-1">
                {learning ? <Spinner className="h-4 w-4 border-cream/30 border-t-cream" /> : <Lightbulb size={15} />} Learn more
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-6 text-center text-sm font-bold text-ink/55 dark:text-cream/55">Loading next question…</p>
        )}

        {revealed && !graded && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 animate-pop">
            <Button variant="soft" onClick={() => grade(false)}>
              <X size={15} /> I missed it
            </Button>
            <Button onClick={() => grade(true)}>
              <Check size={15} /> I got it
            </Button>
          </div>
        )}
      </Card>

      {explanation && (
        <Card className="mt-4 border-violet-200 dark:border-violet-500/30">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
            <Sparkles size={13} /> Deeper explanation
          </p>
          <RichText text={explanation} />
        </Card>
      )}

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" disabled={idx === 0} onClick={() => { setIdx((i) => i - 1); setInput(""); setRevealed(false); setGraded(false); setExplanation(null); }}>
          <ChevronLeft size={16} /> Previous
        </Button>
        {!graded && (
          <Button variant="ghost" onClick={advance}>
            Skip <ChevronRight size={16} />
          </Button>
        )}
      </div>

      <Modal open={intro} onClose={() => setIntro(false)}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500 text-white">
          <Brain size={24} />
        </span>
        <h3 className="font-display mt-4 text-xl font-bold text-ink dark:text-cream">Welcome to Smart Study</h3>
        <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink/70 dark:text-cream/70">
          <p>1. Try to <strong>answer first</strong> — thinking is where the learning happens.</p>
          <p>2. Click <strong>Show answer</strong> to see the correct answer and explanation.</p>
          <p>3. Be honest with <strong>I got it / I missed it</strong> — missed questions get extra attention.</p>
          <p>4. Use <strong>Learn more</strong> anytime for a deeper, AI-written explanation.</p>
        </div>
        <Button className="mt-6 w-full" onClick={() => setIntro(false)}>Okay, let&apos;s study</Button>
      </Modal>
    </div>
  );
}

/* ============================ STUDY GUIDE ============================ */

function StudyGuideTool({
  data,
  onChanged,
  shareLink,
}: {
  data: KitData;
  onChanged: () => void;
  shareLink: string;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"exact" | "notes" | "ai">("exact");
  const [busy, setBusy] = useState(false);
  const { kit } = data;
  const summaryTerms = useMemo(
    () => (kit.summary?.keyTerms ?? []).map((k) => k.term).filter(Boolean),
    [kit.summary]
  );

  // Term → definition pulled straight from the source text, so a highlighted
  // term's MEANING can light up in the exact text too (a softer amber band
  // under the brand-marked keyword). Source definitions match verbatim, so this
  // is reliable in the "Exact text" view.
  const defByTerm = useMemo(() => {
    const m = new Map<string, string>();
    for (const { term, definition } of extractTerms(kit.content)) {
      const k = term.trim().toLowerCase();
      if (k && definition && definition.length > 12 && !m.has(k)) m.set(k, definition);
    }
    return m;
  }, [kit.content]);

  // Editable highlight terms: start from the AI summary, user can add/remove/
  // refresh at any time. Exact text never changes — only what glows.
  const [highlights, setHighlights] = useState<string[]>(summaryTerms);
  const [newTerm, setNewTerm] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [focusOnly, setFocusOnly] = useState(false);
  const [hlBusy, setHlBusy] = useState(false);
  useEffect(() => {
    setHighlights(summaryTerms);
  }, [kit.id, summaryTerms.join("|")]);

  const refreshHighlights = async () => {
    // AI first (uses your API key when configured): the word AND its
    // definition light up because matches apply to the whole passage.
    setHlBusy(true);
    try {
      const res = await suggestGuideTermsAction(kit.id);
      if (res.ok && res.terms?.length) {
        setHighlights(res.terms);
        toast(`Highlights refreshed — ${res.terms.length} key terms ${res.ai ? " (AI)" : ""}`);
        return;
      }
      const fresh = keyTerms(kit.content, 12).map((k) => k.term).filter(Boolean);
      if (!fresh.length) {
        toast(res.error ?? "No clear terms found — add your own below.", "error");
        return;
      }
      setHighlights(fresh);
      toast(`Highlights refreshed — ${fresh.length} key terms `);
    } finally {
      setHlBusy(false);
    }
  };

  const cleanHighlights = () => {
    const cleaned = highlights.filter((h) => {
      const t = h.trim();
      if (t.length < 4) return false;
      // Drop vague single-word topic labels; keep real concepts.
      if (!t.includes(" ") && /^(topics?|lessons?|chapters?|reviewers?|overviews?|introductions?|summar(y|ies)|notes?|examples?|advantages?|disadvantages|types?|kinds?|parts?|steps?)$/i.test(t)) return false;
      return true;
    });
    const removed = highlights.length - cleaned.length;
    setHighlights(cleaned);
    toast(removed > 0 ? `Removed ${removed} vague term${removed === 1 ? "" : "s"} ` : "Highlights already look clean ");
  };

  const addTerm = () => {
    const t = newTerm.trim();
    if (t.length < 3) return;
    if (highlights.some((h) => h.toLowerCase() === t.toLowerCase())) {
      setNewTerm("");
      return;
    }
    setHighlights((h) => [...h, t]);
    setNewTerm("");
  };

  // Active-recall view: only sentences that contain a highlighted term.
  const focusText = useMemo(() => {
    if (!focusOnly || !highlights.length) return null;
    const lower = highlights.map((h) => h.toLowerCase());
    const hits = splitSentences(kit.content).filter((s) => {
      const sl = s.toLowerCase();
      return lower.some((h) => h.length > 2 && sl.includes(h));
    });
    return hits.length ? hits.join("\n") : null;
  }, [focusOnly, highlights, kit.content]);

  // Definitions of the terms the user is currently highlighting — these get the
  // softer "definition" band in the exact text so keyword AND meaning stand out.
  const defHighlights = useMemo(
    () =>
      highlights
        .map((h) => defByTerm.get(h.trim().toLowerCase()))
        .filter((d): d is string => Boolean(d)),
    [highlights, defByTerm]
  );

  const regenerate = async () => {
    setBusy(true);
    if (mode === "notes") {
      const res = await regenerateNotesAction(kit.id);
      toast(res.ok ? "Notes regenerated " : "Could not regenerate", res.ok ? "success" : "error");
    } else {
      const res = await regenerateKitAction(kit.id);
      toast(res.ok ? "Study tools regenerated " : "Could not regenerate", res.ok ? "success" : "error");
    }
    setBusy(false);
    onChanged();
  };

  const cleanFormatting = async () => {
    setBusy(true);
    try {
      const res = await cleanupExactTextAction(kit.id);
      if (res.ok) {
        toast(res.ai ? "Formatting fixed — every word kept  (AI)" : "Spacing cleaned up ");
        onChanged();
      } else {
        toast(res.error ?? "Could not clean formatting", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const guideText = () => {
    if (mode === "exact") return focusText ?? kit.content;
    if (mode === "notes") {
      const sections = kit.notes?.sections ?? [];
      if (!sections.length) return "";
      return sections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n");
    }
    const parts = [
      `# ${kit.title} — AI summary`,
      kit.summary?.overview ?? "",
      ...((kit.summary?.bullets ?? []).map((b) => `• ${b}`)),
      ...((kit.summary?.keyTerms ?? []).map((k) => `${k.term}: ${k.meaning}`)),
    ].filter(Boolean);
    return parts.join("\n\n");
  };

  const downloadTxt = () => {
    const text = guideText();
    if (!text.trim()) {
      toast("Nothing to download yet.", "error");
      return;
    }
    const blob = new Blob([`${kit.title}\n${mode === "exact" ? "Exact text" : mode === "notes" ? "Study notes" : "AI summary"} · tawi.study\n\n${text}`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kit.title.slice(0, 60).replace(/[^\w\- ]+/g, "") || "study-guide"}-${mode}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Downloaded — open it anywhere, or Print / PDF it ");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 no-print">
        <Tabs
          tabs={[
            { id: "exact", label: "Exact text" },
            { id: "notes", label: "Study notes" },
            { id: "ai", label: "AI summary" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "exact" | "notes" | "ai")}
        />
        <div className="flex items-center gap-2">
          {!kit.aiEnabled && (
            <span className="hidden text-xs font-semibold text-ink/45 sm:block dark:text-cream/45">
              Built-in engine active
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> Print / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTxt}>
            <Download size={14} /> Download
          </Button>
          {mode === "exact" && (
            <Button variant="outline" size="sm" onClick={cleanFormatting} disabled={busy} title="AI fixes spacing, blank lines and bullet layout — keeps every word">
              {busy ? <Spinner className="h-4 w-4" /> : <Sparkles size={14} />} Clean formatting
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw size={14} />} Regenerate
          </Button>
        </div>
      </div>

      <div className="print-area">
      <div className="mb-4 hidden print:block">
        <h1 className="text-2xl font-bold">{kit.title}</h1>
        <p className="text-sm text-gray-600">
          {mode === "exact" ? "Exact text" : mode === "notes" ? "Study notes" : "AI summary"} · tawi.study
        </p>
      </div>

      {mode === "exact" && (
        <>
          <Card className="mb-3 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setShowTerms((s) => !s)}
                className="text-sm font-bold text-ink hover:underline dark:text-cream"
              >
                {showTerms ? "Hide" : "Edit"} highlight terms ({highlights.length})
              </button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refreshHighlights} disabled={hlBusy}>
                  {hlBusy ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw size={13} />} Refresh highlights
                </Button>
                <Button variant="outline" size="sm" onClick={cleanHighlights} disabled={!highlights.length}>
                  <Eraser size={13} /> Clean up
                </Button>
                <Button
                  variant={focusOnly ? "dark" : "outline"}
                  size="sm"
                  onClick={() => setFocusOnly((f) => !f)}
                  title="Show only sentences containing highlighted terms — read, recall, reveal"
                >
                  {focusOnly ? <EyeOff size={13} /> : <Eye size={13} />} {focusOnly ? "Full text" : "Active recall"}
                </Button>
              </div>
            </div>
            {showTerms && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {highlights.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-ink dark:bg-brand-500/15 dark:text-brand-300"
                    >
                      {h}
                      <button
                        onClick={() => setHighlights((list) => list.filter((x) => x !== h))}
                        className="rounded-full p-0.5 hover:bg-ink/10 dark:hover:bg-cream/15"
                        aria-label={`Remove ${h}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {highlights.length === 0 && (
                    <span className="text-xs text-ink/50 dark:text-cream/50">No highlights — add terms below.</span>
                  )}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <Input
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTerm()}
                    placeholder="Add a term to highlight, e.g. Chloroplast"
                  />
                  <Button size="sm" onClick={addTerm} disabled={newTerm.trim().length < 3}>
                    <Plus size={13} /> Add
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <Card className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible print:shadow-none">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">
                Your material, word for word — key terms highlighted
                {focusOnly ? " · active-recall view" : ""}
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink/45 dark:text-cream/45">
                <span className="inline-block h-3 w-3 rounded bg-brand-200 dark:bg-brand-500/30" /> term
                {defHighlights.length > 0 && (
                  <>
                    <span className="ml-1.5 inline-block h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-400/50 dark:bg-amber-400/20" /> definition
                  </>
                )}
              </span>
            </div>
            {focusText !== null && !focusText ? (
              <p className="text-sm text-ink/60 dark:text-cream/60">
                No sentences match your highlight terms — add terms above or switch back to full text.
              </p>
            ) : (
              <RichText text={focusText ?? kit.content} highlights={highlights} defs={defHighlights} />
            )}
          </Card>
        </>
      )}

      {mode === "notes" && (
        <div className="space-y-4">
          {kit.notes?.sections?.length ? (
            kit.notes.sections.map((s, i) => (
              <Card key={i}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-500 text-[12px] font-bold text-ink">
                      {i + 1}
                    </span>
                    {s.heading}
                  </h3>
                  <CopyButton text={`## ${s.heading}\n${s.content}`} label="Copy" size="sm" />
                </div>
                <RichText text={s.content} />
              </Card>
            ))
          ) : (
            <EmptyState
              icon={<NotebookPen size={22} />}
              title="No study notes yet"
              desc="Click Regenerate to format your material into clean, structured study notes."
              action={
                <Button onClick={regenerate} disabled={busy}>
                  <Sparkles size={15} /> Generate notes
                </Button>
              }
            />
          )}
        </div>
      )}

      {mode === "ai" && (
        <div className="space-y-4">
          <Card className="border-brand-500/40">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink dark:text-cream">
              <Sparkles size={15} className="text-brand-700 dark:text-brand-400" /> Overview
            </p>
            <p className="text-[15px] leading-relaxed text-ink/80 dark:text-cream/80">
              {kit.summary?.overview ?? "No overview yet — click Regenerate."}
            </p>
          </Card>
          <Card>
            <p className="mb-4 text-sm font-bold text-ink dark:text-cream">Summary bullets</p>
            <div className="space-y-2.5">
              {(kit.summary?.bullets ?? []).map((b, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <p className="text-[14.5px] leading-relaxed text-ink/80 dark:text-cream/80">{b}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <p className="mb-4 text-sm font-bold text-ink dark:text-cream">Key terms</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(kit.summary?.keyTerms ?? []).map((k) => (
                <div key={k.term} className="rounded-2xl bg-brand-50 p-3.5 dark:bg-brand-500/10">
                  <p className="text-[13.5px] font-bold text-ink dark:text-brand-300">{k.term}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink/65 dark:text-cream/65">{k.meaning}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink/4 p-4 no-print dark:bg-cream/5">
        <p className="text-sm font-semibold text-ink/60 dark:text-cream/60">
          Sharing this guide shares {kit.title} with your friends.
        </p>
        <CopyButton text={shareLink} label="Share this guide" />
      </div>
      </div>
    </div>
  );
}
