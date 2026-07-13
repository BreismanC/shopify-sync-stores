import Link from "next/link";
import { Card } from "@/components/ui/Card";

export function WhatsNewCard() {
  return (
    <Card className="min-h-68 rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
      <div className="grid h-full grid-cols-1 items-center gap-8 md:grid-cols-[minmax(240px,0.9fr)_minmax(320px,1.1fr)]">
        <div>
          <h3 className="text-2xl font-semibold leading-tight tracking-tight text-gray-12">
            Sincronizá stock a múltiples ubicaciones
          </h3>
          <p className="mt-6 max-w-80 text-base leading-6 text-gray-11">
            Multi-location te permite elegir dónde sincronizar el stock en tu
            tienda destino.
          </p>
          <p className="mt-4 max-w-80 text-base leading-6 text-gray-11">
            Para usar Multi-location, activá la opción en la página Tiendas.
          </p>
          <Link
            href="/dashboard/help/multi-location"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-accent-9 px-5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-10"
          >
            Conocé más
          </Link>
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 460 220"
          className="hidden h-52 w-full md:block"
          fill="none"
        >
          <path
            d="M292 167c35 15 54-8 82 3 17 7 27-2 39-16"
            stroke="var(--gray-12)"
            strokeWidth="3"
            strokeDasharray="9 8"
            strokeLinecap="round"
          />
          <path
            d="M401 112c0-18 14-32 32-32s32 14 32 32c0 25-32 53-32 53s-32-28-32-53Z"
            fill="var(--accent-9)"
            transform="translate(-15 -8) scale(.75)"
          />
          <circle
            cx="310"
            cy="47"
            r="25"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <circle
            cx="340"
            cy="47"
            r="25"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <circle
            cx="325"
            cy="70"
            r="28"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <circle
            cx="355"
            cy="71"
            r="24"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <circle
            cx="296"
            cy="73"
            r="23"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <circle
            cx="322"
            cy="92"
            r="24"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <path
            d="M296 95 336 154M322 113l14 41M355 94l-19 60M340 70l-4 84"
            stroke="var(--gray-12)"
            strokeWidth="1.5"
          />
          <path
            d="m320 155 20-13 20 14-3 29-23 7-19-17 5-20Z"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <path
            d="m320 155 23 18 17-17M343 173l-9 19"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <path
            d="M126 147 178 127l42 19v60l-52 13-42-22v-50Z"
            fill="var(--accent-12)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <path
            d="m178 127 42 19-52 17-42-16 52-20ZM168 163v56"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
          <path
            d="M142 160v18M156 165v19M184 159v18M199 154v19M184 188v18M200 183v18"
            stroke="var(--gray-1)"
            strokeWidth="5"
          />
          <path
            d="M93 184c0-15 9-27 20-27s20 12 20 27c0 10-7 17-17 19v16h-6v-16c-10-2-17-9-17-19Z"
            fill="var(--gray-1)"
            stroke="var(--gray-12)"
            strokeWidth="2"
          />
        </svg>
      </div>
    </Card>
  );
}
