"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, EyeOff, GraduationCap, KeyRound, LogOut, Pencil, RefreshCw, Settings2, Trash2, User, Users } from "lucide-react";
import { Avatar, Button, Card, cn, Field, Input, Spinner, Textarea, useToast } from "@/components/ui";
import { ACCENTS, applyAccent, useTheme, type ThemeMode } from "@/components/theme";
import {
  getApiKeyAction,
  getAvatarAction,
  getProfileAction,
  getUserSettings,
  regenerateApiKeyAction,
  removeAvatarAction,
  revokeApiKeyAction,
  signoutAction,
  updateAvatarAction,
  updateProfileAction,
  updateSettingsAction,
} from "@/lib/actions";

/** Cover-banner gradients keyed by accent id (mirrors the community profile card). */
const BANNER_GRADIENTS: Record<string, string> = {
  lime: "from-brand-300 to-brand-500",
  violet: "from-violet-300 to-violet-500",
  sky: "from-sky-300 to-sky-500",
  amber: "from-amber-300 to-amber-500",
  rose: "from-rose-300 to-rose-500",
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [institution, setInstitution] = useState("");
  const [bio, setBio] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [banner, setBanner] = useState("lime");
  const [appearOffline, setAppearOffline] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerWork, setTimerWork] = useState(25);
  const [timerBreak, setTimerBreak] = useState(5);
  const [timerLongBreak, setTimerLongBreak] = useState(15);
  const [timerRounds, setTimerRounds] = useState(4);
  const [theme, setTheme] = useState("system");
  const [accent, setAccent] = useState("lime");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [profile, settings, keyRes, av] = await Promise.all([
      getProfileAction(),
      getUserSettings(),
      getApiKeyAction(),
      getAvatarAction(),
    ]);
    if (!profile) {
      router.push("/signin");
      return;
    }
    setName(profile.name);
    setEmail(profile.email);
    setRole(profile.role ?? "student");
    setInstitution(profile.institution ?? "");
    setBio(profile.bio ?? "");
    setCourse(profile.course ?? "");
    setYearLevel(profile.yearLevel ?? "");
    setBanner(profile.banner ?? "lime");
    setAppearOffline(profile.appearOffline);
    setAvatar(av ?? profile.avatar);
    if (settings) {
      setTimerEnabled(settings.timerEnabled);
      setTimerWork(settings.timerWork);
      setTimerBreak(settings.timerBreak);
      setTimerLongBreak(settings.timerLongBreak);
      setTimerRounds(settings.timerRounds);
      const t = (["light", "dark", "system"] as const).includes(settings.theme as ThemeMode)
        ? (settings.theme as ThemeMode)
        : "system";
      setTheme(t);
      setMode(t);
      setAccent(settings.accent ?? "lime");
      applyAccent(settings.accent ?? "lime");
    }
    if (keyRes.ok) setApiKey(keyRes.key ?? null);
    setLoading(false);
  }, [router, setMode]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAccount = async () => {
    setSaving(true);
    const res = await updateProfileAction({
      name,
      role,
      institution,
      bio,
      course,
      yearLevel,
      banner,
      appearOffline,
    });
    setSaving(false);
    if (res.ok) {
      toast("Profile updated ✨");
      router.refresh();
    } else toast(res.error ?? "Could not save", "error");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      toast("Image must be under 500KB", "error");
      return;
    }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const res = await updateAvatarAction(dataUrl);
      setUploadingAvatar(false);
      if (res.ok) {
        setAvatar(dataUrl);
        toast("Profile picture updated");
        router.refresh();
      } else toast(res.error ?? "Could not upload", "error");
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    const res = await removeAvatarAction();
    setUploadingAvatar(false);
    if (res.ok) {
      setAvatar(null);
      toast("Profile picture removed");
      router.refresh();
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    const res = await updateSettingsAction({
      timerEnabled,
      timerWork,
      timerBreak,
      timerLongBreak,
      timerRounds,
      theme,
      accent,
    });
    setSaving(false);
    if (res.ok) toast("Settings saved");
    else toast(res.error ?? "Could not save", "error");
  };

  const regenKey = async () => {
    setKeyBusy(true);
    const res = await regenerateApiKeyAction();
    setKeyBusy(false);
    if (res.ok && res.key) {
      setApiKey(res.key);
      toast("New collaboration key generated 🔑");
    } else toast(res.error ?? "Could not generate key", "error");
  };

  const revokeKey = async () => {
    setKeyBusy(true);
    const res = await revokeApiKeyAction();
    setKeyBusy(false);
    if (res.ok) {
      setApiKey(null);
      toast("Collaboration key revoked");
    } else toast(res.error ?? "Could not revoke key", "error");
  };

  const copyKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
    } catch {
      /* clipboard unavailable */
    }
    toast("Key copied — share it with collaborators 🤝");
  };

  const signOut = async () => {
    await signoutAction();
    toast("Signed out. See you soon!");
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold tracking-tight text-ink dark:text-cream">
          <User size={26} /> Profile
        </h1>
        <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
          Your identity, account type, settings and collaboration key — all in one place.
        </p>
      </section>

      {/* Identity */}
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatar ? (
              <img
                src={avatar}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-ink/10 dark:ring-cream/15"
              />
            ) : (
              <Avatar name={name || email} size={80} />
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
                <Spinner className="h-6 w-6 border-white/30 border-t-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}>
                <Camera size={14} /> Upload image
              </Button>
              {avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeAvatar}
                  disabled={uploadingAvatar}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <Trash2 size={14} /> Remove
                </Button>
              )}
            </div>
            <p className="text-[12px] text-ink/45 dark:text-cream/45">JPG, PNG or WebP. Max 500KB.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email">
          <Input value={email} disabled className="opacity-60" />
        </Field>
      </Card>

      {/* Account type */}
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-bold text-ink dark:text-cream">Account type</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["student", "Student", Pencil, "Study kits, flashcards & practice tests"],
              ["educator", "Educator", GraduationCap, "Assignments & worksheets to share"],
            ] as const
          ).map(([id, label, Icon, desc]) => (
            <button
              key={id}
              onClick={() => setRole(id)}
              className={`rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] ${
                role === id
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-ink/10 hover:border-ink/25 dark:border-cream/15"
              }`}
            >
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-cream">
                <Icon size={15} /> {label}
              </p>
              <p className="mt-1 text-xs text-ink/55 dark:text-cream/55">{desc}</p>
            </button>
          ))}
        </div>
        <Field label="Institution">
          <Input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. University of the Philippines"
          />
        </Field>
        <Button onClick={saveAccount} disabled={saving || name.trim().length < 2}>
          {saving ? <Spinner className="border-ink/30 border-t-ink" /> : <Check size={15} />} Save profile
        </Button>
      </Card>

      {/* Community profile */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
          <Users size={18} /> Community profile
        </h2>
        <p className="text-[13px] text-ink/55 dark:text-cream/55">
          This is what other members see when they open your profile in the Workspace community.
        </p>

        {/* Live preview */}
        <div>
          <div className={cn("h-20 rounded-2xl bg-gradient-to-br", BANNER_GRADIENTS[banner] ?? BANNER_GRADIENTS.lime)} />
          <div className="-mt-8 ml-5 mb-1 inline-block rounded-full ring-4 ring-surface dark:ring-surface-dark">
            {avatar ? (
              <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <Avatar name={name || email} size={64} />
            )}
          </div>
        </div>

        <Field label="Profile banner" hint="The cover color at the top of your community profile card.">
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setBanner(a.id)}
                title={a.label}
                aria-label={`${a.label} banner`}
                className={cn(
                  "h-10 w-16 rounded-xl bg-gradient-to-br transition hover:scale-105 active:scale-95",
                  BANNER_GRADIENTS[a.id],
                  banner === a.id
                    ? "ring-2 ring-ink ring-offset-2 dark:ring-cream dark:ring-offset-surface-dark"
                    : "ring-1 ring-ink/10 dark:ring-cream/15"
                )}
              />
            ))}
          </div>
        </Field>

        <Field label="Bio / About me" hint="A short intro shown on your profile. Up to 300 characters.">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Tell the community a bit about yourself…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course">
            <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. BSIT" maxLength={60} />
          </Field>
          <Field label="Year level">
            <Input
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              placeholder="e.g. 2nd year"
              maxLength={40}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink/4 p-3.5 dark:bg-cream/5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-cream">
              <EyeOff size={14} /> Appear offline
            </p>
            <p className="text-xs text-ink/55 dark:text-cream/55">
              Hide your green “online” dot from other members. You can still post, comment and react.
            </p>
          </div>
          <button
            onClick={() => setAppearOffline((v) => !v)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              appearOffline ? "bg-brand-500" : "bg-ink/15 dark:bg-cream/20"
            )}
            aria-label="Toggle appear offline"
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                appearOffline ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>

        <Button onClick={saveAccount} disabled={saving || name.trim().length < 2}>
          {saving ? <Spinner className="border-ink/30 border-t-ink" /> : <Check size={15} />} Save profile
        </Button>
      </Card>

      {/* Settings — directly below account type */}
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
          <Settings2 size={18} /> Settings
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink/4 p-3.5 dark:bg-cream/5">
          <div>
            <p className="text-sm font-bold text-ink dark:text-cream">Study timer popup</p>
            <p className="text-xs text-ink/55 dark:text-cream/55">
              Off by default. Turn on to show a floating focus timer on your dashboard.
            </p>
          </div>
          <button
            onClick={() => setTimerEnabled((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${timerEnabled ? "bg-brand-500" : "bg-ink/15 dark:bg-cream/20"}`}
            aria-label="Toggle timer popup"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${timerEnabled ? "left-6" : "left-1"}`}
            />
          </button>
        </div>
        {timerEnabled && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Focus (min)">
              <Input type="number" min={1} max={120} value={timerWork} onChange={(e) => setTimerWork(Math.max(1, Number(e.target.value) || 25))} />
            </Field>
            <Field label="Short break">
              <Input type="number" min={1} max={60} value={timerBreak} onChange={(e) => setTimerBreak(Math.max(1, Number(e.target.value) || 5))} />
            </Field>
            <Field label="Long break">
              <Input type="number" min={1} max={60} value={timerLongBreak} onChange={(e) => setTimerLongBreak(Math.max(1, Number(e.target.value) || 15))} />
            </Field>
            <Field label="Rounds">
              <Input type="number" min={1} max={10} value={timerRounds} onChange={(e) => setTimerRounds(Math.max(1, Number(e.target.value) || 4))} />
            </Field>
          </div>
        )}
        <Field label="Theme">
          <div className="flex gap-2">
            {([
              ["light", "☀️ Light"],
              ["dark", "🌙 Dark"],
              ["system", "💻 System"],
            ] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  setMode(t);
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                  theme === t
                    ? "bg-brand-500 text-ink"
                    : "bg-ink/5 text-ink/60 hover:bg-ink/10 dark:bg-cream/10 dark:text-cream/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Accent color" hint="Recolors buttons, highlights, rings and badges across the whole app.">
          <div className="flex gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setAccent(a.id);
                  applyAccent(a.id);
                }}
                title={a.label}
                aria-label={`${a.label} accent`}
                className={`grid h-11 w-11 place-items-center rounded-full transition hover:scale-110 active:scale-90 ${
                  accent === a.id ? "ring-2 ring-ink ring-offset-2 dark:ring-cream dark:ring-offset-surface-dark" : "ring-1 ring-ink/10 dark:ring-cream/15"
                }`}
                style={{ background: a.swatch }}
              >
                {accent === a.id && <Check size={16} className="text-ink" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Field>
        <Button onClick={saveSettings} disabled={saving} variant="outline">
          {saving ? <Spinner className="h-4 w-4" /> : <Check size={15} />} Save settings
        </Button>
      </Card>

      {/* Collaboration API key */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
          <KeyRound size={18} /> Collaboration key
        </h2>
        <p className="text-[13px] leading-relaxed text-ink/60 dark:text-cream/60">
          Share this key with people you collaborate with so their tools can fetch your shared kits
          through the API (<code className="rounded bg-ink/5 px-1 dark:bg-cream/10">POST /api/extract</code> with{" "}
          <code className="rounded bg-ink/5 px-1 dark:bg-cream/10">{"{ key }"}</code>). Regenerating
          invalidates the old key instantly.
        </p>
        {apiKey ? (
          <div className="flex gap-2">
            <Input value={apiKey} readOnly className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="sm" onClick={copyKey}>
              <Copy size={14} /> Copy
            </Button>
          </div>
        ) : (
          <p className="rounded-xl bg-ink/4 p-3 text-[13px] text-ink/55 dark:bg-cream/5 dark:text-cream/55">
            No key yet — generate one to start collaborating.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={regenKey} disabled={keyBusy}>
            <RefreshCw size={14} /> {apiKey ? "Regenerate" : "Generate"} key
          </Button>
          {apiKey && (
            <Button variant="ghost" size="sm" onClick={revokeKey} disabled={keyBusy} className="text-red-500">
              <Trash2 size={14} /> Revoke
            </Button>
          )}
        </div>
      </Card>

      <Card className="border border-red-500/20 p-6">
        <h2 className="text-lg font-bold text-ink dark:text-cream">Sign out</h2>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
