import { describe, expect, it } from "vitest";
import { alignmentsFor, assignScores, classesFor, isValidIdentity } from "@/lib/rules/creation";
import { rollAbilitySets, rollFirstLevelHp, rollStartingGold, type D6 } from "@/lib/rules/dice";
import { CATALOG, catalogItem, checkKit, classAllows } from "@/lib/rules/equipment";
import { bandFor, carriedUnits, unknownUnitItems } from "@/lib/rules/encumbrance";

const fixed = (...faces: number[]): D6 => {
  let i = 0;
  return () => faces[i++ % faces.length];
};

describe("dice (WW pp. 5-6, M&M p. 10)", () => {
  it("rolls six sets of 3d6 and totals them", () => {
    const r = rollAbilitySets(fixed(1, 2, 3, 6, 6, 6));
    expect(r.dice).toHaveLength(6);
    expect(r.dice[0]).toEqual([1, 2, 3]);
    expect(r.totals[0]).toBe(6);
    expect(r.totals[1]).toBe(18);
  });

  it("real dice stay in 3 to 18", () => {
    for (let n = 0; n < 200; n++) {
      for (const t of rollAbilitySets().totals) {
        expect(t).toBeGreaterThanOrEqual(3);
        expect(t).toBeLessThanOrEqual(18);
      }
    }
  });

  it("adjusts first-level hit points by class and Constitution", () => {
    expect(rollFirstLevelHp("fighting-man", 0, fixed(5)).hp).toBe(6);
    expect(rollFirstLevelHp("cleric", 1, fixed(5)).hp).toBe(6);
    expect(rollFirstLevelHp("magic-user", 0, fixed(6)).hp).toBe(5);
    expect(rollFirstLevelHp("thief", 2, fixed(6)).hp).toBe(7);
  });

  it("never gives fewer than 3 hit points at 1st level", () => {
    expect(rollFirstLevelHp("magic-user", -2, fixed(1)).hp).toBe(3);
    expect(rollFirstLevelHp("fighting-man", 0, fixed(1)).hp).toBe(3);
  });

  it("starting gold is 3d6 x 10", () => {
    expect(rollStartingGold(fixed(1, 1, 1)).gold).toBe(30);
    expect(rollStartingGold(fixed(6, 6, 6)).gold).toBe(180);
  });
});

describe("arranging scores (WW p. 5)", () => {
  const totals = [9, 14, 7, 16, 11, 12];
  it("assigns each set to one ability", () => {
    expect(assignScores(totals, { str: 3, int: 0, wis: 1, dex: 2, con: 4, cha: 5 })).toEqual({
      str: 16,
      int: 9,
      wis: 14,
      dex: 7,
      con: 11,
      cha: 12,
    });
  });
  it("refuses using a set twice", () => {
    expect(typeof assignScores(totals, { str: 3, int: 3, wis: 1, dex: 2, con: 4, cha: 5 })).toBe("string");
  });
  it("refuses a missing pick", () => {
    expect(typeof assignScores(totals, { str: 3, int: NaN, wis: 1, dex: 2, con: 4, cha: 5 })).toBe("string");
  });
});

describe("race, class and alignment (WW pp. 8-10)", () => {
  it("limits classes by race", () => {
    expect(classesFor("dwarf")).toEqual(["fighting-man"]);
    expect(classesFor("elf").sort()).toEqual(["fighting-man", "magic-user"]);
    expect(classesFor("halfling").sort()).toEqual(["fighting-man", "thief"]);
    expect(classesFor("human")).toHaveLength(4);
  });
  it("thieves are neutral or chaotic; clerics any", () => {
    expect(alignmentsFor("thief")).toEqual(["neutral", "chaotic"]);
    expect(alignmentsFor("cleric")).toEqual(["lawful", "neutral", "chaotic"]);
    expect(isValidIdentity("human", "thief", "lawful")).not.toBeNull();
    expect(isValidIdentity("dwarf", "cleric", "lawful")).not.toBeNull();
    expect(isValidIdentity("halfling", "thief", "chaotic")).toBeNull();
  });
});

describe("price list and class limits (WW pp. 9, 17, 19)", () => {
  it("has the p. 17 weapons, armor and gear, with p. 18 weights", () => {
    expect(CATALOG.filter((i) => i.category === "weapon")).toHaveLength(26);
    expect(CATALOG.filter((i) => i.category === "armor")).toHaveLength(6);
    expect(catalogItem("long-sword")?.costGp).toBe(10);
    expect(CATALOG.every((i) => Number.isInteger(i.enc) && i.enc >= 0)).toBe(true);
    expect(catalogItem("plate-mail")?.enc).toBe(8);
    expect(catalogItem("pole-arm")?.enc).toBe(4);
    // Circles on p. 18 count as 0.
    expect(catalogItem("tinderbox")?.enc).toBe(0);
    expect(catalogItem("arrow-silver")?.enc).toBe(0);
  });
  it("puts a typical fighter kit in the p. 16 bands", () => {
    const kit = ["plate-mail", "shield", "long-sword", "backpack", "rations-iron", "waterskin", "torches", "rope-hemp"];
    const items = kit.map((k) => ({ encUnits: catalogItem(k)!.enc, quantity: 1, isMagic: false, location: "carried" }));
    expect(carriedUnits(items)).toBe(19);
    expect(bandFor(carriedUnits(items)).name).toBe("Heavy");
  });
  const T = { cls: "thief" as const, race: "halfling" as const, int: 10 };
  it("keeps thieves to small or normal weapons, leather, no shield", () => {
    expect(classAllows(T, catalogItem("two-handed-sword")!).ok).toBe(false);
    expect(classAllows(T, catalogItem("short-sword")!).ok).toBe(true);
    expect(classAllows(T, catalogItem("leather-armor")!).ok).toBe(true);
    expect(classAllows(T, catalogItem("chain-mail")!).ok).toBe(false);
    expect(classAllows(T, catalogItem("shield")!).ok).toBe(false);
    expect(classAllows({ cls: "fighting-man", race: "human", int: 10 }, catalogItem("plate-mail")!).ok).toBe(true);
  });
  it("keeps human magic-users to daggers, plus a staff with Int 15+; elves are exempt", () => {
    const mu = { cls: "magic-user" as const, race: "human" as const, int: 12 };
    expect(classAllows(mu, catalogItem("dagger")!).ok).toBe(true);
    expect(classAllows(mu, catalogItem("long-sword")!).ok).toBe(false);
    expect(classAllows(mu, catalogItem("staff")!).ok).toBe(false);
    expect(classAllows({ ...mu, int: 15 }, catalogItem("staff")!).ok).toBe(true);
    expect(classAllows({ ...mu, race: "elf" }, catalogItem("long-sword")!).ok).toBe(true);
  });
  it("checks a whole kit at once against the price list and class limits", () => {
    const fighter = { cls: "fighting-man" as const, race: "human" as const, int: 10 };
    expect(checkKit(fighter, { torches: 2, "long-sword": 1, rope: 0 } as Record<string, number>)).toBe("That item isn't on the price list.");
    expect(checkKit(fighter, { torches: 2, "long-sword": 1, shield: 0 })).toEqual([
      { key: "long-sword", quantity: 1 },
      { key: "torches", quantity: 2 },
    ]);
    expect(checkKit(fighter, { torches: 21 })).toMatch(/1 to 20/);
    expect(checkKit(fighter, { torches: 1.5 })).toMatch(/1 to 20/);
    expect(checkKit(T, { "leather-armor": 1, "plate-mail": 1 })).toMatch(/heavier than leather/);
    expect(checkKit(fighter, {})).toEqual([]);
  });
  it("counts unknown weights separately instead of guessing", () => {
    const items = [
      { encUnits: null, quantity: 1, isMagic: false, location: "carried" },
      { encUnits: 2, quantity: 2, isMagic: false, location: "carried" },
    ];
    expect(carriedUnits(items)).toBe(4);
    expect(unknownUnitItems(items)).toBe(1);
  });
});
