/**
 * Example answers for the open rulings (keys from the rulings seed in
 * scripts/migrate.mjs), shown on /gm/rulings so Jay can start from one.
 *
 * These are NOT rules. Nothing in the vault reads them. Picking one only
 * fills Jay's answer box; Jay's recorded answer is what goes on file.
 * `basis` says where an example comes from: a book page, an earlier table
 * ruling, or "What the vault does now" for the behavior already in place.
 */

export type RulingExample = { answer: string; basis?: string };

export const NOW = "What the vault does now";

export const RULING_ANSWER_MAX = 1000;

export const RULING_EXAMPLES: Record<string, RulingExample[]> = {
  "hit-die-floor": [
    { answer: "No. Every hit die adds at least 1 hit point.", basis: "Men & Magic p. 11 sets 1 as the floor for its own Constitution rule" },
    { answer: "Yes. A total below 1 adds nothing for that level.", basis: NOW },
  ],
  "low-int-literacy": [
    { answer: "Yes. A character with Int 4 to 6 can't read or write.", basis: "WW p. 11 lets the referee limit it" },
    { answer: "No. Every character can read and write." },
  ],
  "dwarf-darkvision": [
    { answer: "Yes. Every player dwarf has the 2 in 6 sight in the dark.", basis: "WW p. 10" },
    { answer: "No. Player dwarves don't have it." },
  ],
  "save-bonus-stacking": [
    { answer: "Yes. Class and race saving throw bonuses add together." },
    { answer: "No. Use the larger of the two bonuses." },
  ],
  "wis-vs-mind": [
    { answer: "Yes. Add the Wisdom modifier to saves against charms and illusions.", basis: "WW p. 5 leaves it to the referee" },
    { answer: "No. Wisdom doesn't change those saves." },
  ],
  "survive-adversity": [
    { answer: "Use the table on Men & Magic p. 11 as printed.", basis: "Men & Magic p. 11, via WW p. 5" },
    { answer: "Jay rolls it at the table; the vault doesn't need the odds." },
  ],
  "cleric-l1-scroll": [
    { answer: "No longer needed. Every cleric has every spell on the cleric list.", basis: "Table ruling cleric-all-spells, 16 Nov 2026" },
  ],
  "cleric-l1-scroll-spells": [
    { answer: "No longer needed. Every cleric has every spell on the cleric list.", basis: "Table ruling cleric-all-spells, 16 Nov 2026" },
  ],
  "cleric-edged-weapons": [
    { answer: "No. Clerics use non-edged weapons only.", basis: "Men & Magic p. 7" },
    { answer: "Yes. Clerics may use any weapon, since WW doesn't forbid it." },
  ],
  "ashan-patronage": [
    { answer: "Nothing on the sheet. Jay plays it out at the table." },
    { answer: "A blessing Jay names here, for example a bonus to one kind of saving throw." },
  ],
  "elf-second-class-hp": [
    { answer: "When the elf first adventures in the second class." },
    { answer: "At creation, one roll for each class." },
  ],
  "name-level-xp": [
    { answer: "Each level after 9th needs 100,000 more XP than the one before." },
    { answer: "Stop at 9th level until a character gets close.", basis: NOW },
  ],
  "level-hp-current": [
    { answer: "Yes. Current hit points rise by the same amount as the maximum." },
    { answer: "No. Only the maximum rises; current hit points heal as usual.", basis: NOW },
  ],
  "prepare-same-spell": [
    { answer: "Yes. A caster may prepare the same spell in several slots." },
    { answer: "No. Each slot holds a different spell." },
  ],
  "cleric-wis-penalty": [
    { answer: "No. A low Wisdom never takes spells away.", basis: "WW p. 5 names only bonuses" },
    { answer: "Yes. A cleric with Wis 3 to 6 has one fewer 1st level spell per day." },
  ],
  "carry-unusable-gear": [
    { answer: "Yes. Anyone may carry anything. Class limits are about using it, not carrying it." },
    { answer: "No. Only Jay adds gear a class can't use, and the sheet flags it.", basis: NOW },
  ],
  "con-change-hp": [
    { answer: "Yes. Recount maximum hit points with the new modifier for every level." },
    { answer: "No. Maximum hit points stay as rolled.", basis: NOW },
  ],
  "ability-range": [
    { answer: "Yes. Magic can take a score below 3 or above 18." },
    { answer: "No. Scores stay between 3 and 18.", basis: NOW },
  ],
  "hp-below-zero": [
    { answer: "Dead at 0 hit points." },
    { answer: "Out of the fight at 0. Jay decides at the table who lives." },
    { answer: "The sheet just shows the number.", basis: NOW },
  ],
  "mu-combat-rows": [
    { answer: "The 4-6 row. The '5-9' row is a misprint for 7-9, since magic-users improve every 3 levels.", basis: "WW p. 19" },
    { answer: "The 5-9 row, as printed." },
  ],
  "neutral-cleric-fourth": [
    { answer: "Yes. Stop the 4th level hit die roll until the cleric chooses Law or Chaos.", basis: "WW p. 8" },
    { answer: "No. Warn on the sheet, but let the roll happen.", basis: NOW },
  ],
  "drain-xp": [
    { answer: "The least XP needed for the new level." },
    { answer: "Halfway between the new level and the next." },
    { answer: "Jay enters the XP each time.", basis: NOW },
  ],
  "drain-hp-current": [
    { answer: "Yes. Current hit points drop by the same amount." },
    { answer: "Only if they are above the new maximum; then they drop to it." },
    { answer: "No. Current hit points stay as they are.", basis: NOW },
  ],
  "regain-drained-level": [
    { answer: "Yes. Roll a new hit die, like any new level.", basis: NOW },
    { answer: "No. The hit die rolled before the drain comes back." },
  ],
  "large-shield-ac": [
    { answer: "No. A large shield counts as a shield.", basis: NOW },
    { answer: "Yes. A large shield gives 1 more point of armor class than a shield." },
  ],
  "magic-armor-ac": [
    { answer: "No. The AC stays as the table gives it. Attackers take the armor's bonus off their roll.", basis: "Monsters & Treasure p. 30" },
    { answer: "Yes. Magic armor lowers armor class by its bonus. A magic shield stays one blow in three." },
    { answer: "Show both numbers and use the lower one at the table.", basis: NOW },
  ],
  "dart-long-range": [
    { answer: "Yes. Dart long range is 31-45 feet.", basis: "The pattern of the other rows on WW p. 19" },
    { answer: "Keep the ranges as printed and settle overlaps at the table.", basis: NOW },
  ],
  "sling-long-range": [
    { answer: "Yes. Sling long range is 81-160 feet.", basis: "The pattern of the other rows on WW p. 19" },
    { answer: "Keep the ranges as printed and settle overlaps at the table.", basis: NOW },
  ],
  "one-level-per-adventure": [
    { answer: "Yes. No single award gains more than one level.", basis: "Men & Magic p. 18" },
    { answer: "No. The form warns, but any award goes through.", basis: NOW },
  ],
  "starting-magic-items": [
    { answer: "No. New characters start with no magic items. Jay adds any found in play.", basis: NOW },
    { answer: "Yes. Each new character starts with two magic items, and Jay picks them." },
    { answer: "Yes. Each new character starts with two magic items the player picks, and Jay approves them." },
  ],
  "starting-xp": [
    { answer: "No. New characters start at 0 XP.", basis: NOW },
    { answer: "Yes. A new character starts with as much XP as the lowest character in the party." },
  ],
  "staff-carry-over-rest": [
    { answer: "Yes. A stored spell stays until it is used, through any amount of rest.", basis: NOW },
    { answer: "No. Stored spells fade when the magic-user rests and prepares the next day's spells." },
  ],
  "staff-same-spell-twice": [
    { answer: "Yes. Both slots may hold the same spell.", basis: NOW },
    { answer: "No. Each slot must hold a different spell." },
  ],
  "staff-loss": [
    { answer: "Yes. If the staff or wand is broken, stolen or dropped, the stored spells are lost." },
    { answer: "Only if it is broken. A stolen or dropped staff keeps its spells until found." },
    { answer: "Jay decides each time and voids the slot when a spell is lost.", basis: NOW },
  ],
  "elf-wand-int": [
    { answer: "Yes. Elves need an Intelligence bonus (15+) like any magic-user.", basis: NOW },
    { answer: "No. Every elf may store one spell in a staff or wand." },
  ],
  "staff-int-drop": [
    { answer: "The extra stored spell is lost at once." },
    { answer: "The stored spell stays until it is released, but no new spell can be loaded past the limit.", basis: NOW },
  ],
};

/** Trims Jay's answer and checks it fits. Throws a message the form shows. */
export function cleanRulingAnswer(raw: string): string {
  const answer = raw.replace(/\r\n/g, "\n").trim();
  if (!answer) throw new Error("Write an answer, or pick one of the examples.");
  if (answer.length > RULING_ANSWER_MAX) throw new Error(`Keep the answer to ${RULING_ANSWER_MAX.toLocaleString("en-US")} characters.`);
  return answer;
}
