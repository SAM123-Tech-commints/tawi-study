"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, Copy, X } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------ Button ------------------------------ */

type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-brand-500 text-ink hover:bg-brand-400 active:bg-brand-600 shadow-[0_1px_0_rgba(0,0,0,0.15)]",
    dark: "bg-ink text-brand-300 hover:bg-ink/85",
    outline: "border border-ink/15 bg-transparent text-ink hover:bg-ink/5 dark:text-cream dark:border-cream/20 dark:hover:bg-cream/5",
    ghost: "text-ink/70 hover:bg-ink/5 dark:text-cream/70 dark:hover:bg-cream/10",
    danger: "bg-red-500 text-white hover:bg-red-600",
    soft: "bg-brand-100 text-ink hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[13px] gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-12 px-6 text-[15px] gap-2",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ------------------------------ Inputs ------------------------------ */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-ink/15 bg-surface px-3.5 text-sm text-ink placeholder:text-ink/40 outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-brand-400/50 dark:border-cream/15 dark:bg-surface-dark dark:text-cream",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40 outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-brand-400/50 dark:border-cream/15 dark:bg-surface-dark dark:text-cream",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 rounded-xl border border-ink/15 bg-surface px-3 text-sm text-ink outline-none focus:border-ink/40 dark:border-cream/15 dark:bg-surface-dark dark:text-cream",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-semibold text-ink/80 dark:text-cream/80", className)}>
      {children}
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink/50 dark:text-cream/50">{hint}</p>}
    </div>
  );
}

/* ------------------------------- Card ------------------------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-ink/8 bg-surface p-6 shadow-[0_1px_2px_rgba(16,16,14,0.04)] dark:border-cream/10 dark:bg-surface-dark",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------- Badge ------------------------------ */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "violet" | "green" | "amber" | "red";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink/5 text-ink/70 dark:bg-cream/10 dark:text-cream/70",
    brand: "bg-brand-200 text-ink dark:bg-brand-500/20 dark:text-brand-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    green: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    red: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Modal ------------------------------ */

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full rounded-3xl border border-ink/10 bg-surface p-6 shadow-2xl animate-pop dark:border-cream/10 dark:bg-surface-dark",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink/50 hover:bg-ink/5 dark:text-cream/50 dark:hover:bg-cream/10"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- Tabs ------------------------------ */

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-ink/10 bg-ink/5 p-1 dark:border-cream/10 dark:bg-cream/5",
        className
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
            value === t.id
              ? "bg-surface text-ink shadow-sm dark:bg-cream/15 dark:text-cream"
              : "text-ink/60 hover:text-ink dark:text-cream/60 dark:hover:text-cream"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------- Progress bar --------------------------- */

export function ProgressBar({
  value,
  max,
  className,
  tone = "brand",
}: {
  value: number;
  max: number;
  className?: string;
  tone?: "brand" | "violet";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-cream/15", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          tone === "violet" ? "bg-violet-500" : "bg-brand-500"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------ Spinner ------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink dark:border-cream/20 dark:border-t-cream",
        className
      )}
    />
  );
}

/* ------------------------------ Avatar ------------------------------- */

const AVATAR_COLORS = [
  "bg-brand-400 text-ink",
  "bg-violet-400 text-white",
  "bg-amber-300 text-ink",
  "bg-green-400 text-ink",
  "bg-red-300 text-ink",
  "bg-sky-300 text-ink",
];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full font-bold", AVATAR_COLORS[idx])}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}

/* ---------------------------- Copy button ---------------------------- */

export function CopyButton({
  text,
  label,
  size = "md",
}: {
  text: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [text]);
  return (
    <Button
      variant="dark"
      size={size}
      onClick={copy}
      className="min-w-[9rem]"
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check size={size === "sm" ? 14 : 16} /> : <Copy size={size === "sm" ? 14 : 16} />}
      {copied ? "Copied!" : label ?? "Copy"}
    </Button>
  );
}

/* ----------------------------- Score ring ---------------------------- */

export function ScoreRing({
  pct,
  size = 120,
  label,
}: {
  pct: number;
  size?: number;
  label?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = pct >= 80 ? "#B7E938" : pct >= 50 ? "#F5B31B" : "#E5484D";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ink/10 dark:text-cream/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-2xl font-bold text-ink dark:text-cream">
        {Math.round(pct)}%
      </span>
      {label && (
        <span className="absolute -bottom-1 text-[10px] font-semibold uppercase tracking-wide text-ink/50 dark:text-cream/50">
          {label}
        </span>
      )}
    </div>
  );
}

/* ----------------------------- Empty state --------------------------- */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink/15 px-6 py-14 text-center dark:border-cream/20">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-ink dark:text-cream">{title}</h3>
      {desc && <p className="mt-1 max-w-sm text-sm text-ink/60 dark:text-cream/60">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------- RichText ---------------------------- */

function renderInline(text: string, key: number, highlights?: string[]): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${key}-${i}`} className="font-semibold text-ink dark:text-cream">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${key}-${i}`}>{applyHighlights(p, `${key}-${i}`, highlights)}</span>
    )
  );
}

/** Wrap detected keyword phrases in <mark> so exact text keeps every word but key terms pop. */
function applyHighlights(text: string, key: string, highlights?: string[]): ReactNode {
  const terms = (highlights ?? []).map((t) => t.trim()).filter((t) => t.length > 2);
  if (!terms.length) return <>{text}</>;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${terms.map(esc).join("|")})`, "gi");
  const chunks = text.split(re);
  if (chunks.length === 1) return <>{text}</>;
  return (
    <>
      {chunks.map((c, i) =>
        i % 2 === 1 ? (
          <mark
            key={`${key}-m${i}`}
            className="rounded bg-brand-200 px-0.5 font-semibold text-ink print:bg-yellow-200 dark:bg-brand-500/30 dark:text-brand-200"
          >
            {c}
          </mark>
        ) : (
          <span key={`${key}-t${i}`}>{c}</span>
        )
      )}
    </>
  );
}

export function RichText({ text, className, highlights }: { text: string; className?: string; highlights?: string[] }) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/(?<=[a-z0-9])(?=[A-Z])/g, "\n")
    .replace(/(?<=\.)(?=\s+[A-Z])/g, "\n")
    .replace(/(?<=\!|\?)(?=\s+[A-Z])/g, "\n")
    .replace(/(?<=\d)(?=\.\s)/g, "\n");
  const lines = normalized.split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let counter = 0;
  const flush = () => {
    if (!para.length) return;
    blocks.push(
      <p key={`p${counter++}`} className="mb-3 leading-relaxed">
        {para.map((l, i) => (
          <span key={i}>
            {renderInline(l, i, highlights)}
            {i < para.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
    para = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    if (/^###\s/.test(t)) {
      flush();
      blocks.push(
        <h4 key={`h4${counter++}`} className="mb-2 mt-4 text-[15px] font-bold text-ink dark:text-cream">
          {renderInline(t.replace(/^###\s/, ""), counter, highlights)}
        </h4>
      );
    } else if (/^##\s/.test(t)) {
      flush();
      blocks.push(
        <h3 key={`h3${counter++}`} className="mb-2 mt-5 text-lg font-bold text-ink dark:text-cream">
          {renderInline(t.replace(/^##\s/, ""), counter, highlights)}
        </h3>
      );
    } else if (/^#\s/.test(t)) {
      flush();
      blocks.push(
        <h2 key={`h2${counter++}`} className="mb-2 mt-6 text-xl font-bold text-ink dark:text-cream">
          {renderInline(t.replace(/^#\s/, ""), counter, highlights)}
        </h2>
      );
    } else if (/^[-•*]\s+/.test(t)) {
      flush();
      blocks.push(
        <div key={`li${counter++}`} className="mb-1.5 flex gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          <span className="leading-relaxed">{renderInline(t.replace(/^[-•*]\s+/, ""), counter, highlights)}</span>
        </div>
      );
    } else if (/^\d+[.)]\s+/.test(t)) {
      flush();
      const num = t.match(/^(\d+)[.)]\s+/)?.[1];
      blocks.push(
        <div key={`n${counter++}`} className="mb-1.5 flex gap-2.5">
          <span className="min-w-5 text-right font-bold text-brand-600 dark:text-brand-400">{num}.</span>
          <span className="leading-relaxed">{renderInline(t.replace(/^\d+[.)]\s+/, ""), counter, highlights)}</span>
        </div>
      );
    } else {
      para.push(t);
    }
  }
  flush();
  return <div className={cn("text-[15px] text-ink/85 dark:text-cream/85", className)}>{blocks}</div>;
}

/* ------------------------------- Toasts ------------------------------ */

type Toast = { id: number; title: string; kind?: "success" | "error" };
const ToastCtx = createContext<{ toast: (title: string, kind?: "success" | "error") => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const toast = useCallback((title: string, kind: "success" | "error" = "success") => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, title, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl animate-pop dark:bg-cream dark:text-ink"
          >
            <span
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                t.kind === "error" ? "bg-red-500" : "bg-brand-400 text-ink"
              )}
            >
              {t.kind === "error" ? <X size={12} /> : <Check size={12} />}
            </span>
            {t.title}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* ----------------------------- date helpers --------------------------- */

export function formatDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - start) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDue(iso: string): string {
  if (!iso) return "No due date";
  const d = new Date(`${iso}T23:59:59`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* =========================== RICH TEXT EDITOR =========================== */

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold transition",
        active
          ? "bg-brand-500/15 text-brand-700 dark:bg-brand-500/25 dark:text-brand-300"
          : "text-ink/55 hover:bg-ink/8 hover:text-ink dark:text-cream/55 dark:hover:bg-cream/10 dark:hover:text-cream"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <span className="mx-0.5 h-5 w-px bg-ink/10 dark:bg-cream/15" />;
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 300,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  const syncActive = useCallback(() => {
    const a: Record<string, boolean> = {};
    a.bold = document.queryCommandState("bold");
    a.italic = document.queryCommandState("italic");
    a.underline = document.queryCommandState("underline");
    a.strikeThrough = document.queryCommandState("strikeThrough");
    a.insertUnorderedList = document.queryCommandState("insertUnorderedList");
    a.insertOrderedList = document.queryCommandState("insertOrderedList");
    setActive(a);
  }, []);

  const exec = useCallback(
    (cmd: string, val?: string) => {
      document.execCommand(cmd, false, val);
      ref.current?.focus();
      syncActive();
      onChange(ref.current?.innerHTML ?? "");
    },
    [onChange, syncActive]
  );

  const handleInput = useCallback(() => {
    onChange(ref.current?.innerHTML ?? "");
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            exec("bold");
            break;
          case "i":
            e.preventDefault();
            exec("italic");
            break;
          case "u":
            e.preventDefault();
            exec("underline");
            break;
        }
      }
    },
    [exec]
  );

  const insertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) exec("createLink", url);
  }, [exec]);

  const setColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      exec("foreColor", e.target.value);
    },
    [exec]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 dark:border-cream/15">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ink/10 bg-ink/[0.03] px-2 py-1.5 dark:border-cream/10 dark:bg-cream/[0.03]">
        <ToolbarBtn active={active.bold} onClick={() => exec("bold")} title="Bold (Ctrl+B)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </ToolbarBtn>
        <ToolbarBtn active={active.italic} onClick={() => exec("italic")} title="Italic (Ctrl+I)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </ToolbarBtn>
        <ToolbarBtn active={active.underline} onClick={() => exec("underline")} title="Underline (Ctrl+U)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </ToolbarBtn>
        <ToolbarBtn active={active.strikeThrough} onClick={() => exec("strikeThrough")} title="Strikethrough">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-3 3c0 2 1 3 3 3"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M15 12c2 0 3 1 3 3a3 3 0 0 1-3 3H8"/></svg>
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn onClick={() => exec("formatBlock", "H1")} title="Heading 1">
          <span className="text-xs font-extrabold">H1</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "H2")} title="Heading 2">
          <span className="text-xs font-extrabold">H2</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "H3")} title="Heading 3">
          <span className="text-[11px] font-extrabold">H3</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "P")} title="Paragraph">
          <span className="text-xs">¶</span>
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn active={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")} title="Bullet list">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
        </ToolbarBtn>
        <ToolbarBtn active={active.insertOrderedList} onClick={() => exec("insertOrderedList")} title="Numbered list">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="8" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">1</text><text x="3" y="14" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">2</text><text x="3" y="20" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">3</text></svg>
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn onClick={() => exec("indent")} title="Indent">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="7 10 3 12 7 14"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("outdent")} title="Outdent">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="3 10 7 12 3 14"/></svg>
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn onClick={insertLink} title="Insert link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </ToolbarBtn>

        <ToolbarSep />

        <label className="flex h-8 items-center gap-1 rounded-lg px-1.5 text-ink/55 transition hover:bg-ink/8 hover:text-ink dark:text-cream/55 dark:hover:bg-cream/10 dark:hover:text-cream" title="Text color">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><path d="M9.354 4H14.646L19 16h-2.5l-1.2-3H8.7l-1.2 3H5L9.354 4z"/></svg>
          <input type="color" className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" onChange={setColor} defaultValue="#000000" />
        </label>

        <ToolbarSep />

        <ToolbarBtn onClick={() => exec("removeFormat")} title="Clear formatting">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="4" x2="20" y2="20"/><path d="M6 12l4-4 4 4 4-4"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("undo")} title="Undo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("redo")} title="Redo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={syncActive}
        onKeyUp={syncActive}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder ?? "Start writing..."}
        className="min-h-[300px] bg-white px-5 py-4 text-[15px] leading-relaxed text-ink/85 outline-none empty:before:text-ink/30 dark:bg-surface-dark dark:text-cream/85 dark:before:text-cream/30 [&:empty]:before:content-[attr(data-placeholder)] [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink [&_h1]:dark:text-cream [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h2]:dark:text-cream [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-ink [&_h3]:dark:text-cream [&_li]:ml-4 [&_li]:list-disc [&_li]:pl-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:ml-4 [&_ul]:list-disc"
        style={{ minHeight }}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}
