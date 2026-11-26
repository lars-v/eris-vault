import type { CharacterClass } from "@/db/schema";
import { abilityModifier } from "./abilities";

/**
 * Spells per day, spell lists and starting spellbooks.
 *
 * - Spells per day by level: Woundwort's Warren p. 7 (Magic-User Advancement
 *   Table) and p. 8 (Cleric Advancement Table).
 * - Extra 1st-level cleric spells from a Wisdom bonus: WW p. 5.
 * - Spell lists: WW p. 26 ("Magic-User Spellbooks", "Cleric Prayer Scrolls").
 * - Which spells a caster prepares from:
 *   - Clerics: table ruling "cleric-all-spells" (Lars, 16 Nov 2026). Every
 *     cleric has every spell on the cleric list. It overrides WW p. 25 (prayer
 *     scrolls offered one spell level at a time).
 *   - Magic-users, and elves casting as one: table ruling "magic-user-spellbook"
 *     (Lars, 25 Nov 2026), which replaces "magic-user-all-spells" (16 Nov). A
 *     magic-user prepares only spells in their spellbook. The player adds or
 *     removes any spell on the magic-user list at any time, with no cost or
 *     limit. A spell removed while prepared stays prepared that day. It sets
 *     aside WW p. 25 (spellbooks bought one spell level at a time) and WW p. 10
 *     (an elf's "mental" book grown by study).
 *   Spells per day (WW pp. 5, 7, 8) are unchanged, so a caster still prepares
 *   only at spell levels they have slots for.
 *
 * Jay's rulings (17 Nov 2026):
 * - "prepare-same-spell": a caster may prepare the same spell in several slots.
 * - "cleric-wis-penalty": a low Wisdom never takes spells away (WW p. 5 names only bonuses).
 * - "cleric-l1-scroll" and "cleric-l1-scroll-spells": a 1st-level cleric with
 *   Wis 15+ gets one spell, even with Wis 18, and the player picks it. WW p. 25
 *   says "one or two". With every cleric spell known, the pick is the day's
 *   prepared spell.
 */
export const SPELL_SLOTS_SOURCE: Record<SpellClass, string> = {
  "magic-user": "Woundwort's Warren p. 7",
  cleric: "Woundwort's Warren p. 8",
};
export const SPELL_LIST_SOURCE = "Woundwort's Warren p. 26";
export const ALL_SPELLS_SOURCE = "Table ruling cleric-all-spells (Lars), 16 Nov 2026";
export const SPELLBOOK_SOURCE = "Table ruling magic-user-spellbook (Lars), 25 Nov 2026";

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
 * 1st-level cleric with Wis 15+ casts at all (WW p. 25). At 1st level that is
 * one spell at most (Jay's ruling cleric-l1-scroll).
 */
export function spellSlots(cls: SpellClass, level: number, wis: number | null): number[] {
  const table = SLOTS[cls];
  if (!Number.isInteger(level) || level < 1 || level > table.length) throw new RangeError(`No spell row for level ${level}`);
  const slots = [...table[level - 1]];
  if (cls === "cleric" && wis !== null) {
    const bonus = Math.max(0, abilityModifier(wis));
    slots[0] += level === 1 ? Math.min(bonus, CLERIC_FIRST_LEVEL_MAX) : bonus;
  }
  return slots;
}

/** Jay's ruling cleric-l1-scroll: a 1st-level cleric's prayer scroll holds one spell. */
export const CLERIC_FIRST_LEVEL_MAX = 1;

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
 * The spells a caster prepares from, in list order. A cleric has the whole
 * cleric list (ruling cleric-all-spells) and the book is ignored. A magic-user
 * has the spells in their spellbook (ruling magic-user-spellbook); keys that
 * aren't on the magic-user list drop out.
 */
export function knownSpells(cls: SpellClass, spellbook: readonly string[]): Spell[] {
  if (cls === "cleric") return spellsFor("cleric");
  const book = new Set(spellbook);
  return spellsFor("magic-user").filter((s) => book.has(s.key));
}

/**
 * Prepared spells a magic-user removed from the spellbook. Each one stays in
 * its slot for the day but can't be prepared again (ruling magic-user-spellbook).
 * One entry per spell, in list order. Always empty for a cleric.
 */
export function preparedOutsideBook(cls: SpellClass, spellbook: readonly string[], prepared: readonly string[]): Spell[] {
  if (cls === "cleric") return [];
  const book = new Set(spellbook);
  const out = new Set(prepared.filter((k) => !book.has(k)));
  return spellsFor("magic-user").filter((s) => out.has(s.key));
}

/**
 * Checks a day's prepared spells: each one on the class list, known (for a
 * magic-user, in the spellbook), and no more at a spell level than the
 * character has slots for. Returns the first problem as a message, or null.
 * Pass the whole class list as `known` to check only the slot counts.
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

/**
 * Adds a spell to a magic-user's spellbook, or removes it (ruling
 * magic-user-spellbook). Returns the new book in list order, without repeats,
 * or throws for a spell that isn't on the magic-user list (WW p. 26). Keys no
 * longer on the list drop out.
 */
export function setSpellbookSpell(spellbook: readonly string[], key: string, on: boolean): string[] {
  const s = spell(key);
  if (!s || s.cls !== "magic-user") throw new Error("That spell isn't on the magic-user list (WW p. 26).");
  const next = new Set(spellbook);
  if (on) next.add(key);
  else next.delete(key);
  return knownSpells("magic-user", [...next]).map((x) => x.key);
}

/** True when two books hold the same spells, in any order. */
export function sameSpellbook(a: readonly string[], b: readonly string[]): boolean {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((k) => y.has(k));
}

export function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
