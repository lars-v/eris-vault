import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  auditLog,
  characterClasses,
  characters,
  inventory,
  profiles,
  rulings,
  users,
} from "@/db/schema";
import { parseAdminIds } from "@/lib/roles";

export async function listCharacters() {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      race: characters.race,
      alignment: characters.alignment,
      status: characters.status,
      hpCurrent: characters.hpCurrent,
      hpMax: characters.hpMax,
      deity: characters.deity,
      ownerId: characters.ownerId,
      ownerName: users.name,
      importFlagCount: characters.importFlags,
      cls: characterClasses.class,
      xp: characterClasses.xp,
    })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .leftJoin(
      characterClasses,
      and(eq(characterClasses.characterId, characters.id), eq(characterClasses.active, true)),
    )
    .where(isNull(characters.deletedAt))
    .orderBy(asc(characters.name));
  return rows.map((r) => ({ ...r, importFlagCount: r.importFlagCount.length }));
}

export async function getCharacter(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .limit(1);
  if (!c) return null;
  const [owner] = await db.select({ name: users.name }).from(users).where(eq(users.id, c.ownerId));
  const classes = await db.select().from(characterClasses).where(eq(characterClasses.characterId, id));
  const items = await db
    .select()
    .from(inventory)
    .where(eq(inventory.characterId, id))
    .orderBy(asc(inventory.name));
  return { ...c, ownerName: owner?.name ?? null, classes, items };
}

export async function listPeople() {
  const adminIds = parseAdminIds(process.env.ADMIN_GITHUB_IDS);
  const people = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: profiles.role,
      status: profiles.status,
      joined: profiles.createdAt,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(asc(users.name));
  const links = await db
    .select({ userId: accounts.userId, provider: accounts.provider, providerAccountId: accounts.providerAccountId })
    .from(accounts);
  const chars = await db
    .select({ ownerId: characters.ownerId, name: characters.name })
    .from(characters)
    .where(isNull(characters.deletedAt));
  return people.filter((p) => p.status !== "merged").map((p) => {
    const mine = links.filter((l) => l.userId === p.userId);
    const railwayAdmin = mine.some((l) => l.provider === "github" && adminIds.has(l.providerAccountId));
    return {
      ...p,
      role: railwayAdmin ? ("admin" as const) : (p.role ?? "player"),
      status: p.status ?? "active",
      railwayAdmin,
      providers: mine.map((l) => l.provider),
      characters: chars.filter((c) => c.ownerId === p.userId).map((c) => c.name),
    };
  });
}

export async function listRulings() {
  return db.select().from(rulings).orderBy(desc(rulings.status), asc(rulings.key));
}

export async function listAudit(limit = 50) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorRole: auditLog.actorRole,
      actorName: users.name,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

export async function reviewQueue() {
  return db
    .select({ id: characters.id, name: characters.name, ownerName: users.name, flags: characters.importFlags })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .where(and(eq(characters.status, "submitted"), isNull(characters.deletedAt)));
}
