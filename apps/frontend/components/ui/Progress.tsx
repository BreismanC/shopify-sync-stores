"use client";

import * as React from "react";
import { Progress as ProgressRadix } from "radix-ui";

import { cn } from "@/utils/class-names";

function Progress({
  value,
  className,
  ...props
}: React.ComponentProps<typeof ProgressRadix.Root>) {
  return (
    <ProgressRadix.Root
      data-slot="progress"
      {...props}
      value={value}
      className={cn("relative h-[18px] w-36 overflow-hidden rounded-full bg-gray-4", className)}
      style={{
        transform: "translateZ(0)",
      }}
    >
      <ProgressRadix.Indicator
        data-slot="progress-indicator"
        className="ease-[cubic-bezier(0.65, 0, 0.35, 1)] size-full bg-accent-8 transition-transform duration-[660ms]"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressRadix.Root>
  );
}

export { Progress };
