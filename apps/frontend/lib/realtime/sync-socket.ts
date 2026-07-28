"use client";

import { io, type Socket } from "socket.io-client";
import { BACKEND_URL } from "@/lib/env";

export function createSyncSocket(token: string): Socket {
  return io(`${BACKEND_URL}/sync`, {
    auth: { token },
    path: "/sync/socket.io",
    transports: ["polling"],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
}
