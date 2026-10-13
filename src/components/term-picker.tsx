"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Check, Highlighter, Plus, Sparkles, X } from "lucide-react";
import { extractTerms, keyTerms, splitSentences } from "@/lib/text";
import { Button, Card, cn, Input } from "@/components/ui";

/** A term the student has confirmed should become a flashcard. The definition
 *  is kept as EXACT source text wherever we can find it. */
export interface PickedTerm {
  term: string;
  definition: string;
}

interface Candidate {
  term: string;
  definition: string;
  bold: boolean; // emphasised in the source → a strong "this is a key term" hint
}

/** Remove the bold/italic/heading/bullet markdown the PDF extractor injects, so
 *  what the student reads and selects is clean text. */
function stripMd(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[-•]\s+/gm, "")
    .trim();
}

const clean = (s: string) => stripMd(s).replace(/\s+/g, " ").trim();

/** Phrases the source emphasised with **bold** — the clearest signal that a word
 *  is a key term. */
function boldPhrases(text: string): string[] {
  const out: string[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = clean(m[1]);
    const words = t.split(" ").length;
    if (t.length >= 2 && t.length <= 60 && words <= 6 && /[a-zA-Z]/.test(t)) out.push(t);
  }
  return out;
}

/** First source sentence that mentions a term — used as the exact-text
 *  definition for terms the student typed or highlighted themselves. */
function firstSentenceWith(sentences: string[], term: string): string {
  const t = term.toLowerCase();
  const hit = sentences.find((s) => s.toLowerCase().includes(t));
  return hit ? clean(hit) : "";
}

const keyOf = (s: string) => clean(s).toLowerCase();
const preview = (s: string, n = 120) =>
  s.length > n ? s.slice(0, s.lastIndexOf(" ", n) > 40 ? s.lastIndexOf(" ", n) : n).trim() + "…" : s;

export function TermPicker({
  sourceText,
  onChange,
}: {
  sourceText: string;
  onChange: (terms: PickedTerm[]) => void;
}) {
  const plain = useMemo(() => clean(sourceText).slice(0, 20000), [sourceText]);
  const sentences = useMemo(() => splitSentences(sourceText), [sourceText]);

  // Auto-detected candidates: bold phrases first (pre-checked), then defined
  // term→definition pairs, then frequency-based suggestions (unchecked).
  const candidates = useMemo<Candidate[]>(() => {
    const map = new Map<string, Candidate>();
    const defs = new Map<string, string>();
    try {
      for (const { term, definition } of extractTerms(sourceText)) {
        const k = keyOf(term);
        if (k && definition && !defs.has(k)) defs.set(k, clean(definition));
      }
    } catch {
      /* extraction is best-effort */
    }

    for (const b of boldPhrases(sourceText)) {
      const k = keyOf(b);
      if (!k || map.has(k)) continue;
      map.set(k, { term: b, definition: defs.get(k) ?? firstSentenceWith(sentences, b), bold: true });
    }
    for (const [k, definition] of defs) {
      if (map.has(k)) continue;
      map.set(k, { term: k.replace(/\b\w/g, (c) => c.toUpperCase()), definition, bold: false });
    }
    try {
      for (const { term } of keyTerms(sourceText, 24)) {
        const k = keyOf(term);
        if (!k || map.has(k)) continue;
        map.set(k, { term, definition: defs.get(k) ?? firstSentenceWith(sentences, term), bold: false });
      }
    } catch {
      /* frequency terms are a nicety */
    }
    // Bold first, then defined, then the rest — capped so the list stays usable.
    return [...map.values()]
      .sort((a, b) => Number(b.bold) - Number(a.bold) || b.definition.length - a.definition.length)
      .slice(0, 40);
  }, [sourceText, sentences]);

  // Selected keys: bold terms and clearly-defined terms are pre-checked.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Candidate[]>([]); // typed or highlighted by the student
  const [manual, setManual] = useState("");
  const [selText, setSelText] = useState("");

  useEffect(() => {
    const init = new Set<string>();
    for (const c of candidates) if (c.bold || c.definition.length > 12) init.add(keyOf(c.term));
    setSelected(init);
    setAdded([]);
  }, [candidates]);

  const all = useMemo(() => {
    const map = new Map<string, Candidate>();
    for (const c of candidates) map.set(keyOf(c.term), c);
    for (const c of added) map.set(keyOf(c.term), c); // user additions win
    return [...map.values()];
  }, [candidates, added]);

  // Report the confirmed terms upward whenever the selection changes.
  useEffect(() => {
    const picked: PickedTerm[] = all
      .filter((c) => selected.has(keyOf(c.term)))
      .map((c) => ({ term: c.term, definition: c.definition }));
    onChange(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, selected]);

  const toggle = (term: string) => {
    const k = keyOf(term);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const addTerm = (raw: string) => {
    const term = clean(raw);
    if (term.length < 2) return;
    const k = keyOf(term);
    if (!all.some((c) => keyOf(c.term) === k)) {
      setAdded((a) => [...a, { term, definition: firstSentenceWith(sentences, term), bold: false }]);
    }
    setSelected((s) => new Set(s).add(k));
  };

  const selectedCount = selected.size;

  const selectAll = () => setSelected(new Set(all.map((c) => keyOf(c.term))));
  const selectKeyTerms = () => {
    const s = new Set<string>();
    for (const c of all) if (c.bold || c.definition.length > 12) s.add(keyOf(c.term));
    setSelected(s);
  };
  const clearAll = () => setSelected(new Set());

  return (
    <Card className="mt-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-500 text-ink">
          <Bot size={17} />
        </span>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-ink/4 p-3.5 dark:bg-cream/5">
          <p className="text-sm font-semibold text-ink dark:text-cream">
            I read your material and found <strong>{all.length}</strong> key term
            {all.length === 1 ? "" : "s"}
            {all.length > 0 && (
              <>
                {" "}
                — <strong>{selectedCount}</strong> selected for flashcards
              </>
            )}
            .
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink/55 dark:text-cream/55">
            {all.length === 0
              ? "Add your own terms below, or paste a little more material."
              : "Are these okay? Bold words in your file are the strongest signals. Use them all, or keep only the strongest (bold + clearly defined)."}
          </p>
          {all.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                onClick={selectAll}
                className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-ink transition hover:bg-brand-400"
              >
                Use all {all.length}
              </button>
              <button
                onClick={selectKeyTerms}
                className="rounded-full border border-ink/15 px-3 py-1 text-xs font-bold text-ink transition hover:border-brand-500 dark:border-cream/20 dark:text-cream"
              >
                Key terms only
              </button>
              <button
                onClick={clearAll}
                className="rounded-full border border-ink/15 px-3 py-1 text-xs font-bold text-ink/60 transition hover:border-ink/30 dark:border-cream/20 dark:text-cream/60"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink dark:text-cream">Detected terms</h3>
        <span className="text-xs font-bold text-brand-700 dark:text-brand-400">
          {selectedCount} selected
        </span>
      </div>

      {/* Candidate checkboxes */}
      <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
        {all.length === 0 && (
          <p className="py-6 text-center text-sm text-ink/50 dark:text-cream/50">
            No terms detected yet — add your own below.
          </p>
        )}
        {all.map((c) => {
          const k = keyOf(c.term);
          const on = selected.has(k);
          return (
            <button
              key={k}
              onClick={() => toggle(c.term)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition",
                on
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-ink/10 bg-surface hover:border-ink/25 dark:border-cream/12 dark:bg-surface-dark dark:hover:border-cream/30"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border-2 transition",
                  on
                    ? "border-brand-500 bg-brand-500 text-ink"
                    : "border-ink/25 bg-transparent dark:border-cream/30"
                )}
              >
                {on && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-ink dark:text-cream">{c.term}</span>
                  {c.bold && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      bold in source
                    </span>
                  )}
                </span>
                {c.definition && (
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink/55 dark:text-cream/55">
                    {preview(c.definition)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add by typing */}
      <div className="mt-4 flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addTerm(manual);
              setManual("");
            }
          }}
          placeholder="Type a term to add, e.g. Photosynthesis"
        />
        <Button
          size="sm"
          onClick={() => {
            addTerm(manual);
            setManual("");
          }}
          disabled={clean(manual).length < 2}
        >
          <Plus size={14} /> Add
        </Button>
      </div>

      {/* Add by highlighting the exact text */}
      <div className="mt-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink/80 dark:text-cream/80">
          <Highlighter size={14} /> Or highlight a term in your material
        </p>
        <div
          onMouseUp={() => {
            const t = clean(window.getSelection?.()?.toString() ?? "");
            if (t.length >= 2 && t.length <= 80) setSelText(t);
          }}
          className="max-h-44 overflow-auto rounded-2xl border border-ink/10 bg-ink/3 p-3 text-[13px] leading-relaxed text-ink/75 selection:bg-brand-300/60 dark:border-cream/12 dark:bg-cream/5 dark:text-cream/75"
        >
          {plain || "Add some material first."}
        </div>
        {selText && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-500/10">
            <span className="min-w-0 truncate text-[13px] font-semibold text-ink dark:text-cream">
              Selected: “{selText}”
            </span>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                onClick={() => {
                  addTerm(selText);
                  setSelText("");
                }}
              >
                <Sparkles size={13} /> Add as term
              </Button>
              <button
                onClick={() => setSelText("")}
                className="rounded-full p-1.5 text-ink/45 hover:bg-ink/10 dark:text-cream/45 dark:hover:bg-cream/10"
                aria-label="Dismiss selection"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
