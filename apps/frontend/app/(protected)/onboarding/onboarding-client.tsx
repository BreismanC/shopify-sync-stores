"use client";

import { useSession } from "next-auth/react";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { Step1Company } from "@/components/onboarding/steps/Step1Company";
import { Step2Plan } from "@/components/onboarding/steps/Step2Plan";
import { Step3Store } from "@/components/onboarding/steps/Step3Store";
import { Step4Role } from "@/components/onboarding/steps/Step4Role";
import { Step5Team } from "@/components/onboarding/steps/Step5Team";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";

interface OnboardingClientProps {
  currentStep: number;
  onboardingStatus: OnboardingStatus;
}

export function OnboardingClient({
  currentStep,
  onboardingStatus,
}: OnboardingClientProps) {
  useSession();

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-2">
      <OnboardingHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        <section className="rounded-xl border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <OnboardingStepper currentStep={currentStep} />
        </section>

        <section>
          {currentStep === 1 ? <Step1Company /> : null}
          {currentStep === 2 ? <Step2Plan /> : null}
          {currentStep === 3 ? <Step3Store /> : null}
          {currentStep === 4 ? <Step4Role /> : null}
          {currentStep === 5 ? <Step5Team /> : null}
        </section>
      </main>
    </div>
  );
}
