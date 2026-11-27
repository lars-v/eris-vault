import type { CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES, RACE_CLASSES } from "./advancement";

/**
 * What a race brings to the sheet, as printed. Saving throw bonuses live in
 * saves.ts, level caps in advancement.ts, the halfling's hurled weapons in
 * weapons.ts, and a dwarf's sight in the dark in its own roll (Jay's ruling
 * dwarf-darkvision); this list says them in words with the rest.
 *
 * - Dwarves (WW p. 9): fighting-men to 10th level; "take note of stonework
 *   traps and similar construction (as detailed in ... Men & Magic, p. 7)",
 *   which M&M p. 7 lists as "slanting passages, traps, shifting walls and new
 *   construction in underground settings"; "can usually tell the approximate
 *   value of found gems".
 * - Elves (WW p. 10): two classes with a record each (elf.ts).
 * - Halflings (WW p. 10): one class for good; +1 to hit with any hurled
 *   weapon; stones hurled at +2, a fist-sized rock for 1d3.
 * - Sight in the dark (WW p. 10): player characters, "including elves,
 *   dwarves, and halflings", have none, except the dwarf's roll.
 * - Searching (WW p. 37): secret doors 1-2 in 6, elves 1-4 and 2 in 6 just
 *   passing within 10 feet; traps 1 in 6, dwarves 1-2, with 4 in 6 for
 *   stonework traps and 2 in 6 to notice such constructions within 10 feet.
 * - Languages (WW p. 11): everyone knows the common tongue. WW gives no race
 *   its own tongues, setting aside Men & Magic pp. 7-8.
 */
export const RACE_SOURCE: Record<Exclude<Race, "human">, string> = {
  dwarf: "WW pp. 9-10, 37",
  elf: "WW pp. 10, 37",
  halfling: "WW pp. 10, 37",
};

export type RaceFeature = { text: string; source: string };

/** "fighting-man up to 5th level or thief up to 9th level", from RACE_CLASSES. */
function classCaps(race: Race, joiner: string): string {
  return Object.entries(RACE_CLASSES[race])
    .map(([k, cap]) => `${CLASS_NAMES[k as CharacterClass].toLowerCase()}${cap ? ` up to ${ordinal(cap)} level` : ""}`)
    .join(joiner);
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** The race's features in plain words, each with its page. Humans have none beyond their classes. */
export function raceFeatures(race: Race): RaceFeature[] {
  const noDarkSight: RaceFeature = {
    text: "No sight in the dark: player characters are surface dwellers.",
    source: "WW p. 10",
  };
  switch (race) {
    case "human":
      return [];
    case "dwarf":
      return [
        { text: `One class: ${classCaps("dwarf", " or ")}.`, source: "WW p. 9" },
        {
          text: "Takes note of stonework traps and similar construction: slanting passages, traps, shifting walls and new construction underground.",
          source: "WW p. 9; Men & Magic p. 7",
        },
        {
          text: "Finds traps on 1-2 in 6 when searching, stonework traps on 4 in 6, and notices such construction on 2 in 6 just passing within 10 feet.",
          source: "WW p. 37",
        },
        { text: "Can usually tell the approximate value of found gems.", source: "WW p. 9" },
      ];
    case "elf":
      return [
        {
          text: `Two classes, ${classCaps("elf", " and ")}, with a separate record for each: XP, hit points, saving throw and to hit. Switches at a safe rest, with meditation and the proper ritual.`,
          source: "WW p. 10",
        },
        {
          text: "Finds secret doors and passages on 1-4 in 6 when searching, and notices them on 2 in 6 just passing within 10 feet.",
          source: "WW p. 37",
        },
        noDarkSight,
      ];
    case "halfling":
      return [
        { text: `One class for good: ${classCaps("halfling", " or ")}. A halfling can't switch as an elf does.`, source: "WW p. 10" },
        // Also in the weapon table (weapons.ts).
        { text: "+1 to hit with any hurled weapon. Hurls stones at +2, and a fist-sized rock for 1d3.", source: "WW p. 10" },
        noDarkSight,
      ];
  }
}
