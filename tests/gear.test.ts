import { describe, expect, it } from "vitest";
import { can, type Viewer } from "@/lib/roles";
import { checkAddCatalog, checkCustomItem, checkQuantity, ITEM_MAX_QUANTITY, kindFor } from "@/lib/rules/equipment";

const player: Viewer = { userId: "p1", role: "player", status: "active", railwayAdmin: false };
const other: Viewer = { userId: "p2", role: "player", status: "active", railwayAdmin: false };
const gm: Viewer = { userId: "jay", role: "gm", status: "active", railwayAdmin: false };
const admin: Viewer = { userId: "lars", role: "admin", status: "active", railwayAdmin: true };
const blocked: Viewer = { userId: "p1", role: "player", status: "blocked", railwayAdmin: false };

describe("who can edit gear", () => {
  it("the owner can, at any status; another player can't", () => {
    for (const status of ["draft", "submitted", "approved"] as const) {
      expect(can.editGear(player, { ownerId: "p1", status })).toBe(true);
      expect(can.editGear(other, { ownerId: "p1", status })).toBe(false);
    }
  });
  it("Jay and admins can edit anyone's gear", () => {
    expect(can.editGear(gm, { ownerId: "p1", status: "approved" })).toBe(true);
    expect(can.editGear(admin, { ownerId: "p1", status: "approved" })).toBe(true);
  });
  it("a blocked account can't, even on its own character", () => {
    expect(can.editGear(blocked, { ownerId: "p1", status: "approved" })).toBe(false);
  });
});

describe("adding from the price list (WW p. 17)", () => {
  const thief = { cls: "thief" as const, race: "human" as const, int: 10 };
  const mu = { cls: "magic-user" as const, race: "human" as const, int: 10 };

  it("takes an item with its price-list weight", () => {
    const r = checkAddCatalog(thief, "long-sword", 1, false);
    expect(typeof r).toBe("object");
    if (typeof r === "object") expect(r.item.enc).toBe(2);
  });
  it("refuses keys that aren't on the price list", () => {
    expect(checkAddCatalog(thief, "laser-sword", 1, false)).toBe("Choose an item from the price list.");
  });
  it("keeps players to the class limits (WW p. 9, M&M p. 6)", () => {
    expect(checkAddCatalog(thief, "plate-mail", 1, false)).toMatch(/WW p\. 9/);
    expect(checkAddCatalog(mu, "long-sword", 1, false)).toMatch(/Men & Magic p\. 6/);
  });
  it("lets Jay add gear outside the class limits (the sheet flags it)", () => {
    expect(typeof checkAddCatalog(thief, "plate-mail", 1, true)).toBe("object");
  });
  it("has nothing to check before a class is chosen", () => {
    expect(typeof checkAddCatalog(null, "plate-mail", 1, false)).toBe("object");
  });
  it("needs a quantity from 1 to the input limit", () => {
    expect(checkAddCatalog(thief, "dagger", 0, false)).toMatch(/Quantity/);
    expect(checkAddCatalog(thief, "dagger", 1.5, false)).toMatch(/Quantity/);
    expect(checkAddCatalog(thief, "dagger", ITEM_MAX_QUANTITY + 1, false)).toMatch(/Quantity/);
    expect(typeof checkAddCatalog(thief, "dagger", ITEM_MAX_QUANTITY, false)).toBe("object");
  });
});

describe("adding an item that isn't on the price list", () => {
  it("tidies the name and keeps an unknown weight unknown", () => {
    expect(checkCustomItem({ name: "  Jade   idol ", quantity: 1, units: null, isMagic: false }, false)).toEqual({
      name: "Jade idol",
      quantity: 1,
      units: null,
      isMagic: false,
    });
  });
  it("needs a name", () => {
    expect(checkCustomItem({ name: "  ", quantity: 1, units: null, isMagic: false }, false)).toMatch(/name/);
  });
  it("needs a whole, non-negative weight when one is given", () => {
    expect(checkCustomItem({ name: "Idol", quantity: 1, units: -1, isMagic: false }, false)).toMatch(/Weight/);
    expect(checkCustomItem({ name: "Idol", quantity: 1, units: 1.5, isMagic: false }, false)).toMatch(/Weight/);
    expect(typeof checkCustomItem({ name: "Idol", quantity: 1, units: 0, isMagic: false }, false)).toBe("object");
  });
  it("only Jay marks an item magic, since magic gear counts 0 units", () => {
    expect(checkCustomItem({ name: "Sword +1", quantity: 1, units: 2, isMagic: true }, false)).toMatch(/Jay/);
    expect(typeof checkCustomItem({ name: "Sword +1", quantity: 1, units: 2, isMagic: true }, true)).toBe("object");
  });
});

describe("changing a quantity", () => {
  it("accepts 1 up to the input limit", () => {
    expect(checkQuantity(3)).toBe(3);
    expect(checkQuantity(0)).toMatch(/Quantity/);
  });
  it("labels kinds by price-list category", () => {
    expect(kindFor("weapon")).toBe("Weapon");
    expect(kindFor("armor")).toBe("Armor");
    expect(kindFor("gear")).toBe("Gear");
  });
});
