import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  auditLog,
  characterClasses,
  characterPortraits,
  characters,
  hitDice,
  inventory,
  profiles,
  rollGrants,
  rolls,
  rulings,
  sheetUploads,
  users,
  type CharacterClass,
} from "@/db/schema";
import { parseAdminIds } from "@/lib/roles";
import { countedHpLevel, levelsToRoll } from "@/lib/rules/advancement";

/** The picture's link, versioned by upload time so browsers can cache it (src/app/api/portraits). */
function portraitUrl(characterId: string, updatedAt: Date | null) {
  return updatedAt ? `/api/portraits/${characterId}?v=${updatedAt.getTime()}` : null;
}

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
      dex: characters.dex,
      int: characters.int,
      deity: characters.deity,
      ownerId: characters.ownerId,
      ownerName: users.name,
      importFlagCount: characters.importFlags,
      cls: characterClasses.class,
      xp: characterClasses.xp,
      portraitAt: characterPortraits.updatedAt,
    })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .leftJoin(characterPortraits, eq(characterPortraits.characterId, characters.id))
    .leftJoin(
      characterClasses,
      and(eq(characterClasses.characterId, characters.id), eq(characterClasses.active, true)),
    )
    .where(isNull(characters.deletedAt))
    .orderBy(asc(characters.name));
  // What armor class needs from each character's gear (WW p. 17).
  const gear = rows.length
    ? await db
        .select({
          characterId: inventory.characterId,
          name: inventory.name,
          catalogKey: inventory.catalogKey,
          location: inventory.location,
          isMagic: inventory.isMagic,
          magicBonus: inventory.magicBonus,
        })
        .from(inventory)
        .where(inArray(inventory.characterId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({
    ...r,
    importFlagCount: r.importFlagCount.length,
    portrait: portraitUrl(r.id, r.portraitAt),
    items: gear.filter((g) => g.characterId === r.id),
  }));
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
  const [pic] = await db
    .select({ updatedAt: characterPortraits.updatedAt })
    .from(characterPortraits)
    .where(eq(characterPortraits.characterId, id));
  const classes = await db.select().from(characterClasses).where(eq(characterClasses.characterId, id));
  const items = await db
    .select()
    .from(inventory)
    .where(eq(inventory.characterId, id))
    .orderBy(asc(inventory.name));
  const [characterRolls, grants, levelDice] = await Promise.all([
    listRolls({ characterId: id }),
    openGrants(id),
    db
      .select({ id: hitDice.id, class: hitDice.class, level: hitDice.level, gain: hitDice.gain, lostAt: hitDice.lostAt, dice: rolls.dice, total: rolls.totals, formula: rolls.formula })
      .from(hitDice)
      .innerJoin(rolls, eq(rolls.id, hitDice.rollId))
      .where(eq(hitDice.characterId, id))
      .orderBy(asc(hitDice.level), asc(hitDice.createdAt)),
  ]);
  const abilityRoll = c.abilityRollId ? characterRolls.find((r) => r.id === c.abilityRollId) ?? null : null;
  return { ...c, ownerName: owner?.name ?? null, portrait: portraitUrl(id, pic?.updatedAt ?? null), classes, items, rolls: characterRolls, grants, abilityRoll, levelDice };
}

/** Every roll, newest first. Rolls are insert-only, so this is the full record. */
export async function listRolls(opts: { characterId?: string; limit?: number } = {}) {
  const q = db
    .select({
      id: rolls.id,
      purpose: rolls.purpose,
      formula: rolls.formula,
      dice: rolls.dice,
      totals: rolls.totals,
      createdAt: rolls.createdAt,
      rollerName: users.name,
      characterId: rolls.characterId,
      characterName: characters.name,
      characterDeleted: characters.deletedAt,
    })
    .from(rolls)
    .innerJoin(users, eq(users.id, rolls.userId))
    .leftJoin(characters, eq(characters.id, rolls.characterId))
    .where(opts.characterId ? eq(rolls.characterId, opts.characterId) : undefined)
    .orderBy(desc(rolls.createdAt))
    .limit(opts.limit ?? 200);
  return q;
}

export async function openGrants(characterId: string) {
  return db
    .select({ id: rollGrants.id, purpose: rollGrants.purpose, reason: rollGrants.reason, grantedByName: users.name })
    .from(rollGrants)
    .innerJoin(users, eq(users.id, rollGrants.grantedBy))
    .where(and(eq(rollGrants.characterId, characterId), isNull(rollGrants.usedAt)));
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

export type WaitingLevelUp = {
  characterId: string;
  name: string;
  ownerName: string | null;
  cls: CharacterClass;
  /** Levels whose hit die still has to be rolled (WW p. 6), lowest first. */
  levels: number[];
};

/**
 * Submitted or approved characters whose XP reached a level that has no hit
 * die rolled yet, worked out the same way the sheet's level panel does.
 */
export async function levelUpsWaiting(): Promise<WaitingLevelUp[]> {
  const [classRows, dice] = await Promise.all([
    db
      .select({
        characterId: characters.id,
        name: characters.name,
        ownerName: users.name,
        race: characters.race,
        source: characters.source,
        hpRollId: characters.hpRollId,
        cls: characterClasses.class,
        xp: characterClasses.xp,
        baseHpLevel: characterClasses.baseHpLevel,
      })
      .from(characterClasses)
      .innerJoin(characters, eq(characters.id, characterClasses.characterId))
      .innerJoin(users, eq(users.id, characters.ownerId))
      .where(and(inArray(characters.status, ["submitted", "approved"]), isNull(characters.deletedAt)))
      .orderBy(asc(characters.name)),
    db.select({ characterId: hitDice.characterId, cls: hitDice.class, level: hitDice.level }).from(hitDice).where(isNull(hitDice.lostAt)),
  ]);
  const out: WaitingLevelUp[] = [];
  for (const k of classRows) {
    const rolled = dice.filter((d) => d.characterId === k.characterId && d.cls === k.cls).map((d) => d.level);
    const counted = countedHpLevel(k.source !== "app" || Boolean(k.hpRollId), k.baseHpLevel, rolled);
    const levels = levelsToRoll(k.race, k.cls, k.xp, counted);
    if (levels.length > 0) out.push({ characterId: k.characterId, name: k.name, ownerName: k.ownerName, cls: k.cls, levels });
  }
  return out;
}

/** Upload details without the file itself; the file is served by /api/sheets/[id]. */
const sheetMeta = {
  id: sheetUploads.id,
  ownerId: sheetUploads.ownerId,
  characterId: sheetUploads.characterId,
  filename: sheetUploads.filename,
  contentType: sheetUploads.contentType,
  size: sheetUploads.size,
  fields: sheetUploads.fields,
  createdAt: sheetUploads.createdAt,
};

export async function getSheetUpload(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select(sheetMeta).from(sheetUploads).where(eq(sheetUploads.id, id)).limit(1);
  return row ?? null;
}

/** Sheets this player uploaded but hasn't sent to Jay yet, newest first. */
export async function openSheetUploads(ownerId: string) {
  return db
    .select(sheetMeta)
    .from(sheetUploads)
    .where(and(eq(sheetUploads.ownerId, ownerId), isNull(sheetUploads.characterId)))
    .orderBy(desc(sheetUploads.createdAt))
    .limit(10);
}

export async function sheetsForCharacter(characterId: string) {
  return db
    .select(sheetMeta)
    .from(sheetUploads)
    .where(eq(sheetUploads.characterId, characterId))
    .orderBy(asc(sheetUploads.createdAt));
}

/**
 * Stats Jay or an admin set by hand on one character, newest first: who, when,
 * which fields and the reason they gave (from the insert-only audit log).
 */
export async function statOverrides(characterId: string) {
  const rows = await db
    .select({ actorName: users.name, after: auditLog.after, createdAt: auditLog.createdAt })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(and(eq(auditLog.characterId, characterId), eq(auditLog.action, "character.override")))
    .orderBy(desc(auditLog.createdAt))
    .limit(50);
  return rows.map((r) => {
    const after = (r.after ?? {}) as Record<string, unknown>;
    const { reason, ...fields } = after;
    return {
      actorName: r.actorName,
      createdAt: r.createdAt,
      reason: typeof reason === "string" ? reason : null,
      fields: Object.keys(fields),
    };
  });
}
