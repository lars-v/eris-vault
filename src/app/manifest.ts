import type { MetadataRoute } from "next";

// Lets players add the vault to their home screen and open it without browser bars at the table.
// Icons are icon.svg rendered on the ink ground (public/icon-*.png).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eris Vault",
    short_name: "Eris Vault",
    description: "Character keeper for the Planet Eris OD&D campaign.",
    start_url: "/party",
    display: "standalone",
    background_color: "#0f100d",
    theme_color: "#0f100d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
