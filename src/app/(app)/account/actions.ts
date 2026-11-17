"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isSchemeKey, SCHEME_COOKIE } from "@/lib/schemes";
import { requireUser } from "@/lib/session";

/** Saves the viewer's color scheme to their account and this device. Display only, so no audit entry. */
export async function setColorScheme(formData: FormData) {
  const viewer = await requireUser();
  const choice = formData.get("scheme");
  if (choice !== "strife" && !isSchemeKey(choice)) return;
  await db.update(profiles).set({ colorScheme: choice }).where(eq(profiles.userId, viewer.userId));
  (await cookies()).set(SCHEME_COOKIE, choice, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
