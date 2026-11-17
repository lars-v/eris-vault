import "server-only";
import { randomInt } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { parseSchemeChoice, SCHEME_COOKIE, SCHEME_KEYS, type SchemeKey } from "@/lib/schemes";

/**
 * The scheme this page is drawn in. Read from the cookie so the first paint is right on every
 * page, signed in or not; the account's saved choice keeps the cookie in step (SchemeSync).
 * Strife picks one at random per request; cached so the layout and the browser bar agree.
 */
export const activeScheme = cache(async (): Promise<{ choice: ReturnType<typeof parseSchemeChoice>; scheme: SchemeKey }> => {
  const choice = parseSchemeChoice((await cookies()).get(SCHEME_COOKIE)?.value);
  const scheme = choice === "strife" ? SCHEME_KEYS[randomInt(SCHEME_KEYS.length)] : choice;
  return { choice, scheme };
});
