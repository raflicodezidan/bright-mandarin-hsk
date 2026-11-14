import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/tests/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/media/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
