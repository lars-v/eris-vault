import { DiceFaces } from "@/components/Dice";
import { Panel } from "@/components/ui";
import type { CharacterClass, Race } from "@/db/schema";
import { formatModifier } from "@/lib/rules/abilities";
import { CLASS_NAMES, countedHpLevel, levelFor, levelsToRoll, maxLevel } from "@/lib/rules/advancement";
import { HIT_DIE_ADJUST } from "@/lib/rules/dice";
import { awardXp, rollLevelHitPoints } from "../actions";
import { SubmitButton } from "./build/forms";

type ClassRow = { id: string; class: CharacterClass; xp: number; active: boolean; baseHpLevel: number };
type LevelDie = { class: CharacterClass; level: number; gain: number | null; dice: number[][]; total: number[] };

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/**
 * XP and hit points for new levels. Jay awards XP; when it reaches a new
 * level, the player (or Jay) rolls that level's hit die (WW p. 6).
 */
export function LevelPanel({
  characterId,
  race,
  classes,
  firstLevelCounted,
  conModifier,
  levelDice,
  canRoll,
  canAward,
}: {
  characterId: string;
  race: Race | null;
  classes: ClassRow[];
  firstLevelCounted: boolean;
  conModifier: number;
  levelDice: LevelDie[];
  canRoll: boolean;
  canAward: boolean;
}) {
  return (
    <Panel title="Levels and hit points" aside="Woundwort's Warren pp. 6-11">
      {classes.map((k) => {
        const dice = levelDice.filter((d) => d.class === k.class);
        const counted = countedHpLevel(firstLevelCounted, k.baseHpLevel, dice.map((d) => d.level));
        const toRoll = levelsToRoll(race, k.class, k.xp, counted);
        const cap = maxLevel(race, k.class);
        const capped = levelFor(k.class, k.xp).level > cap;
        const adj = HIT_DIE_ADJUST[k.class] + conModifier;
        return (
          <div key={k.id} className="flex flex-col gap-3">
            {classes.length > 1 && <h3 className="text-sm font-semibold">{CLASS_NAMES[k.class]}</h3>}
            {toRoll.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#4b5e2a] bg-[#1b2113] px-4 py-3">
                <span className="text-sm">
                  {ordinal(toRoll[0])} level reached. Its hit die is 1d6 {formatModifier(HIT_DIE_ADJUST[k.class])} for the class
                  {conModifier ? `, ${formatModifier(conModifier)} for Constitution` : ""} (WW pp. 5-6), so {1 + adj} to {6 + adj}.{toRoll.length > 1 ? ` ${toRoll.length - 1} more level${toRoll.length > 2 ? "s" : ""} after this one.` : ""}
                </span>
                {canRoll ? (
                  <form action={rollLevelHitPoints}>
                    <input type="hidden" name="id" value={characterId} />
                    <input type="hidden" name="classId" value={k.id} />
                    <SubmitButton pendingText="Rolling…">Roll hit points for {ordinal(toRoll[0])} level</SubmitButton>
                  </form>
                ) : (
                  <span className="text-xs text-subtle">The player rolls this.</span>
                )}
              </div>
            ) : !firstLevelCounted ? (
              <p className="text-sm text-subtle">Roll 1st-level hit points in the build steps first.</p>
            ) : (
              <p className="text-sm text-subtle">
                No new level to roll for.
                {capped ? ` ${ordinal(cap)} level is as high as this race goes in this class (WW pp. 7-10).` : ""}
              </p>
            )}
            {dice.length > 0 && (
              <ul className="flex flex-col divide-y divide-[#262920]">
                {dice.map((d) => (
                  <li key={d.level} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="w-24 text-muted">{ordinal(d.level)} level</span>
                    <DiceFaces faces={d.dice[0]} size="sm" />
                    {d.gain !== null ? (
                      <span className="font-mono">+{d.gain} hp</span>
                    ) : (
                      <span className="text-amber">
                        Total {d.total[0]}, so nothing added yet. Jay rules on whether a hit die can add less than 1 (hit-die-floor).
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <p className="text-xs text-subtle">
        A new level&apos;s hit die adds to maximum hit points. Current hit points stay as they are until Jay rules on that
        (level-hp-current).
      </p>
      {canAward && (
        <form action={awardXp} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <input type="hidden" name="id" value={characterId} />
          {classes.length > 1 && (
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">
              Class
              <select name="classId" defaultValue={classes.find((k) => k.active)?.id} className="min-h-11 rounded-xl border border-line-2 bg-ink px-2 text-sm text-parchment">
                {classes.map((k) => (
                  <option key={k.id} value={k.id}>
                    {CLASS_NAMES[k.class]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {classes.length === 1 && <input type="hidden" name="classId" value={classes[0].id} />}
          <label className="flex w-32 flex-col gap-1.5 text-[13px] text-muted">
            XP
            <input name="amount" type="number" required step={1} className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 font-mono text-[15px] text-parchment" />
          </label>
          <label className="flex min-w-50 flex-1 flex-col gap-1.5 text-[13px] text-muted">
            Note (optional)
            <input name="note" maxLength={200} placeholder="What it was for" className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 text-sm text-parchment" />
          </label>
          <SubmitButton tone="amber" pendingText="Awarding…">
            Award XP
          </SubmitButton>
          <span className="basis-full text-xs text-subtle">
            Use a negative number to correct a mistake. High or low scores give no XP bonus or penalty (WW p. 11). Every award
            goes in the audit log.
          </span>
        </form>
      )}
    </Panel>
  );
}
