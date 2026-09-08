"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { createEventAction, deleteEventAction, getEventsAction, updateEventAction } from "@/lib/actions";
import {
  Button,
  Card,
  cn,
  EmptyState,
  Field,
  Input,
  Modal,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";

interface CalEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  color: string;
}

const COLORS = ["#B7E938", "#7C5CFC", "#F5B31B", "#46A758", "#38BDF8", "#E5484D", "#F472B6"];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function DeleteEventButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!confirm("Delete this event?")) return;
        setBusy(true);
        const res = await deleteEventAction(id);
        setBusy(false);
        if (!res.ok) {
          toast(res.error ?? "Could not delete", "error");
          return;
        }
        onDeleted();
      }}
      disabled={busy}
      className="rounded-full p-2 text-ink/35 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
      aria-label="Delete event"
      title="Delete event"
    >
      <Trash2 size={15} />
    </button>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [modal, setModal] = useState<null | { date: string; event?: CalEvent }>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await getEventsAction();
    setEvents(rows as CalEvent[] | null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = (iso: string) => {
    setTitle("");
    setDesc("");
    setDate(iso);
    setColor(COLORS[0]);
    setModal({ date: iso });
  };

  const openEdit = (ev: CalEvent) => {
    setTitle(ev.title);
    setDesc(ev.description);
    setDate(ev.date);
    setColor(ev.color);
    setModal({ date: ev.date, event: ev });
  };

  const save = async () => {
    if (!title.trim() || !date) {
      toast("Give your event a title and a date.", "error");
      return;
    }
    setBusy(true);
    const res = modal?.event
      ? await updateEventAction({ id: modal.event.id, title, date, description: desc, color })
      : await createEventAction({ title, date, description: desc, color });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save the event", "error");
      if (/guest/i.test(res.error ?? "")) router.push("/signin");
      return;
    }
    toast(modal?.event ? "Event updated ✏️" : "Event added 📅");
    setModal(null);
    load();
  };

  const remove = async () => {
    if (!modal?.event) return;
    setBusy(true);
    const res = await deleteEventAction(modal.event.id);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not delete", "error");
      return;
    }
    toast("Event deleted");
    setModal(null);
    load();
  };

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDay = first.getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(new Date(cursor.y, cursor.m, d));
    return arr;
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events ?? []) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const today = toISO(new Date());

  if (events === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold tracking-tight text-ink dark:text-cream">
            <CalendarDays size={26} /> Calendar
          </h1>
          <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
            Click any day to add an event — click an event to edit it, just like Notion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
          >
            <ChevronLeft size={15} />
          </Button>
          <span className="min-w-36 text-center text-sm font-bold text-ink dark:text-cream">{monthName}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </section>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="No events yet"
          desc="Plan exams, assignment due dates and study sessions on your editable calendar."
          action={
            <Button onClick={() => openNew(today)}>
              <Plus size={15} /> Add your first event
            </Button>
          }
        />
      ) : null}

      <Card className="p-3 sm:p-5">
        <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-widest text-ink/40 dark:text-cream/40">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) =>
            d === null ? (
              <div key={`x${i}`} />
            ) : (
              <button
                key={toISO(d)}
                onClick={() => openNew(toISO(d))}
                className={cn(
                  "min-h-20 rounded-2xl border p-1.5 text-left align-top transition hover:border-brand-500 sm:min-h-24 sm:p-2",
                  toISO(d) === today
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-ink/8 bg-surface hover:bg-ink/[0.02] dark:border-cream/10 dark:bg-surface-dark"
                )}
              >
                <span
                  className={cn(
                    "mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                    toISO(d) === today ? "bg-brand-500 text-ink" : "text-ink/60 dark:text-cream/60"
                  )}
                >
                  {d.getDate()}
                </span>
                <div className="space-y-1">
                  {(byDate.get(toISO(d)) ?? []).slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openEdit(e);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.stopPropagation();
                          openEdit(e);
                        }
                      }}
                      className="block truncate rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-ink"
                      style={{ background: `${e.color}55`, borderLeft: `3px solid ${e.color}` }}
                      title={e.title}
                    >
                      {e.title}
                    </span>
                  ))}
                  {(byDate.get(toISO(d)) ?? []).length > 3 && (
                    <span className="block px-1.5 text-[10px] font-bold text-ink/45 dark:text-cream/45">
                      +{(byDate.get(toISO(d)) ?? []).length - 3} more
                    </span>
                  )}
                </div>
              </button>
            )
          )}
        </div>
      </Card>

      {/* Upcoming list — every event has an explicit edit + delete button */}
      <section>
        <h2 className="font-display mb-3 text-lg font-bold text-ink dark:text-cream">
          Upcoming ({events.length})
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink/55 dark:text-cream/55">
            Nothing scheduled — click any day above to add your first event.
          </p>
        ) : (
          <div className="space-y-2">
            {[...events]
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 20)
              .map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-2xl border border-ink/8 bg-surface p-3 dark:border-cream/10 dark:bg-surface-dark"
                >
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink dark:text-cream">{e.title}</p>
                    <p className="text-xs text-ink/50 dark:text-cream/50">
                      {e.date}
                      {e.description ? ` · ${e.description.slice(0, 80)}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
                    Edit
                  </Button>
                  <DeleteEventButton
                    id={e.id}
                    onDeleted={() => {
                      toast("Event deleted");
                      load();
                    }}
                  />
                </div>
              ))}
          </div>
        )}
      </section>

      <Modal open={modal !== null} onClose={() => setModal(null)}>
        <h3 className="font-display text-lg font-bold text-ink dark:text-cream">
          {modal?.event ? "Edit event" : "New event"}
        </h3>
        <div className="mt-5 space-y-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology exam" />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Room number, topics to revise…"
            />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("h-8 w-8 rounded-full transition", color === c && "ring-2 ring-ink ring-offset-2 dark:ring-cream")}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div>
            {modal?.event && (
              <Button variant="ghost" className="text-red-500" onClick={remove} disabled={busy}>
                <Trash2 size={15} /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !title.trim()}>
              {busy ? <Spinner className="border-ink/30 border-t-ink" /> : modal?.event ? "Save changes" : "Add event"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
