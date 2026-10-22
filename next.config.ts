import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
