"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/Dialog";

export default function ConnectStoreButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-green-9 hover:bg-green-10 text-white">
          <Plus className="size-3.5" />
          <span>Connect new store</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar tienda Shopify</DialogTitle>
          <DialogDescription>
            Para conectar una tienda real, necesitas autenticarte con Shopify
            OAuth (próximamente).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button mode="pill">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}