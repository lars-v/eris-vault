"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, characterClasses, characters, gmClaims, inventory, profiles, sessions, users, type Role } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { claimExpiry, hashClaimCode, newClaimCode } from "@/lib/claim";
import { canChangeAccount } from "@/lib/roles";
import { isRailwayAdmin, requireAdmin, requireStaff } from "@/lib/session";
import { LIZ } from "@/lib/seed/liz";

async function currentRow(userId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row ?? { userId, role: "player" as Role, status: "active" as const };
}

export async function setRole(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!["player", "gm", "admin"].includes(role)) throw new Error("Unknown role");
  const target = { userId, railwayAdmin: await isRailwayAdmin(userId) };
  if (!canChangeAccount(actor, target)) throw new Error("That account can't be changed here");
  const before = await currentRow(userId);
  await db
    .insert(profiles)
    .values({ userId, role })
    .onConflictDoUpdate({ target: profiles.userId, set: { role } });
  await writeAudit(actor, { action: "account.role", targetUserId: userId, before: { role: before.role }, after: { role } });
  revalidatePath("/admin");
}

export async function setStatus(formData: FormData) {
  // GM and admin can block (plan: Who can do what).
  const actor = await requireStaff();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "blocked") throw new Error("Unknown status");
  const targetIsRailwayAdmin = await isRailwayAdmin(userId);
  if (targetIsRailwayAdmin || userId === actor.userId) throw new Error("That account can't be blocked here");
  const before = await currentRow(userId);
  if (actor.role !== "admin" && (before.role === "gm" || before.role === "admin")) {
    throw new Error("Only an admin can block a GM or admin");
  }
  await db
    .insert(profiles)
    .values({ userId, status })
    .onConflictDoUpdate({ target: profiles.userId, set: { status } });
  await writeAudit(actor, {
    action: "account.status",
    targetUserId: userId,
    before: { status: before.status },
    after: { status },
  });
  revalidatePath("/admin");
}

export type ClaimLinkState = { url?: string; error?: string };

export async function createClaimLink(_prev: ClaimLinkState, formData: FormData): Promise<ClaimLinkState> {
  const actor = await requireAdmin();
  const note = String(formData.get("note") ?? "").slice(0, 80) || null;
  const code = newClaimCode();
  const expiresAt = claimExpiry();
  await db.insert(gmClaims).values({ codeHash: hashClaimCode(code), note, createdBy: actor.userId, expiresAt });
  await writeAudit(actor, { action: "gm-claim.created", after: { note, expiresAt: expiresAt.toISOString() } });
  revalidatePath("/admin");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { url: `${proto}://${host}/claim#${code}` };
}

export async function importLiz() {
  const actor = await requireAdmin();
  const existing = await db.select({ id: characters.id }).from(characters).where(eq(characters.name, LIZ.name));
  if (existing.length > 0) return;
  const [row] = await db
    .insert(characters)
    .values({
      ownerId: actor.userId,
      name: LIZ.name,
      race: LIZ.race,
      alignment: LIZ.alignment,
      status: "submitted",
      ...LIZ.scores,
      hpCurrent: LIZ.hpCurrent,
      hpMax: LIZ.hpMax,
      coinsGp: LIZ.coinsGp,
      deity: LIZ.deity,
      notes: LIZ.notes,
      source: "pdf-import",
      importFlags: LIZ.flags,
    })
    .returning({ id: characters.id });
  await db.insert(characterClasses).values({ characterId: row.id, class: LIZ.cls, xp: LIZ.xp });
  await db.insert(inventory).values(LIZ.items.map((i) => ({ characterId: row.id, ...i })));
  await writeAudit(actor, { action: "character.imported", characterId: row.id, after: { name: LIZ.name } });
  revalidatePath("/party");
  revalidatePath("/admin");
}

/**
 * Folds an account that has no characters into another account: its sign-ins
 * (GitHub or Google) move over, its sessions end, and it is hidden as "merged".
 * Nothing is deleted, so the insert-only audit log keeps every reference.
 */
export async function mergeAccount(formData: FormData) {
  const actor = await requireAdmin();
  const sourceId = String(formData.get("userId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!sourceId || !targetId || sourceId === targetId) throw new Error("Pick a different account to merge into");
  if (sourceId === actor.userId) throw new Error("You can't merge the account you're signed in with");
  if (await isRailwayAdmin(sourceId)) throw new Error("A Railway-listed admin can't be merged away");

  const owned = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.ownerId, sourceId), isNull(characters.deletedAt)))
    .limit(1);
  if (owned.length > 0) throw new Error("Only accounts without characters can be merged");

  const [target] = await db
    .select({ id: users.id, name: users.name, status: profiles.status })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target || target.status === "merged") throw new Error("That account can't take a merge");

  const [source] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, sourceId)).limit(1);
  const moved = await db.transaction(async (tx) => {
    const links = await tx
      .update(accounts)
      .set({ userId: targetId })
      .where(eq(accounts.userId, sourceId))
      .returning({ provider: accounts.provider });
    await tx.delete(sessions).where(eq(sessions.userId, sourceId));
    await tx
      .insert(profiles)
      .values({ userId: sourceId, status: "merged" })
      .onConflictDoUpdate({ target: profiles.userId, set: { status: "merged" } });
    return links.map((l) => l.provider);
  });

  await writeAudit(actor, {
    action: "account.merged",
    targetUserId: sourceId,
    before: { account: source?.name ?? null, email: source?.email ?? null },
    after: { mergedInto: target.name ?? targetId, signInsMoved: moved },
  });
  revalidatePath("/admin");
}
