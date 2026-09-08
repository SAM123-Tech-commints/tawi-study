/** Shared admin helpers — safe to import from both server and client code. */

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: { email: string; isAdmin: boolean } | null): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return adminEmails().includes(user.email.toLowerCase());
}
