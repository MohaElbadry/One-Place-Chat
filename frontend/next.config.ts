import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable modern features
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
