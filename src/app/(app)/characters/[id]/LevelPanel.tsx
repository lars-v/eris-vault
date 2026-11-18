import { DiceFaces } from "@/components/Dice";
import { Panel } from "@/components/ui";
import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { formatModifier } from "@/lib/rules/abilities";
import { CLASS_NAMES, countedHpLevel, fixedHpLevel, levelFor, levelsToRoll, maxLevel, NAME_LEVEL_HP, TOP_LEVEL } from "@/lib/rules/advancement";
import { HIT_DIE_ADJUST } from "@/lib/rules/dice";
import { levelUp, neutralClericBlocked, ordinal, type LevelUp } from "@/lib/rules/levelup";
import { rollLevelHitPoints } from "../actions";
import { DrainForm } from "./DrainForm";
import { SubmitButton } from "./build/forms";
import { XpField } from "./XpField";

type ClassRow = { id: string; class: CharacterClass; xp: number; active: boolean; baseHpLevel: number };
/** `dice` and `total` are null from 10th level, where hit points are fixed and not rolled (WW pp. 7-9). */
type LevelDie = {
  id: string;
  class: CharacterClass;
  level: number;
  gain: number | null;
  lostAt: Date | null;
  dice: number[][] | null;
  total: number[] | null;
};

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
            <li key={n.text} className={`text-sm ${n.ruling ? "text-amber" : "text-soft"}`}>
              {n.text}
              {n.ruling && ` Waiting on Jay's ruling (${n.ruling}).`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * XP and new levels. XP is typed straight in (the player on an approved
 * character, Jay and admins on submitted ones too); when it reaches a new level the sheet
 * lists what changed, and the player (or Jay) rolls that level's hit die
 * (WW p. 6).
 */
export function LevelPanel({
  characterId,
  race,
  alignment,
  wis,
  classes,
  firstLevelCounted,
  hpMax,
  conModifier,
  levelDice,
  canRoll,
  canEditXp,
  canDrain,
}: {
  characterId: string;
  race: Race | null;
  alignment: Alignment | null;
  wis: number | null;
  classes: ClassRow[];
  firstLevelCounted: boolean;
  hpMax: number | null;
  conModifier: number;
  levelDice: LevelDie[];
  canRoll: boolean;
  canEditXp: boolean;
  canDrain: boolean;
}) {
  return (
    <Panel title="Levels and hit points" aside="Woundwort's Warren pp. 6-11">
      {classes.map((k) => {
        const dice = levelDice.filter((d) => d.class === k.class);
        // Dice for levels Jay took away stay listed but no longer count.
        const counted = countedHpLevel(firstLevelCounted, k.baseHpLevel, dice.filter((d) => !d.lostAt).map((d) => d.level));
        const toRoll = levelsToRoll(race, k.class, k.xp, counted);
        const cap = maxLevel(race, k.class);
        const reached = Math.min(levelFor(k.class, k.xp).level, cap);
        const capped = levelFor(k.class, k.xp).level > cap;
        const adj = HIT_DIE_ADJUST[k.class] + conModifier;
        const input = { race, cls: k.class, alignment, wis };
        const blocked = toRoll.length > 0 ? neutralClericBlocked(k.class, alignment, toRoll[0]) : null;
        const fixed = toRoll.length > 0 && fixedHpLevel(toRoll[0]);
        const fresh = toRoll.length > 0 ? levelUp(input, counted, reached) : null;
        const last = !fresh && firstLevelCounted && reached > 1 ? levelUp(input, reached - 1, reached) : null;
        return (
          <div key={k.id} className="flex flex-col gap-3">
            {classes.length > 1 && <h3 className="text-sm font-semibold">{CLASS_NAMES[k.class]}</h3>}
            <XpField key={k.xp} characterId={characterId} classId={k.id} race={race} cls={k.class} xp={k.xp} canEdit={canEditXp} />
            {fresh ? (
              <div className="flex flex-col gap-3 rounded-xl border border-lime-edge bg-lime-wash px-4 py-3">
                <h4 className="font-display text-2xl text-lime">
                  {toRoll.length === 1
                    ? `${ordinal(reached)} level reached`
                    : `${ordinal(toRoll[0])} to ${ordinal(reached)} level reached`}
                </h4>
                <LevelChanges up={fresh} />
                <div className="flex flex-wrap items-center gap-3 border-t border-lime-edge pt-3">
                  <span className="text-sm">
                    {fixed ? (
                      <>
                        {ordinal(toRoll[0])} level adds {NAME_LEVEL_HP[k.class]} hit point{NAME_LEVEL_HP[k.class] === 1 ? "" : "s"}, with no
                        roll (WW pp. 7-9).
                      </>
                    ) : (
                      <>
                        {ordinal(toRoll[0])} level&apos;s hit die is 1d6
                        {HIT_DIE_ADJUST[k.class] ? ` ${formatModifier(HIT_DIE_ADJUST[k.class])} for the class` : ""}
                        {conModifier ? `${HIT_DIE_ADJUST[k.class] ? "," : ""} ${formatModifier(conModifier)} for Constitution` : ""} (WW pp.
                        5-6), so {Math.max(1, 1 + adj)} to {Math.max(1, 6 + adj)}. Every hit die adds at least 1 (Jay&apos;s ruling).
                      </>
                    )}
                    {toRoll.length > 1 ? ` ${toRoll.length - 1} more level${toRoll.length > 2 ? "s" : ""} to roll after this one.` : ""}
                  </span>
                  {blocked ? (
                    <span className="text-sm text-amber">{blocked}</span>
                  ) : canRoll ? (
                    <form action={rollLevelHitPoints}>
                      <input type="hidden" name="id" value={characterId} />
                      <input type="hidden" name="classId" value={k.id} />
                      <SubmitButton pendingText={fixed ? "Adding…" : "Rolling…"}>
                        {fixed ? `Add ${ordinal(toRoll[0])} level's hit points` : `Roll hit points for ${ordinal(toRoll[0])} level`}
                      </SubmitButton>
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
                {capped && cap < TOP_LEVEL ? ` ${ordinal(cap)} level is as high as this race goes in this class (WW pp. 7-10).` : ""}
                {capped && cap === TOP_LEVEL ? " The vault stops at 10th level until Jay rules on what comes after (past-tenth-level)." : ""}
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
              <ul className="flex flex-col divide-y divide-rule">
                {dice.map((d) => (
                  <li key={d.id} className={`flex flex-wrap items-center gap-3 py-2 text-sm ${d.lostAt ? "opacity-60" : ""}`}>
                    <span className="w-24 text-muted">{ordinal(d.level)} level</span>
                    {d.dice ? <DiceFaces faces={d.dice[0]} size="sm" /> : <span className="text-xs text-subtle">no roll</span>}
                    {d.lostAt ? (
                      <span className="text-ember">
                        <s className="font-mono">{d.gain === null ? "+0" : `+${d.gain}`} hp</s> level taken away on{" "}
                        {d.lostAt.toISOString().slice(0, 10)}
                      </span>
                    ) : d.gain !== null ? (
                      <span className="font-mono">+{d.gain} hp</span>
                    ) : (
                      <span className="text-amber">Total {d.total?.[0]}, rolled before Jay&apos;s hit-die-floor ruling, so it added nothing.</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <p className="text-xs text-subtle">
        A new level&apos;s hit points add to the maximum, and current hit points rise by the same amount (Jay&apos;s ruling).
      </p>
      {canDrain && hpMax !== null && firstLevelCounted && (
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
