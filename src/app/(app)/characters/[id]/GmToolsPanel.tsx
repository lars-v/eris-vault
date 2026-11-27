import { Panel } from "@/components/ui";
import { grantReroll, returnToPlayer } from "../actions";
import { SubmitButton } from "./build/forms";
import type { CharacterSheet } from "./SheetPanels";
import { StatsEditor } from "./StatsEditor";

const field = "min-h-11 min-w-0 rounded-xl border border-line-2 bg-ink px-3 text-sm";

function Tool({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-2xl flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-subtle">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Jay's and the admins' tools for one character. Approve sits in the sheet
 * header; everything here writes to the audit log.
 */
export function GmToolsPanel({ c, canOverride }: { c: CharacterSheet; canOverride: boolean }) {
  const active = c.classes.find((k) => k.active) ?? c.classes[0];
  const canReturn = c.status === "submitted" || c.status === "approved";
  // A re-roll of abilities or hit points would undo hit dice rolled for later levels.
  const early = c.levelDice.length === 0;
  return (
    <Panel title="GM tools" aside="Every change goes in the audit log" className="border-amber-edge">
      <div className="flex flex-col divide-y divide-rule">
        {canReturn && (
          <Tool title="Return to player" hint="Sends the character back to draft so the player can change it.">
            <form action={returnToPlayer} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="note" aria-label="Note for the player (optional)" placeholder="Note for the player (optional)" maxLength={300} className={`${field} flex-[1_1_14rem]`} />
              <SubmitButton tone="plain" pendingText="Returning…">
                Return to player
              </SubmitButton>
            </form>
          </Tool>
        )}
        <Tool title="Grant a re-roll" hint="The player rolls again. The replaced roll stays in the log.">
          <form action={grantReroll} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={c.id} />
            <select name="purpose" aria-label="Roll to grant again" defaultValue={early ? "abilities" : "gold"} className={`${field} px-2`}>
              {early && <option value="abilities">Ability scores</option>}
              {early && <option value="hp">Hit points</option>}
              <option value="gold">Starting gold</option>
            </select>
            <input name="reason" aria-label="Reason" placeholder="Reason" maxLength={200} className={`${field} flex-[1_1_10rem]`} />
            <SubmitButton tone="plain" pendingText="Granting…">
              Grant re-roll
            </SubmitButton>
          </form>
        </Tool>
        {canOverride && (
          <Tool title="Stats" hint="Set abilities, maximum hit points, XP, name, alignment or patron by hand. Needs a reason.">
            <div>
              <StatsEditor
                id={c.id}
                name={c.name}
                alignment={c.alignment}
                deity={c.deity}
                scores={{ str: c.str, int: c.int, wis: c.wis, dex: c.dex, con: c.con, cha: c.cha }}
                hpRecountable={
                  c.source === "app" &&
                  !c.manualFields.includes("hpMax") &&
                  c.classes.every((k) => k.hpMax === null || (Boolean(k.hpRollId) && k.baseHpLevel === 1))
                }
                classes={c.classes.map((k) => ({
                  id: k.id,
                  class: k.class,
                  xp: k.xp,
                  hpMax: k.hpMax,
                  highestHitDie: Math.max(0, ...c.levelDice.filter((d) => d.class === k.class && !d.lostAt).map((d) => d.level)),
                }))}
                activeClass={active?.class ?? null}
              />
            </div>
          </Tool>
        )}
      </div>
    </Panel>
  );
}
