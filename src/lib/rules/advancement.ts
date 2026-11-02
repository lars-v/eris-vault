import type { CharacterClass, Race } from "@/db/schema";

/**
 * Advancement tables, levels 1 to 9.
 * Source: Woundwort's Warren pp. 7-9 (Fighting-Man, Magic-User, Cleric and Thief
 * Advancement Tables): title, XP needed, base saving throw.
 *
 * 10th level is listed as "+100,000" in every table. Whether that means
 * 100,000 more than 9th or something else is a GM ruling ("name-level-xp"),
 * so this module stops at 9th and reports anything past it as "9+".
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
  ],
};

export const ADVANCEMENT_SOURCE: Record<CharacterClass, string> = {
  "fighting-man": "Woundwort's Warren p. 7",
  "magic-user": "Woundwort's Warren p. 7",
  cleric: "Woundwort's Warren p. 8",
  thief: "Woundwort's Warren p. 9",
};

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
  pastNine: boolean;
};

/**
 * The highest level this race may reach in this class (RACE_CLASSES), and no
 * higher than 9th: above that the XP needed is the pending ruling "name-level-xp".
 */
export function maxLevel(race: Race | null, cls: CharacterClass): number {
  const cap = race ? RACE_CLASSES[race][cls] : null;
  return Math.min(cap ?? 9, 9);
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
  return { level: row.level, title: row.title, save: row.save, startXp: row.xp, nextTitle: null, nextXp: null, pastNine: false };
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
 * Levels whose hit die still has to be rolled: every level above `hpLevel`
 * (the highest level already counted in the character's hit points) up to
 * the level the XP reaches, stopping at maxLevel. WW p. 6: a d6 per level.
 */
export function levelsToRoll(race: Race | null, cls: CharacterClass, xp: number, hpLevel: number): number[] {
  // 1st-level hit points come from the creation roll (or the imported sheet) first.
  if (hpLevel < 1) return [];
  const reached = Math.min(levelFor(cls, xp).level, maxLevel(race, cls));
  const out: number[] = [];
  for (let l = hpLevel + 1; l <= reached; l++) out.push(l);
  return out;
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
    pastNine: row.level === 9,
  };
}
