'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import { cn } from '@/utils/class-names';
import type { AuraContainer } from '@/components/ui/Section';

interface DialogModalProps {
  trigger?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  container?: AuraContainer;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DialogModal({
  title,
  description,
  trigger,
  footer,
  children,
  className,
  open,
  onOpenChange,
  container = 'smash',
}: DialogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent
        className={cn(
          container,
          'flex flex-col max-h-[85vh] overflow-hidden p-6 gap-4',
          className,
        )}
      >
        {title || description ? (
          <DialogHeader className="shrink-0 flex flex-col gap-1 text-left">
            {title ? (
              <DialogTitle className="text-xl font-semibold leading-tight text-gray-12">
                {title}
              </DialogTitle>
            ) : null}
            {description ? (
              <DialogDescription className="text-sm text-gray-11">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        ) : null}
        <div className="flex-1 overflow-auto min-h-0">{children}</div>
        {footer ? (
          <div className="shrink-0 pt-2 border-t border-gray-a6">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default DialogModal;
