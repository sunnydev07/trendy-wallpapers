import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["sharp"],
  images: {
    unoptimized: true,
    // Omitting `search` matches any query string, so bounded preview URLs are allowed.
    localPatterns: [
      { pathname: "/api/download" },
      { pathname: "/api/demo-image/**" },
      { pathname: "/curated/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.fal.media",
      },
    ],
  },
};

export default nextConfig;
