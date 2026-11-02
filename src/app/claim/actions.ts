"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { gmClaims, profiles } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { hashClaimCode } from "@/lib/claim";
import { getCurrentUser } from "@/lib/session";

export type ClaimState = { ok?: boolean; error?: string };

// Simple per-process throttle: at most 10 attempts per user per 10 minutes.
const attempts = new Map<string, number[]>();
function throttled(userId: string) {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  attempts.set(userId, recent);
  return recent.length > 10;
}

export async function claimGm(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const viewer = await getCurrentUser();
  if (!viewer) return { error: "Sign in first." };
  if (viewer.status !== "active") return { error: "This account is blocked." };
  if (throttled(viewer.userId)) return { error: "Too many tries. Wait a few minutes." };

  const code = String(formData.get("code") ?? "").trim();
  if (code.length < 20) return { error: "That link is incomplete." };

  // The code is looked up by its hash; the plain code is never stored.
  const hash = hashClaimCode(code);
  const used = await db
    .update(gmClaims)
    .set({ usedBy: viewer.userId, usedAt: new Date() })
    .where(and(eq(gmClaims.codeHash, hash), isNull(gmClaims.usedAt), gt(gmClaims.expiresAt, new Date())))
    .returning({ id: gmClaims.id, note: gmClaims.note });
  if (used.length === 0) return { error: "That link has expired or was already used. Ask for a new one." };

  if (viewer.role !== "admin") {
    await db
      .insert(profiles)
      .values({ userId: viewer.userId, role: "gm" })
      .onConflictDoUpdate({ target: profiles.userId, set: { role: "gm" } });
  }
  await writeAudit(
    { ...viewer, role: viewer.role === "admin" ? "admin" : "gm" },
    { action: "gm-claim.used", targetUserId: viewer.userId, before: { role: viewer.role }, after: { role: "gm", note: used[0].note } },
  );
  return { ok: true };
}
