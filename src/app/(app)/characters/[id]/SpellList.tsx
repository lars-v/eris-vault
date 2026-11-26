export type SpellListLevel = {
  level: number;
  /** "1st", "2nd", ... */
  label: string;
  spells: { key: string; name: string }[];
};

export const levelLabel = "text-xs font-semibold uppercase tracking-[0.12em] text-subtle";
export const chip = "rounded-full border px-2.5 py-0.5 text-sm";

/** The whole class spell list (WW p. 26), read-only. Clerics have every spell on it (ruling cleric-all-spells). */
export function SpellList({ title, levels }: { title: string; levels: SpellListLevel[] }) {
  const total = levels.reduce((n, l) => n + l.spells.length, 0);
  return (
    <details className="border-t border-rule pt-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {title} · {total}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {levels.map((l) => (
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
        ))}
      </div>
    </details>
  );
}
