import { Chip, Panel } from "@/components/ui";
import { abilityModifier } from "@/lib/rules/abilities";
import {
  checkPrepared,
  knownSpells,
  maxSpellLevel,
  ordinal,
  repeatedSpells,
  spell,
  SPELLBOOK_COST_GP,
  spellsFor,
  spellSlots,
  startingSpells,
  type SpellClass,
} from "@/lib/rules/spells";
import { SubmitButton } from "./build/forms";
import { forgetSpell, prepareSpells, recordSpells } from "../spell-actions";

const selectCls = "min-h-11 min-w-0 rounded-xl border border-line-2 bg-ink px-2 text-sm";

export function SpellsPanel({
  id,
  cls,
  level,
  wis,
  recorded,
  prepared,
  canPrepare,
  staff,
}: {
  id: string;
  cls: SpellClass;
  level: number;
  wis: number | null;
  recorded: string[];
  prepared: string[];
  canPrepare: boolean;
  staff: boolean;
}) {
  const slots = spellSlots(cls, level, wis);
  const known = knownSpells(cls, recorded);
  const starting = new Set(startingSpells(cls));
  const problem = checkPrepared(cls, slots, known, prepared);
  const twice = repeatedSpells(prepared);
  const book = cls === "cleric" ? "prayer scroll" : "spellbook";
  const levels = Array.from({ length: maxSpellLevel(cls) }, (_, i) => i + 1);
  const castable = levels.filter((l) => (slots[l - 1] ?? 0) > 0);

  return (
    <Panel title="Spells" aside="Woundwort's Warren pp. 5, 7-8, 25-26">
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

      {castable.length > 0 && canPrepare ? (
        <form action={prepareSpells} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          {castable.map((l) => {
            const options = known.filter((s) => s.level === l);
            const current = prepared.filter((k) => spell(k)?.level === l);
            return (
              <fieldset key={l} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">{ordinal(l)}-level spells</legend>
                {options.length === 0 ? (
                  <p className="text-sm text-subtle">
                    No {ordinal(l)}-level {book} yet. It costs {SPELLBOOK_COST_GP[l - 1].toLocaleString("en-US")} gp
                    {cls === "cleric" ? " as an offering to the church" : ""} (WW p. 25). Jay records it here.
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                    {Array.from({ length: slots[l - 1] }, (_, i) => (
                      <select key={i} name="slot" defaultValue={current[i] ?? ""} aria-label={`${ordinal(l)}-level slot ${i + 1}`} className={selectCls}>
                        <option value="">Open slot</option>
                        {options.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}
          {known.some((s) => castable.includes(s.level)) && (
            <div>
              <SubmitButton pendingText="Saving…">Save prepared spells</SubmitButton>
            </div>
          )}
        </form>
      ) : (
        castable.length > 0 && (
          <div className="text-sm">
            <span className="text-muted">Prepared: </span>
            {prepared.length === 0 ? <span className="text-subtle">nothing yet</span> : prepared.map((k) => spell(k)?.name ?? k).join(", ")}
          </div>
        )
      )}

      <details className="border-t border-[#262920] pt-3">
        <summary className="cursor-pointer text-sm font-semibold">
          In the {book} · {known.length}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {known.length === 0 && (
            <p className="text-sm text-subtle">
              {cls === "cleric"
                ? "No prayer scrolls yet. A cleric gets the full 1st-level scroll from the church at 2nd level for an offering, or a limited scroll at 1st level with Wisdom 15+ (WW p. 25)."
                : "Nothing recorded."}
            </p>
          )}
          {levels.map((l) => {
            const atLevel = known.filter((s) => s.level === l);
            if (atLevel.length === 0) return null;
            return (
              <div key={l} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{ordinal(l)} level</span>
                <ul className="flex flex-wrap gap-1.5">
                  {atLevel.map((s) => (
                    <li key={s.key} className="flex items-center gap-1 rounded-full border border-line-2 py-0.5 pl-2.5 pr-1 text-sm">
                      {s.name}
                      {starting.has(s.key) ? (
                        <span className="px-1.5 text-xs text-subtle" title="Every magic-user starts with all 1st-level spells (WW p. 25)">
                          start
                        </span>
                      ) : (
                        staff && (
                          <form action={forgetSpell}>
                            <input type="hidden" name="id" value={id} />
                            <input type="hidden" name="key" value={s.key} />
                            <button type="submit" aria-label={`Remove ${s.name}`} className="flex h-6 w-6 items-center justify-center rounded-full text-subtle hover:bg-[#2e1a15] hover:text-ember">
                              ×
                            </button>
                          </form>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
      {staff && (
        <form action={recordSpells} className="flex flex-wrap items-center gap-2 border-t border-[#262920] pt-3">
          <input type="hidden" name="id" value={id} />
          <label htmlFor="spell-add" className="text-sm text-muted">
            Jay: record a {book}
          </label>
          <select id="spell-add" name="add" defaultValue="" required className={selectCls}>
            <option value="" disabled>
              Choose…
            </option>
            <optgroup label="A whole level">
              {levels.map((l) => (
                <option key={l} value={`level:${l}`}>
                  All {ordinal(l)}-level spells ({SPELLBOOK_COST_GP[l - 1].toLocaleString("en-US")} gp)
                </option>
              ))}
            </optgroup>
            {levels.map((l) => {
              const missing = spellsFor(cls, l).filter((s) => !known.some((k) => k.key === s.key));
              if (missing.length === 0) return null;
              return (
                <optgroup key={l} label={`One ${ordinal(l)}-level spell`}>
                  {missing.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <SubmitButton tone="plain" pendingText="Recording…">
            Record
          </SubmitButton>
        </form>
      )}
    </Panel>
  );
}
