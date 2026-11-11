import type { CharacterClass, Race } from "@/db/schema";

/**
 * Equipment price list, transcribed from Woundwort's Warren p. 17 (Equipment Costs).
 * Encumbrance units from p. 18 (Equipment Encumbrance), read from the page
 * image because the text copy loses the dots: each dot is 1 unit, and a
 * circle is "negligible encumbrance (count as 0)".
 * Weapon classes (small / normal / two-handed) are from WW p. 19, Weapon Damage Table.
 * Land transport is left out of the starting-kit picker: mounts aren't carried
 * (p. 18 note), so Jay handles them directly.
 */
export type Category = "weapon" | "armor" | "gear";
export type WeaponClass = "small" | "normal" | "two-handed";

export type CatalogItem = {
  key: string;
  name: string;
  category: Category;
  cost: string; // as printed: "10 gp", "25+ gp", "Special"
  costGp: number | null; // null when the price isn't a fixed number
  enc: number; // units, WW p. 18
  weaponClass?: WeaponClass;
};

const w = (key: string, name: string, cost: number, enc: number, weaponClass?: WeaponClass): CatalogItem => ({
  key,
  name,
  category: "weapon",
  cost: `${cost} gp`,
  costGp: cost,
  enc,
  weaponClass,
});
const a = (key: string, name: string, cost: number, enc: number): CatalogItem => ({
  key,
  name,
  category: "armor",
  cost: `${cost} gp`,
  costGp: cost,
  enc,
});
const g = (key: string, name: string, cost: number | string, enc: number): CatalogItem => ({
  key,
  name,
  category: "gear",
  cost: typeof cost === "number" ? `${cost} gp` : cost,
  costGp: typeof cost === "number" ? cost : null,
  enc,
});

export const CATALOG: CatalogItem[] = [
  // Weapons (WW p. 17, enc p. 18); class from WW p. 19 where the damage table lists it.
  w("arrow-silver", "Arrow (1, silver tipped)", 5, 0, "normal"),
  w("arrows-score", "Arrows (1 score)", 5, 1, "normal"),
  w("bastard-sword", "Bastard Sword", 13, 2, "normal"),
  w("battle-axe", "Battle Axe", 7, 3, "two-handed"),
  w("bolts-score", "Bolts/Quarrels (1 score)", 5, 1, "normal"),
  w("club", "Club or Cudgel", 1, 1, "normal"),
  w("crossbow", "Crossbow", 25, 3),
  w("dagger", "Dagger", 3, 1, "small"),
  w("darts-3", "Darts (3)", 1, 1, "small"),
  w("flail", "Flail", 8, 2, "normal"),
  w("hand-axe", "Hand Axe", 3, 1, "normal"),
  w("heavy-war-hammer", "Heavy War Hammer", 7, 3, "two-handed"),
  w("long-bow", "Long Bow", 40, 2),
  w("long-sword", "Long Sword", 10, 2, "normal"),
  w("mace", "Mace", 5, 1, "normal"),
  w("morning-star", "Morning Star", 6, 3, "normal"),
  w("pole-arm", "Pole Arm", 7, 4, "two-handed"),
  w("short-bow", "Short Bow", 25, 2),
  w("short-sword", "Short Sword", 5, 1, "small"),
  w("sling", "Sling", 1, 1),
  w("sling-stones-iron", "Sling Stones (iron, 1 score)", 1, 1, "small"),
  w("sling-stones-silver", "Sling Stones (silver, 1 dozen)", 5, 0, "small"),
  w("spear", "Spear", 2, 2, "normal"),
  w("staff", "Staff", 1, 3, "normal"),
  w("two-handed-sword", "Two-handed Sword", 15, 4, "two-handed"),
  w("war-hammer", "War Hammer", 5, 2, "normal"),
  // Armor (WW p. 17, enc p. 18). Barding is for horses, so it stays with transport.
  a("shield", "Shield", 10, 3),
  a("shield-large", "Shield (large)", 15, 4),
  a("leather-armor", "Leather Armor", 15, 1),
  a("ring-mail", "Ring Mail", 30, 2),
  a("chain-mail", "Chain Mail", 45, 4),
  a("plate-mail", "Plate Mail", 60, 8),
  // Dungeon gear (WW p. 17, enc p. 18).
  g("backpack", "Backpack (35 pound capacity)", 5, 1),
  g("bedrolls-3", "Bedrolls (3)", 1, 2),
  g("bell", "Bell (small)", 1, 0),
  g("belladonna", "Belladonna (1 bunch)", 10, 0),
  g("candles", "Candle (1 dozen)", 1, 0),
  g("canvas", "Canvas (10 sq. yd)", 1, 2),
  g("case", "Case (map or scroll)", 1, 1),
  g("chain", "Chain (10ft)", 30, 2),
  g("chalk", "Chalk (10 pieces)", 1, 0),
  g("chest", "Chest (1' x 2', wooden)", 3, 3),
  g("crowbar", "Crowbar", 2, 1),
  g("fishing-net", "Fishing net (25 sq. feet)", 4, 2),
  g("garlic", "Garlic (1 sprig)", 5, 0),
  g("grappling-hook", "Grappling Hook", 25, 2),
  g("holy-symbol-wood", "Holy Symbol, wooden", 2, 0),
  g("holy-symbol-silver", "Holy Symbol, silver", 25, 1),
  g("holy-water", "Holy Water (1 glass vial)", 25, 1),
  g("ink", "Ink (1 oz)", 1, 0),
  g("iron-spikes", "Iron Spikes (1 dozen)", 1, 1),
  g("ladder", "Ladder (12 ft., wooden or rope)", 3, 3),
  g("lantern", "Lantern, hooded", 10, 1),
  g("lock", "Lock", "25+ gp", 0),
  g("mallet", "Mallet (iron)", 2, 1),
  g("manacles", "Manacles (iron, with key)", 10, 1),
  g("mirror", "Mirror (small, silvered)", 15, 0),
  g("musical-instrument", "Musical Instrument", "5+ gp", 1),
  g("oil", "Oil (1 pint, clay flask)", 2, 1),
  g("parchment", "Parchment (5 sheets)", 1, 0),
  g("pole", "Pole, 10 ft.", 1, 3),
  g("pot", "Pot, iron", 1, 1),
  g("rations-iron", "Rations, iron (7 days)", 15, 2),
  g("rations-standard", "Rations, standard (7 days)", 5, 3),
  g("rope-hemp", "Rope, hemp (50 ft)", 1, 1),
  g("rope-silk", "Rope, silk (50 ft)", 10, 1),
  g("sack-large", "Sack, lg. (50 pound capacity)", 2, 1),
  g("sack-small", "Sack, sm. (20 pound capacity)", 1, 1),
  g("shovel", "Shovel", 2, 2),
  g("signal-whistle", "Signal Whistle", 1, 0),
  g("spellbook", "Spellbook", "Special", 1),
  g("tent", "Tent (canvas, sleeps two)", 8, 2),
  g("tinderbox", "Tinderbox (flint & steel)", 3, 0),
  g("thieves-tools", "Thieves' Tools & Picks", 25, 1),
  g("torches", "Torches (half dozen)", 1, 1),
  g("waterskin", "Waterskin (half gallon)", 1, 1),
  g("wine", "Wine (1 quart, bottle)", 1, 1),
  g("wolfsbane", "Wolfsbane (1 bunch)", 10, 0),
];

export const EQUIPMENT_SOURCE = "Woundwort's Warren p. 17";

export function catalogItem(key: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.key === key);
}

export type Wielder = { cls: CharacterClass; race: Race | null; int: number | null };

/**
 * Class limits on starting gear that the books state outright:
 * - Thieves (WW p. 9): "any type of small or normal weapon", armor no heavier
 *   than leather, no shield.
 * - Magic-users (Men & Magic p. 6): "may arm themselves with daggers only".
 *   Woundwort's Warren p. 7 adds a staff for storing spells when Intelligence
 *   gives a bonus (15+). Elves are exempt: they "may use both weaponry and
 *   spells" (Men & Magic p. 8).
 * Anything the books leave open (magic-user armor, clerics and ordinary edged
 * weapons) is for Jay to judge at approval.
 */
export function classAllows(w: Wielder, item: CatalogItem): { ok: true } | { ok: false; why: string } {
  if (w.cls === "thief") {
    if (item.category === "weapon" && item.weaponClass === "two-handed") {
      return { ok: false, why: "Thieves may wield small or normal weapons only (WW p. 9)." };
    }
    if (item.category === "armor") {
      if (item.key === "shield" || item.key === "shield-large") {
        return { ok: false, why: "Thieves may not employ a shield (WW p. 9)." };
      }
      if (item.key !== "leather-armor") {
        return { ok: false, why: "Thieves may not wear armor heavier than leather (WW p. 9)." };
      }
    }
  }
  if (w.cls === "magic-user" && w.race !== "elf" && item.category === "weapon") {
    if (item.key === "dagger") return { ok: true };
    if (item.key === "staff" && (w.int ?? 0) >= 15) return { ok: true };
    return {
      ok: false,
      why:
        item.key === "staff"
          ? "A magic-user may carry a staff for storing spells only with an Intelligence bonus, 15+ (WW p. 7)."
          : "Magic-users may arm themselves with daggers only (Men & Magic p. 6).",
    };
  }
  return { ok: true };
}

export const KIT_MAX_QUANTITY = 20;

/**
 * Checks a whole kit picked in one go: every key must be on the price list,
 * allowed for the class (classAllows), and taken 1 to 20 times. Returns the
 * first problem as a message, or the picks in price-list order.
 */
export function checkKit(w: Wielder, picks: Record<string, number>): { key: string; quantity: number }[] | string {
  for (const key of Object.keys(picks)) if (!catalogItem(key)) return "That item isn't on the price list.";
  const kit: { key: string; quantity: number }[] = [];
  for (const item of CATALOG) {
    const quantity = picks[item.key];
    if (quantity === undefined || quantity === 0) continue;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > KIT_MAX_QUANTITY) {
      return `Take 1 to ${KIT_MAX_QUANTITY} of ${item.name}.`;
    }
    const allowed = classAllows(w, item);
    if (!allowed.ok) return allowed.why;
    kit.push({ key: item.key, quantity });
  }
  return kit;
}

const AMMO_OR_LAUNCHER = new Set([
  "arrow-silver",
  "arrows-score",
  "bolts-score",
  "sling-stones-iron",
  "sling-stones-silver",
  "crossbow",
  "long-bow",
  "short-bow",
  "sling",
]);
/** Damage table (WW p. 19) weapons with no edge. Used for clerics while "cleric-edged-weapons" waits on Jay. */
const NON_EDGED = new Set(["club", "flail", "mace", "morning-star", "staff", "war-hammer", "heavy-war-hammer"]);
const CLASS_EXTRAS = new Set(["thieves-tools", "holy-symbol-wood", "holy-symbol-silver", "spellbook"]);

/**
 * A random basic starting kit that stays inside the rules for the class:
 * one weapon the class may use, armor the books allow, the class's own tools,
 * and 4 to 6 pieces of dungeon gear. Jay still approves it.
 * - Fighting-men (dwarves, halflings, elves in that class) and clerics: plate mail and shield.
 * - Thieves: leather armor, no shield (WW p. 9); thieves' tools.
 * - Magic-users: no armor (left to Jay); human magic-users get a dagger and a
 *   spellbook (Men & Magic p. 6; WW p. 23: first-level magic-users have a spellbook).
 * - Clerics: a non-edged weapon until Jay rules on edged weapons; a wooden holy symbol.
 */
export function randomKitKeys(w: Wielder, rand: () => number = Math.random): string[] {
  const pickOne = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const weapons = CATALOG.filter(
    (i) =>
      i.category === "weapon" &&
      !AMMO_OR_LAUNCHER.has(i.key) &&
      classAllows(w, i).ok &&
      (w.cls !== "cleric" || NON_EDGED.has(i.key)),
  );
  const keys: string[] = [pickOne(weapons).key];

  if (w.cls === "thief") keys.push("leather-armor", "thieves-tools");
  else if (w.cls === "cleric") keys.push("plate-mail", "shield", "holy-symbol-wood");
  else if (w.cls === "fighting-man") keys.push("plate-mail", "shield");
  else if (w.cls === "magic-user" && w.race !== "elf") keys.push("spellbook");

  const gear = CATALOG.filter((i) => i.category === "gear" && i.costGp !== null && !CLASS_EXTRAS.has(i.key));
  const count = 4 + Math.floor(rand() * 3);
  const pool = [...gear];
  for (let n = 0; n < count && pool.length; n++) {
    const [item] = pool.splice(Math.floor(rand() * pool.length), 1);
    keys.push(item.key);
  }
  return keys;
}

/** The `inventory.kind` label for a price-list category. */
export function kindFor(category: Category): string {
  return category === "weapon" ? "Weapon" : category === "armor" ? "Armor" : "Gear";
}

/**
 * Bounds for editing gear on the sheet. These are input limits only, not game
 * rules: the books don't cap how many of a thing a character owns.
 */
export const ITEM_MAX_QUANTITY = 999;
export const ITEM_MAX_UNITS = 99;
export const ITEM_NAME_MAX = 80;

const quantityProblem = (n: number) =>
  !Number.isInteger(n) || n < 1 || n > ITEM_MAX_QUANTITY ? `Quantity must be a whole number from 1 to ${ITEM_MAX_QUANTITY}.` : null;

/**
 * Adding an item from the price list (WW p. 17) to a character's gear.
 * Players keep to the class limits the books state (classAllows), as in the
 * kit dialog. Jay may add anything; the sheet then flags the item. Whether a
 * character may carry gear the class can't use waits on "carry-unusable-gear".
 * `wielder` is null when no class is chosen yet, so there's nothing to check.
 */
export function checkAddCatalog(
  wielder: Wielder | null,
  key: string,
  quantity: number,
  staff: boolean,
): { item: CatalogItem; quantity: number } | string {
  const item = catalogItem(key);
  if (!item) return "Choose an item from the price list.";
  const q = quantityProblem(quantity);
  if (q) return q;
  if (wielder && !staff) {
    const allowed = classAllows(wielder, item);
    if (!allowed.ok) return allowed.why;
  }
  return { item, quantity };
}

/**
 * An item that isn't on the price list (loot, a magic item, something Jay
 * hands out). `units` is null when the weight isn't known: it stays unknown
 * and the encumbrance total says it's a floor. Only Jay marks an item magic,
 * since magic gear counts 0 units (campaign ruling).
 */
export function checkCustomItem(
  input: { name: string; quantity: number; units: number | null; isMagic: boolean },
  staff: boolean,
): { name: string; quantity: number; units: number | null; isMagic: boolean } | string {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return "Give the item a name.";
  if (name.length > ITEM_NAME_MAX) return `Keep the name to ${ITEM_NAME_MAX} characters.`;
  const q = quantityProblem(input.quantity);
  if (q) return q;
  if (input.units !== null && (!Number.isInteger(input.units) || input.units < 0 || input.units > ITEM_MAX_UNITS)) {
    return `Weight must be a whole number of units from 0 to ${ITEM_MAX_UNITS}, or left blank if you don't know it.`;
  }
  if (input.isMagic && !staff) return "Only Jay can mark an item as magic.";
  return { name, quantity: input.quantity, units: input.units, isMagic: input.isMagic };
}

/** A new quantity for an item already carried. */
export function checkQuantity(quantity: number): number | string {
  return quantityProblem(quantity) ?? quantity;
}
