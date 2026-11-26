"use client";

import { startTransition, useOptimistic, useState } from "react";
import { markKnownSpell } from "../spell-actions";

export type SpellListLevel = {
  level: number;
  /** "1st", "2nd", ... */
  label: string;
  spells: { key: string; name: string }[];
};

type Mark = { key: string; on: boolean };

/**
 * The class spell list (WW p. 26). On a magic-user, spells the player
 * highlighted as known stand out; the player who owns the character, Jay and
 * admins tap a spell to mark or clear it. A note only: preparing still uses
 * the whole list (ruling magic-user-all-spells).
 */
export function SpellList({
  id,
  title,
  levels,
  markable,
  marked,
  canMark,
}: {
  id: string;
  title: string;
  levels: SpellListLevel[];
  /** Magic-users only. */
  markable: boolean;
  marked: string[];
  canMark: boolean;
}) {
  const [shown, addMark] = useOptimistic(marked, (cur: string[], m: Mark) =>
    m.on ? (cur.includes(m.key) ? cur : [...cur, m.key]) : cur.filter((k) => k !== m.key),
  );
  const [error, setError] = useState<string | null>(null);
  const set = new Set(shown);
  const total = levels.reduce((n, l) => n + l.spells.length, 0);
  const knownCount = levels.reduce((n, l) => n + l.spells.filter((s) => set.has(s.key)).length, 0);
  const editable = markable && canMark;

  function toggle(key: string) {
    const on = !set.has(key);
    setError(null);
    startTransition(async () => {
      addMark({ key, on });
      const r = await markKnownSpell(id, key, on);
      if (r.error) setError(r.error);
    });
  }

  const chip = "rounded-full border px-2.5 py-0.5 text-sm";
  const plain = "border-line-2";
  const lit = "border-lime-edge bg-lime-wash font-semibold text-lime";

  return (
    <details className="border-t border-rule pt-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {title} · {total}
        {markable && knownCount > 0 && <span className="font-normal text-lime"> · {knownCount} known</span>}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {editable && (
          <p className="text-sm text-muted">
            Tap a spell to highlight it as one your character knows. Tap again to clear it. Highlights are notes. They don&apos;t change which spells can be
            prepared.
          </p>
        )}
        {levels.map((l) => (
          <div key={l.level} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{l.label} level</span>
            <ul className="flex flex-wrap gap-1.5">
              {l.spells.map((s) => {
                const on = markable && set.has(s.key);
                return (
                  <li key={s.key}>
                    {editable ? (
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(s.key)}
                        className={`${chip} min-h-9 px-3 hover:border-lime ${on ? lit : plain}`}
                      >
                        {on && <span aria-hidden="true">✓ </span>}
                        {s.name}
                      </button>
                    ) : (
                      <span className={`inline-block ${chip} ${on ? lit : plain}`}>
                        {on && <span aria-hidden="true">✓ </span>}
                        {s.name}
                        {on && <span className="sr-only"> (known)</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {error && (
          <p role="alert" className="rounded-lg border border-ember-edge bg-ember-wash px-3 py-2 text-sm text-ember">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
