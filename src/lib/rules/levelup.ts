import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES, levelFor, levelRow, maxLevel } from "./advancement";
import { combatRows } from "./combat";
import { castsSpells, knownSpells, SPELLBOOK_COST_GP, spellSlots } from "./spells";
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
  /** Spell keys Jay recorded on the character (characters.spells_known). */
  recordedSpells: string[];
};

export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

const toHitAc9 = (cls: CharacterClass, level: number) => combatRows(cls, level).map((r) => r.toHit[0]).join(" or ");

export function levelUp(input: LevelUpInput, from: number, to: number): LevelUp {
  const { race, cls, alignment, wis, recordedSpells } = input;
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
    const known = knownSpells(cls, recordedSpells);
    now.forEach((n, i) => {
      if (n === was[i]) return;
      changes.push({ label: `${ordinal(i + 1)}-level spells per day`, before: String(was[i]), after: String(n), source: book });
      if (was[i] > 0 || known.some((s) => s.level === i + 1)) return;
      // A cleric's 1st-level scroll at 2nd level has its own note below.
      if (cls === "cleric" && i === 0) return;
      const cost = SPELLBOOK_COST_GP[i].toLocaleString("en-US");
      if (cls === "cleric") {
        notes.push({ text: `The cleric can now pray for ${ordinal(i + 1)}-level spells. The prayer scroll comes from the church or temple for an offering of ${cost} gp (WW p. 25). Record it on the sheet once bought.` });
      } else if (race === "elf") {
        notes.push({ text: `The elf can now cast ${ordinal(i + 1)}-level spells. An elf adds spells to the mental book by studying scrolls or tomes, or from another elf who shares them (WW p. 10). Record them on the sheet.` });
      } else {
        notes.push({ text: `The magic-user can now cast ${ordinal(i + 1)}-level spells. A ${ordinal(i + 1)}-level spellbook costs ${cost} gp, usually bought from a higher-level magic-user (WW p. 25). Record it on the sheet once bought.` });
      }
    });
  }
  // WW p. 25: at 2nd level the church gives the complete 1st-level scroll for an offering.
  if (cls === "cleric" && from < 2 && to >= 2) {
    notes.push({
      text: `At 2nd level the church gives a complete prayer scroll of every 1st-level cleric spell, in exchange for an offering (${SPELLBOOK_COST_GP[0].toLocaleString("en-US")} gp on the WW p. 25 table). Record it on the sheet once given.`,
    });
  }

  // To hit (WW pp. 19-20).
  const hitBefore = toHitAc9(cls, from);
  const hitAfter = toHitAc9(cls, to);
  if (hitBefore !== hitAfter) changes.push({ label: "Roll to hit AC 9", before: hitBefore, after: hitAfter, source: "WW p. 20" });
  if (combatRows(cls, to).length > 1) {
    notes.push({
      text: `The WW p. 20 matrix lists a ${ordinal(to)}-level magic-user in two rows, so both are shown. WW p. 19 says magic-users improve every 3 levels.`,
      ruling: "mu-combat-rows",
    });
  }

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
    if (alignment === "neutral" && from < 4 && to >= 4) {
      notes.push({
        text: "A neutral cleric may not stay neutral past 3rd level and, under most circumstances, must choose Law or Chaos before advancing to 4th (WW p. 8).",
        ruling: "neutral-cleric-fourth",
      });
    }
  }

  const cap = maxLevel(race, cls);
  if (to === cap && cap < 9 && race) {
    notes.push({ text: `${ordinal(cap)} level is as high as a ${race} ${CLASS_NAMES[cls].toLowerCase()} goes (WW pp. 7-10).` });
  } else if (to === 9) {
    notes.push({ text: "10th level is name level. What its +100,000 XP means waits on Jay.", ruling: "name-level-xp" });
  }
  return { from, to, changes, notes };
}

/**
 * Levels gained by an XP award, for the award form (M&M p. 18 recommends no
 * more XP from one adventure than it takes to gain one level; pending ruling
 * "one-level-per-adventure").
 */
export function levelsGained(race: Race | null, cls: CharacterClass, xp: number, amount: number): { from: number; to: number } {
  const cap = maxLevel(race, cls);
  const from = Math.min(levelFor(cls, xp).level, cap);
  const to = Math.min(levelFor(cls, Math.max(0, xp + amount)).level, cap);
  return { from, to };
}
