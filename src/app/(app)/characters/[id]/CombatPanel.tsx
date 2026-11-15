import { Panel } from "@/components/ui";
import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { abilityModifier, formatModifier } from "@/lib/rules/abilities";
import { cappedLevelFor, CLASS_NAMES } from "@/lib/rules/advancement";
import { ARMOR_CLASSES, combatRows } from "@/lib/rules/combat";
import { ordinal } from "@/lib/rules/levelup";
import { thiefSkills } from "@/lib/rules/thief";
import { canAffectUndead, formatTurn, turningRow } from "@/lib/rules/turning";

type ClassRow = { id: string; class: CharacterClass; xp: number };

const cell = "px-1.5 py-1 text-center font-mono";

/**
 * Rolls that change with level: to hit (WW pp. 19-20), thief skills (WW p. 9)
 * and a cleric's power over undead (WW p. 8). Elves keep a record per class
 * (WW p. 10), so every class gets its own block.
 */
export function CombatPanel({
  race,
  alignment,
  str,
  dex,
  classes,
}: {
  race: Race | null;
  alignment: Alignment | null;
  str: number | null;
  dex: number | null;
  classes: ClassRow[];
}) {
  const strMod = str === null ? null : abilityModifier(str);
  const dexMod = dex === null ? null : abilityModifier(dex);
  return (
    <Panel title="Fighting and skills" aside="Woundwort's Warren pp. 8-9, 19-20">
      {classes.map((k) => {
        const level = cappedLevelFor(race, k.class, k.xp).level;
        const rows = combatRows(k.class, level);
        const undeadOk = canAffectUndead(alignment);
        return (
          <div key={k.id} className="flex min-w-0 flex-col gap-4">
            {classes.length > 1 && (
              <h3 className="text-sm font-semibold">
                {CLASS_NAMES[k.class]}, {ordinal(level)} level
              </h3>
            )}

            <section className="flex min-w-0 flex-col gap-1.5">
              <h4 className="text-[13px] font-semibold tracking-wide text-muted">Roll to hit on d20 (WW p. 20)</h4>
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr className="text-xs text-subtle">
                      <th className="px-1.5 py-1 text-left font-normal">AC</th>
                      {ARMOR_CLASSES.map((ac) => (
                        <th key={ac} className={`${cell} font-normal`}>
                          {ac}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} className="border-t border-[#262920]">
                        <th className="px-1.5 py-1 text-left text-xs font-normal whitespace-nowrap text-subtle">
                          {rows.length > 1 ? `Row ${r.row}` : "Need"}
                        </th>
                        {r.toHit.map((n, i) => (
                          <td key={i} className={cell}>
                            {n}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 1 && (
                <p className="text-xs text-amber">
                  The matrix lists a {ordinal(level)}-level magic-user in two rows. WW p. 19 says magic-users improve every 3 levels.
                  Jay rules (mu-combat-rows).
                </p>
              )}
              <p className="text-xs text-subtle">
                {k.class === "thief" ? "Thieves use the cleric's row (WW p. 20). " : ""}
                Strength bonuses and penalties{strMod === null ? "" : ` (${formatModifier(strMod)} here)`} apply to melee rolls,
                Dexterity{dexMod === null ? "" : ` (${formatModifier(dexMod)} here)`} to missile rolls (WW p. 5).
                {race === "halfling" ? " Halflings get +1 with hurled weapons and +2 with hurled stones (WW p. 10)." : ""}
                {k.class === "thief" ? " Attacking unnoticed from behind: +4 to hit and double damage (WW p. 9)." : ""}
                {k.class === "fighting-man" ? " A natural 20 does double damage (WW p. 7)." : ""}
              </p>
            </section>

            {k.class === "thief" && (
              <section className="flex flex-col gap-1.5">
                <h4 className="text-[13px] font-semibold tracking-wide text-muted">Thief skills (WW p. 9)</h4>
                <ul className="grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
                  {thiefSkills(level).map((s) => (
                    <li key={s.key} className="contents">
                      <span className="text-muted">
                        {s.name} <span className="text-xs text-subtle">{s.kind}</span>
                      </span>
                      <span className="text-right font-mono">{s.value ?? "-"}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-subtle">
                  2d6 skills: the roll needed, adjusted by the Dexterity {dexMod === null ? "modifier" : formatModifier(dexMod)}. d6
                  skills: the range that succeeds. A dash means not yet. A failed Read Magic roll misreads the scroll, with a backfire
                  or unexpected result.
                </p>
              </section>
            )}

            {k.class === "cleric" && (
              <section className="flex min-w-0 flex-col gap-1.5">
                <h4 className="text-[13px] font-semibold tracking-wide text-muted">Affecting undead on 2d6 (WW p. 8)</h4>
                {undeadOk === false ? (
                  <p className="text-sm text-[#d6d2c2]">
                    Neutral clerics can&apos;t affect undead or demon-types. Declaring for Law or Chaos gives the power at once.
                  </p>
                ) : (
                  <>
                    <ul className="grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
                      {turningRow(level).map((u) => (
                        <li key={u.name} className="contents">
                          <span className="text-muted">
                            {u.name} <span className="text-xs text-subtle">({u.hd})</span>
                          </span>
                          <span className="text-right font-mono">{formatTurn(u.result)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-subtle">
                      A number is the roll needed. T = turn, D = dispel, a dash = no effect.
                      {alignment === "chaotic" ? " A chaotic priest neutralizes or commands undead instead of turning or dispelling." : ""}{" "}
                      Demon-types of 9 HD or less are treated as 3 levels higher than their undead equivalent, and only 1-3 are
                      affected; demons of 10 HD or more can&apos;t be affected.
                    </p>
                  </>
                )}
              </section>
            )}
          </div>
        );
      })}
    </Panel>
  );
}
