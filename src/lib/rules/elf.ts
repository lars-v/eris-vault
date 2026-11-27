import type { CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES, RACE_CLASSES } from "./advancement";

/**
 * An elf's two classes.
 *
 * Woundwort's Warren p. 10: an elf "will always have the option of two
 * classes: fighting-man or magic-user", begins play in one, and "may switch
 * freely to the other class anytime he is able to safely rest, meditate, and
 * perform the proper ritual". "A separate record should be kept by the player
 * for each class's experience, hit points, saving throw, 'to hit' rolls, and
 * special abilities." Men & Magic p. 8 has elves switch "from adventure to
 * adventure"; WW covers switching, so its safe rest is the rule. The vault
 * records each switch and doesn't police when it happens.
 *
 * - Jay's ruling "elf-second-class-hp" (17 Nov 2026): 1st-level hit points are
 *   rolled for each class at creation.
 * - Table decision "elf-starting-xp" (Lars, 27 Nov 2026): the player shares the
 *   5,000 starting XP (ruling starting-xp) between the two classes as they
 *   like; XP from an adventure goes to the class the elf played it as.
 * - Pending: "elf-switch-wounds" (do wounds carry over a switch; until then
 *   each class keeps its own current hit points), "elf-switch-spells" (prepared
 *   and stored spells through a switch; until then nothing is cleared),
 *   "elf-unsafe-switch" (the optional switch in a dungeon for 1 Constitution;
 *   until then the vault takes nothing off).
 */
export const ELF_SOURCE = "WW p. 10";

/**
 * Whether the race keeps a record for each class it may take. Only elves do;
 * halflings "may not switch classes as elves do" (WW p. 10).
 */
export function keepsEveryClass(race: Race | null): boolean {
  return race === "elf";
}

/** The classes a character keeps a record for, the one it plays first leading. */
export function classRecordsFor(race: Race, first: CharacterClass): CharacterClass[] {
  if (!keepsEveryClass(race)) return [first];
  return [first, ...(Object.keys(RACE_CLASSES[race]) as CharacterClass[]).filter((k) => k !== first)];
}

/**
 * Checks how XP is shared between a character's classes: whole numbers, 0 or
 * more, adding up to `total` (5,000 for a new character, Jay's ruling
 * starting-xp). With one class it all goes there. Returns XP by class, or
 * what is wrong.
 */
export function checkXpSplit(
  classes: CharacterClass[],
  xp: Partial<Record<CharacterClass, number>>,
  total: number,
): Partial<Record<CharacterClass, number>> | string {
  if (classes.length === 1) return { [classes[0]]: total };
  const out: Partial<Record<CharacterClass, number>> = {};
  for (const k of classes) {
    const v = xp[k];
    if (v === undefined || !Number.isInteger(v) || v < 0) return `Enter the ${CLASS_NAMES[k]}'s XP as a whole number, 0 or more.`;
    out[k] = v;
  }
  const sum = classes.reduce((n, k) => n + out[k]!, 0);
  if (sum !== total) {
    return `The XP for both classes has to add up to ${total.toLocaleString("en-US")}; these add up to ${sum.toLocaleString("en-US")}.`;
  }
  return out;
}

export type ClassRecord = { id: string; class: CharacterClass; active: boolean; hpMax: number | null };

/** Why an elf can't switch to the class record `targetId` now, or null when it can (WW p. 10). */
export function switchProblem(race: Race | null, records: ClassRecord[], targetId: string): string | null {
  if (!keepsEveryClass(race)) return "Only an elf switches class (WW p. 10).";
  const to = records.find((r) => r.id === targetId);
  if (!to) return "Unknown class";
  if (to.active) return `Already playing as a ${CLASS_NAMES[to.class]}.`;
  if (to.hpMax === null) return `Roll the ${CLASS_NAMES[to.class]}'s 1st-level hit points first.`;
  return null;
}
