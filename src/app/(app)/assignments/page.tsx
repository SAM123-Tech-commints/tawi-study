"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, GraduationCap, Plus, Trash2 } from "lucide-react";
import { deleteAssignmentAction, getAssignmentsData } from "@/lib/actions";
import { Badge, Button, cn, EmptyState, formatDate, formatDue, Spinner, useToast } from "@/components/ui";

type Data = NonNullable<Awaited<ReturnType<typeof getAssignmentsData>>>;

export default function AssignmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await getAssignmentsData();
    setData(d);
    if (!d) router.push("/signin");
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (filter === "all" ? data?.assignments ?? [] : (data?.assignments ?? []).filter((a) => a.classId === filter)),
    [data, filter]
  );

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const remove = async (id: string, title: string) => {
    setBusy(id);
    await deleteAssignmentAction(id);
    setBusy(null);
    toast(`“${title}” deleted`);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-cream">Assignments</h1>
          <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
            Build worksheets from your material and share them with your class.
          </p>
        </div>
        <Link href="/assignments/new">
          <Button size="lg" variant="dark">
            <GraduationCap size={16} /> Build an assignment
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
            All classes
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
          icon={<ClipboardList size={22} />}
          title="No assignments yet"
          desc="Upload your material, choose the number and type of questions, then share one link with your students."
          action={
            <Link href="/assignments/new">
              <Button variant="dark">
                <Plus size={15} /> Build your first assignment
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <div
              key={a.id}
              className="group relative rounded-3xl border border-ink/8 bg-surface p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md dark:border-cream/10 dark:bg-surface-dark"
            >
              <Link href={`/assignments/${a.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                    <ClipboardList size={19} />
                  </span>
                  <Badge tone="violet">{a.questionCount} questions</Badge>
                </div>
                <p className="mt-3 text-[15px] font-bold text-ink dark:text-cream">{a.title}</p>
                <p className="mt-1 text-xs text-ink/50 dark:text-cream/50">
                  {a.teacherName} · {a.className}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-ink/60 dark:text-cream/60">
                  <span>Due {formatDue(a.dueDate)}</span>
                  <span>{formatDate(a.createdAt)}</span>
                </div>
              </Link>
              <button
                onClick={() => remove(a.id, a.title)}
                disabled={busy === a.id}
                className="absolute right-3 top-3 rounded-full p-1.5 text-ink/35 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10"
                aria-label="Delete assignment"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
