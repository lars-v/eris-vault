import { Chip, Panel } from "@/components/ui";
import { abilityModifier } from "@/lib/rules/abilities";
import { checkPrepared, knownSpells, maxSpellLevel, ordinal, repeatedSpells, spell, spellSlots, type SpellClass } from "@/lib/rules/spells";
import { PreparedSpells, type PrepareLevel } from "./PreparedSpells";

export function SpellsPanel({
  id,
  cls,
  level,
  wis,
  prepared,
  canPrepare,
}: {
  id: string;
  cls: SpellClass;
  level: number;
  wis: number | null;
  prepared: string[];
  canPrepare: boolean;
}) {
  const slots = spellSlots(cls, level, wis);
  const known = knownSpells(cls);
  const list = cls === "cleric" ? "cleric" : "magic-user";
  const problem = checkPrepared(cls, slots, known, prepared);
  const twice = repeatedSpells(prepared);
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
      {cls === "cleric" && level === 1 && castable.length === 0 && (
        <p className="text-sm text-muted">A 1st-level cleric casts no spells unless Wisdom is 15 or more (WW p. 25).</p>
      )}
      {cls === "cleric" && wis !== null && abilityModifier(wis) < 0 && (
        <p className="text-sm text-amber">WW p. 5 gives clerics extra spells for high Wisdom but says nothing about low Wisdom. Jay hasn&apos;t ruled yet, so no spells are taken away.</p>
      )}

      {problem && prepared.length > 0 && (
        <p className="rounded-xl border border-[#5e4720] bg-[#2a2113] px-3 py-2 text-sm text-amber">Saved spells no longer fit: {problem} Prepare again.</p>
      )}
      {twice.length > 0 && (
        <p className="rounded-xl border border-[#5e4720] bg-[#2a2113] px-3 py-2 text-sm text-amber">
          {twice.join(", ")} {twice.length === 1 ? "is" : "are"} prepared more than once. The books don&apos;t say if that&apos;s allowed; Jay will rule.
        </p>
      )}

      {castable.length > 0 && <PreparedSpells id={id} levels={prepareLevels} canEdit={canPrepare} />}

      <details className="border-t border-[#262920] pt-3">
        <summary className="cursor-pointer text-sm font-semibold">
          {cls === "cleric" ? "Cleric" : "Magic-user"} spells · {known.length}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {levels.map((l) => (
            <div key={l} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{ordinal(l)} level</span>
              <ul className="flex flex-wrap gap-1.5">
                {known
                  .filter((s) => s.level === l)
                  .map((s) => (
                    <li key={s.key} className="rounded-full border border-line-2 px-2.5 py-0.5 text-sm">
                      {s.name}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </Panel>
  );
}
