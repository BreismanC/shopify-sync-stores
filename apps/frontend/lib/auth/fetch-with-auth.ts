'use client';

import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import useSWR, { SWRConfiguration, SWRResponse } from 'swr';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '@/lib/env';

export interface AuthFetchError extends Error {
  status?: number;
  statusText?: string;
}

export interface FetchWithAuthOptions extends RequestInit {
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  dedupingInterval?: number;
  refreshInterval?: number;
}

function buildAuthHeaders(
  accessToken?: string,
  additionalHeaders?: Record<string, string>,
): HeadersInit {
  const headers: Record<string, string> = {
    ...additionalHeaders,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function fetchWithAuth<T = unknown>(
  url: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
  const headers = buildAuthHeaders(accessToken, options.headers as Record<string, string>);

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: AuthFetchError = new Error(
      `HTTP ${response.status}: ${response.statusText}`,
    );
    error.status = response.status;
    error.statusText = response.statusText;
    throw error;
  }

  return response.json() as Promise<T>;
}

export function useAuthFetch<T = unknown>(
  url: string | null,
  options: FetchWithAuthOptions = {},
): SWRResponse<T, AuthFetchError> {
  const { data: session, status } = useSession();
  const router = useRouter();
  const accessToken = session?.accessToken;

  const swrConfig: SWRConfiguration = {
    revalidateOnFocus: options.revalidateOnFocus ?? true,
    revalidateOnReconnect: options.revalidateOnReconnect ?? true,
    dedupingInterval: options.dedupingInterval ?? 2000,
    refreshInterval: options.refreshInterval,
    shouldRetryOnError: false,
    onError: (err) => {
      if ((err as AuthFetchError).status === 401) {
        router.push('/auth/login');
      }
    },
  };

  // Pass SWR-specific options to useSWR
  const swrResponse = useSWR<T, AuthFetchError>(
    url && status === 'authenticated' ? [url, accessToken] : null,
    ([fetchUrl, token]) => fetchWithAuth<T>(fetchUrl, options, token as string),
    swrConfig,
  );

  return swrResponse;
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  return fetchWithAuth<T>(endpoint, options, accessToken);
}
