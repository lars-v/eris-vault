/**
 * Ability score modifiers.
 * Source: Woundwort's Warren (Planet Eris House Rules), p. 5,
 * "Ability Scores Bonuses & Penalties": 3 = -2, 4-6 = -1, 7-14 = 0, 15-17 = +1, 18 = +2.
 */
export const ABILITIES = ["str", "int", "wis", "dex", "con", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  int: "Intelligence",
  wis: "Wisdom",
  dex: "Dexterity",
  con: "Constitution",
  cha: "Charisma",
};

export const ABILITY_SOURCE = "Woundwort's Warren p. 5";

export function abilityModifier(score: number): number {
  if (!Number.isInteger(score) || score < 3 || score > 18) {
    throw new RangeError(`Ability score must be an integer from 3 to 18, got ${score}`);
  }
  if (score === 3) return -2;
  if (score <= 6) return -1;
  if (score <= 14) return 0;
  if (score <= 17) return 1;
  return 2;
}

export function formatModifier(mod: number): string {
  if (mod > 0) return `+${mod}`;
  if (mod < 0) return `−${Math.abs(mod)}`;
  return "0";
}

/**
 * Reading and writing. WW p. 11: average Intelligence reads and writes the
 * common tongue; Int 3 can't read or write at all; the referee may limit Int 6
 * or below. Jay's ruling "low-int-literacy" (17 Nov 2026): Int 4 to 6 can't
 * read or write either. Null when Intelligence isn't assigned.
 */
export function canReadAndWrite(int: number | null): boolean | null {
  if (int === null) return null;
  return int > 6;
}

/**
 * Surviving adversity (WW p. 5 points to Men & Magic pp. 10-11). Jay's ruling
 * "survive-adversity" (17 Nov 2026): use the M&M p. 11 table as printed. It
 * gives words for Constitution 7 to 14 only; null outside them, where the
 * table says nothing about survival (15+ adds +1 to each hit die, 6 or less
 * takes 1 away).
 */
export function surviveAdversity(con: number | null): string | null {
  if (con === null) return null;
  if (con >= 13 && con <= 14) return "Will withstand adversity";
  if (con >= 9 && con <= 12) return "60% to 90% chance of survival";
  if (con >= 7 && con <= 8) return "40% to 50% chance of survival";
  return null;
}
