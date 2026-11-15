"use client";

import { useState } from "react";
import type { CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES, levelRow } from "@/lib/rules/advancement";
import { DRAIN_SOURCE, planDrain, untrackedLevelsFor, type DrainDie } from "@/lib/rules/drain";
import { ordinal } from "@/lib/rules/levelup";
import { drainLevels } from "../actions";
import { SubmitButton } from "./build/forms";

type ClassRow = { id: string; class: CharacterClass; xp: number; active: boolean; baseHpLevel: number; dice: DrainDie[] };

const input = "min-h-11 rounded-xl border border-line-2 bg-ink px-3 text-sm text-parchment";

/**
 * Jay's level-loss form (Monsters & Treasure p. 9). The preview runs the same
 * planDrain the server runs, so what Jay sees is what gets saved.
 */
export function DrainForm({ characterId, race, hpMax, classes }: { characterId: string; race: Race | null; hpMax: number; classes: ClassRow[] }) {
  const [classId, setClassId] = useState(classes.find((k) => k.active)?.id ?? classes[0]?.id);
  const [xp, setXp] = useState("");
  const [hpLost, setHpLost] = useState("");
  const k = classes.find((c) => c.id === classId);
  if (!k) return null;
  const newXp = Number(xp);
  const typed = xp !== "" && Number.isInteger(newXp);
  const untracked = typed ? untrackedLevelsFor({ race, cls: k.class, baseHpLevel: k.baseHpLevel, newXp }) : [];
  const plan = typed
    ? planDrain({
        race,
        cls: k.class,
        xp: k.xp,
        baseHpLevel: k.baseHpLevel,
        dice: k.dice,
        hpMax,
        newXp,
        untrackedHpLost: hpLost === "" ? null : Number(hpLost),
      })
    : null;

  return (
    <details className="rounded-xl border border-[#5c3328] px-4 py-2.5">
      <summary className="min-h-8 cursor-pointer text-sm text-ember">Level loss</summary>
      <form action={drainLevels} className="flex flex-col gap-3 pt-2">
        <p className="text-xs text-subtle">
          {DRAIN_SOURCE}: a Wight or Wraith drains one level per hit, a Spectre or Vampire two. A hit removes both the level and its hit
          die. The book doesn&apos;t say what XP is left, so you set it (drain-xp). Current hit points stay as they are until you rule
          on that (drain-hp-current).
        </p>
        <input type="hidden" name="id" value={characterId} />
        <div className="flex flex-wrap items-end gap-2">
          {classes.length > 1 ? (
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">
              Class
              <select name="classId" value={classId} onChange={(e) => setClassId(e.target.value)} className={`${input} px-2`}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {CLASS_NAMES[c.class]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="classId" value={classId} />
          )}
          <label className="flex w-36 flex-col gap-1.5 text-[13px] text-muted">
            New XP
            <input
              name="xp"
              type="number"
              required
              min={0}
              step={1}
              value={xp}
              onChange={(e) => setXp(e.target.value)}
              placeholder={`now ${k.xp.toLocaleString("en-US")}`}
              className={`${input} font-mono text-[15px]`}
            />
          </label>
          {untracked.length > 0 && (
            <label className="flex w-44 flex-col gap-1.5 text-[13px] text-muted">
              Hit points lost
              <input
                name="hpLost"
                type="number"
                required
                min={0}
                step={1}
                value={hpLost}
                onChange={(e) => setHpLost(e.target.value)}
                className={`${input} font-mono text-[15px]`}
              />
            </label>
          )}
          <label className="flex min-w-50 flex-1 flex-col gap-1.5 text-[13px] text-muted">
            Reason
            <input name="reason" required maxLength={200} placeholder="Wight's hit, session 12" className={input} />
          </label>
          <SubmitButton tone="plain" pendingText="Saving…">
            Take levels away
          </SubmitButton>
        </div>
        {untracked.length > 0 && (
          <p className="text-xs text-amber">
            {untracked.length === 1 ? `Level ${untracked[0]} came` : `Levels ${[...untracked].reverse().join(", ")} came`} from the
            uploaded sheet with no hit die on record. Enter the hit points{" "}
            {untracked.length === 1 ? "it" : "they"} gave.
          </p>
        )}
        {plan && (
          <p aria-live="polite" className={`text-sm ${typeof plan === "string" ? "text-ember" : "text-[#d6d2c2]"}`}>
            {typeof plan === "string"
              ? plan
              : plan.toLevel === plan.fromLevel
                ? `Stays at ${ordinal(plan.fromLevel)} level. No hit die is lost.`
                : `Drops from ${ordinal(plan.fromLevel)} to ${ordinal(plan.toLevel)} level (${levelRow(k.class, plan.toLevel).title}). ` +
                  (plan.lostDice.length > 0
                    ? `Hit ${plan.lostDice.length === 1 ? "die" : "dice"} lost: ${plan.lostDice
                        .map((d) => `${ordinal(d.level)} level ${d.gain === null ? "(added nothing)" : `+${d.gain}`}`)
                        .join(", ")}. `
                    : "") +
                  `Maximum hit points ${hpMax} → ${plan.newHpMax}.`}
          </p>
        )}
      </form>
    </details>
  );
}
