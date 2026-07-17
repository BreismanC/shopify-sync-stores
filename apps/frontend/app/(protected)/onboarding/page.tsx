import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
  isValidStep,
  isStepUnlocked,
} from "@/lib/auth/onboarding-status";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const requestedStep = Number(params.step);

  const onboardingStatus: OnboardingStatus = isValidStatus(
    session.user?.onboardingStatus,
  )
    ? (session.user!.onboardingStatus as OnboardingStatus)
    : OnboardingStatus.PENDING_TENANT_CONFIG;
  const isOwner =
    session.user?.isOwner === true || session.user?.role === "OWNER";

  // El wizard es exclusivo para owners. Un miembro solo entra a la app
  // cuando el tenant está en paso 5 o completed.
  if (!isOwner) {
    if (
      onboardingStatus === OnboardingStatus.PENDING_TEAM_CONFIG ||
      onboardingStatus === OnboardingStatus.COMPLETED
    ) {
      redirect("/dashboard");
    }
    redirect("/unauthorized?reason=team-member-not-invited");
  }

  // Si completó el onboarding, fuera de acá.
  if (onboardingStatus === OnboardingStatus.COMPLETED) {
    redirect("/dashboard");
  }

  const currentStep = statusToStep(onboardingStatus);

  // Si no hay ?step válido o el step no está desbloqueado, mandamos al actual.
  if (!isValidStep(requestedStep) || !isStepUnlocked(requestedStep, onboardingStatus)) {
    redirect(`/onboarding?step=${currentStep}`);
  }

  return (
    <OnboardingClient
      currentStep={requestedStep}
      onboardingStatus={onboardingStatus}
    />
  );
}
