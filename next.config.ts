import type { NextConfig } from "next";

// Cache Components is left off on purpose: every page here reads the signed-in
// session, so pages render per request. See docs: "Caching (Previous Model)".
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Character sheet uploads go through a Server Action (limit 8 MB in src/lib/sheets.ts, plus form overhead).
    serverActions: { bodySizeLimit: "9mb" },
  },
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
