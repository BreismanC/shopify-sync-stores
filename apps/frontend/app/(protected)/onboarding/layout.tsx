import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  OnboardingStatus,
  isValidStatus,
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
  const isOwner =
    session.user?.isOwner === true || session.user?.role === "OWNER";

  // Los invitados no completan onboarding. Solo pueden acceder a la app
  // desde el paso 5 del tenant o cuando el tenant ya está completed.
  if (!isOwner) {
    if (
      status === OnboardingStatus.PENDING_TEAM_CONFIG ||
      status === OnboardingStatus.COMPLETED
    ) {
      redirect("/dashboard");
    }
    redirect("/unauthorized?reason=team-member-not-invited");
  }

  if (isValidStatus(status) && status === OnboardingStatus.COMPLETED) {
    redirect("/dashboard");
  }

  return <div className="min-h-screen bg-gray-2">{children}</div>;
}
