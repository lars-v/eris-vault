import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { activeScheme } from "@/lib/scheme-server";
import { resolveScheme, SCHEMES, schemeStyles } from "@/lib/schemes";

// Self-hosted (SIL Open Font License, see src/fonts) so builds never depend on Google Fonts.
const fell = localFont({
  src: "../fonts/im-fell-english-sc-latin-400-normal.woff2",
  variable: "--font-fell",
  display: "swap",
});
const inter = localFont({
  src: [
    { path: "../fonts/inter-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/inter-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/inter-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/jetbrains-mono-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Eris Vault", template: "%s · Eris Vault" },
  description: "Character keeper for the Planet Eris OD&D campaign.",
  appleWebApp: { title: "Eris Vault", statusBarStyle: "black-translucent" },
};

// Browser bars match the scheme's ground; `cover` lets the phone tab bar pad itself for the home indicator.
// Zoom stays on (no maximumScale): pinch-zoom is an accessibility need.
export async function generateViewport(): Promise<Viewport> {
  const { scheme } = await activeScheme();
  return {
    themeColor: resolveScheme(scheme).ink,
    colorScheme: SCHEMES[scheme].mode,
    viewportFit: "cover",
  };
}

// Built once: the CSS for every scheme, keyed on <html data-scheme>.
const SCHEME_CSS = schemeStyles();

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { choice, scheme } = await activeScheme();
  return (
    <html
      lang="en"
      data-scheme={scheme}
      data-scheme-choice={choice}
      className={`${fell.variable} ${inter.variable} ${mono.variable}`}
    >
      <head>
        <style>{SCHEME_CSS}</style>
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
