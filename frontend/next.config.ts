import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker builds
  experimental: {
    // Enable modern features
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
