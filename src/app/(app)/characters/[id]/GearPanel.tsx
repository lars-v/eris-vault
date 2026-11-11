"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { Panel } from "@/components/ui";
import { ITEM_MAX_QUANTITY, ITEM_MAX_UNITS, ITEM_NAME_MAX } from "@/lib/rules/equipment";
import { addCatalogItem, addCustomItem, deleteItem, setItemMagic, setItemQuantity, type GearResult } from "../gear-actions";

export type GearItem = {
  id: string;
  name: string;
  quantity: number;
  encUnits: number | null;
  isMagic: boolean;
  location: string;
  /** Set when the price-list item is outside the class limits (classAllows). */
  warn: string | null;
};

export type GearCatalogRow = {
  key: string;
  name: string;
  category: "weapon" | "armor" | "gear";
  cost: string;
  enc: number;
  why: string | null;
};

const SECTIONS = [
  { category: "weapon", title: "Weapons" },
  { category: "armor", title: "Armor" },
  { category: "gear", title: "Dungeon gear" },
] as const;

const idle: GearResult = { error: null, at: 0 };
const inputCls = "min-h-11 min-w-0 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment";
/**
 * The add forms submit through a transition rather than `<form action>`, so
 * React doesn't reset the form afterwards: a reset would put the price-list
 * select back on its first option and lose what was typed after a problem.
 */
const submitWith = (action: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => action(fd));
};

function AddButton({ pending, tone }: { pending: boolean; tone: "lime" | "plain" }) {
  const cls = tone === "lime" ? "bg-lime text-lime-ink hover:brightness-110" : "border border-line-2 text-[#d6d2c2] hover:border-lime";
  return (
    <button type="submit" disabled={pending} className={`min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${cls}`}>
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

const units = (n: number) => `${n} unit${n === 1 ? "" : "s"}`;

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
      {text}
    </p>
  );
}

/** Carried weight of a row, as the encumbrance total counts it (magic counts 0, campaign ruling). */
function rowUnits(i: GearItem) {
  if (i.isMagic) return "0";
  if (i.encUnits === null) return "?";
  return String(i.encUnits * i.quantity);
}

/**
 * The Gear panel on the character sheet. Everyone sees the list; the player
 * who owns the character, Jay and admins get an Edit button (can.editGear).
 */
export function GearPanel({
  id,
  items,
  catalog,
  canEdit,
  staff,
}: {
  id: string;
  items: GearItem[];
  catalog: GearCatalogRow[];
  canEdit: boolean;
  staff: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Panel
      title={`Gear · ${items.length}`}
      className="min-w-0"
      aside={
        canEdit && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
            className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold ${
              editing ? "bg-lime text-lime-ink" : "border border-line-2 text-[#d6d2c2] hover:border-lime"
            }`}
          >
            {editing ? "Done" : "Edit gear"}
          </button>
        )
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing carried.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#262920]">
          {items.map((i) => (editing ? <EditRow key={i.id} characterId={id} item={i} staff={staff} /> : <ViewRow key={i.id} item={i} />))}
        </ul>
      )}

      {editing && (
        <div className="flex flex-col gap-4 border-t border-[#262920] pt-4">
          <AddFromList id={id} catalog={catalog} staff={staff} />
          <AddOther id={id} staff={staff} />
          <p className="text-xs text-subtle">
            Adding gear doesn&apos;t change your coins. Price-list weights are from Woundwort&apos;s Warren p. 18.
          </p>
        </div>
      )}

    </Panel>
  );
}

function ItemMeta({ item }: { item: GearItem }) {
  return (
    <>
      {item.isMagic && <span className="text-xs text-lime">Magic: counts 0</span>}
      {item.location !== "carried" && <span className="text-xs text-subtle">{item.location === "mount" ? "On the mount" : "Stashed"}: not carried</span>}
      {item.warn && <span className="text-xs text-amber">{item.warn} Carrying it waits on Jay&apos;s ruling.</span>}
    </>
  );
}

function ViewRow({ item }: { item: GearItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-[15px]">
      <span className="flex min-w-0 flex-col">
        <span>
          {item.quantity > 1 && <span className="font-mono text-muted">{item.quantity} × </span>}
          {item.name}
        </span>
        <ItemMeta item={item} />
      </span>
      <span className="font-mono" title="Encumbrance units">
        {rowUnits(item)}
      </span>
    </li>
  );
}

function EditRow({ characterId, item, staff }: { characterId: string; item: GearItem; staff: boolean }) {
  const [qtyState, qtyAction] = useActionState(setItemQuantity, idle);
  const [magicState, magicAction] = useActionState(setItemMagic, idle);
  const [delState, delAction] = useActionState(deleteItem, idle);
  const [qty, setQty] = useState(String(item.quantity));
  const form = useRef<HTMLFormElement>(null);

  // Follow the saved quantity after a step, or after a change made elsewhere.
  const [savedQty, setSavedQty] = useState(item.quantity);
  if (savedQty !== item.quantity) {
    setSavedQty(item.quantity);
    setQty(String(item.quantity));
  }

  const commit = () => {
    if (qty !== String(item.quantity)) form.current?.requestSubmit();
  };

  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="flex min-w-0 flex-[1_1_10rem] flex-col text-[15px]">
          <span>{item.name}</span>
          {!item.isMagic && (
            <span className="text-xs text-subtle">{item.encUnits === null ? "Weight unknown" : `${units(item.encUnits)} each`}</span>
          )}
          <ItemMeta item={item} />
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {staff && (
            <form action={magicAction}>
              <input type="hidden" name="id" value={characterId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="magic" value={item.isMagic ? "off" : "on"} />
              <button
                type="submit"
                role="switch"
                aria-checked={item.isMagic}
                aria-label={`${item.name} is magic`}
                title="Magic gear counts 0 units (campaign ruling)"
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[13px] ${
                  item.isMagic ? "border-[#4b5e2a] bg-[#222c17] text-lime" : "border-line-2 text-muted hover:border-lime"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative h-4 w-7 rounded-full transition-colors ${item.isMagic ? "bg-lime" : "bg-[#3a3d33]"}`}
                >
                  <span
                    className={`absolute top-0.5 size-3 rounded-full bg-ink transition-[left] ${item.isMagic ? "left-3.5" : "left-0.5"}`}
                  />
                </span>
                Magic
              </button>
            </form>
          )}
          <form ref={form} action={qtyAction} className="flex items-center">
            <input type="hidden" name="id" value={characterId} />
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              name="step"
              value="-1"
              disabled={item.quantity <= 1}
              aria-label={`One fewer ${item.name}`}
              className="size-11 rounded-l-xl border border-line-2 text-lg text-muted hover:text-lime disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              name="quantity"
              min={1}
              max={ITEM_MAX_QUANTITY}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                // Enter would press the first button (−); save the typed number instead.
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              aria-label={`How many ${item.name}`}
              className="h-11 w-14 border-y border-line-2 bg-ink text-center font-mono text-[15px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="submit"
              name="step"
              value="1"
              disabled={item.quantity >= ITEM_MAX_QUANTITY}
              aria-label={`One more ${item.name}`}
              className="size-11 rounded-r-xl border border-line-2 text-lg text-muted hover:text-lime disabled:opacity-30"
            >
              +
            </button>
          </form>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (item.isMagic && !confirm(`Remove ${item.name}? Only Jay can add a magic item back.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={characterId} />
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              aria-label={`Remove ${item.name}`}
              className="min-h-11 rounded-xl border border-line-2 px-3 text-[13px] text-muted hover:border-ember hover:text-ember"
            >
              Remove
            </button>
          </form>
        </span>
      </div>
      <Problem text={qtyState.error ?? magicState.error ?? delState.error} />
    </li>
  );
}

function AddFromList({ id, catalog, staff }: { id: string; catalog: GearCatalogRow[]; staff: boolean }) {
  const [state, action, pending] = useActionState(addCatalogItem, idle);
  const [key, setKey] = useState("");
  const [qty, setQty] = useState("1");
  const chosen = catalog.find((r) => r.key === key);

  // Clear the form after a successful add; keep what was typed after a problem.
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error) {
      setKey("");
      setQty("1");
    }
  }

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`gear-key-${id}`} className="text-sm font-semibold">
        Add from the price list <span className="font-normal text-subtle">· WW p. 17</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`gear-key-${id}`}
          name="key"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={`${inputCls} flex-[1_1_14rem] px-2`}
        >
          <option value="" disabled>
            Choose an item…
          </option>
          {SECTIONS.map(({ category, title }) => (
            <optgroup key={category} label={title}>
              {catalog
                .filter((r) => r.category === category)
                .map((r) => (
                  <option key={r.key} value={r.key} disabled={Boolean(r.why) && !staff}>
                    {r.name} · {r.cost} · {r.enc === 0 ? "no weight" : units(r.enc)}
                    {r.why ? (staff ? " (outside class limits)" : " (not for this class)") : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          name="quantity"
          min={1}
          max={ITEM_MAX_QUANTITY}
          required
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="How many"
          className={`${inputCls} w-20 text-center font-mono`}
        />
        <AddButton pending={pending} tone="lime" />
      </div>
      {chosen?.why && <p className="text-xs text-amber">{chosen.why} Jay can add it; the sheet will flag it.</p>}
      <Problem text={state.error} />
    </form>
  );
}

function AddOther({ id, staff }: { id: string; staff: boolean }) {
  const [state, action, pending] = useActionState(addCustomItem, idle);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [weight, setWeight] = useState("");
  const [magic, setMagic] = useState(false);

  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error) {
      setName("");
      setQty("1");
      setWeight("");
      setMagic(false);
    }
  }

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-sm font-semibold">Add something not on the list</span>
      <div className="flex flex-wrap gap-2">
        <input
          name="name"
          required
          maxLength={ITEM_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          aria-label="Item name"
          className={`${inputCls} flex-[1_1_12rem]`}
        />
        <input
          type="number"
          inputMode="numeric"
          name="quantity"
          min={1}
          max={ITEM_MAX_QUANTITY}
          required
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="How many"
          className={`${inputCls} w-20 text-center font-mono`}
        />
        <input
          type="number"
          inputMode="numeric"
          name="units"
          min={0}
          max={ITEM_MAX_UNITS}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Units"
          aria-label="Weight in units each (leave blank if unknown)"
          className={`${inputCls} w-24 text-center font-mono`}
        />
        <AddButton pending={pending} tone="plain" />
      </div>
      {staff && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="magic" checked={magic} onChange={(e) => setMagic(e.target.checked)} className="size-5 accent-lime" />
          Magic item (counts 0 units, campaign ruling)
        </label>
      )}
      <p className="text-xs text-subtle">Units are per item. Leave them blank if you don&apos;t know; the encumbrance total then shows as a floor.</p>
      <Problem text={state.error} />
    </form>
  );
}
