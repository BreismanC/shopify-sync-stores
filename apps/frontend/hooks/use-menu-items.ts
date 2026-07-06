import { DASHBOARD_ROUTES } from "@/utils/constants";
import type { MenuItem, ProfileWithRole } from "@/types";

export function useMenuItems(profile: ProfileWithRole | null): MenuItem[] {
  if (!profile?.role) {
    return [];
  }

  const userRole = profile.role;

  return DASHBOARD_ROUTES.filter((route: MenuItem) =>
    route.roles.includes(userRole)
  );
}