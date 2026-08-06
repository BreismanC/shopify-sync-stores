import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-2"
      role="status"
      aria-live="polite"
      aria-label="Cargando onboarding"
    >
      <div className="flex items-center gap-3 rounded-xl border border-gray-6 bg-gray-1 px-5 py-4 text-sm font-medium text-gray-11 shadow-sm">
        <Loader2
          className="h-5 w-5 animate-spin text-accent-9"
          aria-hidden="true"
        />
        <span>Cargando...</span>
      </div>
    </div>
  );
}
