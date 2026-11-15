"use client";

import { useState } from "react";
import type { CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES, levelRow } from "@/lib/rules/advancement";
import { levelsGained, ordinal } from "@/lib/rules/levelup";
import { awardXp } from "../actions";
import { SubmitButton } from "./build/forms";

type ClassRow = { id: string; class: CharacterClass; xp: number; active: boolean };

/**
 * Jay's XP award, with a live note of the level it reaches. M&M p. 18
 * recommends no more XP from one adventure than it takes to gain one level;
 * whether the table uses that is the pending ruling "one-level-per-adventure",
 * so the form warns and still lets Jay award it.
 */
export function AwardXpForm({ characterId, race, classes }: { characterId: string; race: Race | null; classes: ClassRow[] }) {
  const [classId, setClassId] = useState(classes.find((k) => k.active)?.id ?? classes[0]?.id);
  const [amount, setAmount] = useState("");
  const k = classes.find((c) => c.id === classId);
  const n = Number(amount);
  const gain = k && amount !== "" && Number.isInteger(n) && n !== 0 && k.xp + n >= 0 ? levelsGained(race, k.class, k.xp, n) : null;

  return (
    <form action={awardXp} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <input type="hidden" name="id" value={characterId} />
      {classes.length > 1 ? (
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Class
          <select
            name="classId"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="min-h-11 rounded-xl border border-line-2 bg-ink px-2 text-sm text-parchment"
          >
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
      <label className="flex w-32 flex-col gap-1.5 text-[13px] text-muted">
        XP
        <input
          name="amount"
          type="number"
          required
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 font-mono text-[15px] text-parchment"
        />
      </label>
      <label className="flex min-w-50 flex-1 flex-col gap-1.5 text-[13px] text-muted">
        Note (optional)
        <input name="note" maxLength={200} placeholder="What it was for" className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 text-sm text-parchment" />
      </label>
      <SubmitButton tone="amber" pendingText="Awarding…">
        Award XP
      </SubmitButton>
      {gain && k && gain.to !== gain.from && (
        <p aria-live="polite" className={`basis-full text-sm ${gain.to - gain.from > 1 ? "text-amber" : "text-lime"}`}>
          {gain.to > gain.from
            ? `This takes ${CLASS_NAMES[k.class]} from ${ordinal(gain.from)} to ${ordinal(gain.to)} level (${levelRow(k.class, gain.to).title}).`
            : `This takes ${CLASS_NAMES[k.class]} down from ${ordinal(gain.from)} to ${ordinal(gain.to)} level.`}
          {gain.to - gain.from > 1 &&
            " Men & Magic p. 18 recommends no more XP from one adventure than it takes to gain one level. Your call (one-level-per-adventure)."}
        </p>
      )}
      <span className="basis-full text-xs text-subtle">
        Use a negative number to correct a mistake. High or low scores give no XP bonus or penalty (WW p. 11). Every award goes in
        the audit log.
      </span>
    </form>
  );
}
