"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isGuideKey } from "@/lib/guide";
import { requireUser } from "@/lib/session";

/** Remembers that the viewer finished or skipped a guide, so it doesn't open on its own again. */
export async function markGuideSeen(key: string) {
  const viewer = await requireUser();
  if (!isGuideKey(key)) return;
  await db
    .update(profiles)
    .set({ guidesSeen: sql`array_append(array_remove(${profiles.guidesSeen}, ${key}), ${key})` })
    .where(eq(profiles.userId, viewer.userId));
}
