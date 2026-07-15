import { auth } from '@/auth';
import { BACKEND_URL } from '@/lib/env';

export type StoreRole = 'SOURCE' | 'VENDOR';

export interface CurrentStore {
  id: string;
  shopifyShopId: string;
  role: StoreRole;
  storeKey?: string;
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
    const response = await fetch(`${BACKEND_URL}/api/stores/me`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as StoreStatusResponse;
    const store = data.store;
    if (store && !store.storeKey) {
      const fallbackSeed =
        process.env.NEXT_PUBLIC_STORE_KEY_FALLBACK ?? store.id;
      store.storeKey = fallbackSeed
        .replaceAll('-', '')
        .slice(0, 13);
    }
    return store;
  } catch {
    return null;
  }
}
