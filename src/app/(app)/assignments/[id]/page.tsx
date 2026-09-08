"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Eye,
  GraduationCap,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  deleteAssignmentQuestionAction,
  generateAssignmentQuestionsAction,
  getAssignmentData,
} from "@/lib/actions";
import {
  Badge,
  Button,
  Card,
  cn,
  CopyButton,
  Field,
  formatDate,
  formatDue,
  Modal,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";

type Data = NonNullable<Awaited<ReturnType<typeof getAssignmentData>>>;

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"questions" | "settings" | "student" | "results">("questions");
  const [moreOpen, setMoreOpen] = useState(false);
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<string[]>(["mcq", "true_false"]);
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await getAssignmentData(id);
    setData(d);
    if (!d) router.push("/assignments");
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

  const { assignment: a, questions, attempts } = data;
  const takeUrl = typeof window !== "undefined" ? `${window.location.origin}/take/${a.shareToken}` : "";

  const removeQ = async (qid: string) => {
    setBusy(qid);
    await deleteAssignmentQuestionAction(qid);
    setBusy(null);
    toast("Question deleted");
    load();
  };

  const generateMore = async (append: boolean) => {
    setGenerating(true);
    const res = await generateAssignmentQuestionsAction({
      assignmentId: a.id,
      count,
      types,
      instructions,
      append,
    });
    setGenerating(false);
    if (res.ok) {
      toast(append ? `${res.created} more questions added` : `${res.created} questions regenerated`);
      setMoreOpen(false);
      load();
    } else {
      toast(res.error ?? "Could not generate", "error");
    }
  };

  const avg = attempts.length
    ? Math.round(attempts.reduce((acc, t) => acc + (t.total ? t.score / t.total : 0), 0) / attempts.length * 100)
    : null;

  return (
    <div>
      <Link href="/assignments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream">
        <ArrowLeft size={15} /> Assignments
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-cream">{a.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/55 dark:text-cream/55">
            <Badge tone="violet">{a.teacherName}</Badge>
            <span>· {a.className}</span>
            <span>· Due {formatDue(a.dueDate)}</span>
            <span>· {questions.length} questions</span>
            <span>· created {formatDate(a.createdAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={takeUrl} label="Share assignment" />
          <Link href={`/take/${a.shareToken}`}>
            <Button variant="outline">
              <Eye size={15} /> Student view
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["questions", "Questions", ClipboardList, questions.length],
            ["settings", "Settings", Settings2, null],
            ["student", "Student view", Eye, null],
            ["results", "Results", Users, attempts.length],
          ] as const
        ).map(([t, label, Icon, n]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
              tab === t ? "bg-ink text-cream dark:bg-cream dark:text-ink" : "bg-ink/5 text-ink/60 hover:bg-ink/10 dark:bg-cream/10 dark:text-cream/60"
            )}
          >
            <Icon size={15} /> {label}
            {n !== null && n > 0 && (
              <span className={cn("rounded-full px-1.5 text-[11px]", tab === t ? "bg-cream/20 dark:bg-ink/10" : "bg-ink/10 dark:bg-cream/15")}>
                {n}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm text-ink/55 dark:text-cream/55">No questions yet — generate some!</p>
            </Card>
          ) : (
            questions.map((q, i) => (
              <Card key={q.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-cream dark:bg-cream dark:text-ink">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-relaxed text-ink dark:text-cream">{q.question}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">
                        {q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True / False" : "Short answer"}
                      </Badge>
                      <span className="text-[12.5px] font-medium text-ink/50 dark:text-cream/50">
                        Answer: <span className="font-semibold text-green-600 dark:text-green-400">{q.answer}</span>
                      </span>
                    </div>
                    {q.explanation && (
                      <p className="mt-2 rounded-xl bg-ink/4 p-3 text-[12.5px] leading-relaxed text-ink/60 dark:bg-cream/5 dark:text-cream/60">
                        💡 {q.explanation}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeQ(q.id)}
                    disabled={busy === q.id}
                    className="rounded-full p-2 text-ink/35 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    aria-label="Delete question"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => setMoreOpen(true)}>
              <Plus size={15} /> Generate more
            </Button>
            <Button variant="outline" onClick={() => setMoreOpen(true)}>
              <Sparkles size={15} /> Regenerate all
            </Button>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <Card>
          <h3 className="mb-4 font-bold text-ink dark:text-cream">Assignment settings</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Teacher", a.teacherName],
              ["Class", a.className],
              ["Due date", formatDue(a.dueDate)],
              ["Source", a.sourceName || "—"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-ink/4 p-4 dark:bg-cream/5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-cream/45">{l}</p>
                <p className="mt-1 text-sm font-semibold text-ink dark:text-cream">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => setMoreOpen(true)}>
              <Sparkles size={15} /> Regenerate questions
            </Button>
          </div>
        </Card>
      )}

      {tab === "student" && (
        <Card className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <GraduationCap size={24} />
          </span>
          <h3 className="font-display mt-4 text-xl font-bold text-ink dark:text-cream">How your students see it</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/60 dark:text-cream/60">
            Students open the link, enter their name and complete the quiz. After submitting, every
            wrong answer shows the correct answer, an explanation and related lecture notes.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href={`/take/${a.shareToken}`}>
              <Button size="lg">
                <Eye size={16} /> Open student view
              </Button>
            </Link>
            <CopyButton text={takeUrl} label="Copy share link" />
          </div>
        </Card>
      )}

      {tab === "results" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Card className="px-6 py-4">
              <p className="font-display text-2xl font-bold text-ink dark:text-cream">{attempts.length}</p>
              <p className="text-xs font-medium text-ink/55 dark:text-cream/55">submissions</p>
            </Card>
            <Card className="px-6 py-4">
              <p className="font-display text-2xl font-bold text-ink dark:text-cream">{avg !== null ? `${avg}%` : "—"}</p>
              <p className="text-xs font-medium text-ink/55 dark:text-cream/55">average score</p>
            </Card>
          </div>
          {attempts.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm text-ink/55 dark:text-cream/55">
                No submissions yet. Share the link with your students to see results here.
              </p>
            </Card>
          ) : (
            attempts.map((t) => {
              const pct = t.total ? Math.round((t.score / t.total) * 100) : 0;
              return (
                <Card key={t.id} className="flex items-center gap-4 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-cream dark:bg-cream dark:text-ink">
                    {t.name[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink dark:text-cream">{t.name}</p>
                    <p className="text-xs text-ink/50 dark:text-cream/50">
                      {t.score}/{t.total} correct · {formatDate(t.createdAt)}
                    </p>
                  </div>
                  <Badge tone={pct >= 80 ? "green" : pct >= 50 ? "amber" : "red"}>{pct}%</Badge>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)}>
        <h3 className="font-display text-lg font-bold text-ink dark:text-cream">Generate questions</h3>
        <p className="mt-1 text-sm text-ink/55 dark:text-cream/55">
          Replace all existing questions, or append more to the current {questions.length}.
        </p>
        <div className="mt-5 space-y-4">
          <Field label={`Number of questions: ${count}`}>
            <input type="range" min={3} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[#96C51F]" />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink/80 dark:text-cream/80">Question types</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["mcq", "Multiple choice"],
                  ["true_false", "True / False"],
                  ["short", "Short answer"],
                ] as const
              ).map(([v, l]) => {
                const on = types.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => setTypes((t) => (on ? t.filter((x) => x !== v) : [...t, v]))}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition",
                      on
                        ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                        : "border-ink/12 text-ink/60 dark:border-cream/15 dark:text-cream/60"
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Additional instructions (optional)">
            <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Make them exam-style…" />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setMoreOpen(false)}>Cancel</Button>
          <Button variant="outline" onClick={() => generateMore(true)} disabled={generating || !types.length}>
            {generating ? <Spinner className="h-4 w-4" /> : <Plus size={15} />} Append
          </Button>
          <Button onClick={() => generateMore(false)} disabled={generating || !types.length}>
            {generating ? <Spinner className="h-4 w-4 border-ink/30 border-t-ink" /> : <Sparkles size={15} />} Regenerate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
