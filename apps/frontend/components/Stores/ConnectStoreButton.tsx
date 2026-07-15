"use client";

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import ConnectStoreDialog from './ConnectStoreDialog';
import type { CurrentStore } from '@/lib/store/current';
import { useState } from 'react';

interface ConnectStoreButtonProps {
  currentStore: CurrentStore | null;
  onConnected?: () => void;
}

export default function ConnectStoreButton({
  currentStore,
  onConnected,
}: ConnectStoreButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-accent-9 hover:bg-accent-10 text-accent-contrast"
        aria-label="Conectar tienda"
      >
        <Plus className="size-3.5" />
        <span>Conectar tienda</span>
      </Button>
      <ConnectStoreDialog
        open={open}
        onOpenChange={setOpen}
        currentStore={currentStore}
        onConnected={() => onConnected?.()}
      />
    </>
  );
}
