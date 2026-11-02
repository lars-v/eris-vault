/**
 * Word lists for the "random" buttons, taken only from the Planet Eris Gazetteer.
 * A random name joins a personal name with a place ("of Koerin") or with one of
 * the epithets the Gazetteer itself uses ("the Black"). The combinations are new;
 * the words are not. Players can always type their own.
 */

/** Personal names of mortals and wizards in the Gazetteer (pp. 9-37). Gods and demons are left out. */
export const GAZETTEER_NAMES = [
  "Amistar",
  "Arrohart",
  "Atholas",
  "Atilos",
  "Cuvhal",
  "Demenokles",
  "Duril",
  "Estorga",
  "Hlarg'rd",
  "Jarrem",
  "Lauropol",
  "Migrond",
  "Morgunna",
  "Nemedus",
  "Pinius",
  "Provax",
  "Rothkar",
  "Rufians",
  "Sen",
  "Skrel",
  "Sparnus",
  "Ulath",
  "Zaladin",
] as const;

/** Settlements from the Gazetteer's index of settlements (p. 64). */
export const GAZETTEER_PLACES = [
  "Ahrima",
  "Amon Sin",
  "Arnes",
  "Boltash",
  "Brix",
  "Cir Soor",
  "Durthos",
  "Fezoor",
  "Gygaxos",
  "Hroth",
  "Irikai",
  "Jaru",
  "Kask",
  "Kathorr",
  "Koerin",
  "Kor Mair",
  "Mentiar",
  "Mos Kahn",
  "Oestia",
  "Omphaal",
  "Partholon",
  "Rath Denacht",
  "Robilos",
  "Samaal",
  "Skoloes",
  "Stelvarun",
  "Strongmoor",
  "Talos",
  "Tantos",
  "Tar Toom",
  "Tycha",
  "Villar",
  "Vis",
  "Wixia",
] as const;

/** Epithets the Gazetteer gives people: Jarrem the Black, Hlarg'rd the Fierce, Ulath the Bull, Pinius the Elder, Arrohart the Lion. */
export const GAZETTEER_EPITHETS = ["the Black", "the Fierce", "the Bull", "the Elder", "the Lion"] as const;

/**
 * Patrons: the Gods of Sparn (Gazetteer pp. 48-51) and the other gods of men
 * still worshipped in the realms (p. 52). Demons are not offered.
 */
export const GAZETTEER_PATRONS = [
  "Brass",
  "Krotus",
  "Den",
  "Oublios",
  "Ariaira",
  "Ashan",
  "Belun",
  "Zeus",
  "Apollo",
  "Ares",
  "Diana",
  "Hades",
  "Wodin",
  "Thunor",
  "Oghma",
  "Bricriu",
  "Morrigan",
  "Agni",
] as const;

export function pick<T>(xs: readonly T[], rand: () => number = Math.random): T {
  return xs[Math.floor(rand() * xs.length)];
}

export function randomName(rand: () => number = Math.random): string {
  const given = pick(GAZETTEER_NAMES, rand);
  return rand() < 0.75 ? `${given} of ${pick(GAZETTEER_PLACES, rand)}` : `${given} ${pick(GAZETTEER_EPITHETS, rand)}`;
}

/** Fisher-Yates shuffle of 0..n-1. */
export function shuffledIndexes(n: number, rand: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
