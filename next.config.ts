import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WordPress permalinks all end with "/" — keep the exact URL shape for SEO.
  trailingSlash: true,
  images: { unoptimized: true },
  // admin: media uploads and large Elementor page HTML go through Server Actions (Vercel caps requests at 4.5MB)
  experimental: { serverActions: { bodySizeLimit: "20mb" }, proxyClientMaxBodySize: "20mb" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
