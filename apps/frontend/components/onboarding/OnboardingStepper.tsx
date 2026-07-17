"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { cn } from "@/utils/class-names";
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
} from "@/lib/auth/onboarding-status";

interface OnboardingStepperProps {
  currentStep: number;
  className?: string;
}

export function OnboardingStepper({ currentStep, className }: OnboardingStepperProps) {
  const progressPercent = Math.min(
    100,
    Math.max(0, ((currentStep - 1) / TOTAL_ONBOARDING_STEPS) * 100),
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-0">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isReachable = step.number <= currentStep;
          const inner = (
            <>
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                  isCompleted && "border-accent-9 bg-accent-9/10 text-accent-9",
                  isCurrent && "border-accent-9 bg-accent-9/10 text-accent-9",
                  !isCompleted && !isCurrent && "border-gray-6 bg-gray-1 text-gray-11",
                  isReachable && !isCurrent && "hover:border-accent-9 hover:text-accent-9",
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step.number}
              </div>
              <span
                className={cn(
                  "mt-2 text-center text-xs font-bold transition-colors",
                  isCurrent ? "text-accent-9" : isCompleted ? "text-accent-9" : "text-gray-11",
                )}
              >
                {step.title}
              </span>
            </>
          );
          return (
            <div key={step.number} className="flex flex-1 items-center sm:flex-col">
              {isReachable ? (
                <Link
                  href={`/onboarding?step=${step.number}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className="group flex flex-1 flex-col items-center sm:p-1"
                >
                  {inner}
                </Link>
              ) : (
                <div aria-disabled className="flex flex-1 flex-col items-center sm:p-1">
                  {inner}
                </div>
              )}
              {idx < ONBOARDING_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "hidden h-[2px] flex-1 sm:block",
                    isCompleted ? "bg-accent-9" : "bg-gray-6",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-3">
        <div
          className="h-full bg-accent-9 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/**
 * Hook compartido por los step components.
 * - `userCurrentStep` es el step real del user (derivado de
 *   `onboardingStatus` en la sesión).
 * - `nextStepAfterSave(currentStep)` decide a dónde redirigir después
 *   de guardar: si el user está en `currentStep` (avanzando), va al
 *   siguiente; si ya lo superó (volvió para editar), lo manda de
 *   vuelta a su step real.
 * - `goToStep(n)` navega explícitamente a un step concreto.
 */
export function useOnboardingNavigation() {
  const router = useRouter();
  const { data: session } = useSession();

  const userCurrentStep = useMemo(() => {
    const raw = session?.user?.onboardingStatus;
    if (isValidStatus(raw)) return statusToStep(raw);
    return 1;
  }, [session?.user?.onboardingStatus]);

  const nextStepAfterSave = useCallback(
    (step: number, updatedStatus?: OnboardingStatus) => {
      const latestUserStep = updatedStatus
        ? statusToStep(updatedStatus)
        : userCurrentStep;
      const target = latestUserStep > step ? latestUserStep : step + 1;
      const safe = Math.min(Math.max(target, 1), TOTAL_ONBOARDING_STEPS);
      router.push(`/onboarding?step=${safe}`);
    },
    [router, userCurrentStep],
  );

  const goToStep = useCallback(
    (step: number) => {
      const safe = Math.min(Math.max(step, 1), TOTAL_ONBOARDING_STEPS);
      router.push(`/onboarding?step=${safe}`);
    },
    [router],
  );

  const goToSummary = useCallback(() => {
    router.push("/onboarding/summary");
  }, [router]);

  return { userCurrentStep, nextStepAfterSave, goToStep, goToSummary };
}
