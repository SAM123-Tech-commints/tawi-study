"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Layers,
  NotebookPen,
  Sparkles,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  ProgressBar,
  RichText,
  Tabs,
} from "@/components/ui";
import type { CardRow, Kit, KitQuestionRow } from "@/db/schema";

interface PublicData {
  kit: Kit;
  cards: CardRow[];
  questions: KitQuestionRow[];
  aiEnabled: boolean;
}

export function PublicKitView({ data }: { data: PublicData }) {
  const { kit, cards, questions } = data;
  const [mode, setMode] = useState<"exact" | "notes" | "ai">("ai");
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);

  const card = cards[cardIdx];
  const q = questions[qIdx];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <Badge tone="brand" className="mb-3">
          <Sparkles size={11} /> Shared study kit
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{kit.title}</h1>
        <p className="mt-2 text-sm text-ink/55 dark:text-cream/55">
          {cards.length} flashcards · {questions.length} questions · {kit.sourceName || "uploaded material"}
        </p>
      </div>

      <div className="mb-6 flex justify-center">
        <Tabs
          tabs={[
            { id: "ai", label: "✨ AI summary" },
            { id: "exact", label: "Exact text" },
            { id: "notes", label: "Study notes" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "exact" | "notes" | "ai")}
        />
      </div>

      {mode === "ai" && (
        <Card className="border-brand-500/40">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Sparkles size={15} className="text-brand-700 dark:text-brand-400" /> Overview
          </p>
          <p className="text-[15px] leading-relaxed text-ink/80 dark:text-cream/80">
            {kit.summary?.overview ?? "No summary available."}
          </p>
          <div className="mt-5 space-y-2.5">
            {(kit.summary?.bullets ?? []).map((b, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <p className="text-[14.5px] leading-relaxed text-ink/80 dark:text-cream/80">{b}</p>
              </div>
            ))}
          </div>
          {(kit.summary?.keyTerms ?? []).length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold">Key terms</p>
              <div className="flex flex-wrap gap-2">
                {(kit.summary?.keyTerms ?? []).map((k) => (
                  <span key={k.term} className="rounded-full bg-brand-100 px-3 py-1 text-[13px] font-semibold text-ink dark:bg-brand-500/15 dark:text-brand-300">
                    {k.term}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {mode === "exact" && (
        <Card className="max-h-[60vh] overflow-auto">
          <RichText text={kit.content} />
        </Card>
      )}

      {mode === "notes" && (
        <div className="space-y-4">
          {(kit.notes?.sections ?? []).map((s, i) => (
            <Card key={i}>
              <h3 className="font-display mb-2 text-lg font-bold">{s.heading}</h3>
              <RichText text={s.content} />
            </Card>
          ))}
        </div>
      )}

      {/* flashcards preview */}
      {cards.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display mb-4 flex items-center gap-2 text-xl font-bold">
            <Layers size={19} className="text-brand-700 dark:text-brand-400" /> Try the flashcards
          </h2>
          <div className="mx-auto max-w-md">
            <ProgressBar value={cardIdx} max={cards.length} className="mb-4" tone="violet" />
            <div className="flip-scene h-[260px] cursor-pointer" onClick={() => setFlipped((f) => !f)}>
              <div className={cn("flip-inner", flipped && "flipped")}>
                <div className="flip-face flex items-center justify-center rounded-3xl border border-ink/8 bg-surface p-8 dark:border-cream/10 dark:bg-surface-dark">
                  <p className="font-display text-center text-xl font-bold">{card.term}</p>
                </div>
                <div className="flip-face flip-back flex items-center justify-center rounded-3xl border border-brand-500/50 bg-brand-50 p-8 dark:bg-brand-500/10">
                  <p className="max-h-48 overflow-auto text-center text-[16px] leading-relaxed text-ink/85 dark:text-cream/85">
                    {card.definition}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={cardIdx === 0}
                onClick={() => {
                  setCardIdx((i) => i - 1);
                  setFlipped(false);
                }}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={cardIdx >= cards.length - 1}
                onClick={() => {
                  setCardIdx((i) => i + 1);
                  setFlipped(false);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* smart study preview */}
      {q && (
        <section className="mt-10">
          <h2 className="font-display mb-4 flex items-center gap-2 text-xl font-bold">
            <Brain size={19} className="text-violet-600 dark:text-violet-300" /> Try Smart Study
          </h2>
          <Card>
            <p className="mb-4 text-lg font-bold leading-relaxed">{q.question}</p>
            {revealed ? (
              <div className="rounded-2xl bg-green-50 p-4 text-sm leading-relaxed text-green-900 animate-pop dark:bg-green-500/10 dark:text-green-300">
                <span className="font-bold">✓ {q.answer}</span>
                {q.explanation && (
                  <span className="mt-2 block border-t border-green-200/70 pt-2 text-green-800/80 dark:border-green-500/20 dark:text-green-300/80">
                    {q.explanation}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink/50 dark:text-cream/50">
                Think about your answer first — then reveal it.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {!revealed ? (
                <Button onClick={() => setRevealed(true)}>Show answer</Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="soft"
                    onClick={() => {
                      setQIdx((i) => (i + 1) % questions.length);
                      setRevealed(false);
                    }}
                  >
                    <X size={15} /> I missed it
                  </Button>
                  <Button
                    onClick={() => {
                      setAnswered((a) => a + 1);
                      setQIdx((i) => (i + 1) % questions.length);
                      setRevealed(false);
                    }}
                  >
                    <Check size={15} /> I got it
                  </Button>
                </div>
              )}
              {answered > 0 && (
                <span className="self-center text-sm font-bold text-brand-700 dark:text-brand-400">
                  {answered} answered ✓
                </span>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* CTA */}
      <section className="mt-12 rounded-[2rem] bg-ink p-8 text-center text-cream">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-ink">
          <BookOpen size={21} />
        </span>
        <h2 className="font-display mt-4 text-2xl font-bold">Want this for your own notes?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-cream/60">
          Create a free account and turn any PDF, lecture or YouTube video into flashcards, Smart
          Study and a study guide — in seconds.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-6 text-[15px] font-bold text-ink transition hover:bg-brand-400"
        >
          Create your free kit <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}
