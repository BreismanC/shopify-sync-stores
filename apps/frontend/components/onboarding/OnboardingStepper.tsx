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
  return (
    <ol
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2",
        className,
      )}
    >
      {ONBOARDING_STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        const isReachable = step.number <= currentStep;
        const inner = (
          <>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                isCompleted && "border-primary bg-primary text-white",
                isCurrent && "border-primary text-primary",
                !isCompleted && !isCurrent && "border-outline-variant text-on-surface-variant",
                isReachable && !isCurrent && "group-hover:border-primary group-hover:text-primary",
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : step.number}
            </div>
            <div className="flex flex-1 flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  isCurrent ? "text-on-background" : "text-on-surface-variant",
                )}
              >
                {step.title}
              </span>
              <span className="hidden text-xs text-on-surface-variant sm:block">
                {step.description}
              </span>
            </div>
          </>
        );
        return (
          <li
            key={step.number}
            className="flex flex-1 items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2"
          >
            {isReachable ? (
              <Link
                href={`/onboarding?step=${step.number}`}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex flex-1 items-center gap-3 rounded-md transition-colors hover:bg-surface-container-low sm:flex-col sm:items-stretch sm:gap-2 sm:p-1"
              >
                {inner}
              </Link>
            ) : (
              <div
                aria-disabled
                className="flex flex-1 items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2 sm:p-1"
              >
                {inner}
              </div>
            )}
            {idx < ONBOARDING_STEPS.length - 1 ? (
              <div
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  isCompleted ? "bg-primary" : "bg-outline-variant",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
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
    (step: number) => {
      const target = userCurrentStep > step ? userCurrentStep : step + 1;
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
