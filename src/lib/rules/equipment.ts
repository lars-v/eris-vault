import type { CharacterClass, Race } from "@/db/schema";

/**
 * Equipment price list, transcribed from Woundwort's Warren p. 17 (Equipment Costs).
 * Encumbrance units come from p. 18, where they are printed as dots that the
 * text copy loses; until that page is read from the PDF every `enc` is null
 * ("not known yet") rather than a guess.
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
  enc: number | null;
  weaponClass?: WeaponClass;
};

const w = (key: string, name: string, cost: number, weaponClass?: WeaponClass): CatalogItem => ({
  key,
  name,
  category: "weapon",
  cost: `${cost} gp`,
  costGp: cost,
  enc: null,
  weaponClass,
});
const a = (key: string, name: string, cost: number): CatalogItem => ({
  key,
  name,
  category: "armor",
  cost: `${cost} gp`,
  costGp: cost,
  enc: null,
});
const g = (key: string, name: string, cost: number | string): CatalogItem => ({
  key,
  name,
  category: "gear",
  cost: typeof cost === "number" ? `${cost} gp` : cost,
  costGp: typeof cost === "number" ? cost : null,
  enc: null,
});

export const CATALOG: CatalogItem[] = [
  // Weapons (WW p. 17); class from WW p. 19 where the damage table lists it.
  w("arrow-silver", "Arrow (1, silver tipped)", 5, "normal"),
  w("arrows-score", "Arrows (1 score)", 5, "normal"),
  w("bastard-sword", "Bastard Sword", 13, "normal"),
  w("battle-axe", "Battle Axe", 7, "two-handed"),
  w("bolts-score", "Bolts/Quarrels (1 score)", 5, "normal"),
  w("club", "Club or Cudgel", 1, "normal"),
  w("crossbow", "Crossbow", 25),
  w("dagger", "Dagger", 3, "small"),
  w("darts-3", "Darts (3)", 1, "small"),
  w("flail", "Flail", 8, "normal"),
  w("hand-axe", "Hand Axe", 3, "normal"),
  w("heavy-war-hammer", "Heavy War Hammer", 7, "two-handed"),
  w("long-bow", "Long Bow", 40),
  w("long-sword", "Long Sword", 10, "normal"),
  w("mace", "Mace", 5, "normal"),
  w("morning-star", "Morning Star", 6, "normal"),
  w("pole-arm", "Pole Arm", 7, "two-handed"),
  w("short-bow", "Short Bow", 25),
  w("short-sword", "Short Sword", 5, "small"),
  w("sling", "Sling", 1),
  w("sling-stones-iron", "Sling Stones (iron, 1 score)", 1, "small"),
  w("sling-stones-silver", "Sling Stones (silver, 1 dozen)", 5, "small"),
  w("spear", "Spear", 2, "normal"),
  w("staff", "Staff", 1, "normal"),
  w("two-handed-sword", "Two-handed Sword", 15, "two-handed"),
  w("war-hammer", "War Hammer", 5, "normal"),
  // Armor (WW p. 17). Barding is for horses, so it stays with transport.
  a("shield", "Shield", 10),
  a("shield-large", "Shield (large)", 15),
  a("leather-armor", "Leather Armor", 15),
  a("ring-mail", "Ring Mail", 30),
  a("chain-mail", "Chain Mail", 45),
  a("plate-mail", "Plate Mail", 60),
  // Dungeon gear (WW p. 17).
  g("backpack", "Backpack (35 pound capacity)", 5),
  g("bedrolls-3", "Bedrolls (3)", 1),
  g("bell", "Bell (small)", 1),
  g("belladonna", "Belladonna (1 bunch)", 10),
  g("candles", "Candle (1 dozen)", 1),
  g("canvas", "Canvas (10 sq. yd)", 1),
  g("case", "Case (map or scroll)", 1),
  g("chain", "Chain (10ft)", 30),
  g("chalk", "Chalk (10 pieces)", 1),
  g("chest", "Chest (1' x 2', wooden)", 3),
  g("crowbar", "Crowbar", 2),
  g("fishing-net", "Fishing net (25 sq. feet)", 4),
  g("garlic", "Garlic (1 sprig)", 5),
  g("grappling-hook", "Grappling Hook", 25),
  g("holy-symbol-wood", "Holy Symbol, wooden", 2),
  g("holy-symbol-silver", "Holy Symbol, silver", 25),
  g("holy-water", "Holy Water (1 glass vial)", 25),
  g("ink", "Ink (1 oz)", 1),
  g("iron-spikes", "Iron Spikes (1 dozen)", 1),
  g("ladder", "Ladder (12 ft., wooden or rope)", 3),
  g("lantern", "Lantern, hooded", 10),
  g("lock", "Lock", "25+ gp"),
  g("mallet", "Mallet (iron)", 2),
  g("manacles", "Manacles (iron, with key)", 10),
  g("mirror", "Mirror (small, silvered)", 15),
  g("musical-instrument", "Musical Instrument", "5+ gp"),
  g("oil", "Oil (1 pint, clay flask)", 2),
  g("parchment", "Parchment (5 sheets)", 1),
  g("pole", "Pole, 10 ft.", 1),
  g("pot", "Pot, iron", 1),
  g("rations-iron", "Rations, iron (7 days)", 15),
  g("rations-standard", "Rations, standard (7 days)", 5),
  g("rope-hemp", "Rope, hemp (50 ft)", 1),
  g("rope-silk", "Rope, silk (50 ft)", 10),
  g("sack-large", "Sack, lg. (50 pound capacity)", 2),
  g("sack-small", "Sack, sm. (20 pound capacity)", 1),
  g("shovel", "Shovel", 2),
  g("signal-whistle", "Signal Whistle", 1),
  g("spellbook", "Spellbook", "Special"),
  g("tent", "Tent (canvas, sleeps two)", 8),
  g("tinderbox", "Tinderbox (flint & steel)", 3),
  g("thieves-tools", "Thieves' Tools & Picks", 25),
  g("torches", "Torches (half dozen)", 1),
  g("waterskin", "Waterskin (half gallon)", 1),
  g("wine", "Wine (1 quart, bottle)", 1),
  g("wolfsbane", "Wolfsbane (1 bunch)", 10),
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
