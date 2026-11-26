import { Chip, Panel } from "@/components/ui";
import { abilityModifier } from "@/lib/rules/abilities";
import { checkPrepared, knownSpells, maxSpellLevel, ordinal, spell, spellSlots, type SpellClass } from "@/lib/rules/spells";
import { PreparedSpells, type PrepareLevel } from "./PreparedSpells";
import { SpellList } from "./SpellList";

export function SpellsPanel({
  id,
  cls,
  level,
  wis,
  prepared,
  canPrepare,
  marked,
}: {
  id: string;
  cls: SpellClass;
  level: number;
  wis: number | null;
  prepared: string[];
  canPrepare: boolean;
  /** Magic-user spells the player highlighted as known (a note, not a rule). */
  marked: string[];
}) {
  const slots = spellSlots(cls, level, wis);
  const known = knownSpells(cls);
  const list = cls === "cleric" ? "cleric" : "magic-user";
  const problem = checkPrepared(cls, slots, known, prepared);
  const levels = Array.from({ length: maxSpellLevel(cls) }, (_, i) => i + 1);
  const castable = levels.filter((l) => (slots[l - 1] ?? 0) > 0);
  const prepareLevels: PrepareLevel[] = castable.map((l) => ({
    level: l,
    label: ordinal(l),
    slots: slots[l - 1],
    options: known.filter((s) => s.level === l).map((s) => ({ key: s.key, name: s.name })),
    current: prepared.filter((k) => spell(k)?.level === l),
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
        Every {list} has every spell on the {list} list (table ruling, 16 Nov 2026). Spells per day still follow WW {cls === "cleric" ? "pp. 5 and 8" : "p. 7"}.
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

      {castable.length > 0 && <PreparedSpells id={id} levels={prepareLevels} canEdit={canPrepare} />}

      <SpellList
        id={id}
        title={cls === "cleric" ? "Cleric spells" : "Magic-user spells"}
        levels={levels.map((l) => ({
          level: l,
          label: ordinal(l),
          spells: known.filter((s) => s.level === l).map((s) => ({ key: s.key, name: s.name })),
        }))}
        markable={cls === "magic-user"}
        marked={marked}
        canMark={canPrepare}
      />
    </Panel>
  );
}
