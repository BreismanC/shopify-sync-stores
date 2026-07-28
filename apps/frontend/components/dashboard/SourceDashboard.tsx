import type { CurrentStore } from '@/lib/store/current';
import {
  AccountCard,
  FeedbackCard,
  GuidesCard,
  MetricCard,
  type DashboardLink,
} from '@/components/dashboard/DashboardCards';
import { StoreKeyCard } from '@/components/dashboard/StoreKeyCard';

interface SourceDashboardProps {
  store: CurrentStore;
}

const guides: DashboardLink[] = [
  { label: 'Guía de inicio rápido', href: '/dashboard/help/quick-start' },
  { label: 'Conectar una tienda', href: '/dashboard/help/connect-store' },
  { label: 'Sincronizar productos', href: '/dashboard/help/sync-products' },
  {
    label: 'Buenas prácticas y sincronización saludable',
    href: '/dashboard/help/best-practices',
  },
];

const metrics = [
  { label: 'Tiendas conectadas', value: 2, period: 'Hasta hoy' },
  { label: 'Productos sincronizados', value: 9, period: 'Hasta hoy' },
  {
    label: 'Órdenes con productos sincronizados',
    value: 9,
    period: 'Últimos 30 días',
  },
  {
    label: 'Productos sincronizados vendidos',
    value: 15,
    period: 'Últimos 30 días',
  },
];

function resolveStoreKey(store: CurrentStore): string {
  if (store.storeKey && store.storeKey.length > 0) return store.storeKey;
  return store.id.replaceAll('-', '').slice(0, 13);
}

export function SourceDashboard({ store }: SourceDashboardProps) {
  const storeKey = resolveStoreKey(store);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-gray-6 pb-5">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-12">
          Bienvenido
        </h1>
        <p className="mt-1 text-base text-gray-11">
          Aprovechá SSS al máximo para enfocarte en hacer crecer tu negocio.
        </p>
      </header>

      <section className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-12">Performance</h2>
          <a
            href="/dashboard/help/data"
            className="text-sm font-medium text-accent-9 hover:underline"
          >
            Contanos qué datos querés ver
          </a>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3.2fr)]">
        <section>
          <h2 className="text-xl font-semibold text-gray-12">Lo esencial</h2>
          <div className="mt-4 flex flex-col gap-6">
            <StoreKeyCard storeKey={storeKey} />
            <AccountCard
              links={[
                {
                  label: "Configuración de la cuenta",
                  href: "/dashboard/profile",
                },
              ]}
            />
            <FeedbackCard />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-12">Recursos</h2>
          <div className="mt-4">
            <GuidesCard links={guides} />
          </div>
        </section>
      </div>
    </main>
  );
}
