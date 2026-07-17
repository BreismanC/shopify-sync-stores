import type { DefaultSession } from 'next-auth';
import type { OnboardingStatus } from '@/lib/auth/onboarding-status';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string | null;
      role: string;
      isOwner: boolean;
      onboardingStatus: OnboardingStatus;
    } & DefaultSession['user'];
  }
}
