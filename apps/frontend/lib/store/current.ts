import { auth } from "@/auth";
import { BACKEND_URL } from "@/lib/env";

export type StoreRole = "SOURCE" | "VENDOR";

export interface CurrentStore {
  id: string;
  shopifyShopId: string;
  role: StoreRole;
  isActive: boolean;
}

interface StoreStatusResponse {
  store: CurrentStore | null;
}

export async function getCurrentStore(): Promise<CurrentStore | null> {
  const session = await auth();

  if (!session?.accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/onboarding/store/status`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as StoreStatusResponse;
    return data.store;
  } catch {
    return null;
  }
}
