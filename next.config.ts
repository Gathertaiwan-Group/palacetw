import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WordPress permalinks all end with "/" — keep the exact URL shape for SEO.
  trailingSlash: true,
  // proxy.ts re-implements the trailing-slash redirect for site pages; API routes (notably /api/mcp, which MCP
  // clients POST to without a slash and may not follow a 308) answer on both forms.
  skipTrailingSlashRedirect: true,
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
