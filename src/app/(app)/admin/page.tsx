"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { claimAdminAction, getAdminData, getSessionInfo } from "@/lib/actions";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  useToast,
} from "@/components/ui";

type AdminData = NonNullable<Awaited<ReturnType<typeof getAdminData>>>;

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [info, d] = await Promise.all([getSessionInfo(), getAdminData()]);
    setIsAdmin(info?.isAdmin ?? false);
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unlock = async () => {
    if (!code.trim()) return;
    setUnlocking(true);
    const res = await claimAdminAction(code.trim());
    setUnlocking(false);
    if (res.ok) {
      toast("Admin unlocked — all Pro features enabled 👑");
      setCode("");
      load();
    } else {
      toast(res.error ?? "Could not unlock admin", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!isAdmin || !data) {
    return (
      <div className="mx-auto max-w-md py-10">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <Card className="p-6 text-center sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-brand-300 dark:bg-cream dark:text-ink">
            <ShieldCheck size={26} />
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold text-ink dark:text-cream">Admin access</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/60 dark:text-cream/60">
            Admins get every Pro feature and can see platform usage. Enter the admin code
            (owner: set <code className="font-mono">ADMIN_CODE</code>, or add your email to{" "}
            <code className="font-mono">ADMIN_EMAILS</code> to skip this step).
          </p>
          <div className="mt-5">
            <Field label="Admin code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. tawi-admin-2026"
                onKeyDown={(e) => e.key === "Enter" && unlock()}
              />
            </Field>
            <Button className="mt-3 w-full" onClick={unlock} disabled={unlocking || !code.trim()}>
              {unlocking ? <Spinner className="border-ink/30 border-t-ink" /> : <ShieldCheck size={15} />}
              Unlock admin
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const stats: [string, string | number][] = [
    ["Total users", data.totals.users],
    ["Guests", data.totals.guests],
    ["Admins", data.totals.admins],
    ["Study kits", data.totals.kits],
    ["Flashcards", data.totals.cards],
    ["Kit questions", data.totals.kitQuestions],
    ["Assignments", data.totals.assignments],
    ["Assignment Qs", data.totals.assignmentQuestions],
    ["Submissions", data.totals.attempts],
    ["Calendar events", data.totals.events],
    ["Tasks", data.totals.tasks],
    ["Notes / docs", data.totals.documents],
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold tracking-tight text-ink dark:text-cream">
            <ShieldCheck size={26} /> Admin panel
          </h1>
          <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
            Platform usage at a glance · AI engine: {data.aiEnabled ? "online ✨" : "offline"}
          </p>
        </div>
        <Badge tone="brand">
          <Sparkles size={12} /> Pro — all features unlocked
        </Badge>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="font-display text-2xl font-bold text-ink dark:text-cream">{value}</p>
            <p className="text-xs font-medium text-ink/55 dark:text-cream/55">{label}</p>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="font-display mb-3 text-lg font-bold text-ink dark:text-cream">Users</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wider text-ink/45 dark:border-cream/10 dark:text-cream/45">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Kits</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-ink/5 last:border-0 dark:border-cream/5">
                  <td className="px-4 py-2.5 font-bold text-ink dark:text-cream">{u.name}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-ink/60 dark:text-cream/60">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className="mr-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/70 dark:bg-cream/10 dark:text-cream/70">
                      {u.isGuest ? "Guest" : u.role ?? "—"}
                    </span>
                    {u.isAdmin && (
                      <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-ink">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-cream/60">{u.kits}</td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-cream/60">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {data.recentAttempts.length > 0 && (
        <section>
          <h2 className="font-display mb-3 text-lg font-bold text-ink dark:text-cream">Recent submissions</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentAttempts.map((a, i) => (
              <Card key={i} className="p-4">
                <p className="text-sm font-bold text-ink dark:text-cream">{a.name}</p>
                <p className="mt-0.5 text-xs text-ink/55 dark:text-cream/55">
                  {a.score}/{a.total} · {new Date(a.createdAt).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-sm text-ink/45 dark:text-cream/45">
        <Link href="/dashboard" className="font-bold underline decoration-brand-500 decoration-2 underline-offset-4">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
