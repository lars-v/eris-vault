import type { NextConfig } from "next";

// Cache Components is left off on purpose: every page here reads the signed-in
// session, so pages render per request. See docs: "Caching (Previous Model)".
const nextConfig: NextConfig = {
  poweredByHeader: false,
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
