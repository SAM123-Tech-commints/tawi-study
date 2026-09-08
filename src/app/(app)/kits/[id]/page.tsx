"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Copy,
  Gamepad2,
  Layers,
  MessageCircleQuestion,
  NotebookPen,
  Pencil,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  copyKitAction,
  deleteKitAction,
  getKitData,
  regenerateKitAction,
  updateKitTitleAction,
} from "@/lib/actions";
import {
  Badge,
  Button,
  Card,
  cn,
  CopyButton,
  formatDate,
  Input,
  Modal,
  Spinner,
  useToast,
} from "@/components/ui";
import { formatInterval } from "@/lib/srs";

type KitData = NonNullable<Awaited<ReturnType<typeof getKitData>>>;

const TOOLS = [
  { id: "flashcards", name: "Flashcards", icon: Layers, desc: "Flip, rate & space out your reviews", tint: "bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300" },
  { id: "smart-study", name: "Smart Study", icon: Brain, desc: "Answer questions, get taught the answers", tint: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { id: "study-guide", name: "Study guide", icon: NotebookPen, desc: "Exact text, study notes & AI summary", tint: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  { id: "games", name: "Games", icon: Gamepad2, desc: "5 memory games from your cards", tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
];

export default function KitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<KitData | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"summary" | "cards" | "questions">("summary");

  const load = useCallback(async () => {
    const d = await getKitData(id);
    setData(d);
    if (d) setTitle(d.kit.title);
    else router.push("/kits");
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

  const { kit, cards, questions } = data;
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}${data.shareUrl}` : data.shareUrl;

  const saveTitle = async () => {
    await updateKitTitleAction({ kitId: kit.id, title });
    setEditing(false);
    toast("Title updated");
    load();
  };

  const regenerate = async () => {
    setRegenerating(true);
    const res = await regenerateKitAction(kit.id);
    setRegenerating(false);
    if (res.ok) {
      toast("Study kit regenerated with fresh content ✨");
      load();
    } else {
      toast(res.error ?? "Could not regenerate", "error");
    }
  };

  const copy = async () => {
    const res = await copyKitAction(kit.id);
    if (res.ok && res.id) {
      toast("Copy created");
      router.push(`/kits/${res.id}`);
    }
  };

  const remove = async () => {
    await deleteKitAction(kit.id);
    toast("Study kit deleted");
    router.push("/kits");
  };

  return (
    <div>
      <Link href="/kits" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream">
        <ArrowLeft size={15} /> Study kits
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md text-lg font-bold" autoFocus />
              <Button size="sm" onClick={saveTitle}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setTitle(kit.title); setEditing(false); }}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <h1 className="font-display truncate text-3xl font-bold tracking-tight text-ink dark:text-cream">{kit.title}</h1>
              <button onClick={() => setEditing(true)} className="rounded-full p-2 text-ink/40 hover:bg-ink/5 hover:text-ink dark:text-cream/40 dark:hover:bg-cream/10 dark:hover:text-cream" aria-label="Rename">
                <Pencil size={15} />
              </button>
            </div>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/55 dark:text-cream/55">
            <Badge tone={kit.aiEnabled ? "violet" : "neutral"}>
              <Sparkles size={11} /> {kit.aiEnabled ? "AI-generated" : "Built-in engine"}
            </Badge>
            {kit.sourceName && <span>📄 {kit.sourceName}</span>}
            <span>· {formatDate(kit.createdAt)}</span>
            <span>· {cards.length} cards · {questions.length} questions</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={shareLink} label="Share kit" />
          <Button variant="outline" onClick={copy}>
            <Copy size={15} /> Create a copy
          </Button>
          <Button variant="outline" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Spinner className="h-4 w-4" /> : <RefreshCw size={15} />} Regenerate
          </Button>
          <Button variant="ghost" className="text-red-500" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {/* Tools */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((t) => (
          <Link
            key={t.id}
            href={`/kits/${kit.id}/${t.id}`}
            className="group rounded-3xl border border-ink/8 bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg dark:border-cream/10 dark:bg-surface-dark"
          >
            <span className={cn("mb-4 grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-110", t.tint)}>
              <t.icon size={21} />
            </span>
            <p className="flex items-center justify-between text-[16px] font-bold text-ink dark:text-cream">
              {t.name}
              <ArrowRight size={15} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/55 dark:text-cream/55">{t.desc}</p>
            <p className="mt-2 text-xs font-bold text-brand-700 dark:text-brand-400">
              {t.id === "flashcards" && `${cards.length} cards${data.dueCount ? ` · ${data.dueCount} due` : ""}`}
              {t.id === "smart-study" && `${questions.length} questions`}
              {t.id === "study-guide" && "Exact text + AI summary"}
              {t.id === "games" && "5 games"}
            </p>
          </Link>
        ))}
      </div>

      {/* Previews */}
      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["summary", "Summary"],
              ["cards", "Flashcards"],
              ["questions", "Questions"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-bold transition",
                tab === t ? "bg-ink text-cream dark:bg-cream dark:text-ink" : "bg-ink/5 text-ink/60 hover:bg-ink/10 dark:bg-cream/10 dark:text-cream/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <Card>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink dark:text-cream">
              <BookOpen size={15} /> Overview
            </p>
            <p className="text-[15px] leading-relaxed text-ink/80 dark:text-cream/80">
              {kit.summary?.overview ?? "No summary yet — click Regenerate to create one."}
            </p>
            {kit.summary?.keyTerms && kit.summary.keyTerms.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-sm font-bold text-ink dark:text-cream">Key terms</p>
                <div className="flex flex-wrap gap-2">
                  {kit.summary.keyTerms.map((k) => (
                    <span key={k.term} className="rounded-full bg-brand-100 px-3 py-1 text-[13px] font-semibold text-ink dark:bg-brand-500/15 dark:text-brand-300">
                      {k.term}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {tab === "cards" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.slice(0, 9).map((c) => {
              const p = data.progress[c.id];
              return (
                <Card key={c.id} className="p-4">
                  <p className="text-[14px] font-bold text-ink dark:text-cream">{c.term}</p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink/55 dark:text-cream/55">{c.definition}</p>
                  {p && p.reps > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-brand-700 dark:text-brand-400">
                      Reviewed {p.reps}× · next in {formatInterval(p.interval)}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {tab === "questions" && (
          <div className="space-y-3">
            {questions.slice(0, 6).map((q, i) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-cream dark:bg-cream dark:text-ink">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold leading-relaxed text-ink dark:text-cream">{q.question}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True / False" : "Short answer"}</Badge>
                      <span className="text-[12px] font-medium text-ink/50 dark:text-cream/50">
                        Answer: {q.answer}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h3 className="font-display text-lg font-bold text-ink dark:text-cream">Delete this study kit?</h3>
        <p className="mt-2 text-sm text-ink/60 dark:text-cream/60">
          “{kit.title}” and all of its {cards.length} flashcards and {questions.length} questions will be removed forever.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={remove}>Delete kit</Button>
        </div>
      </Modal>
    </div>
  );
}
