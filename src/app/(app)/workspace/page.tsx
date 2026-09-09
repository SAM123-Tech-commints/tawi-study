"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  FileText,
  ListChecks,
  MessageCircle,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  createTaskAction,
  deleteDocAction,
  deleteTaskAction,
  getWorkspaceData,
  saveDocAction,
  toggleTaskAction,
} from "@/lib/actions";
import {
  Button,
  Card,
  cn,
  EmptyState,
  Field,
  Input,
  RichEditor,
  Spinner,
  useToast,
} from "@/components/ui";
import Community from "@/components/community";

type WorkspaceData = NonNullable<Awaited<ReturnType<typeof getWorkspaceData>>>;

type WorkspaceTab = "tasks" | "notes" | "docs" | "community";

interface Task {
  id: string;
  title: string;
  done: boolean;
  due: string;
}
interface Doc {
  id: string;
  kind: string;
  title: string;
  content: string;
}

export default function WorkspacePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<WorkspaceTab>("tasks");

  const load = useCallback(async () => {
    setLoading(true);
    const d = await getWorkspaceData();
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold tracking-tight text-ink dark:text-cream">
          <NotebookPen size={26} /> Workspace
        </h1>
        <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
          Tasks, notes, documents and your study community — all in one place.
        </p>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-ink/10 pb-3 dark:border-cream/15">
        {(
          [
            ["tasks", "Tasks", ListChecks],
            ["notes", "Notes", NotebookPen],
            ["docs", "Documents", FileText],
            ["community", "Community", Users],
          ] as const
        ).map(([t, label, Icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition active:scale-95",
              tab === t
                ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                : "text-ink/50 hover:bg-ink/5 dark:text-cream/50 dark:hover:bg-cream/10"
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <TasksTab data={data} onRefresh={load} />
      )}
      {tab === "notes" && (
        <DocsTab data={data} kind="note" onRefresh={load} />
      )}
      {tab === "docs" && (
        <DocsTab data={data} kind="doc" onRefresh={load} />
      )}
      {tab === "community" && <Community />}
    </div>
  );
}

/* ============================= TASKS TAB ============================ */

function TasksTab({ data, onRefresh }: { data: WorkspaceData; onRefresh: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const todos = data.tasks.filter((t) => !t.done);
  const dones = data.tasks.filter((t) => t.done);

  const add = async () => {
    if (!newTitle.trim()) return;
    setBusy("add");
    const res = await createTaskAction({ title: newTitle.trim(), due: newDue });
    setBusy(null);
    if (!res.ok) {
      toast(res.error ?? "Could not add task", "error");
      if (/guest/i.test(res.error ?? "")) router.push("/signin");
      return;
    }
    setNewTitle("");
    setNewDue("");
    toast("Task added ✅");
    onRefresh();
  };

  const toggle = async (id: string) => {
    setBusy(id);
    const res = await toggleTaskAction(id);
    setBusy(null);
    if (res.ok) onRefresh();
    if (res.error && /guest/i.test(res.error)) {
      toast(res.error, "error");
      router.push("/signin");
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    const res = await deleteTaskAction(id);
    setBusy(null);
    if (res.ok) {
      toast("Task deleted");
      onRefresh();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Main task list */}
      <div className="space-y-4">
        {todos.length === 0 && dones.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title="No tasks yet"
            desc="Add study tasks, assignment deadlines, or exam prep — check them off as you go."
          />
        ) : null}

        {/* Open tasks */}
        {todos.length > 0 && (
          <Card className="divide-y divide-ink/5 dark:divide-cream/10 p-0">
            {todos.map((t) => (
              <TaskRow key={t.id} task={t} busy={busy} onToggle={toggle} onDelete={remove} />
            ))}
          </Card>
        )}

        {/* Completed */}
        {dones.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">
              Completed ({dones.length})
            </p>
            <Card className="divide-y divide-ink/5 dark:divide-cream/10 p-0">
              {dones.map((t) => (
                <TaskRow key={t.id} task={t} busy={busy} onToggle={toggle} onDelete={remove} />
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Add task sidebar */}
      <Card className="h-fit lg:sticky lg:top-24">
        <h3 className="mb-3 font-bold text-ink dark:text-cream">Add a task</h3>
        <Field label="Task">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Review Chapter 6 flashcards"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </Field>
        <Field label="Due date (optional)">
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
        </Field>
        <Button className="mt-4 w-full" onClick={add} disabled={!newTitle.trim() || busy === "add"}>
          {busy === "add" ? <Spinner className="border-ink/30 border-t-ink" /> : <Plus size={15} />}
          Add task
        </Button>
      </Card>
    </div>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  onDelete,
}: {
  task: Task;
  busy: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button onClick={() => onToggle(task.id)} disabled={busy !== null} className="shrink-0">
        {task.done ? (
          <CheckCircle2 size={20} className="text-brand-600 dark:text-brand-400" />
        ) : (
          <Circle size={20} className="text-ink/25 dark:text-cream/25" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold text-ink dark:text-cream",
            task.done && "line-through text-ink/40 dark:text-cream/40"
          )}
        >
          {task.title}
        </p>
        {task.due && (
          <p className="text-[11px] font-medium text-ink/45 dark:text-cream/45">
            Due {new Date(task.due + "T00:00").toLocaleDateString()}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(task.id)}
        disabled={busy !== null}
        className="rounded-full p-1.5 text-ink/30 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* ============================= DOCS TAB ============================ */

function DocsTab({ data, kind, onRefresh }: { data: WorkspaceData; kind: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const docs = data.docs.filter((d) => d.kind === kind);
  const [open, setOpen] = useState<Doc | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const startNew = () => {
    setOpen({ id: "", kind, title: "", content: "" });
    setTitle("");
    setContent("");
  };

  const openDoc = (doc: Doc) => {
    setOpen(doc);
    setTitle(doc.title);
    setContent(doc.content);
  };

  const save = async () => {
    if (!title.trim()) {
      toast("Give your note a title.", "error");
      return;
    }
    setBusy(true);
    const res = await saveDocAction({ id: open?.id || null, kind, title: title.trim(), content });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save", "error");
      if (/guest/i.test(res.error ?? "")) {
        router.push("/signin");
      }
      return;
    }
    toast(open?.id ? "Note saved 💾" : "Note created ✨");
    setOpen(null);
    onRefresh();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const res = await deleteDocAction(id);
    setBusy(false);
    if (res.ok) {
      toast("Note deleted");
      onRefresh();
    }
  };

  if (open) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setOpen(null)}
          className="text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream"
        >
          ← Back to {kind === "note" ? "notes" : "documents"}
        </button>
        <Card className="space-y-4 p-5 sm:p-6">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "note" ? "e.g. Network Protocols Review" : "e.g. Lab Report Draft"}
            />
          </Field>
          <Field label={kind === "note" ? "Note content" : "Document body"}>
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder={
                kind === "note"
                  ? "Write your notes here — use the toolbar for formatting."
                  : "Write your document here — full formatting available."
              }
              minHeight={350}
            />
          </Field>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink/40 dark:text-cream/40">
              {content.length.toLocaleString()} characters
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy || !title.trim()}>
                {busy ? <Spinner className="border-ink/30 border-t-ink" /> : <Sparkles size={15} />}
                {open.id ? "Save changes" : "Create note"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink/55 dark:text-cream/55">
          {docs.length} {kind === "note" ? "notes" : "documents"}
        </p>
        <Button onClick={startNew}>
          <Plus size={15} /> New {kind === "note" ? "note" : "document"}
        </Button>
      </div>
      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title={`No ${kind === "note" ? "notes" : "documents"} yet`}
          desc={
            kind === "note"
              ? "Quick notes, lecture summaries, review sheets — all saved right here."
              : "Write longer-form documents: essays, reports, lab write-ups and more."
          }
          action={
            <Button onClick={startNew}>
              <Plus size={15} /> Create your first
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => openDoc(d)}
              className="group rounded-2xl border border-ink/8 bg-surface p-4 text-left transition hover:border-brand-500 hover:shadow-md dark:border-cream/10 dark:bg-surface-dark"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-[15px] font-bold text-ink dark:text-cream">{d.title}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(d.id);
                  }}
                  className="shrink-0 rounded-full p-1 text-ink/30 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/50 dark:text-cream/50">
                {d.content.slice(0, 120) || "Empty — click to start writing…"}
              </p>
              <p className="mt-2 text-[11px] font-medium text-ink/40 dark:text-cream/40">
                Updated {new Date(d.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
