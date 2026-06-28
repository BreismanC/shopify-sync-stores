import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/class-names";

const alertVariants = cva("flex gap-1 space-y-0.5 p-1 rounded-md border", {
  variants: {
    variant: {
      default: "",
      info: "bg-info text-info-contrast border-info-contrast",
      success: "bg-success text-success-contrast border-success-contrast",
      warning: "bg-warning text-warning-contrast border-warning-contrast",
      danger: "bg-danger text-danger-contrast border-danger-contrast",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-medium", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" {...props} />;
}

function AlertContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-content"
      className={cn("flex items-center justify-between", className)}
      {...props}
    />
  );
}

function AlertIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="alert-icon" {...props} />;
}

export {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertIcon,
  AlertContent,
  alertVariants,
};