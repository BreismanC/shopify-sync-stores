import { auth } from '@/auth';
import { BACKEND_URL } from '@/lib/env';
import { getCurrentStore } from '@/lib/store/current';
import StoresClient from './stores-client';

interface CurrentStoreApiResponse {
  store: {
    id: string;
    shopifyShopId: string;
    role: 'SOURCE' | 'VENDOR';
    storeKey?: string;
    isActive: boolean;
  } | null;
}

export default async function StoresPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  let currentStore = await getCurrentStore();

  if (accessToken && !currentStore) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stores/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as CurrentStoreApiResponse;
        currentStore = data.store;
      }
    } catch {
      currentStore = null;
    }
  }

  return <StoresClient currentStore={currentStore} />;
}
