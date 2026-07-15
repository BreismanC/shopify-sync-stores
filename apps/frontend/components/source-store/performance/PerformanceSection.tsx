import { PerformanceCard } from "./PerformanceCard";
import type { PerformanceMetric } from "@/components/source-store/data";

interface PerformanceSectionProps {
  metrics: PerformanceMetric[];
  feedbackHref?: string;
}

export function PerformanceSection({
  metrics,
  feedbackHref = "/dashboard/help/data",
}: PerformanceSectionProps) {
  return (
    <section className="mt-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-on-background">
          Performance
        </h2>
        <a
          href={feedbackHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          Contanos qué datos querés ver
        </a>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <PerformanceCard key={metric.label} metric={metric} />
        ))}
      </div>
    </section>
  );
}
