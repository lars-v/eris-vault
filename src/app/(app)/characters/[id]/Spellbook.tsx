"use client";

import { startTransition, useOptimistic, useState } from "react";
import { setSpellbookEntry } from "../spell-actions";
import { chip, levelLabel, type SpellListLevel } from "./SpellList";

type Change = { key: string; on: boolean };

const smallBtn = "min-h-9 rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-soft hover:border-lime";
const lit = "border-lime-edge bg-lime-wash font-semibold text-lime";

/**
 * A magic-user's spellbook (table ruling magic-user-spellbook, 25 Nov 2026):
 * the only spells they prepare or store in a staff. Shows the book by spell
 * level. The player who owns the character, Jay and admins open the whole
 * magic-user list (WW p. 26) and tap spells to add or remove them at any time.
 */
export function Spellbook({
  id,
  levels,
  book,
  canEdit,
}: {
  id: string;
  /** The whole magic-user list, by spell level. */
  levels: SpellListLevel[];
  /** Spell keys in the book. */
  book: string[];
  canEdit: boolean;
}) {
  const [shown, change] = useOptimistic(book, (cur: string[], m: Change) =>
    m.on ? (cur.includes(m.key) ? cur : [...cur, m.key]) : cur.filter((k) => k !== m.key),
  );
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inBook = new Set(shown);
  const bookLevels = levels.map((l) => ({ ...l, spells: l.spells.filter((s) => inBook.has(s.key)) })).filter((l) => l.spells.length > 0);
  const count = bookLevels.reduce((n, l) => n + l.spells.length, 0);
  const open = canEdit && editing;

  function toggle(key: string) {
    const on = !inBook.has(key);
    setError(null);
    startTransition(async () => {
      change({ key, on });
      const r = await setSpellbookEntry(id, key, on);
      if (r.error) setError(r.error);
    });
  }

  return (
    <section aria-label="Spellbook" className="flex flex-col gap-3 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Spellbook · {count} {count === 1 ? "spell" : "spells"}
        </h3>
        {canEdit && (
          <button type="button" aria-expanded={open} onClick={() => setEditing(!editing)} className={smallBtn}>
            {open ? "Done" : count === 0 ? "Add spells" : "Edit spellbook"}
          </button>
        )}
      </div>

      {open ? (
        <>
          <p className="text-sm text-muted">
            Tap a spell to add it to the spellbook. Tap a spell with a check to take it out. A spell taken out while prepared stays prepared today.
          </p>
          {levels.map((l) => {
            const have = l.spells.filter((s) => inBook.has(s.key)).length;
            return (
              <div key={l.level} className="flex flex-col gap-1.5">
                <span className={levelLabel}>
                  {l.label} level · {have} of {l.spells.length}
                </span>
                <ul className="flex flex-wrap gap-1.5">
                  {l.spells.map((s) => {
                    const on = inBook.has(s.key);
                    return (
                      <li key={s.key}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(s.key)}
                          className={`${chip} min-h-9 px-3 hover:border-lime ${on ? lit : "border-line-2"}`}
                        >
                          {on && <span aria-hidden="true">✓ </span>}
                          {s.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </>
      ) : count === 0 ? (
        <p className="text-sm text-subtle">{canEdit ? "The spellbook is empty. Add spells to prepare them." : "The spellbook is empty."}</p>
      ) : (
        bookLevels.map((l) => (
          <div key={l.level} className="flex flex-col gap-1.5">
            <span className={levelLabel}>{l.label} level</span>
            <ul className="flex flex-wrap gap-1.5">
              {l.spells.map((s) => (
                <li key={s.key} className={`${chip} border-line-2`}>
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-ember-edge bg-ember-wash px-3 py-2 text-sm text-ember">
          {error}
        </p>
      )}
    </section>
  );
}
