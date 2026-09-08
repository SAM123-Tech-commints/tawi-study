"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Copy,
  Folder,
  FolderPlus,
  GraduationCap,
  Layers,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import {
  copyKitAction,
  createClassAction,
  createSampleKitAction,
  deleteClassAction,
  deleteKitAction,
  getDashboardData,
} from "@/lib/actions";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Field,
  formatDate,
  formatDue,
  Input,
  Modal,
  Spinner,
  useToast,
} from "@/components/ui";

type DashData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;

const CLASS_COLORS = ["#B7E938", "#7C5CFC", "#F5B31B", "#46A758", "#38BDF8", "#E5484D", "#F472B6"];

const DEMO_STEPS = [
  ["Sign up & choose your role", "Create a free account, then tell us if you're a student or an educator."],
  ["Upload your materials", "Drop in a PDF, paste notes or add a link — 90+ file types supported."],
  ["Generate your study kit", "AI creates flashcards, questions, a study guide and summaries in seconds."],
  ["Study actively", "Rate flashcards green/yellow/red, play games and answer Smart Study questions."],
  ["Build assignments (educators)", "Set the number of questions, types and instructions, then share one link."],
  ["Review & track", "Students get correct answers plus explanations — you see every score."],
];

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [open]);
  return (
    <Modal open={open} onClose={onClose} wide>
      <h3 className="font-display text-xl font-bold text-ink dark:text-cream">
        The 2-minute tour <span className="text-sm font-semibold text-ink/45 dark:text-cream/45">({step + 1}/{DEMO_STEPS.length})</span>
      </h3>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-ink/4 p-4 dark:bg-cream/5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-lg font-bold text-ink">
          {step + 1}
        </span>
        <div>
          <p className="font-bold text-ink dark:text-cream">{DEMO_STEPS[step][0]}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink/60 dark:text-cream/60">{DEMO_STEPS[step][1]}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
        {DEMO_STEPS.map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-500" : "bg-ink/10 dark:bg-cream/15")} />
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        <Button
          onClick={() => (step === DEMO_STEPS.length - 1 ? onClose() : setStep((s) => s + 1))}
        >
          {step === DEMO_STEPS.length - 1 ? "Let's go!" : "Next"} <ArrowRight size={15} />
        </Button>
      </div>
    </Modal>
  );
}

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);
  const [classModal, setClassModal] = useState(false);
  const [newClass, setNewClass] = useState("");
  const [newColor, setNewColor] = useState(CLASS_COLORS[0]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await getDashboardData();
    setData(d);
    setLoading(false);
    if (!d) router.push("/signin");
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (params.get("sample") === "1" && data && !data.kits.length) {
      const timer = setTimeout(async () => {
        const res = await createSampleKitAction();
        if (res.ok && res.id) {
          toast("Sample study kit created! 🎉");
          router.replace(`/kits/${res.id}`);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [params, data, router, toast]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof data extends null ? never : DashData["kits"]> = {};
    if (!data) return [];
    for (const k of data.kits) {
      const key = formatDate(k.updatedAt);
      (map[key] ??= []).push(k);
    }
    return Object.entries(map);
  }, [data]);

  if (loading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const firstName = data.user.name.split(" ")[0];

  const createClass = async () => {
    if (!newClass.trim()) return;
    const res = await createClassAction({ name: newClass, color: newColor });
    if (res.ok) {
      toast(`Class folder “${newClass}” created`);
      setNewClass("");
      setClassModal(false);
      load();
    } else {
      toast(res.error ?? "Could not create class", "error");
    }
  };

  const copyKit = async (id: string, title: string) => {
    setBusy(id);
    const res = await copyKitAction(id);
    setBusy(null);
    if (res.ok) toast(`Copy of “${title}” created`);
    else toast(res.error ?? "Could not copy", "error");
    load();
  };

  const removeKit = async (id: string, title: string) => {
    setBusy(id);
    await deleteKitAction(id);
    setBusy(null);
    toast(`“${title}” deleted`);
    load();
  };

  const removeClass = async (id: string, name: string) => {
    await deleteClassAction(id);
    toast(`Folder “${name}” deleted`);
    load();
  };

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <section>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-cream">
          Hey {firstName} 👋
        </h1>
        <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
          Ready to turn your notes into grades? Pick a tool below or jump back into a recent kit.
        </p>
      </section>

      {/* Create actions */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/kits/new"
          className="group relative overflow-hidden rounded-3xl border border-ink/8 bg-brand-500 p-6 text-ink shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/25 blur-2xl transition group-hover:scale-125" />
          <div className="flex items-start justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-brand-300">
              <BookOpen size={21} />
            </span>
            <ArrowRight size={18} className="opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
          </div>
          <h2 className="font-display mt-4 text-xl font-bold">Create a study kit</h2>
          <p className="mt-1 text-[13.5px] font-medium text-ink/70">
            Upload notes → get flashcards, Smart Study, study guide & games.
          </p>
        </Link>
        <Link
          href="/assignments/new"
          className="group relative overflow-hidden rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-cream/10 dark:bg-surface-dark"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <GraduationCap size={21} />
            </span>
            <ArrowRight size={18} className="opacity-40 transition group-hover:translate-x-1 group-hover:opacity-100" />
          </div>
          <h2 className="font-display mt-4 text-xl font-bold text-ink dark:text-cream">Build an assignment</h2>
          <p className="mt-1 text-[13.5px] text-ink/60 dark:text-cream/60">
            Generate a worksheet from your material and share it with one link.
          </p>
        </Link>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="soft" onClick={() => setDemoOpen(true)}>
          <Play size={15} /> Watch the 2-minute demo
        </Button>
        <Button variant="outline" onClick={async () => { const r = await createSampleKitAction(); if (r.ok && r.id) router.push(`/kits/${r.id}`); }}>
          <Sparkles size={15} /> Try a sample study kit
        </Button>
        {!data.aiEnabled && (
          <span className="text-xs font-semibold text-ink/45 dark:text-cream/45">
            Offline engine active · add a free GEMINI_API_KEY or GROQ_API_KEY for LLM-grade text
          </span>
        )}
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [data.kits.length, "Study kits", BookOpen],
          [data.kits.reduce((a, k) => a + k.cardCount, 0), "Flashcards", Layers],
          [data.assignments.reduce((a, k) => a + k.questionCount, 0), "Assignment questions", ClipboardList],
          [data.avgScore !== null ? `${data.avgScore}%` : "—", "Avg student score", Zap],
        ].map(([v, l, Icon]) => {
          const IconC = Icon as typeof BookOpen;
          return (
            <Card key={l as string} className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300">
                  <IconC size={18} />
                </span>
                <div>
                  <p className="font-display text-xl font-bold text-ink dark:text-cream">{v as number | string}</p>
                  <p className="text-xs font-medium text-ink/55 dark:text-cream/55">{l as string}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      {/* Classes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
            <Folder size={17} /> Class folders
          </h2>
          <Button variant="outline" size="sm" onClick={() => setClassModal(true)}>
            <FolderPlus size={14} /> New folder
          </Button>
        </div>
        {data.classes.length ? (
          <div className="flex flex-wrap gap-2.5">
            {data.classes.map((c) => (
              <div
                key={c.id}
                className="group flex items-center gap-2 rounded-full border border-ink/10 bg-surface py-1.5 pl-2 pr-1.5 text-sm font-semibold text-ink/80 dark:border-cream/15 dark:bg-surface-dark dark:text-cream/80"
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} />
                <Link href={`/kits?class=${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
                <button
                  onClick={() => removeClass(c.id, c.name)}
                  className="rounded-full p-1 text-ink/35 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10"
                  aria-label="Delete folder"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-[13px] text-ink/50 dark:border-cream/20 dark:text-cream/50">
            No folders yet. Create one for each class you teach or take — e.g. “Biology 4A”.
          </p>
        )}
      </section>

      {/* Recent kits */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink dark:text-cream">Recent study kits</h2>
          <Link href="/kits" className="text-sm font-bold text-brand-700 hover:underline dark:text-brand-400">
            View all →
          </Link>
        </div>
        {data.kits.length ? (
          <div className="space-y-6">
            {grouped.map(([day, kits]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">{day}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {kits.map((k) => (
                    <div key={k.id} className="group rounded-2xl border border-ink/8 bg-surface p-4 transition hover:border-brand-500 hover:shadow-md dark:border-cream/10 dark:bg-surface-dark">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/kits/${k.id}`} className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-ink hover:underline dark:text-cream">{k.title}</p>
                          <p className="mt-0.5 text-xs text-ink/50 dark:text-cream/50">
                            {k.cardCount} cards · {k.questionCount} questions
                          </p>
                        </Link>
                        <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-ink dark:bg-brand-500/15 dark:text-brand-300">
                          Kit
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                        <Button size="sm" variant="ghost" onClick={() => copyKit(k.id, k.title)} disabled={busy === k.id}>
                          <Copy size={13} /> Copy
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeKit(k.id, k.title)} disabled={busy === k.id}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Upload size={22} />}
            title="No study kits yet"
            desc="Upload your notes, a PDF or a YouTube link and Tawi will turn it into flashcards, questions and a study guide."
            action={
              <Link href="/kits/new">
                <Button>
                  <Plus size={15} /> Create your first study kit
                </Button>
              </Link>
            }
          />
        )}
      </section>

      {/* Recent assignments */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink dark:text-cream">Assignments</h2>
          <Link href="/assignments" className="text-sm font-bold text-brand-700 hover:underline dark:text-brand-400">
            View all →
          </Link>
        </div>
        {data.assignments.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.assignments.slice(0, 6).map((a) => (
              <Link
                key={a.id}
                href={`/assignments/${a.id}`}
                className="rounded-2xl border border-ink/8 bg-surface p-4 transition hover:border-brand-500 hover:shadow-md dark:border-cream/10 dark:bg-surface-dark"
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-[15px] font-bold text-ink dark:text-cream">{a.title}</p>
                  <Badge tone="violet">{a.questionCount} Qs</Badge>
                </div>
                <p className="mt-1 text-xs text-ink/50 dark:text-cream/50">
                  {a.teacherName} · {a.className}
                </p>
                <p className="mt-2 text-xs font-semibold text-ink/60 dark:text-cream/60">
                  Due {formatDue(a.dueDate)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="No assignments yet"
            desc="Educators: build a worksheet from your material, then share the link with your class."
            action={
              <Link href="/assignments/new">
                <Button variant="dark">
                  <GraduationCap size={15} /> Build an assignment
                </Button>
              </Link>
            }
          />
        )}
      </section>

      <Modal open={classModal} onClose={() => setClassModal(false)}>
        <h3 className="font-display text-lg font-bold text-ink dark:text-cream">New class folder</h3>
        <p className="mt-1 text-sm text-ink/55 dark:text-cream/55">Keep worksheets and kits organized per class.</p>
        <div className="mt-5 space-y-4">
          <Field label="Folder name">
            <Input
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              placeholder="e.g. Biology 4A"
              onKeyDown={(e) => e.key === "Enter" && createClass()}
            />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn("h-8 w-8 rounded-full transition", newColor === c && "ring-2 ring-ink ring-offset-2 dark:ring-cream")}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setClassModal(false)}>Cancel</Button>
          <Button onClick={createClass} disabled={!newClass.trim()}>
            Create folder
          </Button>
        </div>
      </Modal>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
