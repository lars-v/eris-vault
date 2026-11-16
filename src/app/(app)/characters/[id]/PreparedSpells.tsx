"use client";

import { useActionState, useState } from "react";
import { savePreparedSpells, type PrepareResult } from "../spell-actions";

const idle: PrepareResult = { error: null, at: 0 };

export type PrepareLevel = {
  level: number;
  /** "1st", "2nd", ... */
  label: string;
  slots: number;
  /** Spells in the book at this level, in list order. */
  options: { key: string; name: string }[];
  /** Spell keys prepared at this level now, in slot order. */
  current: string[];
};

const selectCls = "min-h-11 w-full min-w-0 rounded-xl border border-line-2 bg-ink px-2 text-sm";

/**
 * The day's prepared spells (WW pp. 5, 7-8, 25). Shows each slot; the player
 * who owns the character, Jay and admins open the picker to change them.
 */
export function PreparedSpells({ id, levels, canEdit }: { id: string; levels: PrepareLevel[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(savePreparedSpells, idle);
  const [editing, setEditing] = useState(false);

  // Close the picker after a successful save; keep it open after a problem.
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error) setEditing(false);
  }

  const nameOf = (lvl: PrepareLevel, key: string) => lvl.options.find((o) => o.key === key)?.name ?? key;
  const anyPrepared = levels.some((l) => l.current.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Prepared spells</h3>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-9 rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-[#d6d2c2] hover:border-lime"
          >
            {anyPrepared ? "Change prepared spells" : "Prepare spells"}
          </button>
        )}
      </div>

      {editing ? (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-muted">Choose a spell for each slot, then save. Leave a slot open to fill it later.</p>
          {levels.map((l) => (
            <fieldset key={l.level} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">{l.label}-level slots</legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                  {Array.from({ length: l.slots }, (_, i) => (
                    <label key={i} className="flex flex-col gap-1">
                      <span className="text-xs text-subtle">Slot {i + 1}</span>
                      <select name="slot" defaultValue={l.current[i] ?? ""} className={selectCls}>
                        <option value="">Open slot</option>
                        {l.options.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
          {state.error && (
            <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(false)}
              className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save prepared spells"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {levels.map((l) => (
            <div key={l.level} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{l.label} level</span>
              <ul className="flex flex-wrap gap-1.5">
                  {Array.from({ length: l.slots }, (_, i) => {
                    const key = l.current[i];
                    return key ? (
                      <li key={i} className="rounded-full border border-line-2 px-2.5 py-0.5 text-sm">
                        {nameOf(l, key)}
                      </li>
                    ) : (
                      <li key={i} className="rounded-full border border-dashed border-line-2 px-2.5 py-0.5 text-sm text-subtle">
                        open slot
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
