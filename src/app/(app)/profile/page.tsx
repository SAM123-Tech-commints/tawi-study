"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { User, Settings, Shield, LogOut, RefreshCw, XCircle } from "lucide-react";
import { Button, Card, Input, Spinner, useToast } from "@/components/ui";
import { signoutAction } from "@/lib/actions";
import { getUser } from "@/lib/auth";
import { getUserSettings, updateSettingsAction } from "@/lib/actions";

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApi, setShowApi] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const timerLabel = timerEnabled ? "Disable Timer" : "Enable Timer";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const user = await getUser();
      if (!user) {
        router.push("/signin");
        return;
      }
      const settings = await getUserSettings();
      if (settings) {
        const storedApi = (user as { settings: any }).settings?.apiKey ?? null;
        setApiKey(storedApi ?? null);
        setShowApi(!!storedApi);
        setTimerEnabled((settings as any).timerEnabled ?? false);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await signoutAction();
    router.push("/signin");
    toast("Signed out.");
  };

  const handleTimerToggle = async () => {
    const res = await updateSettingsAction({
      timerWork: 25,
      timerBreak: 5,
      timerLongBreak: 15,
      timerRounds: 4,
      theme: "system",
      language: "en",
      timerEnabled: !timerEnabled,
    });
    if (res.ok) {
      setTimerEnabled(!timerEnabled);
      toast(`Timer ${!timerEnabled ? "enabled" : "disabled"}`);
    } else {
      toast(res.error ?? "Could not update", "error");
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
    <div className="mx-auto max-w-xl space-y-8 p-6">
      {/* Profile Header */}
      <div className="text-center border-b border-ink/10 pb-6">
        <div className="grid h-24 w-24 place-items-center rounded-full mb-4 bg-brand-100 dark:bg-cream/[0.03]">
          <User size={32} className="text-brand-600 dark:text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink dark:text-cream">
          Tawi Study
        </h1>
        <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
          Account: Student
        </p>
      </div>

      {/* API Key section */}
      {showApi && (
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink dark:text-cream">API Key</h2>
          <p className="mt-2 text-[13px] text-ink/60 dark:text-cream/60">
            Your API key lets Tawi connect to AI services.
          </p>
          <div className="mt-4 flex gap-2">
            <Input
              value={apiKey ?? ""}
              onChange={(e) => setApiKey(e.target.value)}
              readOnly
              placeholder="API key (hidden for security)"
              className="flex-1 py-2 px-3 rounded border border-ink/20 bg-cream/5 dark:border-cream/15 dark:text-cream/20"
            />
            <Button variant="outline" size="sm" onClick={() => setApiKey("")}>
              <RefreshCw size={14} /> Regenerate
            </Button>
          </div>
        </Card>
      )}

      {/* Timer toggle */}
      {showApi && (
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink dark:text-cream">Study Timer</h2>
          <p className="mt-2 text-[13px] text-ink/60 dark:text-cream/60">
            Pomodoro-style timer for focused study sessions.
          </p>
          <Button onClick={handleTimerToggle} className="w-full">
            {timerLabel}
          </Button>
        </Card>
      )}

      {/* Logout */}
      <Card className="p-6 border border-red-500/20">
        <h2 className="font-display text-lg font-bold text-ink dark:text-cream">Log Out</h2>
        <p className="mt-2 text-[13px] text-ink/60 dark:text-cream/60">
          Are you sure you want to sign out?
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={handleLogout}>
            Sign Out
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}