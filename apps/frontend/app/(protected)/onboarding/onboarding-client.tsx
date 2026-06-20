"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
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
  const { data: session } = useSession();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="h-8 w-8 text-primary">
            <svg
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.59L7.59 13.17a.996.996 0 1 1 1.41-1.41L11 13.75V7c0-.55.45-1 1-1s1 .45 1 1v6.75l2-2a.996.996 0 1 1 1.41 1.41L13.41 16.59a.996.001 0 0 1 -1.41 0z"></path>
            </svg>
          </div>
          <span className="text-xl font-bold text-on-background">SyncShop</span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-on-surface-variant sm:inline">
            {session?.user?.email}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
        <OnboardingStepper currentStep={currentStep} />
      </section>

      <section>
        {currentStep === 1 ? <Step1Company /> : null}
        {currentStep === 2 ? <Step2Plan /> : null}
        {currentStep === 3 ? <Step3Store /> : null}
        {currentStep === 4 ? <Step4Role /> : null}
        {currentStep === 5 ? <Step5Team /> : null}
      </section>
    </div>
  );
}
