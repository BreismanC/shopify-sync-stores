import { Store } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SourceDashboard } from "@/components/dashboard/SourceDashboard";
import { VendorDashboard } from "@/components/dashboard/VendorDashboard";
import { getCurrentStore } from "@/lib/store/current";

export default async function DashboardPage() {
  const store = await getCurrentStore();

  if (!store) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center p-6">
        <Card className="w-full rounded-lg border border-gray-6 bg-gray-1 p-8 text-center shadow-sm">
          <Store className="mx-auto size-10 text-gray-10" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-gray-12">
            No pudimos cargar tu tienda
          </h1>
          <p className="mt-2 text-sm text-gray-11">
            Verificá la conexión con Shopify y volvé a intentarlo.
          </p>
        </Card>
      </main>
    );
  }

  return store.role === "VENDOR" ? (
    <VendorDashboard store={store} />
  ) : (
    <SourceDashboard store={store} />
  );
}
