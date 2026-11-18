import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES, levelFor, levelRow, maxLevel, NAME_LEVEL_HP, TOP_LEVEL } from "./advancement";
import { combatRows } from "./combat";
import { castsSpells, spellSlots } from "./spells";
import { thiefSkills } from "./thief";
import { canAffectUndead, formatTurn, turningRow } from "./turning";

/**
 * What changes when a class goes from one level to a higher one. Every line
 * names its page; open questions name their pending ruling.
 */
export type LevelChange = { label: string; before: string; after: string; source: string };
export type LevelNote = { text: string; ruling?: string };
export type LevelUp = { from: number; to: number; changes: LevelChange[]; notes: LevelNote[] };

export type LevelUpInput = {
  race: Race | null;
  cls: CharacterClass;
  alignment: Alignment | null;
  wis: number | null;
};

export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

const toHitAc9 = (cls: CharacterClass, level: number) => combatRows(cls, level).map((r) => r.toHit[0]).join(" or ");

export function levelUp(input: LevelUpInput, from: number, to: number): LevelUp {
  const { race, cls, alignment, wis } = input;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to <= from) {
    throw new RangeError(`A level-up goes up: ${from} to ${to}`);
  }
  if (to > maxLevel(race, cls)) throw new RangeError(`${ordinal(to)} level is past the cap for this class`);
  const before = levelRow(cls, from);
  const after = levelRow(cls, to);
  const changes: LevelChange[] = [];
  const notes: LevelNote[] = [];
  const book = cls === "thief" ? "WW p. 9" : cls === "cleric" ? "WW p. 8" : "WW p. 7";

  changes.push({ label: "Title", before: before.title, after: after.title, source: book });
  changes.push({ label: "Saving throw", before: String(before.save), after: String(after.save), source: book });

  // Spells per day (WW pp. 7-8; cleric Wisdom bonus WW p. 5).
  if (castsSpells(cls)) {
    const was = spellSlots(cls, from, wis);
    const now = spellSlots(cls, to, wis);
    // Every caster already has every spell on the list (rulings cleric-all-spells,
    // magic-user-all-spells), so a new spell level needs no book or scroll.
    now.forEach((n, i) => {
      if (n === was[i]) return;
      changes.push({ label: `${ordinal(i + 1)}-level spells per day`, before: String(was[i]), after: String(n), source: book });
    });
  }

  // To hit (WW pp. 19-20).
  const hitBefore = toHitAc9(cls, from);
  const hitAfter = toHitAc9(cls, to);
  if (hitBefore !== hitAfter) changes.push({ label: "Roll to hit AC 9", before: hitBefore, after: hitAfter, source: "WW p. 20" });

  // Thief skills (WW p. 9).
  if (cls === "thief") {
    const was = thiefSkills(from);
    thiefSkills(to).forEach((s, i) => {
      if (s.value === was[i].value) return;
      changes.push({ label: s.name, before: was[i].value ?? "-", after: s.value ?? "-", source: "WW p. 9" });
    });
  }

  // Affecting undead (WW p. 8).
  if (cls === "cleric") {
    if (canAffectUndead(alignment) === false) {
      notes.push({ text: "Neutral clerics can't affect undead. Declaring for Law or Chaos gives the power at once (WW p. 8)." });
    } else {
      const was = turningRow(from);
      turningRow(to).forEach((u, i) => {
        if (u.result === was[i].result) return;
        changes.push({ label: `Affect ${u.name}`, before: formatTurn(was[i].result), after: formatTurn(u.result), source: "WW p. 8" });
      });
    }
    // WW p. 8: a neutral cleric must choose Law or Chaos before advancing to 4th level.
    // Jay's ruling "neutral-cleric-fourth": the 4th-level hit die waits until then (neutralClericBlocked).
    if (alignment === "neutral" && from < 4 && to >= 4) {
      notes.push({
        text: "A neutral cleric must choose Law or Chaos before advancing to 4th level (WW p. 8). The 4th-level hit die can't be rolled until Jay changes the alignment.",
      });
    }
  }

  const cap = maxLevel(race, cls);
  if (to >= TOP_LEVEL) {
    changes.push({ label: "Hit points per level", before: "1d6", after: `+${NAME_LEVEL_HP[cls]}`, source: book });
  }
  if (to === cap && cap < TOP_LEVEL && race) {
    notes.push({ text: `${ordinal(cap)} level is as high as a ${race} ${CLASS_NAMES[cls].toLowerCase()} goes (WW pp. 7-10).` });
  } else if (to === TOP_LEVEL) {
    notes.push({
      text: "10th level is name level (WW p. 6). WW lists saving throws and cleric spells only to 10th, so the vault stops here for now.",
      ruling: "past-tenth-level",
    });
  }
  return { from, to, changes, notes };
}

/**
 * Jay's ruling "neutral-cleric-fourth" (17 Nov 2026): a neutral cleric's
 * 4th-level hit die is not rolled until the cleric chooses Law or Chaos (WW p. 8).
 * Returns the message to show, or null.
 */
export function neutralClericBlocked(cls: CharacterClass, alignment: Alignment | null, level: number): string | null {
  if (cls !== "cleric" || alignment !== "neutral" || level < 4) return null;
  return "A neutral cleric must choose Law or Chaos before advancing to 4th level (WW p. 8). Ask Jay to change the alignment first.";
}

/**
 * Levels gained by an XP award, for the award form. M&M p. 18 recommends no
 * more XP from one adventure than it takes to gain one level; Jay's ruling
 * "one-level-per-adventure" (17 Nov 2026) makes that the rule (awardTooBig).
 */
export function levelsGained(race: Race | null, cls: CharacterClass, xp: number, amount: number): { from: number; to: number } {
  const cap = maxLevel(race, cls);
  const from = Math.min(levelFor(cls, xp).level, cap);
  const to = Math.min(levelFor(cls, Math.max(0, xp + amount)).level, cap);
  return { from, to };
}

/**
 * Jay's ruling "one-level-per-adventure" (17 Nov 2026): no single award gains
 * more than one level. Returns the message to show, naming the most XP the
 * award may bring, or null when the new total is fine. Lowering XP is never
 * an award. Jay corrects a mistake with Set by hand (overrideStats) instead.
 */
export function awardTooBig(race: Race | null, cls: CharacterClass, xp: number, newXp: number): string | null {
  if (newXp <= xp) return null;
  const { from, to } = levelsGained(race, cls, xp, newXp - xp);
  if (to - from <= 1) return null;
  const most = levelRow(cls, from + 2).xp - 1;
  return `No single award gains more than one level (Jay's ruling; Men & Magic p. 18). From ${ordinal(from)} level the most this award can bring is ${most.toLocaleString("en-US")} XP.`;
}
