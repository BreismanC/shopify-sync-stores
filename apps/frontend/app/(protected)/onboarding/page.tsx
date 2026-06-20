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
