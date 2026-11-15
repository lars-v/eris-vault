import { DiceFaces } from "@/components/Dice";
import { Panel } from "@/components/ui";
import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { formatModifier } from "@/lib/rules/abilities";
import { CLASS_NAMES, countedHpLevel, levelFor, levelsToRoll, maxLevel } from "@/lib/rules/advancement";
import { HIT_DIE_ADJUST } from "@/lib/rules/dice";
import { levelUp, ordinal, type LevelUp } from "@/lib/rules/levelup";
import { rollLevelHitPoints } from "../actions";
import { AwardXpForm } from "./AwardXpForm";
import { DrainForm } from "./DrainForm";
import { SubmitButton } from "./build/forms";

type ClassRow = { id: string; class: CharacterClass; xp: number; active: boolean; baseHpLevel: number };
type LevelDie = { id: string; class: CharacterClass; level: number; gain: number | null; lostAt: Date | null; dice: number[][]; total: number[] };

/** What a level-up changed, each line with its page; open questions name their ruling. */
function LevelChanges({ up }: { up: LevelUp }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
        {up.changes.map((c) => (
          <li key={c.label} className="contents">
            <span className="text-muted">
              {c.label} <span className="text-xs text-subtle">{c.source}</span>
            </span>
            <span className="text-right font-mono">
              {c.before} <span className="text-subtle">→</span> {c.after}
            </span>
          </li>
        ))}
      </ul>
      {up.notes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {up.notes.map((n) => (
            <li key={n.text} className={`text-sm ${n.ruling ? "text-amber" : "text-[#d6d2c2]"}`}>
              {n.text}
              {n.ruling && ` Jay rules (${n.ruling}).`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * XP and new levels. Jay awards XP; when it reaches a new level the sheet
 * lists what changed, and the player (or Jay) rolls that level's hit die
 * (WW p. 6).
 */
export function LevelPanel({
  characterId,
  race,
  alignment,
  wis,
  recordedSpells,
  classes,
  firstLevelCounted,
  hpMax,
  conModifier,
  levelDice,
  canRoll,
  canAward,
}: {
  characterId: string;
  race: Race | null;
  alignment: Alignment | null;
  wis: number | null;
  recordedSpells: string[];
  classes: ClassRow[];
  firstLevelCounted: boolean;
  hpMax: number | null;
  conModifier: number;
  levelDice: LevelDie[];
  canRoll: boolean;
  canAward: boolean;
}) {
  return (
    <Panel title="Levels and hit points" aside="Woundwort's Warren pp. 6-11">
      {classes.map((k) => {
        const dice = levelDice.filter((d) => d.class === k.class);
        // Dice lost to a level drain stay listed but no longer count (Monsters & Treasure p. 9).
        const counted = countedHpLevel(firstLevelCounted, k.baseHpLevel, dice.filter((d) => !d.lostAt).map((d) => d.level));
        const toRoll = levelsToRoll(race, k.class, k.xp, counted);
        const cap = maxLevel(race, k.class);
        const reached = Math.min(levelFor(k.class, k.xp).level, cap);
        const capped = levelFor(k.class, k.xp).level > cap;
        const adj = HIT_DIE_ADJUST[k.class] + conModifier;
        const input = { race, cls: k.class, alignment, wis, recordedSpells };
        const fresh = toRoll.length > 0 ? levelUp(input, counted, reached) : null;
        const last = !fresh && firstLevelCounted && reached > 1 ? levelUp(input, reached - 1, reached) : null;
        return (
          <div key={k.id} className="flex flex-col gap-3">
            {classes.length > 1 && <h3 className="text-sm font-semibold">{CLASS_NAMES[k.class]}</h3>}
            {fresh ? (
              <div className="flex flex-col gap-3 rounded-xl border border-[#4b5e2a] bg-[#1b2113] px-4 py-3">
                <h4 className="font-display text-2xl text-lime">
                  {toRoll.length === 1
                    ? `${ordinal(reached)} level reached`
                    : `${ordinal(toRoll[0])} to ${ordinal(reached)} level reached`}
                </h4>
                <LevelChanges up={fresh} />
                <div className="flex flex-wrap items-center gap-3 border-t border-[#4b5e2a] pt-3">
                  <span className="text-sm">
                    {ordinal(toRoll[0])} level&apos;s hit die is 1d6
                    {HIT_DIE_ADJUST[k.class] ? ` ${formatModifier(HIT_DIE_ADJUST[k.class])} for the class` : ""}
                    {conModifier ? `${HIT_DIE_ADJUST[k.class] ? "," : ""} ${formatModifier(conModifier)} for Constitution` : ""} (WW pp.
                    5-6), so {1 + adj} to {6 + adj}.
                    {toRoll.length > 1 ? ` ${toRoll.length - 1} more level${toRoll.length > 2 ? "s" : ""} to roll after this one.` : ""}
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
              </div>
            ) : !firstLevelCounted ? (
              <p className="text-sm text-subtle">Roll 1st-level hit points in the build steps first.</p>
            ) : (
              <p className="text-sm text-subtle">
                No new level to roll for.
                {capped ? ` ${ordinal(cap)} level is as high as this race goes in this class (WW pp. 7-10).` : ""}
              </p>
            )}
            {last && (
              <details className="rounded-xl border border-line px-4 py-2.5">
                <summary className="min-h-8 cursor-pointer text-sm text-muted">What changed at {ordinal(reached)} level</summary>
                <div className="pt-2">
                  <LevelChanges up={last} />
                </div>
              </details>
            )}
            {dice.length > 0 && (
              <ul className="flex flex-col divide-y divide-[#262920]">
                {dice.map((d) => (
                  <li key={d.id} className={`flex flex-wrap items-center gap-3 py-2 text-sm ${d.lostAt ? "opacity-60" : ""}`}>
                    <span className="w-24 text-muted">{ordinal(d.level)} level</span>
                    <DiceFaces faces={d.dice[0]} size="sm" />
                    {d.lostAt ? (
                      <span className="text-ember">
                        <s className="font-mono">{d.gain === null ? "+0" : `+${d.gain}`} hp</s> lost to a level drain on{" "}
                        {d.lostAt.toISOString().slice(0, 10)}
                      </span>
                    ) : d.gain !== null ? (
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
      {canAward && <AwardXpForm characterId={characterId} race={race} classes={classes} />}
      {canAward && hpMax !== null && firstLevelCounted && (
        <DrainForm
          characterId={characterId}
          race={race}
          hpMax={hpMax}
          classes={classes.map((k) => ({
            ...k,
            dice: levelDice.filter((d) => d.class === k.class && !d.lostAt).map((d) => ({ id: d.id, level: d.level, gain: d.gain })),
          }))}
        />
      )}
    </Panel>
  );
}
