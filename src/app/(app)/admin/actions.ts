"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters, gmClaims, inventory, profiles, type Role } from "@/db/schema";
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
