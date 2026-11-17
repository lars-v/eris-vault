import type { CharacterStatus } from "@/db/schema";

/** Ways to order the party page. The first is the default. */
export const PARTY_SORTS = [
  { key: "player", label: "Player" },
  { key: "name", label: "Character" },
  { key: "level", label: "Level" },
  { key: "class", label: "Class" },
  { key: "status", label: "Status" },
] as const;

export type PartySort = (typeof PARTY_SORTS)[number]["key"];

export function parsePartySort(value: string | undefined): PartySort {
  return PARTY_SORTS.some((s) => s.key === value) ? (value as PartySort) : "player";
}

export type SortableCharacter = {
  name: string;
  ownerName: string | null;
  className: string | null;
  level: number | null;
  status: CharacterStatus;
};

// Characters that need Jay first, the fallen last.
const STATUS_ORDER: Record<CharacterStatus, number> = { submitted: 0, draft: 1, approved: 2, retired: 3, dead: 4 };

const text = (a: string | null, b: string | null) => {
  // Missing values go last.
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
};

/** Returns a new array; ties fall back to character name, then player. */
export function sortParty<T extends SortableCharacter>(list: readonly T[], sort: PartySort): T[] {
  const byName = (a: T, b: T) => text(a.name, b.name);
  const byPlayer = (a: T, b: T) => text(a.ownerName, b.ownerName);
  const primary: Record<PartySort, (a: T, b: T) => number> = {
    player: byPlayer,
    name: byName,
    level: (a, b) => (b.level ?? -1) - (a.level ?? -1),
    class: (a, b) => text(a.className, b.className),
    status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  };
  return [...list].sort((a, b) => primary[sort](a, b) || byName(a, b) || byPlayer(a, b));
}
