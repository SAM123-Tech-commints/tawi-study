import { requireUser } from "@/lib/auth";
import OnboardingForm from "@/components/onboarding";

export default async function OnboardingPage() {
  // Intentionally no redirect when a role is already set: this page doubles
  // as "Account type" settings, so users can change their role anytime.
  await requireUser();
  return <OnboardingForm />;
}
