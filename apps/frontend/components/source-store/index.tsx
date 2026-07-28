import { WelcomeHeader } from "@/components/source-store/welcome/WelcomeHeader";
import { PerformanceSection } from "@/components/source-store/performance/PerformanceSection";
import { StoreKeyCard } from "@/components/source-store/store/StoreKeyCard";
import { YourAccountCard } from "@/components/source-store/account/YourAccountCard";
import { HaveYourSayCard } from "@/components/source-store/feedback/HaveYourSayCard";
import { ResourcesCard } from "@/components/source-store/resources/ResourcesCard";
import {
  MOCK_PERFORMANCE,
  MOCK_STORE,
  MOCK_RESOURCES,
  MOCK_ACCOUNT_LINKS,
  MOCK_FEEDBACK_LINKS,
} from "@/components/source-store/data";

export function DashboardSource() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <WelcomeHeader />
      <PerformanceSection metrics={MOCK_PERFORMANCE} />

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3.2fr)]">
        <section>
          <h2 className="text-xl font-semibold text-on-background">
            Lo esencial
          </h2>
          <div className="mt-4 flex flex-col gap-6">
            <StoreKeyCard storeKey={MOCK_STORE.storeKey} />
            <YourAccountCard links={MOCK_ACCOUNT_LINKS} />
            <HaveYourSayCard links={MOCK_FEEDBACK_LINKS} />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-on-background">Recursos</h2>
          <div className="mt-4">
            <ResourcesCard links={MOCK_RESOURCES} />
          </div>
        </section>
      </div>
    </main>
  );
}
