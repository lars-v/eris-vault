import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { can, type Viewer } from "@/lib/roles";
import { cleanRulingAnswer, NOW, RULING_ANSWER_MAX, RULING_EXAMPLES } from "@/lib/ruling-examples";

// Keys from the rulings seed, read from the file so a new pending ruling can't miss its examples.
const seed = readFileSync(new URL("../scripts/migrate.mjs", import.meta.url), "utf8");
const seeded = [...seed.matchAll(/^\s*\["([a-z0-9-]+)",.*"(pending|decided)"\],?$/gm)].map((m) => ({ key: m[1], status: m[2] }));

describe("example answers for open rulings", () => {
  it("reads the seed", () => {
    expect(seeded.length).toBeGreaterThan(20);
  });

  it("every pending ruling has at least one example", () => {
    const missing = seeded.filter((r) => r.status === "pending" && !(RULING_EXAMPLES[r.key]?.length));
    expect(missing).toEqual([]);
  });

  it("examples fit the answer box and aren't repeated", () => {
    for (const list of Object.values(RULING_EXAMPLES)) {
      expect(new Set(list.map((e) => e.answer)).size).toBe(list.length);
      for (const e of list) expect(e.answer.length).toBeLessThanOrEqual(RULING_ANSWER_MAX);
      // At most one example is the current behavior.
      expect(list.filter((e) => e.basis === NOW).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("Jay's answer", () => {
  it("is trimmed and keeps line breaks", () => {
    expect(cleanRulingAnswer("  Yes.\r\nOnly once.  ")).toBe("Yes.\nOnly once.");
  });
  it("can't be empty or too long", () => {
    expect(() => cleanRulingAnswer("   ")).toThrow(/Write an answer/);
    expect(() => cleanRulingAnswer("x".repeat(RULING_ANSWER_MAX + 1))).toThrow(/Keep the answer/);
  });
  it("only Jay and admins can record one", () => {
    const base = { status: "active" as const, railwayAdmin: false };
    expect(can.editRulings({ ...base, userId: "p", role: "player" } as Viewer)).toBe(false);
    expect(can.editRulings({ ...base, userId: "j", role: "gm" } as Viewer)).toBe(true);
    expect(can.editRulings({ ...base, userId: "l", role: "admin" } as Viewer)).toBe(true);
    expect(can.editRulings({ ...base, status: "blocked", userId: "j", role: "gm" } as Viewer)).toBe(false);
  });
});
