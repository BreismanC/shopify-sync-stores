import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardingSummary } from "@/components/onboarding/OnboardingSummary";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
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
    <div className="flex min-h-screen w-full flex-col bg-gray-2">
      <OnboardingHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        <OnboardingSummary />
      </main>
    </div>
  );
}
