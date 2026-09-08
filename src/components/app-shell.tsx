"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Plus,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { signoutAction } from "@/lib/actions";
import { Avatar, cn, useToast } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { OwlLogo } from "@/components/logo";
import { isAdminUser } from "@/lib/admin";

export interface ShellUser {
  name: string;
  email: string;
  role: string | null;
  isGuest: boolean;
  isAdmin: boolean;
  avatar?: string | null;
}

function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <OwlLogo size={32} />
      <span className="text-lg font-bold tracking-tight text-ink dark:text-cream">
        tawi<span className="font-medium text-ink/50 dark:text-cream/50">.study</span>
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kits", label: "Study kits", icon: BookOpen },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/workspace", label: "Workspace", icon: NotebookPen },
];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = async () => {
    await signoutAction();
    toast("Signed out. See you soon!");
    router.push("/signin");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-paper-dark dark:text-cream">
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-paper/85 backdrop-blur-md dark:border-cream/10 dark:bg-paper-dark/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => {
                const active = pathname === n.href || pathname.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                      active
                        ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                        : "text-ink/60 hover:bg-ink/5 hover:text-ink dark:text-cream/60 dark:hover:bg-cream/10 dark:hover:text-cream"
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/kits/new"
              className="hidden items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:bg-brand-400 sm:inline-flex"
            >
              <Plus size={15} strokeWidth={2.5} /> New kit
            </Link>
            <Link
              href="/assignments/new"
              className="hidden items-center gap-1.5 rounded-full border border-ink/15 px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:bg-ink/5 lg:inline-flex dark:border-cream/20 dark:text-cream dark:hover:bg-cream/10"
            >
              <GraduationCap size={15} /> New assignment
            </Link>
            <ThemeToggle />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-full transition hover:ring-2 hover:ring-brand-400/60"
                aria-label="Account menu"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-[34px] w-[34px] rounded-full object-cover"
                  />
                ) : (
                  <Avatar name={user.name} size={34} />
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-64 rounded-2xl border border-ink/10 bg-surface p-2 shadow-xl animate-pop dark:border-cream/10 dark:bg-surface-dark">
                  <div className="px-3 py-2">
                    <p className="text-sm font-bold text-ink dark:text-cream">{user.name}</p>
                    <p className="truncate text-xs text-ink/50 dark:text-cream/50">{user.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-ink dark:bg-brand-500/15 dark:text-brand-300">
                        {user.role === "educator" ? "🎓 Educator" : user.role === "student" ? "✏️ Student" : "Guest"}
                      </span>
                      {user.isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-brand-300 dark:bg-cream dark:text-ink">
                          <ShieldCheck size={11} /> Admin · Pro
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="my-1 h-px bg-ink/8 dark:bg-cream/10" />
                  <Link
                    href="/onboarding"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 dark:text-cream/70 dark:hover:bg-cream/10"
                  >
                    <GraduationCap size={15} /> Account type
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 dark:text-cream/70 dark:hover:bg-cream/10"
                  >
                    <User size={15} /> Profile & settings
                  </Link>
                  {user.isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 dark:text-cream/70 dark:hover:bg-cream/10"
                    >
                      <ShieldCheck size={15} /> Admin panel
                    </Link>
                  )}
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 md:hidden dark:text-cream/70 dark:hover:bg-cream/10"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-ink/8 px-4 py-3 md:hidden dark:border-cream/10">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/80 hover:bg-ink/5 dark:text-cream/80 dark:hover:bg-cream/10"
              >
                <n.icon size={16} /> {n.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 px-3">
              <Link
                href="/kits/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-ink"
              >
                <Plus size={15} /> New kit
              </Link>
              <Link
                href="/assignments/new"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink dark:border-cream/20 dark:text-cream"
              >
                New assignment
              </Link>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {user.isGuest && (
          <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-50 p-4 sm:flex-row sm:items-center dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              👀 You&apos;re browsing as a guest — uploads, study kits, assignments, calendar and
              workspace need a free account.
            </p>
            <Link
              href="/signin"
              className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-bold text-brand-300 transition hover:bg-ink/85 dark:bg-brand-500 dark:text-ink dark:hover:bg-brand-400"
            >
              Sign up free →
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
