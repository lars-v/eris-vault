"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SCHEME_COOKIE, SCHEME_KEYS, type SchemeChoice } from "@/lib/schemes";

// The path the current Strife scheme was drawn for. The server picks on a full load.
let strifePath: string | null = null;

/**
 * The page is drawn from the scheme cookie; the account holds the real choice. When they differ
 * (first sign-in on this device, or the scheme changed on another one), copy the account's
 * choice into the cookie and redraw.
 *
 * Strife: the root layout doesn't redraw on in-app navigation, so pick a new scheme here.
 * Cosmetic only, so Math.random is fine (game dice are rolled on the server).
 */
export function SchemeSync({ choice }: { choice: SchemeChoice }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (document.documentElement.dataset.schemeChoice === choice) return;
    document.cookie = `${SCHEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    router.refresh();
  }, [choice, router]);

  useEffect(() => {
    if (choice !== "strife") return;
    if (strifePath !== null && strifePath !== pathname) {
      const root = document.documentElement;
      const others = SCHEME_KEYS.filter((k) => k !== root.dataset.scheme);
      root.dataset.scheme = others[Math.floor(Math.random() * others.length)];
    }
    strifePath = pathname;
  }, [choice, pathname]);

  return null;
}
