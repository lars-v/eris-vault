import type { Alignment, CharacterClass, ImportFlag, Race } from "@/db/schema";
import { ABILITIES, ABILITY_NAMES, abilityModifier, formatModifier, type Ability } from "@/lib/rules/abilities";
import { ADVANCEMENT_SOURCE, CLASS_NAMES, levelFor, RACE_CLASSES } from "@/lib/rules/advancement";
import { alignmentsFor, classesFor } from "@/lib/rules/creation";
import { combatRows } from "@/lib/rules/combat";
import { catalogItem, classAllows, type WeaponClass } from "@/lib/rules/equipment";
import { againstText, overlappingForms, parseAgainst, SAVE_FORMS, saveBonusesFor, saveTotal, type SaveForm } from "@/lib/rules/saves";
import { CLASS_DAMAGE, dice, magicAdds, WEAPON_RULES, weaponEntry } from "@/lib/rules/weapons";

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

export type WrittenSaveBonus = { bonus: number | null; against: string };
export type WrittenWeapon = { name: string; size: string; damage: string; meleeRanged: string; ranges: [string, string, string] };

/** What the sheet itself says, where the app would work it out instead. */
export type WrittenOnSheet = {
  level: number | null;
  save: number | null;
  bonuses: Record<Ability, number | null>;
  /** The "roll d20 to hit" boxes under target armor class 9 to 0. */
  toHit?: (number | null)[];
  /** The two "+/- against" boxes beside the saving throw. */
  saveBonuses?: WrittenSaveBonus[];
  /** The weapon table on page 1. */
  weapons?: WrittenWeapon[];
};

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

  const toHitFlag = toHitCheck(c, written, lvl.level);
  if (toHitFlag) flags.push(toHitFlag);
  const saveFlag = saveBonusCheck(c, written);
  if (saveFlag) flags.push(saveFlag);
  const weaponFlag = weaponCheck(c, written);
  if (weaponFlag) flags.push(weaponFlag);

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

const TO_HIT_ACS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

/** The to-hit row against the Character Combat Matrix (WW p. 20), before any Strength or Dexterity adjustment. */
function toHitCheck(c: ImportedCharacter, written: WrittenOnSheet, level: number): ImportFlag | null {
  const boxes = written.toHit ?? [];
  if (!boxes.some((n) => n !== null)) return null;
  const rows = combatRows(c.cls, level);
  const fits = rows.some((r) => boxes.every((n, i) => n === null || n === r.toHit[i]));
  if (fits) return null;
  const sheet = TO_HIT_ACS.map((ac, i) => `${ac}: ${boxes[i] ?? "blank"}`).join(", ");
  const table = rows.map((r) => r.toHit.slice(0, TO_HIT_ACS.length).join(", ")).join(" or ");
  return {
    title: "To-hit row doesn't match the Combat Matrix",
    body: `The sheet says ${sheet}. A level ${level} ${CLASS_NAMES[c.cls]} needs ${table} against armor class 9 to 0, before Strength or Dexterity.`,
    source: "WW p. 20",
  };
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** The "+/- against" boxes against Saving Throw Bonuses (WW p. 21). */
function saveBonusCheck(c: ImportedCharacter, written: WrittenOnSheet): ImportFlag | null {
  if (!written.saveBonuses || !classesFor(c.race).includes(c.cls)) return null;
  const problems: string[] = [];
  const covered = new Set<SaveForm>();
  for (const w of written.saveBonuses) {
    const forms = parseAgainst(w.against);
    if (w.bonus === null || !forms) {
      problems.push(`Couldn't read "${[w.bonus === null ? "" : sign(w.bonus), w.against].filter(Boolean).join(" vs ")}".`);
      continue;
    }
    for (const form of forms) {
      covered.add(form);
      const total = saveTotal(c.cls, c.race, form);
      if (total === 0) problems.push(`The sheet gives ${sign(w.bonus)} vs ${form}; WW p. 21 gives a ${c.race} ${CLASS_NAMES[c.cls]} no bonus there.`);
      else if (w.bonus !== total) problems.push(`The sheet gives ${sign(w.bonus)} vs ${form}; WW p. 21 gives ${sign(total)}.`);
    }
  }
  // Forms the sheet leaves out, grouped by the total WW p. 21 gives.
  const missing = new Map<number, SaveForm[]>();
  for (const f of SAVE_FORMS) {
    const total = saveTotal(c.cls, c.race, f);
    if (total !== 0 && !covered.has(f)) missing.set(total, [...(missing.get(total) ?? []), f]);
  }
  for (const [total, forms] of missing) problems.push(`The sheet has no bonus vs ${againstText(forms)}; WW p. 21 gives ${sign(total)}.`);
  if (!problems.length) return null;
  const stack = overlappingForms(saveBonusesFor(c.cls, c.race)).length > 0;
  return {
    title: "Save bonuses differ from the book",
    body: problems.join(" ") + (stack ? " Class and race bonuses add together (Jay's ruling)." : ""),
    source: "WW p. 21",
  };
}

const SIZE_WORDS: Record<string, WeaponClass> = { s: "small", small: "small", n: "normal", normal: "normal", "2h": "two-handed", "two-handed": "two-handed", twohanded: "two-handed" };
const cleanRange = (s: string) => s.replace(/[\s']/g, "").replace(/[–—]/g, "-").replace(/ft|feet/gi, "");

/** "1d6-1", "d6+1", "1-5" (WW p. 19 prints both) to the change from 1d6; null when it isn't a d6. */
function damageMod(raw: string): number | null {
  const s = raw.replace(/\s/g, "").toLowerCase();
  const d = s.match(/^1?d6([+-]\d+)?$/);
  if (d) return d[1] ? Number(d[1]) : 0;
  const r = s.match(/^(\d+)-(\d+)$/);
  if (r && Number(r[2]) - Number(r[1]) === 5) return Number(r[1]) - 1;
  return null;
}

/** The page 1 weapon table against WW p. 19 (and M&T pp. 30-31 for magic weapons). */
function weaponCheck(c: ImportedCharacter, written: WrittenOnSheet): ImportFlag | null {
  const problems: string[] = [];
  const unknown: string[] = [];
  const strMod = abilityModifier(c.scores.str);
  for (const w of written.weapons ?? []) {
    const entry = weaponEntry(w.name);
    if (!entry) {
      unknown.push(w.name);
      continue;
    }
    const rule = WEAPON_RULES[entry.key];
    const bonus = Number(w.name.match(/\+(\d+)/)?.[1] ?? 0);
    const magic = magicAdds(entry.key, bonus).damage;

    const size = SIZE_WORDS[w.size.trim().toLowerCase()];
    if (size && entry.weaponClass && size !== entry.weaponClass) {
      problems.push(`${w.name}: size says ${w.size}; WW p. 19 lists it as ${entry.weaponClass}.`);
    }

    const mod = w.damage ? damageMod(w.damage) : null;
    const base = CLASS_DAMAGE[rule.ammo?.weaponClass ?? entry.weaponClass!];
    const melee = rule.uses.includes("melee");
    const ok = new Set([base, base + magic, ...(melee ? [base + strMod, base + strMod + magic] : [])]);
    if (w.damage && (mod === null || !ok.has(mod))) {
      problems.push(`${w.name}: damage says ${w.damage}; WW p. 19 gives ${dice(base)}${base + magic !== base ? `, ${dice(base + magic)} with its magic` : ""}${melee && strMod ? `, plus Strength ${sign(strMod)} in melee` : ""}.`);
    }

    const mr = w.meleeRanged.toLowerCase();
    if (/r/.test(mr) && !rule.ranges) problems.push(`${w.name}: marked ranged, but WW p. 19 has no range for it.`);
    if (/m/.test(mr) && !/r/.test(mr) && !melee) problems.push(`${w.name}: marked melee, but it is a missile weapon.`);

    if (rule.ranges && w.ranges.some(Boolean)) {
      // A sheet that copied the printed long range Jay corrected is fine.
      const ok = (r: string, i: number) => cleanRange(r) === rule.ranges![i] || (i === 2 && cleanRange(r) === rule.printedLong);
      const differs = w.ranges.some((r, i) => r && !ok(r, i));
      if (differs) {
        problems.push(
          `${w.name}: ranges say ${w.ranges.map((r) => r || "blank").join(" / ")}; WW p. 19 ${rule.printedLong ? "gives" : "prints"} ${rule.ranges.join(" / ")}${rule.printedLong ? ` (long range by Jay's ruling; printed ${rule.printedLong})` : ""}.`,
        );
      }
    }
  }
  if (unknown.length) problems.push(`Not on the WW p. 19 damage table: ${unknown.join(", ")}.`);
  if (!problems.length) return null;
  return { title: "Weapon table differs from the book", body: problems.join(" "), source: "WW p. 19; M&T pp. 30-31" };
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
