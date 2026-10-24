import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // backend/ vive dentro del repo del Vue (que tiene su propio lockfile): se fija la raíz aquí.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
