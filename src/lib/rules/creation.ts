import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { ABILITIES, type Ability } from "@/lib/rules/abilities";
import { RACE_CLASSES } from "@/lib/rules/advancement";

export const RACES: Race[] = ["human", "dwarf", "elf", "halfling"];
export const ALIGNMENTS: Alignment[] = ["lawful", "neutral", "chaotic"];

/**
 * Alignments by class. The house rules only restrict two cases:
 * clerics may begin as any alignment (WW p. 8); thieves may be neutral or
 * chaotic (WW p. 9). Everything else is open.
 */
export function alignmentsFor(cls: CharacterClass): Alignment[] {
  return cls === "thief" ? ["neutral", "chaotic"] : ALIGNMENTS;
}

export function classesFor(race: Race): CharacterClass[] {
  return Object.keys(RACE_CLASSES[race]) as CharacterClass[];
}

export function isValidIdentity(race: Race, cls: CharacterClass, alignment: Alignment): string | null {
  if (!RACES.includes(race)) return "Unknown race.";
  if (!classesFor(race).includes(cls)) return "That race can't take that class (WW pp. 9-10).";
  if (!alignmentsFor(cls).includes(alignment)) return "Thieves may be neutral or chaotic (WW p. 9).";
  return null;
}

/**
 * The six rolled totals are arranged as the player likes (WW p. 5): each
 * ability takes one set, and every set is used exactly once.
 */
export function assignScores(totals: number[], picks: Record<Ability, number>): Record<Ability, number> | string {
  if (totals.length !== 6) return "Six rolled sets are needed.";
  const used = ABILITIES.map((ab) => picks[ab]);
  if (used.some((i) => !Number.isInteger(i) || i < 0 || i > 5)) return "Pick one rolled set for every ability.";
  if (new Set(used).size !== 6) return "Each rolled set can be used once.";
  return Object.fromEntries(ABILITIES.map((ab) => [ab, totals[picks[ab]]])) as Record<Ability, number>;
}
