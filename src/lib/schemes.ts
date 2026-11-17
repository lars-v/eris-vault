/**
 * Color schemes a player can pick on /account. Display only: no game rule depends on them.
 *
 * Every scheme fills the same jobs, so clashing colors never blur what a color means:
 *   ink/surface   page ground and panels      parchment/muted/subtle   text, strongest to weakest
 *   lime          main accent (buttons, active tabs, good news), also used as text
 *   amber         warnings and GM things       ember   danger, delete, errors
 *   moon          focus ring, info, admin
 *
 * Eris sets every token by hand (the original look). The others set the base colors and
 * the rest is mixed from them (`resolveScheme`). tests/schemes.test.ts checks contrast.
 */

export const BASE_TOKENS = [
  "ink",
  "surface",
  "parchment",
  "muted",
  "subtle",
  "lime",
  "lime-ink",
  "amber",
  "ember",
  "moon",
] as const;

export const DERIVED_TOKENS = [
  "ink-2",
  "surface-2",
  "line",
  "line-2",
  "parchment-2",
  "soft",
  "lede",
  "rule",
  "lime-wash",
  "lime-edge",
  "lime-dim",
  "lime-deep",
  "amber-wash",
  "amber-edge",
  "amber-soft",
  "on-amber",
  "ember-wash",
  "ember-edge",
  "moon-wash",
  "moon-edge",
  "moon-soft",
  "on-moon",
] as const;

export type Token = (typeof BASE_TOKENS)[number] | (typeof DERIVED_TOKENS)[number];
type Palette = Record<(typeof BASE_TOKENS)[number], string> & Partial<Record<Token, string>>;

export type SchemeDef = {
  label: string;
  blurb: string;
  mode: "dark" | "light";
  colors: Palette;
};

export const SCHEMES = {
  eris: {
    label: "Eris",
    blurb: "Ink and parchment under the lime sky. The original.",
    mode: "dark",
    colors: {
      ink: "#0f100d",
      "ink-2": "#12140f",
      surface: "#171914",
      "surface-2": "#1e211b",
      line: "#2f3329",
      "line-2": "#3a3f33",
      parchment: "#eee9db",
      "parchment-2": "#f3eedf",
      muted: "#b3b0a0",
      subtle: "#8e8c7e",
      soft: "#d6d2c2",
      lede: "#c9c5b4",
      rule: "#262920",
      lime: "#b9d55f",
      "lime-ink": "#14170f",
      "lime-wash": "#222c17",
      "lime-edge": "#4b5e2a",
      "lime-dim": "#2b3122",
      "lime-deep": "#6c7f3a",
      amber: "#e5aa4e",
      "amber-wash": "#2a2113",
      "amber-edge": "#5e4720",
      "amber-soft": "#e2d2b4",
      "on-amber": "#1a1408",
      ember: "#e8775f",
      "ember-wash": "#2e1a15",
      "ember-edge": "#5c3328",
      moon: "#8fb1e6",
      "moon-wash": "#18202e",
      "moon-edge": "#34496b",
      "moon-soft": "#9faac0",
      "on-moon": "#0e1420",
    },
  },
  "samer-burn": {
    label: "Samer Burn",
    blurb: "Oxblood under the red moon, acid text, cyan buttons.",
    mode: "dark",
    colors: {
      ink: "#2a0710",
      surface: "#3b0d18",
      parchment: "#c8ff3d",
      muted: "#f0b3ff",
      subtle: "#d78fe8",
      lime: "#00e5ff",
      "lime-ink": "#001a1f",
      amber: "#ffb000",
      ember: "#ff8a5c",
      moon: "#7df9ff",
    },
  },
  "damini-static": {
    label: "Damini Static",
    blurb: "Indigo night, yellow type, hot pink everywhere.",
    mode: "dark",
    colors: {
      ink: "#0d0636",
      surface: "#1a0f5c",
      parchment: "#ffe600",
      muted: "#ff9ee8",
      subtle: "#e07fd0",
      lime: "#ff4fc4",
      "lime-ink": "#1a0010",
      amber: "#ff9a1f",
      ember: "#ff5c5c",
      moon: "#00ffd0",
    },
  },
  toxic: {
    label: "Toxic",
    blurb: "Swamp green with orange text. Wash your hands.",
    mode: "dark",
    colors: {
      ink: "#071a07",
      surface: "#0f2a0f",
      parchment: "#ff8a1f",
      muted: "#9dff7a",
      subtle: "#7ad65c",
      lime: "#e2ff00",
      "lime-ink": "#1a1f00",
      amber: "#ffd23f",
      ember: "#ff6b9a",
      moon: "#c29bff",
    },
  },
  bruise: {
    label: "Bruise",
    blurb: "Plum and chartreuse with orange buttons.",
    mode: "dark",
    colors: {
      ink: "#24003a",
      surface: "#350a52",
      parchment: "#c4ff1a",
      muted: "#ffb27a",
      subtle: "#e8955c",
      lime: "#ff6a00",
      "lime-ink": "#1f0a00",
      amber: "#ffd400",
      ember: "#ff6fa3",
      moon: "#00e1ff",
    },
  },
  highlighter: {
    label: "Highlighter",
    blurb: "Yellow paper, black lines, magenta ink.",
    mode: "light",
    colors: {
      ink: "#fff200",
      surface: "#ffffff",
      parchment: "#141414",
      muted: "#4b1f78",
      subtle: "#5e3a8a",
      line: "#141414",
      "line-2": "#141414",
      lime: "#b8008f",
      "lime-ink": "#ffffff",
      amber: "#b34700",
      ember: "#c40000",
      moon: "#0038d6",
    },
  },
  circus: {
    label: "Circus",
    blurb: "Bubblegum pink and bottle green.",
    mode: "light",
    colors: {
      ink: "#ff9fd0",
      surface: "#ffe3f1",
      parchment: "#002b17",
      muted: "#00502b",
      subtle: "#164a2f",
      line: "#002b17",
      "line-2": "#00502b",
      lime: "#004a20",
      "lime-ink": "#ffffff",
      amber: "#5c3700",
      ember: "#7d0018",
      moon: "#2200c9",
    },
  },
} satisfies Record<string, SchemeDef>;

export type SchemeKey = keyof typeof SCHEMES;
/** What a player can choose: a scheme, or Strife, which picks a different one on every page. */
export type SchemeChoice = SchemeKey | "strife";

export const DEFAULT_SCHEME: SchemeKey = "eris";
export const SCHEME_KEYS = Object.keys(SCHEMES) as SchemeKey[];
export const SCHEME_COOKIE = "eris-scheme";

export const STRIFE = {
  label: "Strife",
  blurb: "Eris, goddess of discord, picks a different scheme every page.",
};

export function isSchemeKey(value: unknown): value is SchemeKey {
  return typeof value === "string" && Object.hasOwn(SCHEMES, value);
}

export function parseSchemeChoice(value: unknown): SchemeChoice {
  return value === "strife" || isSchemeKey(value) ? value : DEFAULT_SCHEME;
}

/* Mixing is plain sRGB, done here so the test sees the exact colors the page gets. */
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function hex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}
/** `amount` of `color` laid over `base` (0 = base, 1 = color). */
export function mix(color: string, base: string, amount: number): string {
  const a = rgb(color);
  const b = rgb(base);
  return hex(a.map((v, i) => v * amount + b[i] * (1 - amount)));
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function readableOn(fill: string): string {
  return contrast("#141414", fill) >= contrast("#ffffff", fill) ? "#141414" : "#ffffff";
}

/** Every token for a scheme: the ones it sets, plus the rest mixed from its base colors. */
export function resolveScheme(key: SchemeKey): Record<Token, string> {
  const c: Palette = SCHEMES[key].colors;
  const line = c.line ?? mix(c.parchment, c.surface, 0.18);
  const derived: Record<(typeof DERIVED_TOKENS)[number], string> = {
    "ink-2": mix(c.surface, c.ink, 0.4),
    "surface-2": mix(c.parchment, c.surface, 0.07),
    line,
    "line-2": mix(c.parchment, c.surface, 0.28),
    "parchment-2": c.parchment,
    soft: mix(c.surface, c.parchment, 0.1),
    lede: mix(c.ink, c.parchment, 0.12),
    rule: mix(c.parchment, c.surface, 0.08),
    "lime-wash": mix(c.lime, c.surface, 0.1),
    "lime-edge": mix(c.lime, c.surface, 0.42),
    "lime-dim": mix(c.lime, c.surface, 0.14),
    "lime-deep": mix(c.lime, c.ink, 0.55),
    "amber-wash": mix(c.amber, c.surface, 0.1),
    "amber-edge": mix(c.amber, c.surface, 0.42),
    "amber-soft": mix(c.amber, c.parchment, 0.5),
    "on-amber": readableOn(c.amber),
    "ember-wash": mix(c.ember, c.surface, 0.1),
    "ember-edge": mix(c.ember, c.surface, 0.42),
    "moon-wash": mix(c.moon, c.surface, 0.1),
    "moon-edge": mix(c.moon, c.surface, 0.42),
    "moon-soft": mix(c.moon, c.parchment, 0.5),
    "on-moon": readableOn(c.moon),
  };
  return { ...derived, ...c };
}

/**
 * CSS for every scheme except Eris (which lives in globals.css `@theme`). Keyed on
 * `html[data-scheme]`, set by the root layout. Unlayered, so it beats Tailwind's theme layer.
 */
export function schemeStyles(): string {
  return SCHEME_KEYS.filter((k) => k !== DEFAULT_SCHEME)
    .map((key) => {
      const tokens = resolveScheme(key);
      const vars = Object.entries(tokens)
        .map(([name, value]) => `--color-${name}:${value}`)
        .join(";");
      return `:root[data-scheme="${key}"]{color-scheme:${SCHEMES[key].mode};${vars}}`;
    })
    .join("\n");
}
