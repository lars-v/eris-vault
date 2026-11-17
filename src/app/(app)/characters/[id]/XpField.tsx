"use client";

import { useActionState, useState } from "react";
import type { CharacterClass, Race } from "@/db/schema";
import { cappedLevelFor } from "@/lib/rules/advancement";
import { levelsGained, ordinal } from "@/lib/rules/levelup";
import { XP_LIMIT } from "@/lib/rules/overrides";
import { setXp, type StatResult } from "../stat-actions";
import { SubmitButton } from "./build/forms";

const idle: StatResult = { error: null, at: 0 };
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * One class's XP on the sheet. Whoever may change it (can.editXp) types the
 * new total and saves; everyone else sees the number. The line under the box
 * names the level the typed total reaches. M&M p. 18 recommends no more XP
 * from one adventure than it takes to gain one level; whether the table uses
 * that is the pending ruling "one-level-per-adventure", so it only warns.
 * Mount with key={xp} so a saved total resets the box.
 */
export function XpField({
  characterId,
  classId,
  race,
  cls,
  xp,
  canEdit,
}: {
  characterId: string;
  classId: string;
  race: Race | null;
  cls: CharacterClass;
  xp: number;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(setXp, idle);
  const [value, setValue] = useState(String(xp));
  const now = cappedLevelFor(race, cls, xp);
  const next = now.nextXp !== null ? `${now.nextTitle} at ${fmt(now.nextXp)}` : "Highest level for this race and class";

  if (!canEdit) {
    return (
      <p className="text-sm">
        <span className="font-mono text-base text-parchment">{fmt(xp)}</span> XP
        <span className="text-subtle"> · {next}</span>
      </p>
    );
  }

  const n = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= XP_LIMIT;
  const changed = valid && n !== xp;
  const gain = changed ? levelsGained(race, cls, xp, n - xp) : null;

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={characterId} />
      <input type="hidden" name="classId" value={classId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          XP
          <input
            name="xp"
            type="number"
            inputMode="numeric"
            min={0}
            max={XP_LIMIT}
            step={1}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-36 rounded-xl border border-line-2 bg-ink px-3 font-mono text-[15px] text-parchment"
          />
        </label>
        {changed ? (
          <SubmitButton tone="amber" pendingText="Saving…">
            Save
          </SubmitButton>
        ) : (
          <span className="text-sm text-subtle">{next}</span>
        )}
      </div>
      {gain && gain.to !== gain.from && (
        <p aria-live="polite" className={`text-sm ${gain.to - gain.from > 1 ? "text-amber" : "text-lime"}`}>
          {gain.to > gain.from ? "Reaches" : "Drops to"} {ordinal(gain.to)} level.
          {gain.to - gain.from > 1 &&
            " Men & Magic p. 18 recommends at most one level per adventure. Jay rules (one-level-per-adventure)."}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-lg border border-ember-edge bg-ember-wash px-3 py-2 text-sm text-ember">
          {state.error}
        </p>
      )}
    </form>
  );
}
