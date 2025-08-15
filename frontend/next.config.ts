import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove deprecated experimental.turbo
  // Add proper configuration for production
  swcMinify: true,
  reactStrictMode: true,
};

export default nextConfig;
