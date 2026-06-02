import path from "path";
import type { NextConfig } from "next";

const rootPath = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  turbopack: {
    // root: rootPath,
  },
  outputFileTracingRoot: rootPath,
};

export default nextConfig;
