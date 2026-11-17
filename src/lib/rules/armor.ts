import type { ItemLocation } from "@/db/schema";
import { abilityModifier, formatModifier } from "./abilities";
import { CATALOG, catalogItem, classAllows, type CatalogItem, type Wielder } from "./equipment";

/**
 * Armor class.
 * - Woundwort's Warren p. 17, Armor Class Table: the armor worn and whether a
 *   shield is carried give the number. Lower is better; no armor is 9.
 * - WW p. 5: "A dexterity bonus will lower a character's armor class by the
 *   indicated amount, and a penalty raises the character's AC."
 * - WW p. 9: thieves may not wear armor heavier than leather or employ a
 *   shield, so such armor never counts for a thief (via classAllows).
 * - Monsters & Treasure p. 30: magic armor does not change the number. "Armor
 *   proper subtracts its bonus from the hit dice of the opponents of its
 *   wearer. If the shield's bonus is greater than that of the armor there is a
 *   one-third chance that the blow will be caught by the shield, thus giving
 *   the additional subtraction." The sheet says this in words.
 *   On the WW pp. 19-20 to-hit tables, 1 off the attacker's roll plays like 1
 *   better armor class except where 20 is needed. Until Jay rules
 *   (magic-armor-ac), the sheet shows the book number and, beside it, the
 *   number with the armor's bonus in. A shield's bonus counts only one blow in
 *   three, so it is never folded in.
 * - WW p. 17 sells "Shield (large)" but the table names only "Shield". Until
 *   Jay rules (large-shield-ac), a large shield counts as a shield.
 * Only armor on the character ("carried") counts. An item is armor when it has
 * a price-list key, or its name is a price-list armor name with an optional
 * "+N". Anything else that sounds like armor is named, not counted.
 */
export const ARMOR_CLASS_SOURCE = "Woundwort's Warren p. 17";

const BODY_ARMOR = ["plate-mail", "chain-mail", "ring-mail", "leather-armor"] as const;
type BodyArmor = (typeof BODY_ARMOR)[number];
const SHIELDS = ["shield", "shield-large"] as const;

/** WW p. 17 Armor Class Table, as printed: without a shield, with a shield. */
export const ARMOR_CLASS_TABLE: Record<BodyArmor | "none", { plain: number; shield: number }> = {
  none: { plain: 9, shield: 8 },
  "leather-armor": { plain: 7, shield: 6 },
  "ring-mail": { plain: 6, shield: 5 },
  "chain-mail": { plain: 5, shield: 4 },
  "plate-mail": { plain: 3, shield: 2 },
};

export type ArmorItem = {
  name: string;
  catalogKey: string | null;
  location: ItemLocation;
  isMagic: boolean;
  magicBonus: number | null;
};

export type ArmorNote = { text: string; tone: "plain" | "amber" };

export type ArmorClass = {
  /** Final armor class: the table value moved by the Dexterity modifier. */
  ac: number;
  /** The Armor Class Table value before Dexterity. */
  table: number;
  /** Null when Dexterity isn't assigned yet. */
  dexMod: number | null;
  /** "Plate mail and shield", "Leather armor", "Shield only", "No armor". */
  wearing: string;
  /** The worn armor's magic bonus, when one is entered. */
  armorBonus: number | null;
  /** `ac` less the armor's magic bonus; null without one (magic-armor-ac). */
  withMagic: number | null;
  notes: ArmorNote[];
};

const isBody = (k: string | undefined): k is BodyArmor => BODY_ARMOR.includes(k as BodyArmor);
const isShield = (k: string | undefined) => SHIELDS.includes(k as (typeof SHIELDS)[number]);
const norm = (s: string) => s.toLowerCase().replace(/\+\d+/g, "").replace(/[^a-z]/g, "");
const ARMOR_BY_NAME = new Map(
  CATALOG.filter((c) => c.category === "armor").flatMap((c) => [
    [norm(c.name), c] as const,
    ...(c.key === "shield-large" ? [[norm("Large Shield"), c] as const] : []),
  ]),
);
const LOOKS_LIKE_ARMOR = /armou?r|\bmail\b|shield|breastplate|\bhelm/i;

/** The price-list armor this item is, if any. */
function armorEntry(i: ArmorItem): CatalogItem | undefined {
  const entry = i.catalogKey ? catalogItem(i.catalogKey) : ARMOR_BY_NAME.get(norm(i.name));
  return entry?.category === "armor" ? entry : undefined;
}

/** The magic bonus as entered, or the "+N" in the name. */
function bonusOf(i: ArmorItem): number | null {
  if (!i.isMagic) return null;
  if (i.magicBonus !== null) return i.magicBonus;
  const m = i.name.match(/\+(\d+)/);
  return m ? Number(m[1]) : null;
}

const plain = (c: CatalogItem) => c.name.toLowerCase();

export function armorClass(items: ArmorItem[], dex: number | null, wielder: Wielder | null): ArmorClass {
  const notes: ArmorNote[] = [];
  const onHand = items.filter((i) => i.location === "carried");
  const fits = (entry: CatalogItem) => {
    if (!wielder) return true;
    const allowed = classAllows(wielder, entry);
    if (!allowed.ok) notes.push({ text: `${allowed.why} The ${plain(entry)} isn't counted.`, tone: "amber" });
    return allowed.ok;
  };

  const pieces = onHand.flatMap((i) => {
    const entry = armorEntry(i);
    return entry && fits(entry) ? [{ item: i, entry }] : [];
  });
  // Best armor first: plate, chain, ring, leather.
  const bodies = pieces
    .filter((p) => isBody(p.entry.key))
    .sort((a, b) => BODY_ARMOR.indexOf(a.entry.key as BodyArmor) - BODY_ARMOR.indexOf(b.entry.key as BodyArmor));
  const shields = pieces.filter((p) => isShield(p.entry.key));
  const armor = bodies[0] ?? null;
  // A plain shield first, since that is the one the table names; then the best magic bonus.
  const shield =
    [...shields].sort(
      (a, b) =>
        Number(a.entry.key === "shield-large") - Number(b.entry.key === "shield-large") ||
        (bonusOf(b.item) ?? 0) - (bonusOf(a.item) ?? 0),
    )[0] ?? null;

  const row = ARMOR_CLASS_TABLE[armor ? (armor.entry.key as BodyArmor) : "none"];
  const table = shield ? row.shield : row.plain;
  const dexMod = dex === null ? null : abilityModifier(dex);
  const ac = table - (dexMod ?? 0);

  const otherSuits = [...new Set(bodies.slice(1).map((b) => plain(b.entry)))].filter((n) => n !== plain(armor!.entry));
  if (otherSuits.length > 0) {
    notes.push({
      text: `Also carrying ${otherSuits.join(", ")}. Only one suit is worn, so this counts the best: the ${plain(armor!.entry)}.`,
      tone: "amber",
    });
  }
  if (shield?.entry.key === "shield-large") {
    notes.push({
      text: "The Armor Class Table names only a shield, so a large shield counts as one until Jay rules (large-shield-ac).",
      tone: "amber",
    });
  }
  if (dexMod === null) notes.push({ text: "Dexterity isn't assigned yet, so its bonus or penalty isn't in.", tone: "amber" });

  // Magic armor and shields change what attackers roll, not the number (M&T p. 30).
  const armorBonus = armor ? bonusOf(armor.item) : null;
  const shieldBonus = shield ? bonusOf(shield.item) : null;
  if (armor?.item.isMagic) {
    notes.push(
      armorBonus
        ? {
            text: `Magic armor +${armorBonus}: attackers take ${armorBonus} off their hit dice when they roll to hit you (Monsters & Treasure p. 30). On the to-hit tables that plays like AC ${ac - armorBonus}, except where 20 is needed. Jay will rule which number the table uses (magic-armor-ac).`,
            tone: "plain",
          }
        : { text: "The armor is magic but its bonus isn't entered.", tone: "amber" },
    );
  }
  if (shield?.item.isMagic) {
    if (!shieldBonus) notes.push({ text: "The shield is magic but its bonus isn't entered.", tone: "amber" });
    else if (shieldBonus > (armorBonus ?? 0)) {
      notes.push({
        text: `Magic shield +${shieldBonus}: one blow in three is caught by the shield, which gives its greater bonus (Monsters & Treasure p. 30).`,
        tone: "plain",
      });
    }
  }

  const away = [
    ...new Set(
      items
        .filter((i) => i.location !== "carried")
        .map(armorEntry)
        .filter((e): e is CatalogItem => Boolean(e))
        .map(plain),
    ),
  ];
  if (away.length > 0) notes.push({ text: `Not counted because it is stashed or on a mount: ${away.join(", ")}.`, tone: "plain" });

  const unknown = onHand.filter((i) => !armorEntry(i) && !(i.catalogKey && catalogItem(i.catalogKey)) && LOOKS_LIKE_ARMOR.test(i.name));
  if (unknown.length > 0) {
    notes.push({
      text: `Not on the price list, so not counted: ${unknown.map((i) => i.name).join(", ")}. Jay can say what it is worth.`,
      tone: "amber",
    });
  }

  const sentence = (c: CatalogItem) => c.name.charAt(0) + c.name.slice(1).toLowerCase();
  const wearing =
    armor && shield ? `${sentence(armor.entry)} and shield` : armor ? sentence(armor.entry) : shield ? "Shield only" : "No armor";
  const seen = new Set<string>();
  return {
    ac,
    table,
    dexMod,
    wearing,
    armorBonus: armorBonus || null,
    withMagic: armorBonus ? ac - armorBonus : null,
    notes: notes.filter((n) => !seen.has(n.text) && seen.add(n.text)),
  };
}

/** How the number was reached, in one or two plain sentences. */
export function armorClassWorking(r: ArmorClass): string {
  const base = `${r.table} on the Armor Class Table.`;
  if (r.dexMod === null || r.dexMod === 0) return base;
  const dir = r.dexMod > 0 ? "lowers" : "raises";
  return `${base} Dexterity ${formatModifier(r.dexMod)} ${dir} it by ${Math.abs(r.dexMod)} (WW p. 5).`;
}
