"use client";

import { cn } from "@/utils/class-names";
import { ChevronUpIcon } from "@radix-ui/react-icons";
import { Collapsible as CollapsibleRadix } from "radix-ui";

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsibleRadix.Root>) {
  return <CollapsibleRadix.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleRadix.CollapsibleTrigger>) {
  return (
    <CollapsibleRadix.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn(
        "w-full px-2 py-1 cursor-pointer bg-gray-2 hover:bg-gray-3 rounded-md [&[data-state=open]_#trigger]:rotate-180 data-[state=open]:rounded-b-none",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        {children}
        <ChevronUpIcon
          id="trigger"
          className="icon size-1.5 text-gray-11 transition-transform duration-200 [&[data-state=open]]:rotate-180"
        />
      </div>
    </CollapsibleRadix.CollapsibleTrigger>
  );
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleRadix.CollapsibleContent>) {
  return (
    <CollapsibleRadix.CollapsibleContent
      className={cn(
        "bg-gray-2 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className,
      )}
      data-slot="collapsible-content"
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
