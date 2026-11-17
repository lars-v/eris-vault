import { describe, expect, it } from "vitest";
import { parsePartySort, sortParty, type SortableCharacter } from "@/lib/party-sort";

const c = (name: string, ownerName: string | null, extra: Partial<SortableCharacter> = {}): SortableCharacter => ({
  name,
  ownerName,
  className: null,
  level: null,
  status: "approved",
  ...extra,
});

const names = (list: SortableCharacter[]) => list.map((x) => x.name);

describe("party sort", () => {
  it("defaults to player and ignores unknown values", () => {
    expect(parsePartySort(undefined)).toBe("player");
    expect(parsePartySort("nonsense")).toBe("player");
    expect(parsePartySort("level")).toBe("level");
  });

  it("player sorts alphabetically by player, ignoring case, then by character", () => {
    const list = [c("Zed", "pat"), c("Liz", "Jay"), c("Abe", "Pat"), c("Orphan", null)];
    expect(names(sortParty(list, "player"))).toEqual(["Liz", "Abe", "Zed", "Orphan"]);
  });

  it("level puts the highest first and unbuilt characters last", () => {
    const list = [c("A", "x", { level: 1 }), c("B", "x"), c("C", "x", { level: 4 })];
    expect(names(sortParty(list, "level"))).toEqual(["C", "A", "B"]);
  });

  it("class sorts by class name with no class last", () => {
    const list = [c("A", "x", { className: "Thief" }), c("B", "x"), c("C", "x", { className: "Cleric" })];
    expect(names(sortParty(list, "class"))).toEqual(["C", "A", "B"]);
  });

  it("status puts characters awaiting Jay first and the dead last", () => {
    const list = [
      c("Dead", "x", { status: "dead" }),
      c("Ok", "x", { status: "approved" }),
      c("Wait", "x", { status: "submitted" }),
      c("Draft", "x", { status: "draft" }),
    ];
    expect(names(sortParty(list, "status"))).toEqual(["Wait", "Draft", "Ok", "Dead"]);
  });

  it("does not change the list it is given", () => {
    const list = [c("B", "x"), c("A", "x")];
    sortParty(list, "name");
    expect(names(list)).toEqual(["B", "A"]);
  });
});
