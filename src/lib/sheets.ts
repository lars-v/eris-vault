import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";
import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { ABILITIES, type Ability } from "@/lib/rules/abilities";
import { CATALOG, type CatalogItem } from "@/lib/rules/equipment";

/**
 * Reads an uploaded character sheet into a draft the player checks before it
 * goes to Jay. Two fillable layouts are known: the Planet Eris sheet (the one
 * Liz and Raz are kept on, fields like "EncItem1") and the generic OD&D sheet
 * ("WEAPONS AND EQUIPMENT A"). Anything else just leaves the draft blank.
 * This only copies what the sheet says. Checking it against the books is
 * src/lib/rules/import.ts.
 */

export const SHEET_MAX_BYTES = 8 * 1024 * 1024;
export type SheetType = "application/pdf" | "image/png" | "image/jpeg";

/** By the file's first bytes, not its name or the browser's claim. */
export function sniffSheetType(bytes: Uint8Array): SheetType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  return null;
}

/** Form field name to value. Empty when the PDF has no form or can't be read. */
export async function readPdfFields(bytes: Uint8Array): Promise<Record<string, string>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const f of doc.getForm().getFields()) {
    let v: string | undefined;
    try {
      if (f instanceof PDFTextField) v = f.getText();
      else if (f instanceof PDFCheckBox) v = f.isChecked() ? "x" : "";
      else if (f instanceof PDFDropdown || f instanceof PDFOptionList) v = f.getSelected().join(", ");
      else if (f instanceof PDFRadioGroup) v = f.getSelected();
    } catch {
      v = undefined;
    }
    const clean = (v ?? "").replace(/﻿/g, "").trim();
    if (clean) out[f.getName().slice(0, 100)] = clean.slice(0, 2000);
  }
  return out;
}

export type DraftItem = { name: string; encUnits: number | null; isMagic: boolean; magicBonus: number | null; catalogKey: string | null };

export type SheetDraft = {
  name: string;
  race: Race | null;
  cls: CharacterClass | null;
  alignment: Alignment | null;
  xp: number | null;
  scores: Record<Ability, number | null>;
  hpCurrent: number | null;
  hpMax: number | null;
  coinsGp: number | null;
  items: DraftItem[];
  notes: string;
  /** Written on the sheet but worked out by the app; kept only to spot mismatches. */
  written: { level: number | null; save: number | null; bonuses: Record<Ability, number | null> };
};

/** "+2", "-15", "−15", "1,250" to a whole number; anything else is null. */
export function toInt(raw: string | undefined): number | null {
  const s = (raw ?? "").replace(/[\s,]/g, "").replace(/−/g, "-");
  return /^[+-]?\d{1,9}$/.test(s) ? Number(s) : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function parseRace(raw: string | undefined): Race | null {
  const s = norm(raw ?? "");
  return (["human", "dwarf", "elf", "halfling"] as const).find((r) => s === r) ?? null;
}

export function parseClass(raw: string | undefined): CharacterClass | null {
  const s = norm(raw ?? "");
  if (s === "fighting man" || s === "fighter" || s === "fighting men") return "fighting-man";
  if (s === "magic user" || s === "mu") return "magic-user";
  if (s === "cleric") return "cleric";
  if (s === "thief") return "thief";
  return null;
}

export function parseAlignment(raw: string | undefined): Alignment | null {
  const s = norm(raw ?? "");
  if (s === "l" || s === "law" || s === "lawful") return "lawful";
  if (s === "n" || s === "neutral" || s === "neutrality") return "neutral";
  if (s === "c" || s === "chaos" || s === "chaotic") return "chaotic";
  return null;
}

const head = (s: string) => norm(s.split("(")[0]);

/** A price list entry with the same name, or the only one starting the same way. */
export function matchCatalog(name: string): CatalogItem | null {
  const plain = name.replace(/\+\d+/g, "");
  const full = CATALOG.find((c) => norm(c.name) === norm(plain));
  if (full) return full;
  const byHead = CATALOG.filter((c) => head(c.name) === head(plain));
  return byHead.length === 1 ? byHead[0] : null;
}

function item(name: string, encUnits: number | null, magic = false): DraftItem {
  const bonus = name.match(/\+(\d)\b/);
  const isMagic = magic || Boolean(bonus);
  return {
    name: name.slice(0, 80),
    encUnits,
    isMagic,
    magicBonus: bonus ? Number(bonus[1]) : null,
    catalogKey: matchCatalog(name)?.key ?? null,
  };
}

const splitList = (s: string) =>
  s
    .split(/[\n;,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

const SHEET_ABILITY: Record<Ability, string> = { str: "STR", int: "INT", wis: "WIS", dex: "DEX", con: "CON", cha: "CHR" };
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

export function draftFromFields(fields: Record<string, string>): SheetDraft {
  // Field names differ in case and spacing between sheet versions.
  const byKey = new Map(Object.entries(fields).map(([k, v]) => [norm(k), v.trim()]));
  const get = (...names: string[]) => names.map((n) => byKey.get(norm(n))).find((v) => v) ?? "";

  const scores = Object.fromEntries(ABILITIES.map((a) => [a, toInt(get(SHEET_ABILITY[a]))])) as Record<Ability, number | null>;
  const bonuses = Object.fromEntries(ABILITIES.map((a) => [a, toInt(get(`${SHEET_ABILITY[a]} Bonus`))])) as Record<Ability, number | null>;

  let hpCurrent = toInt(get("CurrentHP"));
  let hpMax = toInt(get("MaxHP"));
  const hpOne = get("Hit Points");
  if (hpMax === null && hpOne) {
    const [a, b] = hpOne.split("/").map((x) => toInt(x));
    hpMax = b ?? a ?? null;
    hpCurrent = a ?? null;
  }

  const items: DraftItem[] = [];
  // Planet Eris sheet: numbered encumbrance rows with the units written beside them.
  const encRows = [...byKey.keys()]
    .map((k) => k.match(/^encitem ?(\d+)$/)?.[1])
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => Number(a) - Number(b));
  for (const n of encRows) {
    const name = byKey.get(`encitem ${n}`) ?? byKey.get(`encitem${n}`) ?? "";
    if (name) items.push(item(name, toInt(byKey.get(`encval ${n}`) ?? byKey.get(`encval${n}`))));
  }
  // Generic OD&D sheet: free text boxes, no units.
  for (const box of ["A", "B", "C", "D"]) {
    for (const name of splitList(get(`WEAPONS AND EQUIPMENT ${box}`))) items.push(item(name, null));
    for (const name of splitList(get(`MAGIC ITEMS ${box}`))) items.push(item(name, null, true));
  }

  const notes: string[] = [];
  const note = (label: string, value: string) => value && notes.push(`${label}: ${value.replace(/\s*\n\s*/g, "; ")}`);
  note("Armor class", get("Armor Class"));
  const saveBonus = (n: number) => [get(`save bonus ${n}`), get(`AGAINST_${n}`)].filter(Boolean).join(" vs ");
  note("Save bonus", saveBonus(1));
  note("Save bonus", saveBonus(2));
  note("Class and race abilities", get("AbilitiesClassRacial", "Other Abilities"));
  note("Abilities and spells", [get("Abilities and Spells"), get("Abilities and Spells 2"), get("Abilities and Spells 3")].filter(Boolean).join("; "));
  ORDINAL.forEach((ord, i) => {
    note(`${ord}-level spells known`, get(`Level${i + 1}Spells`));
    note(`${ord}-level spells prepared`, get(`Level${i + 1}Prepped`));
  });
  const thief = [
    ["Pick pockets", "ThiefPickPockets"],
    ["Move silently", "ThiefMoveSilently"],
    ["Open locks", "ThiefOpenLocks"],
    ["Remove traps", "ThiefRemoveTraps"],
    ["Hide in shadows", "ThiefHideShadows"],
    ["Climb walls", "ThiefClimbWalls"],
    ["Hear noise", "ThiefHearNoise"],
    ["Read languages", "ThiefReadLanguages"],
    ["Read magic", "ThiefReadMagic"],
  ]
    .map(([label, key]) => (get(key) ? `${label} ${get(key)}` : ""))
    .filter(Boolean);
  note("Thief skills", thief.join(", "));
  const weapons = [1, 2, 3, 4, 5]
    .map((n) => {
      const w = get(`WeaponRow${n}`);
      const extra = [get(`DamageRow${n}`), get(`MeleeRangedRow${n}`)].filter(Boolean).join(", ");
      return w ? (extra ? `${w} (${extra})` : w) : "";
    })
    .filter(Boolean);
  note("Weapons", weapons.join("; "));
  note("Magic items", get("MagicItems"));
  note("Gems and jewelry", get("GemsAndJewelry"));
  note("Treasure", ["A", "B", "C", "D"].map((b) => get(`TREASURE ${b}`)).filter(Boolean).join("; "));
  note("Notes", ["a", "b", "c", "d"].map((b) => get(`notes ${b}`)).filter(Boolean).join("; "));

  return {
    name: get("CHARACTER NAME").slice(0, 60),
    race: parseRace(get("RACE")),
    cls: parseClass(get("CLASS")),
    alignment: parseAlignment(get("ALIGNMENT")),
    xp: toInt(get("XP", "experience a")),
    scores,
    hpCurrent,
    hpMax,
    coinsGp: toInt(get("CoinsGP")),
    items: items.slice(0, 60),
    notes: notes.join("\n").slice(0, 4000),
    written: { level: toInt(get("LEVEL")), save: toInt(get("Base Save")), bonuses },
  };
}
