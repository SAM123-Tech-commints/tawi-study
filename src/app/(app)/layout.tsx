import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        isGuest: user.isGuest,
        isAdmin: isAdminUser(user),
      }}
    >
      {children}
    </AppShell>
  );
}
