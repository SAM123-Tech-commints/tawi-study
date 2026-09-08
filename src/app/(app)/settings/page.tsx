import { redirect } from "next/navigation";

// Settings now live inside Profile (below Account type) — keep the old URL working.
export default function SettingsRedirect() {
  redirect("/profile");
}
