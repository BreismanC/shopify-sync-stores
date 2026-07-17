import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";

declare module "next-auth" {
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
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    tenantId?: string | null;
    role?: string;
    isOwner?: boolean;
    accessToken?: string;
    refreshToken?: string;
    onboardingStatus?: OnboardingStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    refreshToken?: string;
    user?: {
      id: string;
      email: string;
      name: string;
      tenantId: string | null;
      role: string;
      isOwner?: boolean;
      onboardingStatus?: OnboardingStatus;
    };
    onboardingStatus?: OnboardingStatus;
    isOwner?: boolean;
    error?: string;
  }
}

export {};
