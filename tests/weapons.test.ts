import { describe, expect, it } from "vitest";
import type { Wielder } from "@/lib/rules/equipment";
import { dice, weaponEntry, weaponTable, type WeaponItem } from "@/lib/rules/weapons";

const item = (name: string, over: Partial<WeaponItem> = {}): WeaponItem => ({
  name,
  catalogKey: null,
  location: "carried",
  isMagic: /\+\d/.test(name),
  magicBonus: null,
  ...over,
});
const opts = { str: 10, dex: 10, race: "human" as const, wielder: null };
const row = (t: ReturnType<typeof weaponTable>, name: string, use = "melee") => t.rows.find((r) => r.name === name && r.use === use)!;

describe("Weapon Damage by Weapon Class (WW p. 19)", () => {
  it("gives small 1d6-1, normal 1d6, two-handed 1d6+1", () => {
    const t = weaponTable([item("Short Sword"), item("Long Sword"), item("Battle Axe")], opts);
    expect(t.rows.map((r) => [r.name, r.size, r.damage])).toEqual([
      ["Short Sword", "S", "1d6-1"],
      ["Long Sword", "N", "1d6"],
      ["Battle Axe", "2H", "1d6+1"],
    ]);
  });

  it("matches what Raz wrote: dagger melee and thrown at 1-10 / 11-20 / 21-30", () => {
    const t = weaponTable([item("dagger"), item("short sword")], { ...opts, str: 10, dex: 13, race: "halfling" });
    expect(row(t, "dagger").damage).toBe("1d6-1");
    expect(row(t, "dagger", "hurled")).toMatchObject({ damage: "1d6-1", ranges: ["1-10", "11-20", "21-30"], toHit: 1 });
    expect(row(t, "short sword").ranges).toBeNull();
  });

  it("adds Strength to melee damage only (WW p. 5)", () => {
    const t = weaponTable([item("Spear")], { ...opts, str: 18, dex: 3 });
    expect(row(t, "Spear")).toMatchObject({ damage: "1d6+2", toHit: 2 });
    expect(row(t, "Spear", "hurled")).toMatchObject({ damage: "1d6", toHit: -2 });
  });

  it("gives launchers their ammunition's damage", () => {
    const t = weaponTable([item("Long Bow"), item("Sling"), item("Arrows (1 score)", { catalogKey: "arrows-score" })], opts);
    expect(t.rows.map((r) => [r.name, r.size, r.damage, r.damageFrom, r.use])).toEqual([
      ["Long Bow", null, "1d6", "arrow", "missile"],
      ["Sling", null, "1d6-1", "sling stone", "missile"],
    ]);
    expect(row(t, "Sling", "missile").notes.some((n) => n.text.includes("sling-long-range"))).toBe(true);
  });

  it("shows the bastard sword used two-handed", () => {
    const t = weaponTable([item("Bastard Sword")], { ...opts, str: 16 });
    expect(row(t, "Bastard Sword").damage).toBe("1d6+1");
    expect(row(t, "Bastard Sword").notes[0].text).toBe("Used two-handed: 1d6+2 (WW p. 19).");
  });

  it("follows Monsters & Treasure pp. 30-31 on magic weapons", () => {
    const t = weaponTable([item("Mace +2"), item("Long Sword +1"), item("Short Bow +2")], opts);
    expect(row(t, "Mace +2")).toMatchObject({ damage: "1d6+2", toHit: 2 });
    expect(row(t, "Long Sword +1")).toMatchObject({ damage: "1d6", toHit: 1 });
    expect(row(t, "Short Bow +2", "missile")).toMatchObject({ damage: "1d6", toHit: 1 });
  });

  it("names carried things that look like weapons but aren't on the table, and skips stashed gear", () => {
    const t = weaponTable([item("Sword +1"), item("Torches"), item("Mace", { location: "stashed" })], opts);
    expect(t.rows).toEqual([]);
    expect(t.unknown).toEqual(["Sword +1"]);
  });

  it("warns when the class can't use the weapon", () => {
    const thief: Wielder = { cls: "thief", race: "human", int: 10 };
    const t = weaponTable([item("Two-handed Sword")], { ...opts, wielder: thief });
    expect(t.rows[0].notes.some((n) => n.tone === "amber")).toBe(true);
  });

  it("finds weapons by everyday names", () => {
    expect(weaponEntry("darts")?.key).toBe("darts-3");
    expect(weaponEntry("Cudgel")?.key).toBe("club");
    expect(weaponEntry("Longbow")?.key).toBe("long-bow");
    expect(weaponEntry("Plate Mail")).toBeUndefined();
    expect(dice(-1)).toBe("1d6-1");
  });
});
