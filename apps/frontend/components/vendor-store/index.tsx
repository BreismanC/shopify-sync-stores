import { StoreKeyCard } from "@/components/source-store/store/StoreKeyCard";
import { YourAccountCard } from "@/components/vendor-store/account/YourAccountCard";
import { HaveYourSayCard } from "@/components/vendor-store/feedback/HaveYourSayCard";
import { WhatsNewCard } from "@/components/vendor-store/news/WhatsNewCard";
import { LearnTheBasicsCard } from "@/components/vendor-store/resources/LearnTheBasicsCard";
import { WelcomeHeader } from "@/components/vendor-store/welcome/WelcomeHeader";
import {
  MOCK_STORE,
  MOCK_LEARN_BASICS,
  MOCK_ACCOUNT_LINKS,
  MOCK_FEEDBACK_LINKS,
} from "@/components/vendor-store/data";

export function DashboardVendor() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <WelcomeHeader />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3.2fr)]">
        <section>
          <h2 className="text-xl font-semibold text-on-background">
            Lo esencial
          </h2>
          <div className="mt-4 flex flex-col gap-5">
            <StoreKeyCard storeKey={MOCK_STORE.storeKey} />
            <YourAccountCard links={MOCK_ACCOUNT_LINKS} />
            <HaveYourSayCard links={MOCK_FEEDBACK_LINKS} />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-on-background">
            Novedades
          </h2>
          <div className="mt-4 flex flex-col gap-6">
            <WhatsNewCard
              featureTitle="Sincronizá stock a múltiples ubicaciones"
              description="Multi-location te permite elegir dónde sincronizar el stock en tu tienda destino."
              bullets={[
                "Para usar Multi-location, activá el toggle en la página Tiendas.",
              ]}
              learnMoreHref="/dashboard/help/multi-location"
            />
            <LearnTheBasicsCard links={MOCK_LEARN_BASICS} />
          </div>
        </section>
      </div>
    </main>
  );
}
