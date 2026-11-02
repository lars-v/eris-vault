import type { Alignment, CharacterClass, ImportFlag, Race } from "@/db/schema";
import { ABILITIES, ABILITY_NAMES, abilityModifier, formatModifier, type Ability } from "@/lib/rules/abilities";
import { ADVANCEMENT_SOURCE, CLASS_NAMES, levelFor, RACE_CLASSES } from "@/lib/rules/advancement";
import { alignmentsFor, classesFor } from "@/lib/rules/creation";
import { catalogItem, classAllows } from "@/lib/rules/equipment";

/**
 * Checks a character brought in from a sheet against the books. Nothing is
 * corrected: every mismatch becomes a flag for Jay (see CLAUDE.md, "Flag
 * conflicts in imported sheets").
 */
export type ImportedCharacter = {
  race: Race;
  cls: CharacterClass;
  alignment: Alignment;
  xp: number;
  scores: Record<Ability, number>;
  hpCurrent: number;
  hpMax: number;
  coinsGp: number;
  items: { name: string; catalogKey?: string | null }[];
};

/** What the sheet itself says, where the app would work it out instead. */
export type WrittenOnSheet = { level: number | null; save: number | null; bonuses: Record<Ability, number | null> };

const n = (x: number) => x.toLocaleString("en-US");

export function importFlags(c: ImportedCharacter, written: WrittenOnSheet): ImportFlag[] {
  const flags: ImportFlag[] = [];
  const lvl = levelFor(c.cls, c.xp);
  const table = ADVANCEMENT_SOURCE[c.cls].replace("Woundwort's Warren", "WW");

  if (!classesFor(c.race).includes(c.cls)) {
    flags.push({
      title: `A ${c.race} can't be a ${CLASS_NAMES[c.cls]}`,
      body: `The house rules allow a ${c.race} to be: ${classesFor(c.race).map((k) => CLASS_NAMES[k]).join(", ")}.`,
      source: "WW pp. 9-10",
    });
  } else {
    const cap = RACE_CLASSES[c.race][c.cls];
    if (cap != null && lvl.level > cap) {
      flags.push({
        title: `Past the ${c.race} level limit`,
        body: `${n(c.xp)} XP is level ${lvl.level}, but a ${c.race} ${CLASS_NAMES[c.cls]} stops at level ${cap}.`,
        source: "WW pp. 9-10",
      });
    }
  }

  if (!alignmentsFor(c.cls).includes(c.alignment)) {
    flags.push({ title: "Thief alignment", body: `The sheet says ${c.alignment}. Thieves may be neutral or chaotic.`, source: "WW p. 9" });
  }

  if (written.level !== null && written.level !== lvl.level) {
    flags.push({
      title: `Level says ${written.level}; XP says ${lvl.level}`,
      body: `${n(c.xp)} XP makes a ${CLASS_NAMES[c.cls]} level ${lvl.level} (${lvl.title}).`,
      source: table,
    });
  }

  if (written.save !== null && written.save !== lvl.save) {
    flags.push({
      title: `Base save says ${written.save}; the table says ${lvl.save}`,
      body: `A level ${lvl.level} ${CLASS_NAMES[c.cls]} saves on ${lvl.save}.`,
      source: table,
    });
  }

  const wrongBonus = ABILITIES.filter((a) => written.bonuses[a] !== null && written.bonuses[a] !== abilityModifier(c.scores[a]));
  if (wrongBonus.length) {
    flags.push({
      title: "Ability bonuses don't match the scores",
      body: wrongBonus
        .map((a) => `${ABILITY_NAMES[a]} ${c.scores[a]} is ${formatModifier(abilityModifier(c.scores[a]))}; the sheet says ${formatModifier(written.bonuses[a]!)}.`)
        .join(" "),
      source: "WW p. 5",
    });
  }

  if (c.hpCurrent > c.hpMax) {
    flags.push({ title: "Hit points above maximum", body: `Current ${c.hpCurrent}, maximum ${c.hpMax}.`, source: "Imported sheet" });
  }

  if (c.coinsGp < 0) flags.push({ title: "Negative gold", body: `Coins show ${c.coinsGp} gp.`, source: "Imported sheet" });

  const notAllowed = c.items.flatMap((it) => {
    const entry = it.catalogKey ? catalogItem(it.catalogKey) : undefined;
    if (!entry || !classesFor(c.race).includes(c.cls)) return [];
    const ok = classAllows({ cls: c.cls, race: c.race, int: c.scores.int }, entry);
    return ok.ok ? [] : [`${it.name}: ${ok.why}`];
  });
  if (notAllowed.length) {
    flags.push({ title: "Gear outside class limits", body: notAllowed.join(" "), source: "WW pp. 7, 9; M&M pp. 6, 8" });
  }

  return flags;
}

/** Values the player typed differently from what the uploaded sheet says. */
export function changedFromSheet(pairs: { label: string; sheet: string | number | null; entered: string | number }[]): ImportFlag | null {
  const changed = pairs.filter((p) => p.sheet !== null && p.sheet !== "" && String(p.sheet) !== String(p.entered));
  if (!changed.length) return null;
  return {
    title: "Changed from the uploaded sheet",
    body: changed.map((p) => `${p.label}: sheet says ${p.sheet}, player entered ${p.entered}.`).join(" "),
    source: "Uploaded sheet",
  };
}
