"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Clock,
  Palette,
  RemoveFormatting,
  Save,
  Trash2,
  User,
} from "lucide-react";
import {
  getAvatarAction,
  getUserSettings,
  removeAvatarAction,
  updateAvatarAction,
  updateSettingsAction,
} from "@/lib/actions";
import {
  Button,
  Card,
  Field,
  Input,
  Spinner,
  useToast,
} from "@/components/ui";

type Settings = {
  timerWork: number;
  timerBreak: number;
  timerLongBreak: number;
  timerRounds: number;
  theme: string;
  language: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    timerWork: 25,
    timerBreak: 5,
    timerLongBreak: 15,
    timerRounds: 4,
    theme: "system",
    language: "en",
  });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getUserSettings();
    if (s) setSettings(s);
    const av = await getAvatarAction();
    if (av) setAvatar(av);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    const res = await updateSettingsAction(settings);
    setSaving(false);
    if (res.ok) toast("Settings saved");
    else toast(res.error ?? "Could not save", "error");
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
        toast("Avatar updated");
        router.refresh();
      } else {
        toast(res.error ?? "Could not upload", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    const res = await removeAvatarAction();
    setUploadingAvatar(false);
    if (res.ok) {
      setAvatar(null);
      toast("Avatar removed");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold tracking-tight text-ink dark:text-cream">
          <Palette size={26} /> Settings
        </h1>
        <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
          Customize your study experience.
        </p>
      </section>

      {/* Avatar */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
          <User size={18} /> Profile Picture
        </h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-ink/10 dark:ring-cream/15"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-500 text-3xl font-bold text-ink">
                <Camera size={28} />
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
                <Spinner className="h-6 w-6 border-white/30 border-t-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
              >
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
      </Card>

      {/* Study Timer */}
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
          <Clock size={18} /> Study Timer
        </h2>
        <p className="text-[13px] text-ink/55 dark:text-cream/55">
          Pomodoro-style timer. Focus for a set time, then take a break.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Focus (min)">
            <Input
              type="number"
              min={1}
              max={120}
              value={settings.timerWork}
              onChange={(e) =>
                setSettings({ ...settings, timerWork: Math.max(1, Number(e.target.value) || 25) })
              }
            />
          </Field>
          <Field label="Short break (min)">
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.timerBreak}
              onChange={(e) =>
                setSettings({ ...settings, timerBreak: Math.max(1, Number(e.target.value) || 5) })
              }
            />
          </Field>
          <Field label="Long break (min)">
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.timerLongBreak}
              onChange={(e) =>
                setSettings({ ...settings, timerLongBreak: Math.max(1, Number(e.target.value) || 15) })
              }
            />
          </Field>
          <Field label="Rounds before long break">
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.timerRounds}
              onChange={(e) =>
                setSettings({ ...settings, timerRounds: Math.max(1, Number(e.target.value) || 4) })
              }
            />
          </Field>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-cream">
          <Palette size={18} /> Appearance
        </h2>
        <Field label="Theme">
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSettings({ ...settings, theme: t })}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  settings.theme === t
                    ? "bg-brand-500 text-ink"
                    : "bg-ink/5 text-ink/60 hover:bg-ink/10 dark:bg-cream/10 dark:text-cream/60 dark:hover:bg-cream/15"
                }`}
              >
                {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "💻 System"}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? <Spinner className="border-ink/30 border-t-ink" /> : <Save size={16} />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
