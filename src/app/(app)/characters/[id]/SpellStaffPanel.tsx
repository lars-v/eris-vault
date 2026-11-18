import Link from "next/link";
import { Panel } from "@/components/ui";
import { spell } from "@/lib/rules/spells";
import { slotStates, STAFF_CATALOG_KEY, STAFF_SLOTS, STAFF_SOURCE, staffSpells, staffWarnings, type StaffEvent } from "@/lib/rules/staff";
import { FocusPicker, StaffSlots, type FocusOption, type StaffSlotView } from "./StaffSlots";

export type StaffHistoryEvent = StaffEvent & { note: string | null; actorName: string | null };
export type StaffRuling = { key: string; question: string; answer: string | null; status: "pending" | "decided" };
type Item = { id: string; name: string; catalogKey: string | null; isSpellFocus: boolean | null };

const VERB = { load: "Loaded", release: "Released", void: "Voided" } as const;

/** The rulings this card can point at (scripts/migrate.mjs). */
export const STAFF_RULINGS = ["staff-carry-over-rest", "staff-loss", "elf-wand-int", "staff-int-drop"];

/** Jay's answer once decided; until then a link for Jay and admins, or a note for players. */
function RulingNote({ ruling, rulings, staff }: { ruling: string; rulings: StaffRuling[]; staff: boolean }) {
  const r = rulings.find((x) => x.key === ruling);
  if (r?.status === "decided" && r.answer) return <span className="block text-xs text-muted">Jay&apos;s ruling: {r.answer}</span>;
  return staff ? (
    <Link href={`/gm/rulings#ruling-${ruling}`} className="block text-xs text-lime underline-offset-4 hover:underline">
      Open ruling: {ruling}
    </Link>
  ) : (
    <span className="block text-xs text-subtle">Waiting on Jay&apos;s ruling ({ruling}).</span>
  );
}

/**
 * The "Spell staff" card (WW pp. 5, 7): the staff or wand, one token per slot,
 * warnings that never change anything, and the last few loads and releases.
 * Jay's staff rulings (17 Nov 2026) are listed in src/lib/rules/staff.ts.
 */
export function SpellStaffPanel({
  id,
  capacity,
  int,
  isElf,
  items,
  events,
  rulings,
  canUse,
  canVoid,
  canFocus,
  staff,
}: {
  id: string;
  capacity: 0 | 1 | 2;
  int: number | null;
  isElf: boolean;
  items: Item[];
  events: StaffHistoryEvent[];
  rulings: StaffRuling[];
  /** Load and release: owner, Jay or admin, and the character in play. */
  canUse: boolean;
  canVoid: boolean;
  canFocus: boolean;
  /** Jay or an admin: may pick any item as the focus, and can open /gm/rulings. */
  staff: boolean;
}) {
  const states = slotStates(events);
  const focus = items.find((i) => i.isSpellFocus) ?? null;
  const warnings = staffWarnings({ states, capacity, focusId: focus?.id ?? null, itemIds: new Set(items.map((i) => i.id)) });
  // Show every slot that can be used or still holds a spell.
  const slots: StaffSlotView[] = STAFF_SLOTS.filter((n) => n <= capacity || states.some((s) => s.slot === n && s.spell)).map((n) => {
    const s = states.find((x) => x.slot === n)!;
    return { slot: n, spellName: s.spell ? spell(s.spell)?.name ?? s.spell : null, usable: n <= capacity };
  });
  const focusOptions: FocusOption[] = items
    .filter((i) => staff || i.catalogKey === STAFF_CATALOG_KEY)
    .map((i) => ({ id: i.id, name: i.name }));
  const RulingNoteFor = (key: string) => <RulingNote ruling={key} rulings={rulings} staff={staff} />;

  return (
    <Panel title="Spell staff" aside={STAFF_SOURCE}>
      <p className="text-sm text-muted">
        {capacity === 0
          ? `Intelligence ${int ?? "unknown"} gives no bonus, so no spells can be stored now.`
          : `Intelligence ${int} stores ${capacity === 1 ? "one 1st-level spell" : "two 1st-level spells"}. A stored spell can be released at any time; then it must be cast on the staff again.`}
      </p>
      {isElf && (
        <p className="text-xs text-subtle">
          Elves follow the same Intelligence rule. {RulingNoteFor("elf-wand-int")}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          <span className="text-muted">Staff or wand: </span>
          {focus ? <span className="font-semibold">{focus.name}</span> : <span className="text-subtle">none set</span>}
        </span>
        {canFocus && capacity > 0 && (focusOptions.length > 0 || focus) && <FocusPicker id={id} current={focus?.id ?? null} options={focusOptions} />}
      </div>
      {canFocus && capacity > 0 && !focus && focusOptions.length === 0 && (
        <p className="text-sm text-subtle">
          Add a staff from the price list in Gear{staff ? ", or add the wand or found staff as an item," : ""} to set it as the spell focus.
          {!staff && " A wand or a found staff is added by Jay."}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {warnings.map((w, i) => (
            <li key={i} className="rounded-xl border border-amber-edge bg-amber-wash px-3 py-2 text-sm text-amber">
              {w.text}
              {w.ruling && RulingNoteFor(w.ruling)}
            </li>
          ))}
        </ul>
      )}

      {slots.length > 0 && (
        <StaffSlots
          id={id}
          slots={slots}
          spells={staffSpells().map((s) => ({ key: s.key, name: s.name }))}
          canUse={canUse}
          canVoid={canVoid}
          hasFocus={focus !== null}
        />
      )}
      {slots.some((s) => s.spellName) && (
        <p className="text-xs text-subtle">
          A stored spell stays until it is used, through any amount of rest. If the staff or wand is broken, stolen or dropped, its
          spells are lost; removing it from Gear voids them. {RulingNoteFor("staff-carry-over-rest")}
          {RulingNoteFor("staff-loss")}
        </p>
      )}

      {events.length > 0 && (
        <details className="border-t border-rule pt-3">
          <summary className="cursor-pointer text-sm font-semibold">History · {events.length}</summary>
          <ul className="mt-2 flex flex-col divide-y divide-rule">
            {events.slice(0, 20).map((e, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5 text-sm">
                <span>
                  {VERB[e.action]} {spell(e.spell ?? "")?.name ?? e.spell} · slot {e.slot}
                  <span className="text-subtle"> by {e.actorName ?? "someone"}</span>
                  {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                </span>
                <time className="text-xs text-subtle" dateTime={e.createdAt.toISOString()}>
                  {e.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                </time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
