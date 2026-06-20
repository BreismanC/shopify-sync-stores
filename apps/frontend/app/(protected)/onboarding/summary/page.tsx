import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardingSummary } from "@/components/onboarding/OnboardingSummary";
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
} from "@/lib/auth/onboarding-status";

export default async function OnboardingSummaryPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const status = session.user?.onboardingStatus;
  if (!isValidStatus(status) || status === OnboardingStatus.COMPLETED) {
    redirect("/dashboard");
  }

  // El resumen solo se muestra si el usuario llegó al menos al paso 5.
  const currentStep = statusToStep(status);
  if (currentStep < 5) {
    redirect(`/onboarding?step=${currentStep}`);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <OnboardingSummary />
    </div>
  );
}
