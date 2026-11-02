/**
 * Encumbrance bands and base move.
 * Source: Woundwort's Warren p. 16 (Encumbrance has these effects) and p. 47
 * (Movement Rates Table). Per-item units come from p. 18 and are not
 * transcribed yet; items carry the units entered on the character.
 * Campaign ruling: magic gear counts 0.
 */
export type Band = { name: string; min: number; max: number | null; move: number | null };

export const BANDS: Band[] = [
  { name: "Unencumbered", min: 0, max: 5, move: 13 },
  { name: "Light", min: 6, max: 10, move: 12 },
  { name: "Medium", min: 11, max: 15, move: 9 },
  { name: "Heavy", min: 16, max: 20, move: 6 },
  { name: "Super-heavy", min: 21, max: 25, move: 3 },
  { name: "Prohibited", min: 26, max: null, move: null },
];

export const ENCUMBRANCE_SOURCE = "Woundwort's Warren pp. 16, 47";

export type CarriedItem = { encUnits: number; quantity: number; isMagic: boolean; location: string };

export function carriedUnits(items: CarriedItem[]): number {
  return items
    .filter((i) => i.location === "carried")
    .reduce((sum, i) => sum + (i.isMagic ? 0 : i.encUnits * i.quantity), 0);
}

export function bandFor(units: number): Band {
  return BANDS.find((b) => units >= b.min && (b.max === null || units <= b.max)) ?? BANDS[BANDS.length - 1];
}
