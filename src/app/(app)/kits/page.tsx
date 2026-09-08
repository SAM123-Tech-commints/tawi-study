"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Copy, Layers, MessageCircleQuestion, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { copyKitAction, deleteKitAction, getKitsData, togglePinKitAction } from "@/lib/actions";
import { Button, cn, EmptyState, formatDate, Spinner, useToast } from "@/components/ui";

type KitsData = NonNullable<Awaited<ReturnType<typeof getKitsData>>>;

function KitsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [data, setData] = useState<KitsData | null>(null);
  const [filter, setFilter] = useState<string>(params.get("class") ?? "all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await getKitsData();
    setData(d);
    if (!d) router.push("/signin");
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (filter === "all" ? data?.kits ?? [] : (data?.kits ?? []).filter((k) => k.classId === filter)),
    [data, filter]
  );
  const pinned = useMemo(() => shown.filter((k) => (k as { pinned?: boolean }).pinned), [shown]);
  const unpinned = useMemo(() => shown.filter((k) => !(k as { pinned?: boolean }).pinned), [shown]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof unpinned> = {};
    for (const k of unpinned) {
      const key = formatDate(k.updatedAt);
      (map[key] ??= []).push(k);
    }
    return Object.entries(map);
  }, [shown]);

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const copy = async (id: string, title: string) => {
    setBusy(id);
    const res = await copyKitAction(id);
    setBusy(null);
    if (res.ok) toast(`Copy of “${title}” created`);
    load();
  };

  const remove = async (id: string, title: string) => {
    setBusy(id);
    await deleteKitAction(id);
    setBusy(null);
    toast(`“${title}” deleted`);
    load();
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    setBusy(id);
    const res = await togglePinKitAction(id);
    setBusy(null);
    if (res.ok) toast(isPinned ? "Unpinned 📌" : "Pinned to top 📌");
    else toast(res.error ?? "Could not pin", "error");
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-cream">Study kits</h1>
          <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
            {data.kits.length} kit{data.kits.length === 1 ? "" : "s"} · flashcards, Smart Study, guides & games
          </p>
        </div>
        <Link href="/kits/new">
          <Button size="lg">
            <Plus size={16} /> Create study kit
          </Button>
        </Link>
      </div>

      {data.classes.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
              filter === "all"
                ? "border-ink bg-ink text-cream dark:border-cream dark:bg-cream dark:text-ink"
                : "border-ink/12 text-ink/65 hover:border-ink/30 dark:border-cream/15 dark:text-cream/65"
            )}
          >
            All kits
          </button>
          {data.classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
                filter === c.id
                  ? "border-ink bg-ink text-cream dark:border-cream dark:bg-cream dark:text-ink"
                  : "border-ink/12 text-ink/65 hover:border-ink/30 dark:border-cream/15 dark:text-cream/65"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title="No study kits here"
          desc="Create a kit from your notes, a PDF, or a link — Tawi builds flashcards, questions and a study guide for you."
          action={
            <Link href="/kits/new">
              <Button>
                <Plus size={15} /> Create study kit
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          {pinned.length > 0 && (
            <div>
              <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">
                📌 Pinned
              </p>
              <div className="space-y-3">
                {pinned.map((k) => (
                  <div
                    key={k.id}
                    className="group flex flex-col gap-3 rounded-2xl border-2 border-brand-500/60 bg-surface p-5 transition hover:shadow-md sm:flex-row sm:items-center dark:bg-surface-dark"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300">
                      <BookOpen size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/kits/${k.id}`} className="truncate text-[15px] font-bold text-ink hover:underline dark:text-cream">
                        {k.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-ink/50 dark:text-cream/50">
                        <span className="inline-flex items-center gap-1">
                          <Layers size={12} /> {k.cardCount} cards
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircleQuestion size={12} /> {k.questionCount} questions
                        </span>
                        {k.sourceName && <span className="truncate">📄 {k.sourceName}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/kits/${k.id}`}
                        className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-ink transition hover:bg-brand-400"
                      >
                        Open
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => togglePin(k.id, true)} disabled={busy === k.id} title="Unpin">
                        <PinOff size={15} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copy(k.id, k.title)} disabled={busy === k.id} title="Create a copy">
                        <Copy size={15} />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(k.id, k.title)} disabled={busy === k.id} title="Delete">
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {grouped.map(([day, kits]) => (
            <div key={day}>
              <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">{day}</p>
              <div className="space-y-3">
                {kits.map((k) => (
                  <div
                    key={k.id}
                    className="group flex flex-col gap-3 rounded-2xl border border-ink/8 bg-surface p-5 transition hover:border-brand-500 hover:shadow-md sm:flex-row sm:items-center dark:border-cream/10 dark:bg-surface-dark"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300">
                      <BookOpen size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/kits/${k.id}`} className="truncate text-[15px] font-bold text-ink hover:underline dark:text-cream">
                        {k.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-ink/50 dark:text-cream/50">
                        <span className="inline-flex items-center gap-1">
                          <Layers size={12} /> {k.cardCount} cards
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircleQuestion size={12} /> {k.questionCount} questions
                        </span>
                        {k.sourceName && <span className="truncate">📄 {k.sourceName}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/kits/${k.id}`}
                        className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-ink transition hover:bg-brand-400"
                      >
                        Open
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => togglePin(k.id, false)} disabled={busy === k.id} title="Pin to top">
                        <Pin size={15} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copy(k.id, k.title)} disabled={busy === k.id} title="Create a copy">
                        <Copy size={15} />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(k.id, k.title)} disabled={busy === k.id} title="Delete">
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KitsPage() {
  return (
    <Suspense fallback={null}>
      <KitsInner />
    </Suspense>
  );
}
