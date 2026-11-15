/**
 * Thief skills by level, Woundwort's Warren p. 9 (Thief Skills Tables 1 and 2),
 * read from the page image. The tables run to 14th level.
 *
 * - Primary skills: "Roll needed on 2d6 by level of Thief". The roll is
 *   adjusted by the thief's Dexterity bonus or penalty (table footnote).
 * - Secondary skills: "Roll needed on d6 by level of Thief", printed as a
 *   range such as "1-4". A dash means the thief can't use the skill yet.
 * - Read Magic: failure means the thief misread the scroll or object, with a
 *   backfire or unexpected result (table footnote).
 */
export const THIEF_SKILLS_SOURCE = "Woundwort's Warren p. 9";

export type ThiefSkill = { key: string; name: string };

export const PRIMARY_SKILLS: (ThiefSkill & { needed: number[] })[] = [
  { key: "pick-pockets", name: "Pick Pockets", needed: [9, 9, 8, 8, 7, 7, 6, 6, 5, 4, 3, 3, 2, 1] },
  { key: "move-silently", name: "Move Silently", needed: [10, 9, 9, 8, 8, 7, 7, 6, 5, 5, 4, 3, 2, 2] },
  { key: "open-locks", name: "Open Locks", needed: [10, 10, 9, 9, 8, 8, 7, 7, 6, 5, 4, 4, 3, 2] },
  { key: "remove-traps", name: "Remove/Disarm Traps", needed: [11, 10, 10, 9, 9, 8, 8, 7, 6, 5, 4, 4, 3, 3] },
  { key: "hide-in-shadows", name: "Hide in Shadows", needed: [11, 10, 10, 10, 9, 9, 8, 7, 7, 6, 5, 4, 4, 3] },
];

// null = "-" in the table.
export const SECONDARY_SKILLS: (ThiefSkill & { range: (string | null)[] })[] = [
  { key: "climb-walls", name: "Climb Walls", range: ["1-4", "1-4", "1-5", "1-5", "1-5", "1-5", "1-5", "1-5", "1-6", "1-6", "1-6", "1-6", "1-6", "1-6"] },
  { key: "hear-noise", name: "Hear Noise", range: ["1-2", "1-2", "1-3", "1-3", "1-3", "1-3", "1-4", "1-4", "1-4", "1-4", "1-5", "1-5", "1-5", "1-5"] },
  { key: "read-languages", name: "Read Languages", range: [null, "1", "1-2", "1-3", "1-3", "1-4", "1-4", "1-5", "1-5", "1-5", "1-5", "1-5", "1-5", "1-5"] },
  { key: "read-magic", name: "Read Magic", range: [null, null, null, "1", "1", "1-2", "1-2", "1-3", "1-4", "1-5", "1-5", "1-5", "1-5", "1-5"] },
];

const MAX_TABLE_LEVEL = 14;

function check(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_TABLE_LEVEL) throw new RangeError(`No thief skill row for level ${level}`);
}

export type ThiefSkillRow = ThiefSkill & { kind: "2d6" | "d6"; value: string | null };

/** Every thief skill at this level: the 2d6 roll needed, or the d6 range (null = not yet). */
export function thiefSkills(level: number): ThiefSkillRow[] {
  check(level);
  return [
    ...PRIMARY_SKILLS.map((s) => ({ key: s.key, name: s.name, kind: "2d6" as const, value: String(s.needed[level - 1]) })),
    ...SECONDARY_SKILLS.map((s) => ({ key: s.key, name: s.name, kind: "d6" as const, value: s.range[level - 1] })),
  ];
}
