import type { CharacterClass, Race } from "@/db/schema";

/**
 * Advancement tables, levels 1 to 10.
 * Source: Woundwort's Warren pp. 7-9 (Fighting-Man, Magic-User, Cleric and Thief
 * Advancement Tables): title, XP needed, base saving throw.
 *
 * 10th level ("name level", WW p. 6) is listed as "+100,000" in every table.
 * Jay's ruling "name-level-xp" (17 Nov 2026): each level after 9th needs
 * 100,000 more XP than the one before. WW prints saving throws and cleric
 * spells only up to 10th, so the vault stops at 10th ("past-tenth-level" is
 * pending) and reports XP past 11th level's mark as "10+".
 */
type Row = { level: number; title: string; xp: number; save: number };

const TABLES: Record<CharacterClass, Row[]> = {
  "fighting-man": [
    { level: 1, title: "Veteran", xp: 0, save: 15 },
    { level: 2, title: "Warrior", xp: 2000, save: 14 },
    { level: 3, title: "Swordsman", xp: 4000, save: 13 },
    { level: 4, title: "Hero", xp: 8000, save: 12 },
    { level: 5, title: "Swashbuckler", xp: 16000, save: 11 },
    { level: 6, title: "Myrmidon", xp: 32000, save: 10 },
    { level: 7, title: "Champion", xp: 64000, save: 9 },
    { level: 8, title: "Superhero", xp: 125000, save: 8 },
    { level: 9, title: "Knight", xp: 250000, save: 7 },
    { level: 10, title: "Lord", xp: 350000, save: 6 },
  ],
  "magic-user": [
    { level: 1, title: "Medium", xp: 0, save: 14 },
    { level: 2, title: "Seer", xp: 2500, save: 13 },
    { level: 3, title: "Conjurer", xp: 5000, save: 12 },
    { level: 4, title: "Theurgist", xp: 10000, save: 11 },
    { level: 5, title: "Thaumaturgist", xp: 20000, save: 10 },
    { level: 6, title: "Magician", xp: 35000, save: 9 },
    { level: 7, title: "Enchanter", xp: 50000, save: 8 },
    { level: 8, title: "Warlock", xp: 75000, save: 7 },
    { level: 9, title: "Sorcerer", xp: 100000, save: 6 },
    { level: 10, title: "Wizard", xp: 200000, save: 5 },
  ],
  cleric: [
    { level: 1, title: "Acolyte", xp: 0, save: 13 },
    { level: 2, title: "Adept", xp: 1500, save: 12 },
    { level: 3, title: "Village Priest", xp: 3000, save: 11 },
    { level: 4, title: "Vicar", xp: 6000, save: 10 },
    { level: 5, title: "Curate", xp: 12000, save: 9 },
    { level: 6, title: "Bishop", xp: 25000, save: 8 },
    { level: 7, title: "Lama", xp: 50000, save: 7 },
    { level: 8, title: "Archbishop", xp: 100000, save: 6 },
    { level: 9, title: "Cardinal", xp: 200000, save: 5 },
    { level: 10, title: "Patriarch", xp: 300000, save: 4 },
  ],
  thief: [
    { level: 1, title: "Apprentice", xp: 0, save: 14 },
    { level: 2, title: "Footpad", xp: 1250, save: 13 },
    { level: 3, title: "Robber", xp: 2500, save: 12 },
    { level: 4, title: "Burglar", xp: 5000, save: 11 },
    { level: 5, title: "Cutpurse", xp: 10000, save: 10 },
    { level: 6, title: "Sharper", xp: 20000, save: 9 },
    { level: 7, title: "Pilferer", xp: 40000, save: 8 },
    { level: 8, title: "Thief", xp: 75000, save: 7 },
    { level: 9, title: "Rogue", xp: 150000, save: 6 },
    { level: 10, title: "Master Thief", xp: 250000, save: 5 },
  ],
};

export const ADVANCEMENT_SOURCE: Record<CharacterClass, string> = {
  "fighting-man": "Woundwort's Warren p. 7",
  "magic-user": "Woundwort's Warren p. 7",
  cleric: "Woundwort's Warren p. 8",
  thief: "Woundwort's Warren p. 9",
};

/** The XP each level after 9th adds to the one before (Jay's ruling name-level-xp). */
export const NAME_LEVEL_XP_STEP = 100_000;

/** The highest level the vault tracks: 10th, name level (WW p. 6). Past it is pending ("past-tenth-level"). */
export const TOP_LEVEL = 10;

/**
 * Hit points at 10th level: a fixed amount, not a die (WW pp. 7-9: "+3 hp/level"
 * for fighting-men, "+2" for clerics, "+1" for magic-users and thieves). Not
 * rolled, so Constitution doesn't apply (WW p. 5: "whenever hit points are rolled").
 */
export const NAME_LEVEL_HP: Record<CharacterClass, number> = {
  "fighting-man": 3,
  cleric: 2,
  "magic-user": 1,
  thief: 1,
};

/** Levels from 10th on add NAME_LEVEL_HP instead of rolling a hit die. */
export function fixedHpLevel(level: number): boolean {
  return level >= TOP_LEVEL;
}

/** Race and class pairs allowed, with level caps (null = no cap below 10). */
export const RACE_CLASSES: Record<Race, Partial<Record<CharacterClass, number | null>>> = {
  // Woundwort's Warren pp. 7-10; clerics are men only (Men & Magic p. 6).
  human: { "fighting-man": null, "magic-user": null, cleric: null, thief: null },
  dwarf: { "fighting-man": 10 },
  elf: { "fighting-man": 7, "magic-user": 9 },
  halfling: { "fighting-man": 5, thief: 9 },
};

export const CLASS_NAMES: Record<CharacterClass, string> = {
  "fighting-man": "Fighting-Man",
  "magic-user": "Magic-User",
  cleric: "Cleric",
  thief: "Thief",
};

export type LevelInfo = {
  level: number;
  title: string;
  save: number;
  startXp: number;
  nextTitle: string | null;
  nextXp: number | null;
  /** At 10th level with XP that would reach 11th (past-tenth-level is pending). */
  pastTen: boolean;
};

/**
 * The highest level this race may reach in this class (RACE_CLASSES), and no
 * higher than 10th (TOP_LEVEL).
 */
export function maxLevel(race: Race | null, cls: CharacterClass): number {
  const cap = race ? RACE_CLASSES[race][cls] : null;
  return Math.min(cap ?? TOP_LEVEL, TOP_LEVEL);
}

/** What to say when there is no next level: the race's cap (WW pp. 7-10), or the vault's stop at 10th. */
export function noNextLevelText(race: Race | null, cls: CharacterClass): string {
  const cap = race ? RACE_CLASSES[race][cls] : null;
  return cap !== null && cap !== undefined
    ? `Highest level for a ${race} ${CLASS_NAMES[cls].toLowerCase()} (WW pp. 7-10)`
    : "Past 10th level waits on Jay's ruling";
}

/**
 * levelFor, held at the race's level cap (WW pp. 7-10): XP past the cap still
 * counts as XP, but the level, title and save stay at the cap and there is no
 * next level to show.
 */
export function cappedLevelFor(race: Race | null, cls: CharacterClass, xp: number): LevelInfo {
  const info = levelFor(cls, xp);
  const max = maxLevel(race, cls);
  if (info.level <= max) return info;
  const row = TABLES[cls].find((r) => r.level === max)!;
  return { level: row.level, title: row.title, save: row.save, startXp: row.xp, nextTitle: null, nextXp: null, pastTen: false };
}

/**
 * The highest level already counted in a class's hit points: 0 until the
 * 1st-level roll (or an imported sheet) gives hit points, then the larger of
 * the level they came with (`baseLevel`) and the last level-up die rolled.
 */
export function countedHpLevel(firstLevelCounted: boolean, baseLevel: number, rolledLevels: number[]): number {
  return firstLevelCounted ? Math.max(baseLevel, ...rolledLevels) : 0;
}

/**
 * Levels whose hit points still have to be added: every level above `hpLevel`
 * (the highest level already counted in the character's hit points) up to
 * the level the XP reaches, stopping at maxLevel. WW p. 6: a d6 per level;
 * from 10th a fixed amount instead (NAME_LEVEL_HP).
 */
export function levelsToRoll(race: Race | null, cls: CharacterClass, xp: number, hpLevel: number): number[] {
  // 1st-level hit points come from the creation roll (or the imported sheet) first.
  if (hpLevel < 1) return [];
  const reached = Math.min(levelFor(cls, xp).level, maxLevel(race, cls));
  const out: number[] = [];
  for (let l = hpLevel + 1; l <= reached; l++) out.push(l);
  return out;
}

/**
 * XP may not drop below a level whose hit die was already rolled (WW p. 6):
 * that die would stay in maximum hit points for a level the XP no longer
 * reaches. Returns the message to show, or null when the XP is fine.
 */
export function xpBelowRolledLevel(cls: CharacterClass, xp: number, highestHitDie: number): string | null {
  if (levelFor(cls, xp).level >= highestHitDie) return null;
  return `${CLASS_NAMES[cls]} has hit points rolled for level ${highestHitDie}, so its XP can't go below that level. To take levels away, use Take levels away on the sheet.`;
}

/** Title, XP and save for one level, 1 to 10 (WW pp. 7-9). */
export function levelRow(cls: CharacterClass, level: number): Row {
  const row = TABLES[cls].find((r) => r.level === level);
  if (!row) throw new RangeError(`No ${cls} row for level ${level}`);
  return row;
}

export function levelFor(cls: CharacterClass, xp: number): LevelInfo {
  if (!Number.isInteger(xp) || xp < 0) throw new RangeError(`XP must be a whole number, got ${xp}`);
  const table = TABLES[cls];
  let row = table[0];
  for (const r of table) if (xp >= r.xp) row = r;
  const next = table.find((r) => r.level === row.level + 1) ?? null;
  return {
    level: row.level,
    title: row.title,
    save: row.save,
    startXp: row.xp,
    nextTitle: next?.title ?? null,
    nextXp: next?.xp ?? null,
    pastTen: row.level === TOP_LEVEL && xp >= row.xp + NAME_LEVEL_XP_STEP,
  };
}
