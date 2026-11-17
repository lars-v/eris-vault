import type { ItemLocation, Race } from "@/db/schema";
import { abilityModifier, formatModifier } from "./abilities";
import { CATALOG, catalogItem, classAllows, type CatalogItem, type WeaponClass, type Wielder } from "./equipment";

/**
 * The weapon table on page 1 of the Planet Eris character sheet: size,
 * damage, melee or ranged, and short / medium / long range.
 *
 * - Woundwort's Warren p. 19, Weapon Damage by Weapon Class: small 1d6-1,
 *   normal 1d6, two-handed 1d6+1. "Two-handed" includes fighting with two
 *   weapons. A bastard sword "may be used two-handed for 2-7 damage".
 * - WW p. 19, Missile Fire and Hurled Weapons Ranges, in feet. Short is +0 to
 *   hit, medium -1, long -2. Bows, crossbows and slings do the damage of what
 *   they shoot (arrow and bolt 1d6, sling stone 1d6-1, all on the same table).
 * - WW p. 5: Strength applies to melee "to hit" and damage rolls. Dexterity
 *   applies to "to hit" for missiles and hurled weapons, not damage.
 * - WW p. 10: halflings get +1 to hit with any hurled weapon, and can hurl a
 *   fist-sized rock for 1d3 at +2.
 * - Monsters & Treasure p. 30: magic swords add their bonus to hit only; the
 *   few with +2 or +3 against named creatures add it to damage against those.
 * - M&T p. 31: other magic weapons add their bonus to damage too. Magic bows
 *   give every arrow +1 to hit and no damage bonus. Magic axes can be thrown 3"
 *   with every target at medium range; magic war hammers +1 and +2 the same.
 *
 * Two ranges are printed so that they overlap the band before them (dart long
 * 21-45 after medium 16-30; sling long 80-160 after medium 41-80). They are
 * shown as printed until Jay rules (dart-long-range, sling-long-range).
 */
export const WEAPONS_SOURCE = "Woundwort's Warren p. 19";

export type WeaponUse = "melee" | "hurled" | "missile";
export type Ranges = readonly [short: string, medium: string, long: string];

type WeaponRule = {
  uses: WeaponUse[];
  ranges?: Ranges;
  /** Missile launchers: the ammunition that sets the damage (WW p. 19). */
  ammo?: { name: string; weaponClass: WeaponClass };
  rangeRuling?: string;
};

/** Catalog key to WW p. 19 entry. Ammunition isn't a row of its own. */
export const WEAPON_RULES: Record<string, WeaponRule> = {
  "bastard-sword": { uses: ["melee"] },
  "battle-axe": { uses: ["melee"] },
  club: { uses: ["melee"] },
  dagger: { uses: ["melee", "hurled"], ranges: ["1-10", "11-20", "21-30"] },
  "darts-3": { uses: ["hurled"], ranges: ["1-15", "16-30", "21-45"], rangeRuling: "dart-long-range" },
  flail: { uses: ["melee"] },
  "hand-axe": { uses: ["melee", "hurled"], ranges: ["1-10", "11-20", "21-30"] },
  "heavy-war-hammer": { uses: ["melee"] },
  "long-sword": { uses: ["melee"] },
  mace: { uses: ["melee"] },
  "morning-star": { uses: ["melee"] },
  "pole-arm": { uses: ["melee"] },
  "short-sword": { uses: ["melee"] },
  spear: { uses: ["melee", "hurled"], ranges: ["1-20", "21-40", "41-60"] },
  staff: { uses: ["melee"] },
  "two-handed-sword": { uses: ["melee"] },
  "war-hammer": { uses: ["melee"] },
  crossbow: { uses: ["missile"], ranges: ["1-80", "81-160", "161-240"], ammo: { name: "bolt", weaponClass: "normal" } },
  "long-bow": { uses: ["missile"], ranges: ["1-70", "71-140", "141-210"], ammo: { name: "arrow", weaponClass: "normal" } },
  "short-bow": { uses: ["missile"], ranges: ["1-50", "51-100", "101-150"], ammo: { name: "arrow", weaponClass: "normal" } },
  sling: {
    uses: ["missile"],
    ranges: ["1-40", "41-80", "80-160"],
    ammo: { name: "sling stone", weaponClass: "small" },
    rangeRuling: "sling-long-range",
  },
};

/** WW p. 19: damage is 1d6 moved by the weapon class. */
export const CLASS_DAMAGE: Record<WeaponClass, number> = { small: -1, normal: 0, "two-handed": 1 };
export const SIZE_LABEL: Record<WeaponClass, string> = { small: "S", normal: "N", "two-handed": "2H" };
export const RANGE_TO_HIT = [0, -1, -2] as const;

const SWORDS = new Set(["bastard-sword", "long-sword", "short-sword", "two-handed-sword"]);
const BOWS = new Set(["long-bow", "short-bow"]);
const THROWABLE_WHEN_MAGIC = new Set(["hand-axe", "battle-axe", "war-hammer", "heavy-war-hammer"]);

/** What a magic +N weapon adds (M&T pp. 30-31): swords to hit only, bows +1 to hit only, the rest both. */
export function magicAdds(key: string, bonus: number): { hit: number; damage: number } {
  if (!bonus) return { hit: 0, damage: 0 };
  if (SWORDS.has(key)) return { hit: bonus, damage: 0 };
  if (BOWS.has(key)) return { hit: 1, damage: 0 };
  return { hit: bonus, damage: bonus };
}

/** "1d6", "1d6-1", "1d6+2". */
export const dice = (mod: number) => (mod === 0 ? "1d6" : `1d6${mod > 0 ? "+" : ""}${mod}`);

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[+-]\s*\d+/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/s$/, "");
const WEAPON_BY_NAME = new Map<string, CatalogItem>();
for (const c of CATALOG) {
  if (!WEAPON_RULES[c.key]) continue;
  WEAPON_BY_NAME.set(norm(c.name), c);
  for (const part of c.name.split(" or ")) WEAPON_BY_NAME.set(norm(part), c);
}
WEAPON_BY_NAME.set(norm("Longbow"), catalogItem("long-bow")!);
WEAPON_BY_NAME.set(norm("Shortbow"), catalogItem("short-bow")!);
WEAPON_BY_NAME.set(norm("Polearm"), catalogItem("pole-arm")!);
WEAPON_BY_NAME.set(norm("Warhammer"), catalogItem("war-hammer")!);

/** The price-list weapon an item or a sheet row names, if WW p. 19 covers it. */
export function weaponEntry(name: string, catalogKey: string | null = null): CatalogItem | undefined {
  const entry = catalogKey ? catalogItem(catalogKey) : WEAPON_BY_NAME.get(norm(name));
  return entry && WEAPON_RULES[entry.key] ? entry : undefined;
}

/** True for price-list ammunition, which shows under the weapon that shoots it. */
export function isAmmunition(catalogKey: string | null, name: string): boolean {
  const key = catalogKey ?? "";
  return /^(arrow|bolts|sling-stones)/.test(key) || (!catalogKey && /\b(arrows?|bolts?|quarrels?|sling ?stones?)\b/i.test(name));
}

export type WeaponItem = {
  name: string;
  catalogKey: string | null;
  location: ItemLocation;
  isMagic: boolean;
  magicBonus: number | null;
};

export type WeaponRow = {
  /** The item's own name, as the player wrote it. */
  name: string;
  key: string;
  /** "S", "N", "2H"; null for a launcher, which isn't on the damage table. */
  size: string | null;
  use: WeaponUse;
  damage: string;
  /** "arrow" for a bow: the damage is the arrow's. */
  damageFrom: string | null;
  /** Total to-hit adjustment from Strength or Dexterity, race and magic. */
  toHit: number;
  ranges: Ranges | null;
  notes: { text: string; tone: "plain" | "amber" }[];
};

export type WeaponTable = {
  rows: WeaponRow[];
  /** Carried items that look like weapons but aren't on WW p. 19. */
  unknown: string[];
  notes: string[];
};

function bonusOf(i: WeaponItem): number {
  if (!i.isMagic) return 0;
  if (i.magicBonus !== null) return i.magicBonus;
  const m = i.name.match(/\+(\d+)/);
  return m ? Number(m[1]) : 0;
}

const LOOKS_LIKE_WEAPON = /sword|axe|bow|dagger|knife|mace|hammer|spear|lance|club|staff|flail|sling|dart|javelin|halberd|pike|scimitar|blade|whip/i;

export function weaponTable(
  items: WeaponItem[],
  opts: { str: number | null; dex: number | null; race: Race | null; wielder: Wielder | null },
): WeaponTable {
  const strMod = opts.str === null ? 0 : abilityModifier(opts.str);
  const dexMod = opts.dex === null ? 0 : abilityModifier(opts.dex);
  const rows: WeaponRow[] = [];
  const unknown: string[] = [];

  for (const item of items.filter((i) => i.location === "carried")) {
    if (isAmmunition(item.catalogKey, item.name)) continue;
    const entry = weaponEntry(item.name, item.catalogKey);
    if (!entry) {
      if (item.catalogKey === null && LOOKS_LIKE_WEAPON.test(item.name)) unknown.push(item.name);
      continue;
    }
    const rule = WEAPON_RULES[entry.key];
    const bonus = bonusOf(item);
    const sword = SWORDS.has(entry.key);
    const bow = BOWS.has(entry.key);
    const shared: WeaponRow["notes"] = [];
    if (opts.wielder) {
      const allowed = classAllows(opts.wielder, entry);
      if (!allowed.ok) shared.push({ text: allowed.why, tone: "amber" });
    }
    if (bonus && sword) {
      shared.push({
        text: `Magic swords add +${bonus} to hit, not damage, except a +2 or +3 against named creatures (Monsters & Treasure p. 30).`,
        tone: "plain",
      });
    }
    if (bonus && bow) {
      shared.push({ text: "A magic bow gives every arrow +1 to hit and no damage bonus (Monsters & Treasure p. 31).", tone: "plain" });
    }
    if (bonus && THROWABLE_WHEN_MAGIC.has(entry.key)) {
      const hammer = entry.key.includes("hammer");
      if (!hammer || bonus <= 2) {
        shared.push({
          text: `A magic ${hammer ? "war hammer" : "axe"} can be thrown 3"; every target counts as medium range (Monsters & Treasure p. 31).`,
          tone: "plain",
        });
      }
    }

    for (const use of rule.uses) {
      const weaponClass = rule.ammo?.weaponClass ?? entry.weaponClass!;
      const { hit: magicHit, damage: magicDamage } = magicAdds(entry.key, bonus);
      const notes = [...shared];
      const strDamage = use === "melee" ? strMod : 0;
      let toHit = magicHit + (use === "melee" ? strMod : dexMod);
      if (use === "hurled" && opts.race === "halfling") toHit += 1;
      if (entry.key === "bastard-sword") {
        notes.push({ text: `Used two-handed: ${dice(CLASS_DAMAGE["two-handed"] + strDamage + magicDamage)} (WW p. 19).`, tone: "plain" });
      }
      if (use !== "melee" && rule.rangeRuling) {
        notes.push({
          text: `WW p. 19 prints long range as ${rule.ranges![2]}, which overlaps medium. Shown as printed until Jay rules (${rule.rangeRuling}).`,
          tone: "amber",
        });
      }
      rows.push({
        name: item.name,
        key: entry.key,
        size: entry.weaponClass ? SIZE_LABEL[entry.weaponClass] : null,
        use,
        damage: dice(CLASS_DAMAGE[weaponClass] + strDamage + magicDamage),
        damageFrom: rule.ammo?.name ?? null,
        toHit,
        ranges: use === "melee" ? null : (rule.ranges ?? null),
        notes,
      });
    }
  }

  const notes: string[] = [];
  if (rows.some((r) => r.use === "melee")) {
    notes.push(
      opts.str === null
        ? "Strength isn't assigned yet, so melee rows leave it out."
        : `Melee to hit and damage include Strength ${formatModifier(strMod)} (WW p. 5).`,
    );
  }
  if (rows.some((r) => r.use !== "melee")) {
    notes.push(
      opts.dex === null
        ? "Dexterity isn't assigned yet, so thrown and missile rows leave it out."
        : `Thrown and missile to hit include Dexterity ${formatModifier(dexMod)}, not damage (WW p. 5). Medium range is -1 to hit, long -2 (WW p. 19).`,
    );
  }
  if (opts.race === "halfling") {
    notes.push("Halflings: +1 to hit with any hurled weapon (in the rows above), and a fist-sized rock hurled for 1d3 at +2 (WW p. 10).");
  }
  if (rows.length > 0) notes.push("Fighting with two weapons does 1d6+1, like a two-handed weapon (WW p. 19).");
  return { rows, unknown, notes };
}
