import { describe, expect, it } from "vitest";
import { ARMOR_CLASS_TABLE, armorClass, armorClassWorking, type ArmorItem } from "@/lib/rules/armor";
import type { Wielder } from "@/lib/rules/equipment";

const item = (catalogKey: string | null, over: Partial<ArmorItem> = {}): ArmorItem => ({
  name: catalogKey ?? "Thing",
  catalogKey,
  location: "carried",
  isMagic: false,
  magicBonus: null,
  ...over,
});
const fighter: Wielder = { cls: "fighting-man", race: "human", int: 10 };
const thief: Wielder = { cls: "thief", race: "human", int: 10 };
const texts = (r: ReturnType<typeof armorClass>) => r.notes.map((n) => n.text).join("\n");

describe("Armor Class Table (WW p. 17)", () => {
  it("matches the printed table", () => {
    const cases: [string[], number][] = [
      [[], 9],
      [["shield"], 8],
      [["leather-armor"], 7],
      [["ring-mail"], 6],
      [["leather-armor", "shield"], 6],
      [["chain-mail"], 5],
      [["ring-mail", "shield"], 5],
      [["chain-mail", "shield"], 4],
      [["plate-mail"], 3],
      [["plate-mail", "shield"], 2],
    ];
    for (const [keys, ac] of cases) {
      expect(armorClass(keys.map((k) => item(k)), 10, fighter).ac, keys.join(" + ") || "none").toBe(ac);
    }
    expect(ARMOR_CLASS_TABLE.none).toEqual({ plain: 9, shield: 8 });
  });

  it("says what is worn in plain words", () => {
    expect(armorClass([item("plate-mail"), item("shield")], 10, fighter).wearing).toBe("Plate mail and shield");
    expect(armorClass([item("leather-armor")], 10, fighter).wearing).toBe("Leather armor");
    expect(armorClass([item("shield")], 10, fighter).wearing).toBe("Shield only");
    expect(armorClass([item("dagger")], 10, fighter).wearing).toBe("No armor");
  });
});

describe("Dexterity (WW p. 5)", () => {
  it("a bonus lowers armor class, a penalty raises it", () => {
    expect(armorClass([item("chain-mail")], 18, fighter).ac).toBe(3);
    expect(armorClass([item("chain-mail")], 16, fighter).ac).toBe(4);
    expect(armorClass([item("chain-mail")], 5, fighter).ac).toBe(6);
    expect(armorClass([item("chain-mail")], 3, fighter).ac).toBe(7);
  });
  it("can take plate and shield below 2", () => {
    expect(armorClass([item("plate-mail"), item("shield")], 18, fighter).ac).toBe(0);
  });
  it("shows the working", () => {
    const r = armorClass([item("chain-mail"), item("shield")], 16, fighter);
    expect(armorClassWorking(r)).toBe("4 on the Armor Class Table. Dexterity +1 lowers it by 1 (WW p. 5).");
    expect(armorClassWorking(armorClass([], 4, fighter))).toContain("raises it by 1");
  });
  it("unknown Dexterity stays out and is said", () => {
    const r = armorClass([item("leather-armor")], null, fighter);
    expect(r.ac).toBe(7);
    expect(r.dexMod).toBeNull();
    expect(texts(r)).toContain("Dexterity isn't assigned yet");
  });
});

describe("what counts", () => {
  it("only armor on the character, not stashed or on a mount", () => {
    const r = armorClass([item("plate-mail", { location: "stashed" }), item("leather-armor"), item("shield", { location: "mount" })], 10, fighter);
    expect(r.ac).toBe(7);
    expect(texts(r)).toContain("stashed or on a mount: plate mail, shield");
  });
  it("counts the best suit when more than one is carried, and says so", () => {
    const r = armorClass([item("leather-armor"), item("plate-mail")], 10, fighter);
    expect(r.ac).toBe(3);
    expect(texts(r)).toContain("Also carrying leather armor");
  });
  it("thieves: no armor heavier than leather, no shield (WW p. 9)", () => {
    const r = armorClass([item("leather-armor"), item("plate-mail"), item("shield")], 10, thief);
    expect(r.ac).toBe(7);
    expect(texts(r)).toContain("plate mail isn't counted");
    expect(texts(r)).toContain("shield isn't counted");
  });
  it("a large shield counts as a shield until Jay rules", () => {
    const r = armorClass([item("chain-mail"), item("shield-large")], 10, fighter);
    expect(r.ac).toBe(4);
    expect(texts(r)).toContain("large-shield-ac");
    expect(texts(armorClass([item("shield"), item("shield-large")], 10, fighter))).not.toContain("large-shield-ac");
  });
  it("reads a hand-added item named exactly like price-list armor", () => {
    expect(armorClass([item(null, { name: "Chain Mail +1", isMagic: true })], 10, fighter).ac).toBe(5);
    expect(armorClass([item(null, { name: "Large shield" })], 10, fighter).ac).toBe(8);
  });
  it("names armor it can't read instead of guessing", () => {
    const r = armorClass([item(null, { name: "Elven chain" }), item(null, { name: "Banded armour" })], 10, fighter);
    expect(r.ac).toBe(9);
    expect(texts(r)).toContain("Not on the price list, so not counted: Banded armour");
    expect(texts(r)).not.toContain("Elven chain");
  });
});

describe("magic armor (Monsters & Treasure p. 30)", () => {
  it("doesn't change the number; attackers take the bonus off their hit dice", () => {
    const r = armorClass([item("plate-mail", { isMagic: true, magicBonus: 2 })], 10, fighter);
    expect(r.ac).toBe(3);
    expect(texts(r)).toContain("attackers take 2 off their hit dice");
  });
  it("a better magic shield catches one blow in three", () => {
    const r = armorClass([item("chain-mail", { isMagic: true, magicBonus: 1 }), item("shield", { isMagic: true, magicBonus: 2 })], 10, fighter);
    expect(r.ac).toBe(4);
    expect(texts(r)).toContain("one blow in three");
    const weaker = armorClass([item("chain-mail", { isMagic: true, magicBonus: 2 }), item("shield", { isMagic: true, magicBonus: 1 })], 10, fighter);
    expect(texts(weaker)).not.toContain("one blow in three");
  });
  it("magic with no bonus entered is said, not guessed", () => {
    expect(texts(armorClass([item("chain-mail", { isMagic: true })], 10, fighter))).toContain("bonus isn't entered");
  });
});
