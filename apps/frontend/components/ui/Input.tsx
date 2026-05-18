import * as React from "react";

import { cn } from "@/utils/class-names";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} data-slot="input" className={cn(className)} {...props} />;
  }
);

Input.displayName = "Input";

export { Input };
