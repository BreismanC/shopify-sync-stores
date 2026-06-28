import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/class-names";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-1.5 py-0.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-8 focus:ring-offset-2",
  {
    variants: {
      status: {
        default: "bg-gray-2 text-gray-12 border-gray-6",
        info: "bg-info text-info-contrast border-info-contrast",
        success: "bg-success text-success-contrast border-success-contrast",
        warning: "bg-warning text-warning-contrast border-warning-contrast",
        danger: "bg-danger text-danger-contrast border-danger-contrast",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, status, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ status }), className)} {...props} />
  );
}

export { Badge, badgeVariants };


