import { describe, expect, it } from "vitest";
import {
  contrast,
  DEFAULT_SCHEME,
  DERIVED_TOKENS,
  parseSchemeChoice,
  resolveScheme,
  SCHEME_KEYS,
  schemeStyles,
  type Token,
} from "@/lib/schemes";

// Text and the ground it sits on somewhere in the app. WCAG AA for normal text is 4.5:1.
const TEXT_PAIRS: [Token, Token][] = [
  ["parchment", "ink"],
  ["parchment", "surface"],
  ["parchment", "surface-2"],
  ["parchment-2", "surface-2"],
  ["soft", "ink"],
  ["soft", "surface"],
  ["lede", "ink"],
  ["muted", "ink"],
  ["muted", "surface"],
  ["muted", "surface-2"],
  ["subtle", "ink"],
  ["subtle", "surface"],
  ["lime", "ink"],
  ["lime", "surface"],
  ["lime", "rule"],
  ["lime", "lime-wash"],
  ["lime", "lime-dim"],
  ["parchment", "lime-wash"],
  ["lime-ink", "lime"],
  ["amber", "ink"],
  ["amber", "surface"],
  ["amber", "amber-wash"],
  ["amber-soft", "ink"],
  ["on-amber", "amber"],
  ["ember", "ink"],
  ["ember", "surface"],
  ["ember", "ember-wash"],
  ["moon", "ink"],
  ["moon", "surface"],
  ["moon", "moon-wash"],
  ["moon-soft", "moon-wash"],
  ["on-moon", "moon"],
];

describe("color schemes", () => {
  for (const key of SCHEME_KEYS) {
    const t = resolveScheme(key);

    it(`${key}: every text color is readable on its ground`, () => {
      const failing = TEXT_PAIRS.map(([fg, bg]) => ({ pair: `${fg} on ${bg}`, ratio: contrast(t[fg], t[bg]) }))
        .filter((p) => p.ratio < 4.5)
        .map((p) => `${p.pair} ${p.ratio.toFixed(2)}`);
      expect(failing).toEqual([]);
    });

    it(`${key}: the focus ring stands out from the page (3:1)`, () => {
      expect(contrast(t.moon, t.ink)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.moon, t.surface)).toBeGreaterThanOrEqual(3);
    });

    it(`${key}: danger never looks like the main accent`, () => {
      expect(t.ember).not.toBe(t.lime);
      expect(t.ember).not.toBe(t.amber);
    });

    it(`${key}: sets every token`, () => {
      for (const name of DERIVED_TOKENS) expect(t[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    });
  }

  it("unknown or missing choices fall back to Eris", () => {
    expect(parseSchemeChoice(undefined)).toBe(DEFAULT_SCHEME);
    expect(parseSchemeChoice("\"><script>")).toBe(DEFAULT_SCHEME);
    expect(parseSchemeChoice("strife")).toBe("strife");
    expect(parseSchemeChoice("toxic")).toBe("toxic");
  });

  it("writes CSS for every scheme but Eris", () => {
    const css = schemeStyles();
    for (const key of SCHEME_KEYS) expect(css.includes(`[data-scheme="${key}"]`)).toBe(key !== DEFAULT_SCHEME);
  });
});
