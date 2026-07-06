import path from "path";
import type { NextConfig } from "next";

const rootPath = path.resolve(__dirname, "../..");

// Hosts permitidos para hacer cross-origin requests al dev server.
// Necesario para que el tunnel de cloudflared (usado para recibir
// webhooks de MercadoPago en dev) pueda cargar HMR / assets.
const allowedDevOrigins = [
  "rise-liabilities-concept-humor.trycloudflare.com",
];

const nextConfig: NextConfig = {
  turbopack: {
    // root: rootPath,
  },
  outputFileTracingRoot: rootPath,
  allowedDevOrigins,
};

export default nextConfig;
