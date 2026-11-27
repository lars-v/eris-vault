import Link from "next/link";
import { Portrait } from "@/components/Portrait";
import { Chip } from "@/components/ui";
import { CLASS_NAMES, noNextLevelText, type cappedLevelFor } from "@/lib/rules/advancement";
import { approveCharacter, switchClass } from "../actions";
import { SubmitButton } from "./build/forms";
import { PortraitEditor } from "./PortraitEditor";
import type { CharacterSheet } from "./SheetPanels";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Level = ReturnType<typeof cappedLevelFor>;

/** The portrait medallion: a file picker for whoever may change it, else a link to the full picture. */
function Medallion({ c, canEdit }: { c: CharacterSheet; canEdit: boolean }) {
  if (canEdit) {
    // Clicking the medallion opens the same file picker as the buttons in PortraitEditor.
    return (
      <label
        htmlFor={`portrait-${c.id}`}
        title={c.portrait ? "Change picture" : "Add a picture"}
        className="group relative flex-none cursor-pointer rounded-[50%] transition hover:ring-2 hover:ring-lime/50 hover:brightness-110"
      >
        <Portrait name={c.name} src={c.portrait} size="sheet" />
        {/* No picture yet: a "+" over the initials on hover says one can be added. */}
        {!c.portrait && (
          <span
            aria-hidden="true"
            className="absolute inset-0.5 flex items-center justify-center rounded-[50%] bg-ink font-display text-4xl text-lime opacity-0 transition-opacity group-hover:opacity-100 sm:text-6xl"
          >
            +
          </span>
        )}
      </label>
    );
  }
  if (c.portrait) {
    return (
      <a href={c.portrait} target="_blank" rel="noopener" title="Open the full picture" className="flex-none rounded-[50%]">
        <Portrait name={c.name} src={c.portrait} size="sheet" />
      </a>
    );
  }
  return <Portrait name={c.name} src={null} size="sheet" />;
}

/** XP toward the next level (WW pp. 7-10). */
function XpBar({ c, xp, lvl, cls }: { c: CharacterSheet; xp: number; lvl: Level; cls: keyof typeof CLASS_NAMES }) {
  const pct = lvl.nextXp ? Math.round(((xp - lvl.startXp) / (lvl.nextXp - lvl.startXp)) * 100) : 100;
  return (
    <div className="mt-1 flex max-w-130 flex-col gap-1.5">
      <div className="flex flex-wrap justify-between gap-x-3 text-[13px]">
        <span className="text-muted">{xp.toLocaleString("en-US")} XP</span>
        <span className="text-subtle">
          {lvl.nextTitle && lvl.nextXp ? `${lvl.nextTitle} at ${lvl.nextXp.toLocaleString("en-US")}` : noNextLevelText(c.race, cls)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-rule">
        <div className="h-full bg-lime" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

/**
 * Top of the sheet: portrait, name, who and what the character is, XP, and
 * the two actions people come for (open the build page, approve).
 */
export function SheetHeader({
  c,
  lvl,
  imported,
  canEditPortrait,
  canBuild,
  staff,
  showGrants,
  canSwitch,
}: {
  c: CharacterSheet;
  lvl: Level | null;
  imported: boolean;
  canEditPortrait: boolean;
  canBuild: boolean;
  staff: boolean;
  /** Whether to show the "re-rolls waiting" chip (the player and staff). */
  showGrants: boolean;
  /** An elf may switch class now: the player once approved, Jay and admins once submitted (WW p. 10). */
  canSwitch: boolean;
}) {
  const active = c.classes.find((k) => k.active) ?? c.classes[0];
  // The elf's other class, once its hit points are rolled (Jay's ruling elf-second-class-hp).
  const switchTo = canSwitch && c.race === "elf" ? c.classes.find((k) => !k.active && k.hpMax !== null) : undefined;
  return (
    <header className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-surface p-5 sm:gap-6 sm:p-6">
      <Medallion c={c} canEdit={canEditPortrait} />
      <div className="flex min-w-0 flex-[999_1_12rem] flex-col gap-2 sm:basis-95">
        <h1 className="font-display text-4xl leading-none text-parchment-2 sm:text-5xl">{c.name}</h1>
        <div className="text-lede">
          {c.race ? cap(c.race) : "Race not chosen"}
          {active ? (c.classes.length > 1 ? `, playing as ${CLASS_NAMES[active.class]}` : ` ${CLASS_NAMES[active.class]}`) : ""}
          {c.alignment ? ` · ${cap(c.alignment)}` : ""}
          {c.deity ? ` · Patron: ${c.deity}` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lvl && (
            <Chip tone="lime">
              Level {lvl.level}
              {lvl.pastTen ? "+" : ""} · {lvl.title}
            </Chip>
          )}
          {c.status === "submitted" ? (
            <Chip tone="amber">Awaiting Jay</Chip>
          ) : c.status === "approved" ? (
            <Chip tone="lime">Approved</Chip>
          ) : (
            <Chip>{cap(c.status)}</Chip>
          )}
          {imported && <Chip tone="moon">From a sheet</Chip>}
          {showGrants && c.grants.length > 0 && (
            <Chip tone="amber">
              {c.grants.length} re-roll{c.grants.length === 1 ? "" : "s"} waiting
            </Chip>
          )}
          <span className="text-sm text-subtle">Player: {c.ownerName ?? "unknown"}</span>
        </div>
        {lvl && active && <XpBar c={c} xp={active.xp} lvl={lvl} cls={active.class} />}
        {canEditPortrait && <PortraitEditor id={c.id} name={c.name} hasPortrait={c.portrait !== null} />}
      </div>
      {(canBuild || (staff && c.status === "submitted") || switchTo) && (
        <div className="flex flex-wrap gap-2">
          {switchTo && (
            <form action={switchClass}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="classId" value={switchTo.id} />
              <SubmitButton tone="plain" pendingText="Switching…">
                Switch to {CLASS_NAMES[switchTo.class]}
              </SubmitButton>
            </form>
          )}
          {canBuild && (
            <Link
              href={`/characters/${c.id}/build`}
              className="inline-flex min-h-11 items-center rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110"
            >
              {c.status === "draft" ? "Continue building" : staff ? "Edit as GM" : "Make changes"}
            </Link>
          )}
          {staff && c.status === "submitted" && (
            <form action={approveCharacter}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton tone="amber" pendingText="Approving…">
                Approve
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </header>
  );
}
