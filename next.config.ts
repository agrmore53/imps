import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PWA will be configured separately with next.config.mjs for production builds
  // For now, use empty turbopack config to allow development
  turbopack: {},
};

export default nextConfig;
