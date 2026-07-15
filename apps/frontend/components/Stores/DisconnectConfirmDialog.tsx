'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { Button } from '@/components/ui/Button';

interface DisconnectConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeLabel: string;
  isPending: boolean;
  onConfirm: () => void;
}

export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  storeLabel,
  isPending,
  onConfirm,
}: DisconnectConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="smosh p-6 flex flex-col gap-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-gray-12">
            ¿Desconectar tienda?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-11">
            Vas a desconectar la tienda{' '}
            <span className="font-medium text-gray-12">{storeLabel}</span>.
            Esta acción no se puede deshacer y dejará de sincronizar
            productos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button mode="pill" isDisabled={isPending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              isLoading={isPending}
              isLoadingText={<>Desconectando…</>}
              className="bg-danger text-danger-contrast hover:opacity-90"
            >
              Desconectar
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
