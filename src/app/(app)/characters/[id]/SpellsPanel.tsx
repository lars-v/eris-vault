import { Chip, Panel } from "@/components/ui";
import { abilityModifier } from "@/lib/rules/abilities";
import {
  checkPrepared,
  knownSpells,
  maxSpellLevel,
  ordinal,
  preparedOutsideBook,
  spell,
  spellSlots,
  spellsFor,
  type SpellClass,
} from "@/lib/rules/spells";
import { PreparedSpells, type PrepareLevel } from "./PreparedSpells";
import { Spellbook } from "./Spellbook";
import { SpellList, type SpellListLevel } from "./SpellList";

export function SpellsPanel({
  id,
  cls,
  level,
  wis,
  prepared,
  canPrepare,
  spellbook,
}: {
  id: string;
  cls: SpellClass;
  level: number;
  wis: number | null;
  prepared: string[];
  /** Prepare spells and, for a magic-user, change the spellbook. */
  canPrepare: boolean;
  /** A magic-user's spellbook (ruling magic-user-spellbook). Ignored for a cleric. */
  spellbook: string[];
}) {
  const mu = cls === "magic-user";
  const slots = spellSlots(cls, level, wis);
  const known = knownSpells(cls, spellbook);
  const inBook = new Set(known.map((s) => s.key));
  // Only slot counts here: a spell taken out of the book stays prepared today (ruling magic-user-spellbook).
  const problem = checkPrepared(cls, slots, spellsFor(cls), prepared);
  const outside = preparedOutsideBook(cls, spellbook, prepared);
  const levels = Array.from({ length: maxSpellLevel(cls) }, (_, i) => i + 1);
  const castable = levels.filter((l) => (slots[l - 1] ?? 0) > 0);
  const prepareLevels: PrepareLevel[] = castable.map((l) => ({
    level: l,
    label: ordinal(l),
    slots: slots[l - 1],
    options: known.filter((s) => s.level === l).map((s) => ({ key: s.key, name: s.name })),
    current: prepared
      .filter((k) => spell(k)?.level === l)
      .map((k) => ({ key: k, name: spell(k)?.name ?? k, inBook: inBook.has(k) })),
  }));
  const listLevels: SpellListLevel[] = levels.map((l) => ({
    level: l,
    label: ordinal(l),
    spells: spellsFor(cls, l).map((s) => ({ key: s.key, name: s.name })),
  }));

  return (
    <Panel title="Spells" aside="Woundwort's Warren pp. 5, 7-8, 26">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Per day:</span>
        {castable.length === 0 ? (
          <span className="text-subtle">none</span>
        ) : (
          castable.map((l) => (
            <Chip key={l} tone="lime">
              {ordinal(l)} level · {slots[l - 1]}
            </Chip>
          ))
        )}
      </div>
      <p className="text-sm text-muted">
        {mu
          ? "A magic-user prepares spells from their spellbook, and can add or remove spells at any time (table ruling, 25 Nov 2026). Spells per day still follow WW p. 7."
          : "Every cleric has every spell on the cleric list (table ruling, 16 Nov 2026). Spells per day still follow WW pp. 5 and 8."}
      </p>
      {cls === "cleric" && level === 1 && (
        <p className="text-sm text-muted">
          {castable.length === 0
            ? "A 1st-level cleric casts no spells unless Wisdom is 15 or more (WW p. 25)."
            : "With Wisdom 15 or more, a 1st-level cleric has one spell, and the player picks it (WW p. 25; Jay's ruling)."}
        </p>
      )}
      {cls === "cleric" && wis !== null && abilityModifier(wis) < 0 && (
        <p className="text-sm text-muted">A low Wisdom never takes spells away (Jay&apos;s ruling).</p>
      )}

      {problem && prepared.length > 0 && (
        <p className="rounded-xl border border-amber-edge bg-amber-wash px-3 py-2 text-sm text-amber">Saved spells no longer fit: {problem} Prepare again.</p>
      )}
      {outside.length > 0 && (
        <p className="text-sm text-muted">
          {names(outside.map((s) => s.name))} {outside.length === 1 ? "is" : "are"} prepared but not in the spellbook.{" "}
          {outside.length === 1 ? "It stays" : "They stay"} today and can&apos;t be prepared again.
        </p>
      )}

      {castable.length > 0 && <PreparedSpells id={id} levels={prepareLevels} canEdit={canPrepare} />}

      {mu ? (
        <Spellbook id={id} levels={listLevels} book={known.map((s) => s.key)} canEdit={canPrepare} />
      ) : (
        <SpellList title="Cleric spells" levels={listLevels} />
      )}
    </Panel>
  );
}

function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}
