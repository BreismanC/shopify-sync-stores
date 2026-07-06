import type { ComponentType } from "react";

export type UserRole = "OWNER" | "ADMIN" | "MEMBER";

export interface MenuItem {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
  isDisabled?: boolean;
  isSheetTrigger?: boolean;
}

export interface ProfileWithRole {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: UserRole;
  onboardingStatus?: string;
}