import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getCharacter, rulingsByKey, sheetsForCharacter, statOverrides } from "@/lib/queries";
import { ABILITIES, abilityModifier } from "@/lib/rules/abilities";
import { armorClass } from "@/lib/rules/armor";
import { cappedLevelFor } from "@/lib/rules/advancement";
import { CATALOG, catalogItem, classAllows, type Wielder } from "@/lib/rules/equipment";
import { overrideOpen, playStateOpen } from "@/lib/rules/overrides";
import { castsSpells } from "@/lib/rules/spells";
import { staffCapacity } from "@/lib/rules/staff";
import { weaponTable } from "@/lib/rules/weapons";
import { can } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { CombatPanel } from "./CombatPanel";
import { GearPanel, type GearCatalogRow, type GearItem } from "./GearPanel";
import { GmToolsPanel } from "./GmToolsPanel";
import { LevelPanel } from "./LevelPanel";
import { NotesPanel } from "./NotesPanel";
import { CoinsPanel, HitPointsPanel } from "./PlayStatePanels";
import { SheetHeader } from "./SheetHeader";
import {
  AbilitiesPanel,
  ArmorClassPanel,
  EncumbrancePanel,
  ImportFlagsPanel,
  RollsPanel,
  SavingThrowPanel,
  UploadedSheetsPanel,
} from "./SheetPanels";
import { SpellsPanel } from "./SpellsPanel";
import { SpellStaffPanel, STAFF_RULINGS } from "./SpellStaffPanel";

/**
 * The character sheet. Layout, top to bottom:
 * header (with Edit and Approve), the numbers used every round (hit points,
 * armor class, saving throw), then two columns: what the character is and
 * carries on the left, levels, fighting and spells on the right. Records
 * (notes, rolls, uploaded sheet) and GM tools close the page.
 */
export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const c = await getCharacter(id);
  if (!c) notFound();

  const active = c.classes.find((k) => k.active) ?? c.classes[0];
  const lvl = active ? cappedLevelFor(c.race, active.class, active.xp) : null;
  const staff = can.approve(viewer);
  const isOwner = c.ownerId === viewer.userId;
  // Imported characters have no app rolls, so only Jay and admins open the build page for them.
  const imported = c.source !== "app";
  const canBuild = can.editCoreStats(viewer, c) && (!imported || staff);
  // Hit points and coins: the player once approved, Jay and admins once submitted.
  const canPlay = can.editPlayState(viewer, c) && playStateOpen(c.status, staff);
  const canNotes = can.editPlayState(viewer, c);
  const canOverride = can.overrideStats(viewer) && overrideOpen(c.status);

  // The spell staff or wand (WW pp. 5, 7): shown while the character can store
  // spells, has a staff set, or has ever stored one.
  const staffCap = staffCapacity(c.classes.map((k) => k.class), c.race, c.int);
  const showStaff = staffCap > 0 || c.items.some((i) => i.isSpellFocus) || c.staffEvents.length > 0;

  const [sheets, overrides, staffRulings] = await Promise.all([
    staff || isOwner ? sheetsForCharacter(c.id) : [],
    // Who set abilities or maximum hit points by hand. The reason shows to the player and staff.
    c.manualFields.length > 0 ? statOverrides(c.id) : [],
    showStaff ? rulingsByKey(STAFF_RULINGS) : [],
  ]);
  const handSetNote = (fields: readonly string[]) => {
    const o = overrides.find((x) => x.fields.some((f) => fields.includes(f)));
    if (!o) return null;
    return (
      <p className="text-xs text-amber">
        Set by hand by {o.actorName ?? "Jay"} on {o.createdAt.toISOString().slice(0, 10)}
        {(staff || isOwner) && o.reason ? `: ${o.reason}` : "."}
      </p>
    );
  };

  // Class limits on price-list gear (WW p. 9, M&M pp. 6, 8), shown on the item and in the add list.
  const wielder: Wielder | null = active ? { cls: active.class, race: c.race, int: c.int } : null;
  const limitFor = (key: string | null) => {
    const entry = key ? catalogItem(key) : undefined;
    if (!entry || !wielder) return null;
    const allowed = classAllows(wielder, entry);
    return allowed.ok ? null : allowed.why;
  };
  const gearItems: GearItem[] = c.items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    encUnits: i.encUnits,
    isMagic: i.isMagic,
    location: i.location,
    isSpellFocus: i.isSpellFocus === true,
    warn: i.isMagic ? null : limitFor(i.catalogKey),
  }));
  const gearCatalog: GearCatalogRow[] = CATALOG.map((i) => ({
    key: i.key,
    name: i.name,
    category: i.category,
    cost: i.cost,
    enc: i.enc,
    why: limitFor(i.key),
  }));

  // Import flags are for Jay's review: at the top for him and the player while the
  // character waits on him, at the end otherwise.
  const flags = c.importFlags.length > 0 ? <ImportFlagsPanel flags={c.importFlags} /> : null;
  const flagsFirst = c.status === "submitted" && (staff || isOwner);

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-8 sm:py-10">
        <SheetHeader
          c={c}
          lvl={lvl}
          imported={imported}
          canEditPortrait={can.editPortrait(viewer, c)}
          canBuild={canBuild}
          staff={staff}
          showGrants={staff || isOwner}
        />

        {error && (
          <div role="alert" className="rounded-xl border border-[#5c3328] bg-[#2e1a15] px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        {flagsFirst && flags}

        {/* The numbers looked at every round. */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-1 [&>section]:h-full">
            <HitPointsPanel
              id={c.id}
              current={c.hpCurrent}
              max={c.hpMax}
              canEdit={canPlay}
              staff={staff}
              handSet={c.manualFields.includes("hpMax") ? handSetNote(["hpMax"]) : null}
            />
          </div>
          <ArmorClassPanel ac={armorClass(c.items, c.dex, wielder)} />
          <SavingThrowPanel c={c} />
        </div>

        {/* With no class chosen the right column is empty, so the left one spreads out instead. */}
        <div className={`grid items-start gap-5 ${active ? "lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" : ""}`}>
          <div className={active ? "flex min-w-0 flex-col gap-5" : "grid items-start gap-5 md:grid-cols-2"}>
            <AbilitiesPanel c={c} handSet={handSetNote(ABILITIES)} />
            <CoinsPanel id={c.id} gp={c.coinsGp} sp={c.coinsSp} cp={c.coinsCp} canEdit={canPlay} />
            <EncumbrancePanel items={c.items} />
            <GearPanel id={c.id} items={gearItems} catalog={gearCatalog} canEdit={can.editGear(viewer, c)} staff={staff} />
          </div>

          {active && (
            <div className="flex min-w-0 flex-col gap-5">
              {(c.status === "submitted" || c.status === "approved") && (
                <LevelPanel
                  characterId={c.id}
                  race={c.race}
                  alignment={c.alignment}
                  wis={c.wis}
                  classes={c.classes}
                  firstLevelCounted={imported || Boolean(c.hpRollId)}
                  hpMax={c.hpMax}
                  conModifier={c.con === null ? 0 : abilityModifier(c.con)}
                  levelDice={c.levelDice}
                  canRoll={can.editPlayState(viewer, c)}
                  canEditXp={can.editXp(viewer, c)}
                  canDrain={can.drainLevels(viewer)}
                />
              )}
              <CombatPanel
                race={c.race}
                alignment={c.alignment}
                str={c.str}
                dex={c.dex}
                classes={c.classes}
                weapons={weaponTable(c.items, { str: c.str, dex: c.dex, race: c.race, wielder })}
              />
              {lvl && castsSpells(active.class) && (
                <SpellsPanel
                  id={c.id}
                  cls={active.class}
                  level={lvl.level}
                  wis={c.wis}
                  prepared={c.spellsPrepared}
                  canPrepare={can.editSpells(viewer, c)}
                />
              )}
              {showStaff && (
                <SpellStaffPanel
                  id={c.id}
                  capacity={staffCap}
                  int={c.int}
                  isElf={c.race === "elf"}
                  items={c.items}
                  events={c.staffEvents}
                  rulings={staffRulings}
                  canUse={can.useSpellStaff(viewer, c) && playStateOpen(c.status, staff)}
                  canVoid={can.voidStoredSpell(viewer)}
                  canFocus={can.editGear(viewer, c)}
                  staff={staff}
                />
              )}
            </div>
          )}
        </div>

        {(c.notes || canNotes) && <NotesPanel id={c.id} notes={c.notes} canEdit={canNotes} />}
        <RollsPanel c={c} imported={imported} />
        {sheets.length > 0 && <UploadedSheetsPanel sheets={sheets} />}
        {!flagsFirst && flags}
        {staff && <GmToolsPanel c={c} canOverride={canOverride} />}
      </main>
    </>
  );
}
