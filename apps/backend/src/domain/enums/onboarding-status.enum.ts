export enum OnboardingStatus {
  PENDING_TENANT_CONFIG = 'PENDING_TENANT_CONFIG',
  PENDING_PLAN_SELECTION = 'PENDING_PLAN_SELECTION',
  PENDING_STORE_CONFIG = 'PENDING_STORE_CONFIG',
  PENDING_STORE_ROLE = 'PENDING_STORE_ROLE',
  PENDING_TEAM_CONFIG = 'PENDING_TEAM_CONFIG',
  COMPLETED = 'COMPLETED',
}

/**
 * Map onboarding status to a human-readable step number (1-indexed).
 * Used by the frontend to derive the current step from session.
 */
export const ONBOARDING_STATUS_TO_STEP: Record<OnboardingStatus, number> = {
  [OnboardingStatus.PENDING_TENANT_CONFIG]: 1,
  [OnboardingStatus.PENDING_PLAN_SELECTION]: 2,
  [OnboardingStatus.PENDING_STORE_CONFIG]: 3,
  [OnboardingStatus.PENDING_STORE_ROLE]: 4,
  [OnboardingStatus.PENDING_TEAM_CONFIG]: 5,
  [OnboardingStatus.COMPLETED]: 6,
};

/**
 * Reverse map: step number to onboarding status.
 */
export const STEP_TO_ONBOARDING_STATUS: Record<number, OnboardingStatus> = {
  1: OnboardingStatus.PENDING_TENANT_CONFIG,
  2: OnboardingStatus.PENDING_PLAN_SELECTION,
  3: OnboardingStatus.PENDING_STORE_CONFIG,
  4: OnboardingStatus.PENDING_STORE_ROLE,
  5: OnboardingStatus.PENDING_TEAM_CONFIG,
};

export const TOTAL_ONBOARDING_STEPS = 5;
