import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
} from "@/lib/auth/onboarding-status";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  // Si el usuario ya completó el onboarding, no tiene sentido estar acá.
  const status = session.user?.onboardingStatus;
  if (isValidStatus(status) && status === OnboardingStatus.COMPLETED) {
    redirect("/dashboard");
  }

  return <div className="min-h-screen bg-surface">{children}</div>;
}
