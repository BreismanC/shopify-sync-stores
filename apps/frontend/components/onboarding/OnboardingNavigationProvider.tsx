"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface OnboardingNavigationContextValue {
  navigate: (href: string) => void;
  isNavigating: boolean;
}

const OnboardingNavigationContext = createContext<
  OnboardingNavigationContextValue | undefined
>(undefined);

export function OnboardingNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [targetHref, setTargetHref] = useState<string | null>(null);

  const navigate = useCallback(
    (href: string) => {
      setTargetHref(href);
      startTransition(() => router.push(href));
    },
    [router],
  );

  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (targetHref && currentHref === targetHref) {
      setTargetHref(null);
    }
  }, [currentHref, targetHref]);

  const value = useMemo(
    () => ({
      navigate,
      isNavigating: isPending || targetHref !== null,
    }),
    [isPending, navigate, targetHref],
  );

  return (
    <OnboardingNavigationContext.Provider value={value}>
      {children}
      {value.isNavigating ? <OnboardingTransitionLoader /> : null}
    </OnboardingNavigationContext.Provider>
  );
}

export function useOnboardingNavigationContext() {
  const context = useContext(OnboardingNavigationContext);
  if (!context) {
    throw new Error(
      "useOnboardingNavigationContext must be used within OnboardingNavigationProvider",
    );
  }
  return context;
}

export function OnboardingTransitionLoader() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-2/85 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label="Cargando el siguiente paso"
    >
      <div className="flex items-center gap-3 rounded-xl border border-gray-6 bg-gray-1 px-5 py-4 text-sm font-medium text-gray-11 shadow-lg">
        <Loader2
          className="h-5 w-5 animate-spin text-accent-9"
          aria-hidden="true"
        />
        <span>Cargando el siguiente paso...</span>
      </div>
    </div>
  );
}
