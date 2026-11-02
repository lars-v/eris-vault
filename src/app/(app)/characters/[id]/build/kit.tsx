"use client";

import { useMemo, useRef, useState } from "react";
import { bandFor } from "@/lib/rules/encumbrance";
import { setKit } from "../../actions";
import { SubmitButton } from "./forms";

export type KitRow = {
  key: string;
  name: string;
  category: "weapon" | "armor" | "gear";
  cost: string;
  costGp: number | null;
  enc: number;
  why: string | null; // set when the class may not take it (classAllows)
};

const SECTIONS = [
  { category: "weapon", title: "Weapons" },
  { category: "armor", title: "Armor" },
  { category: "gear", title: "Dungeon gear" },
] as const;

/**
 * The gear dialog: tick everything on the price list in one go, then save.
 * It opens on the current kit and replaces it on save (setKit). `otherUnits`
 * counts carried items the dialog doesn't manage, so the totals stay honest.
 */
export function KitPicker({
  id,
  rows,
  initial,
  otherUnits,
  max,
}: {
  id: string;
  rows: KitRow[];
  initial: Record<string, number>;
  otherUnits: number;
  max: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [qty, setQty] = useState<Record<string, number>>(initial);
  const [filter, setFilter] = useState("");

  const open = () => {
    setQty(initial);
    setFilter("");
    dialog.current?.showModal();
  };

  const picked = rows.filter((r) => (qty[r.key] ?? 0) > 0);
  const units = otherUnits + picked.reduce((s, r) => s + r.enc * qty[r.key], 0);
  const band = bandFor(units);
  const gp = picked.reduce((s, r) => s + (r.costGp ?? 0) * qty[r.key], 0);
  const gpOpen = picked.some((r) => r.costGp === null);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? rows.filter((r) => r.name.toLowerCase().includes(f)) : rows;
  }, [rows, filter]);

  const toggle = (key: string, on: boolean) => setQty((q) => ({ ...q, [key]: on ? Math.max(1, q[key] ?? 0) : 0 }));
  const setCount = (key: string, n: number) =>
    setQty((q) => ({ ...q, [key]: Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0 }));

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110"
      >
        Choose gear
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="kit-title"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-surface text-parchment backdrop:bg-black/70 sm:m-auto sm:h-[85dvh] sm:max-w-[760px] sm:rounded-2xl sm:border sm:border-line"
      >
        <form action={setKit} onSubmit={() => dialog.current?.close()} className="flex h-full flex-col">
          <input type="hidden" name="id" value={id} />
          {picked.map((r) => (
            <input key={r.key} type="hidden" name={`qty:${r.key}`} value={qty[r.key]} />
          ))}

          <div className="flex flex-col gap-3 border-b border-line px-5 pb-4 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="kit-title" className="font-display text-3xl text-parchment-2">
                Choose gear
              </h2>
              <span className="text-xs text-subtle">Woundwort&apos;s Warren pp. 17, 18</span>
            </div>
            <p className="text-sm text-muted">
              Tick everything you want and set how many. Saving replaces your kit. Weight is in units (p. 18).
            </p>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find an item"
              aria-label="Find an item"
              className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {SECTIONS.map(({ category, title }) => {
              const list = shown.filter((r) => r.category === category);
              if (list.length === 0) return null;
              return (
                <fieldset key={category} className="mb-4">
                  <legend className="sticky top-0 z-10 w-full bg-surface py-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-subtle">
                    {title}
                  </legend>
                  <ul className="flex flex-col divide-y divide-[#262920]">
                    {list.map((r) => {
                      const n = qty[r.key] ?? 0;
                      return (
                        <li key={r.key} className={`flex items-center gap-3 py-1.5 ${r.why ? "opacity-50" : ""}`}>
                          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={n > 0}
                              disabled={Boolean(r.why)}
                              onChange={(e) => toggle(r.key, e.target.checked)}
                              className="size-5 flex-none accent-[#b9d55f]"
                            />
                            <span className="flex flex-col">
                              <span className="text-[15px]">{r.name}</span>
                              <span className="text-xs text-subtle">
                                {r.cost} · {r.enc === 0 ? "no weight" : `${r.enc} unit${r.enc === 1 ? "" : "s"}`}
                                {r.why && ` · ${r.why}`}
                              </span>
                            </span>
                          </label>
                          {n > 0 && (
                            <input
                              type="number"
                              min={1}
                              max={max}
                              value={n}
                              onChange={(e) => setCount(r.key, Number(e.target.value))}
                              aria-label={`How many ${r.name}`}
                              className="min-h-11 w-16 rounded-xl border border-line-2 bg-ink px-2 text-center font-mono text-[15px]"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
            {shown.length === 0 && <p className="py-6 text-sm text-subtle">Nothing on the price list matches.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-5 py-4">
            <div className="text-sm" aria-live="polite">
              <div>
                {picked.length} item{picked.length === 1 ? "" : "s"} · <span className="font-mono">{units}</span> units ·{" "}
                {band.name}
                {band.move ? `, move ${band.move}` : ""}
              </div>
              <div className="text-xs text-subtle">
                Price list total {gp} gp{gpOpen ? " plus items priced by Jay" : ""}. Not taken from your gold (campaign ruling).
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime"
              >
                Cancel
              </button>
              <SubmitButton pendingText="Saving…">Save kit</SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
