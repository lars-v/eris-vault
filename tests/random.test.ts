import { describe, expect, it } from "vitest";
import { catalogItem, classAllows, randomKitKeys, type Wielder } from "@/lib/rules/equipment";
import { GAZETTEER_EPITHETS, GAZETTEER_NAMES, GAZETTEER_PLACES, randomName, shuffledIndexes } from "@/lib/rules/names";

const kinds: Wielder[] = [
  { cls: "fighting-man", race: "dwarf", int: 10 },
  { cls: "fighting-man", race: "halfling", int: 10 },
  { cls: "cleric", race: "human", int: 10 },
  { cls: "magic-user", race: "human", int: 9 },
  { cls: "magic-user", race: "human", int: 16 },
  { cls: "magic-user", race: "elf", int: 12 },
  { cls: "thief", race: "halfling", int: 10 },
];

describe("random basic kit stays inside the class rules", () => {
  it("never includes an item the class can't use, over many draws", () => {
    for (const w of kinds) {
      for (let n = 0; n < 300; n++) {
        const keys = randomKitKeys(w);
        for (const k of keys) {
          const item = catalogItem(k);
          expect(item, k).toBeDefined();
          expect(classAllows(w, item!).ok, `${w.cls}/${w.race}: ${k}`).toBe(true);
        }
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });
  it("gives each class its expected pieces", () => {
    expect(randomKitKeys(kinds[6])).toEqual(expect.arrayContaining(["leather-armor", "thieves-tools"]));
    expect(randomKitKeys(kinds[2])).toEqual(expect.arrayContaining(["plate-mail", "shield", "holy-symbol-wood"]));
    expect(randomKitKeys(kinds[3])[0]).toBe("dagger");
    expect(randomKitKeys(kinds[3])).toContain("spellbook");
    expect(randomKitKeys(kinds[5])).not.toContain("spellbook");
  });
  it("gives clerics only non-edged weapons", () => {
    const edged = ["long-sword", "short-sword", "dagger", "battle-axe", "hand-axe", "spear", "bastard-sword", "two-handed-sword", "pole-arm"];
    for (let n = 0; n < 300; n++) expect(edged).not.toContain(randomKitKeys(kinds[2])[0]);
  });
});

describe("random names use only Gazetteer words", () => {
  it("builds 'Name of Place' or 'Name the Epithet'", () => {
    for (let n = 0; n < 200; n++) {
      const name = randomName();
      const given = GAZETTEER_NAMES.find((g) => name.startsWith(`${g} `));
      expect(given, name).toBeDefined();
      const rest = name.slice(given!.length + 1);
      const ok = (rest.startsWith("of ") && (GAZETTEER_PLACES as readonly string[]).includes(rest.slice(3))) || (GAZETTEER_EPITHETS as readonly string[]).includes(rest);
      expect(ok, name).toBe(true);
    }
  });
  it("shuffles each set to exactly one ability", () => {
    expect(shuffledIndexes(6).sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
