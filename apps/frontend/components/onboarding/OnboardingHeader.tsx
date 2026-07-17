"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

export function OnboardingHeader() {
  const { data: session } = useSession();
  const initials = (session?.user?.name || session?.user?.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-6 bg-gray-1">
      <nav className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="h-8 w-8 text-accent-9">
            <svg
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.59L7.59 13.17a.996.996 0 1 1 1.41-1.41L11 13.75V7c0-.55.45-1 1-1s1 .45 1 1v6.75l2-2a.996.996 0 1 1 1.41 1.41L13.41 16.59a.996.001 0 0 1 -1.41 0z"></path>
            </svg>
          </div>
          <span className="text-xl font-semibold text-accent-9">SyncShop</span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Notificaciones"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
          >
            <Bell className="h-5 w-5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menú de perfil"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-9/10 text-accent-9 text-sm font-semibold transition-colors hover:bg-accent-9/20"
            >
              {initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="min-w-[180px] rounded-lg border border-gray-6 bg-gray-1 p-1 shadow-lg"
            >
              <DropdownMenuItem
                onSelect={() => signOut({ callbackUrl: "/auth/login" })}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-12 outline-none focus:bg-gray-3"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
