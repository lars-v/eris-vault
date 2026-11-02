import type { CharacterClass } from "@/db/schema";
import { abilityModifier } from "./abilities";

/**
 * Spells per day, spell lists and starting spellbooks.
 *
 * - Spells per day by level: Woundwort's Warren p. 7 (Magic-User Advancement
 *   Table) and p. 8 (Cleric Advancement Table).
 * - Extra 1st-level cleric spells from a Wisdom bonus: WW p. 5.
 * - Spell lists: WW p. 26 ("Magic-User Spellbooks", "Cleric Prayer Scrolls").
 * - What a character starts with: WW p. 25. A 1st-level magic-user's book holds
 *   every 1st-level spell; an elf holds the same in a "mental" book. Clerics
 *   start with nothing: a 1st-level cleric with Wis 15+ gets a limited prayer
 *   scroll of "one or two spells" (pending ruling "cleric-l1-scroll"), and the
 *   complete 1st-level scroll comes from the church at 2nd level for an
 *   offering. Every later book or scroll is bought or offered for (WW p. 25),
 *   so Jay records those on the character.
 *
 * Open questions left to Jay (rulings seed in scripts/migrate.mjs):
 * - "prepare-same-spell": may one spell fill two slots? Allowed here, and shown as a flag.
 * - "cleric-wis-penalty": does a Wisdom penalty take spells away? WW p. 5 only speaks of
 *   bonuses, so no spells are taken away here, and the sheet says the question is open.
 */
export const SPELL_SLOTS_SOURCE: Record<SpellClass, string> = {
  "magic-user": "Woundwort's Warren p. 7",
  cleric: "Woundwort's Warren p. 8",
};
export const SPELL_LIST_SOURCE = "Woundwort's Warren p. 26";
export const SPELLBOOK_SOURCE = "Woundwort's Warren p. 25";

/** Cost of a book or prayer scroll of one spell level, index 0 = 1st level (WW p. 25). */
export const SPELLBOOK_COST_GP = [2000, 4000, 8000, 16000, 32000, 64000];

export type SpellClass =Extract<CharacterClass, "magic-user" | "cleric">;
export type Spell = { key: string; name: string; cls: SpellClass; level: number };

export function castsSpells(cls: CharacterClass): cls is SpellClass {
  return cls === "magic-user" || cls === "cleric";
}

// Spells per day at each character level (index 0 = 1st level), by spell level 1 to 5.
const SLOTS: Record<SpellClass, number[][]> = {
  // WW p. 7. Past 10th level, WW points to Men & Magic p. 17.
  "magic-user": [
    [1, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [3, 1, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 2, 1, 0, 0],
    [4, 2, 2, 0, 0],
    [4, 3, 2, 1, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 2, 1],
    [4, 4, 3, 3, 2],
  ],
  // WW p. 8.
  cleric: [
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [2, 1, 0, 0, 0],
    [2, 2, 1, 0, 0],
    [2, 2, 1, 1, 0],
    [2, 2, 2, 1, 1],
    [2, 2, 2, 2, 2],
    [3, 3, 3, 2, 2],
    [3, 3, 3, 3, 3],
  ],
};

/**
 * Spells a character may hold each day, by spell level (index 0 = 1st).
 * A cleric adds the Wisdom bonus to 1st-level spells (WW p. 5), which is how a
 * 1st-level cleric with Wis 15+ casts at all (WW p. 25).
 */
export function spellSlots(cls: SpellClass, level: number, wis: number | null): number[] {
  const table = SLOTS[cls];
  if (!Number.isInteger(level) || level < 1 || level > table.length) throw new RangeError(`No spell row for level ${level}`);
  const slots = [...table[level - 1]];
  if (cls === "cleric" && wis !== null) slots[0] += Math.max(0, abilityModifier(wis));
  return slots;
}

const MU: string[][] = [
  ["Charm Person", "Detect Magic", "Floating Disc", "Hold Portal", "Light", "Magic Missile", "Protection from Chaos", "Read Languages", "Read Magic", "Sleep"],
  ["Continual Light", "Detect Chaos", "Detect Invisibility", "ESP", "Invisibility", "Knock", "Levitate", "Locate Object", "Mirror Image", "Phantasmal Force", "Web", "Wizard Lock"],
  [
    "Clairaudience",
    "Clairvoyance",
    "Dispel Magic",
    "Field of Force",
    "Fireball",
    "Fly",
    "Haste",
    "Hold Person",
    "Infravision",
    "Invisibility, 10' radius",
    "Lightning Bolt",
    "Protection/Chaos 10' r.",
    "Protection/Normal Missiles",
    "Slow",
    "Water Breathing",
  ],
  ["Charm Monster", "Confusion", "Dimension Door", "Hallucinatory Terrain", "Massmorph", "Plant Growth", "Polymorph Other", "Polymorph Self", "Remove Curse", "Wall of Fire", "Wall of Ice", "Wizard Eye"],
  [
    "Animate Dead",
    "Cloudkill",
    "Conjure Elemental",
    "Contact Higher Plane",
    "Feeblemind",
    "Growth of Animals",
    "Hold Monster",
    "Magic Jar",
    "Passwall",
    "Telekinesis",
    "Teleport",
    "Transform Rock to Mud",
    "Wall of Iron",
    "Wall of Stone",
  ],
  ["Anti-Magic Shell", "Control Weather", "Death Spell", "Disintegrate", "Geas", "Invisible Stalker", "Lower Water", "Move Earth", "Part Water", "Projected Image", "Reincarnate", "Stone to Flesh"],
];

const CLERIC: string[][] = [
  ["Cure Light Wounds", "Detect Chaos", "Detect Magic", "Light", "Protection from Chaos", "Purify Food and Drink"],
  ["Bless", "Find Traps", "Hold Person", "Resist Fire", "Silence 15' Radius", "Speak With Animals"],
  ["Continual Light", "Cure Disease", "Locate Object", "Remove Curse", "Speak with the Dead", "Striking"],
  ["Cure Serious Wounds", "Neutralize Poison", "Protection/Chaos, 10' r.", "Speak with Plants", "Sticks to Snakes", "Tongues"],
  ["Commune", "Create Food and Drink", "Dispel Chaos", "Insect Plague", "Quest", "Raise Dead", "True Seeing"],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const build = (cls: SpellClass, prefix: string, lists: string[][]): Spell[] =>
  lists.flatMap((names, i) => names.map((name) => ({ key: `${prefix}:${slug(name)}`, name, cls, level: i + 1 })));

/** Every spell on the house lists (WW p. 26). Keys look like "mu:sleep" and "cl:light". */
export const SPELLS: Spell[] = [...build("magic-user", "mu", MU), ...build("cleric", "cl", CLERIC)];

const BY_KEY = new Map(SPELLS.map((s) => [s.key, s]));

export function spell(key: string): Spell | undefined {
  return BY_KEY.get(key);
}

export function spellsFor(cls: SpellClass, level?: number): Spell[] {
  return SPELLS.filter((s) => s.cls === cls && (level === undefined || s.level === level));
}

/** Highest spell level on the class's list: 6 for magic-users, 5 for clerics (WW p. 26). */
export function maxSpellLevel(cls: SpellClass): number {
  return cls === "magic-user" ? MU.length : CLERIC.length;
}

/**
 * Spells every member of the class holds without Jay recording anything (WW p. 25):
 * all 1st-level magic-user spells for magic-users and elves, nothing for clerics.
 */
export function startingSpells(cls: SpellClass): string[] {
  return cls === "magic-user" ? spellsFor("magic-user", 1).map((s) => s.key) : [];
}

/** Starting spells plus what Jay recorded, in list order. Unknown keys are dropped. */
export function knownSpells(cls: SpellClass, recorded: string[]): Spell[] {
  const keys = new Set([...startingSpells(cls), ...recorded]);
  return SPELLS.filter((s) => s.cls === cls && keys.has(s.key));
}

/**
 * Checks a day's prepared spells: each one on the class list, known, and no
 * more at a spell level than the character has slots for. Returns the first
 * problem as a message, or null.
 */
export function checkPrepared(cls: SpellClass, slots: number[], known: Spell[], prepared: string[]): string | null {
  const knownKeys = new Set(known.map((s) => s.key));
  const counts = new Map<number, number>();
  for (const key of prepared) {
    const s = spell(key);
    if (!s || s.cls !== cls) return "That spell isn't on this class's list (WW p. 26).";
    if (!knownKeys.has(key)) return `${s.name} isn't in this character's ${cls === "cleric" ? "prayer scrolls" : "spellbook"}.`;
    counts.set(s.level, (counts.get(s.level) ?? 0) + 1);
  }
  for (const [level, n] of counts) {
    const max = slots[level - 1] ?? 0;
    if (n > max) return `${n} ${ordinal(level)}-level spells prepared, but only ${max} allowed at this level.`;
  }
  return null;
}

/** Names of spells that fill more than one slot (pending ruling "prepare-same-spell"). */
export function repeatedSpells(prepared: string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const key of prepared) (seen.has(key) ? twice : seen).add(key);
  return SPELLS.filter((s) => twice.has(s.key)).map((s) => s.name);
}

export function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
