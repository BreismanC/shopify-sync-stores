/**
 * Mapping helpers between OnboardingStatus and step number (1-5).
 * Mirror of the backend helper in
 * `apps/backend/src/domain/enums/onboarding-status.enum.ts`.
 */

export enum OnboardingStatus {
  PENDING_TENANT_CONFIG = 'PENDING_TENANT_CONFIG',
  PENDING_PLAN_SELECTION = 'PENDING_PLAN_SELECTION',
  PENDING_STORE_CONFIG = 'PENDING_STORE_CONFIG',
  PENDING_STORE_ROLE = 'PENDING_STORE_ROLE',
  PENDING_TEAM_CONFIG = 'PENDING_TEAM_CONFIG',
  COMPLETED = 'COMPLETED',
}

export const TOTAL_ONBOARDING_STEPS = 5;

export const ONBOARDING_STATUS_TO_STEP: Record<OnboardingStatus, number> = {
  [OnboardingStatus.PENDING_TENANT_CONFIG]: 1,
  [OnboardingStatus.PENDING_PLAN_SELECTION]: 2,
  [OnboardingStatus.PENDING_STORE_CONFIG]: 3,
  [OnboardingStatus.PENDING_STORE_ROLE]: 4,
  [OnboardingStatus.PENDING_TEAM_CONFIG]: 5,
  [OnboardingStatus.COMPLETED]: 6,
};

export const STEP_TO_ONBOARDING_STATUS: Record<number, OnboardingStatus> = {
  1: OnboardingStatus.PENDING_TENANT_CONFIG,
  2: OnboardingStatus.PENDING_PLAN_SELECTION,
  3: OnboardingStatus.PENDING_STORE_CONFIG,
  4: OnboardingStatus.PENDING_STORE_ROLE,
  5: OnboardingStatus.PENDING_TEAM_CONFIG,
};

export interface OnboardingStepDefinition {
  number: number;
  slug: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    number: 1,
    slug: 'company',
    title: 'Configura tu empresa',
    description: 'Ingresa el nombre de tu organización',
  },
  {
    number: 2,
    slug: 'plan',
    title: 'Selecciona tu plan',
    description: 'Elegí un plan o probá gratis por 7 días',
  },
  {
    number: 3,
    slug: 'store',
    title: 'Conecta tu tienda Shopify',
    description: 'Agregá el dominio y el access token de tu tienda',
  },
  {
    number: 4,
    slug: 'role',
    title: 'Definí el rol de tu tienda',
    description: 'Elegí si tu tienda es fuente (SOURCE) o destino (VENDOR)',
  },
  {
    number: 5,
    slug: 'team',
    title: 'Invita a tu equipo',
    description: 'Sumá personas para que te ayuden a gestionar tu tienda',
  },
];

export function isValidStep(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_ONBOARDING_STEPS;
}

export function isValidStatus(s: unknown): s is OnboardingStatus {
  return (
    typeof s === 'string' &&
    Object.values(OnboardingStatus).includes(s as OnboardingStatus)
  );
}

export function stepToStatus(step: number): OnboardingStatus | null {
  if (!isValidStep(step)) return null;
  return STEP_TO_ONBOARDING_STATUS[step];
}

export function statusToStep(status: OnboardingStatus | string | undefined): number {
  if (!status || !isValidStatus(status)) return 1;
  return ONBOARDING_STATUS_TO_STEP[status as OnboardingStatus];
}

export function isStepUnlocked(
  requestedStep: number,
  currentStatus: OnboardingStatus | string | undefined,
): boolean {
  const currentStep = statusToStep(currentStatus);
  if (currentStatus === OnboardingStatus.COMPLETED) return true;
  return requestedStep <= currentStep;
}
