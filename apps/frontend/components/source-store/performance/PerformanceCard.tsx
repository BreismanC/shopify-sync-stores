import { Card } from "@/components/ui/Card";
import type { PerformanceMetric } from "@/components/source-store/data";

interface PerformanceCardProps {
  metric: PerformanceMetric;
}

export function PerformanceCard({ metric }: PerformanceCardProps) {
  return (
    <Card className="flex min-h-48 flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <p className="max-w-56 text-base leading-5 text-on-surface-variant">
        {metric.label}
      </p>
      <p className="mt-6 text-xl font-semibold leading-none tabular-nums text-on-background">
        {metric.value}
      </p>
      <p className="mt-auto pt-6 text-sm text-on-surface-variant">
        {metric.sublabel}
      </p>
    </Card>
  );
}
