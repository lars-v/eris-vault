// Browser check for Jay's rulings of 17 Nov 2026. Not part of `npm test`.
//
// Runs against a local build with seeded sessions (see CLAUDE.md, "Local
// Postgres for browser testing"): `tok-pat` owns the test characters, `tok-jay`
// is the GM. Never point this at production.
//
//   DATABASE_URL=postgres://...local... BASE_URL=http://localhost:3001 \
//   PLAYWRIGHT=/path/to/node_modules/playwright node e2e/rulings-17-nov.mjs
//
// Needs, owned by u-pat: an approved cleric "Test Vicar", a submitted halfling
// thief "Raz", and an approved magic-user "Test Conjurer" with Int 15+. Builds
// a new dwarf through the wizard and soft-deletes it at the end.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("DATABASE_URL must be a local database.");

const sql = postgres(url, { max: 1 });
const byName = async (name) => {
  const [c] = await sql`select * from characters where name = ${name} and owner_id = 'u-pat' and deleted_at is null`;
  assert.ok(c, `No character named ${name} owned by u-pat`);
  return c;
};
const vicar = await byName("Test Vicar");
const raz = await byName("Raz");
const conjurer = await byName("Test Conjurer");

const browser = await chromium.launch();
const as = async (token) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "authjs.session-token", value: token, url: BASE }]);
  return ctx.newPage();
};
/** Waits until a query returns a row that passes `ok`. */
const until = async (query, ok, what) => {
  for (let i = 0; i < 50; i++) {
    const [row] = await query();
    if (row && ok(row)) return row;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${what}`);
};
const panel = (page, title) => page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) });

let dwarfId = null;
try {
  const pat = await as("tok-pat");
  const jay = await as("tok-jay");

  // 1. A new dwarf: 5,000 XP (starting-xp) and a logged roll for sight in the dark (dwarf-darkvision).
  await pat.goto(`${BASE}/characters/new`);
  await pat.getByRole("button", { name: "Roll 3d6 six times" }).click();
  await pat.waitForURL(/\/characters\/[0-9a-f-]{36}\/build/);
  dwarfId = pat.url().match(/characters\/([0-9a-f-]{36})/)[1];
  await pat.getByRole("button", { name: "Arrange the sets at random" }).click();
  await pat.getByRole("button", { name: "Save abilities" }).click();
  await until(() => sql`select con from characters where id = ${dwarfId}`, (c) => c.con !== null, "abilities to save");
  await pat.locator("input[name=name]").fill("E2E Dwarf");
  await pat.locator("select[name=race]").selectOption("dwarf");
  await pat.locator("select[name=cls]").selectOption("fighting-man");
  await pat.locator("select[name=alignment]").selectOption("lawful");
  await pat.getByRole("button", { name: "Save", exact: true }).click();
  const k = await until(() => sql`select xp from character_classes where character_id = ${dwarfId}`, () => true, "the class to save");
  assert.equal(k.xp, 5000, "new characters start at 5,000 XP");
  await pat.getByText("A dwarf also rolls 1d6 for sight in the dark").waitFor();
  await pat.getByRole("button", { name: "Roll hit points" }).click();
  await pat.getByText(/^Sight in the dark: /).first().waitFor();
  const [d] = await sql`select dark_sight, dark_sight_roll_id from characters where id = ${dwarfId}`;
  assert.ok(d.dark_sight_roll_id, "the dark sight roll is recorded");
  const [r] = await sql`select purpose, totals from rolls where id = ${d.dark_sight_roll_id}`;
  assert.equal(r.purpose, "dark-sight");
  assert.equal(d.dark_sight, r.totals[0] <= 2, "a 1 or 2 sees in the dark");
  await pat.getByRole("button", { name: "Roll starting gold" }).click();
  await until(() => sql`select gold_roll_id from characters where id = ${dwarfId}`, (c) => c.gold_roll_id, "the gold roll");
  await pat.getByRole("button", { name: "Send to Jay for approval" }).click();
  await pat.waitForURL(new RegExp(`/characters/${dwarfId}$`));

  // Jay rolls 2nd level: current hit points rise with the maximum (level-hp-current).
  await jay.goto(`${BASE}/characters/${dwarfId}`);
  await jay.getByText("2nd to 3rd level reached").waitFor();
  const [before] = await sql`select hp_max, hp_current from characters where id = ${dwarfId}`;
  await jay.getByRole("button", { name: "Roll hit points for 2nd level" }).click();
  await jay.getByRole("button", { name: "Roll hit points for 3rd level" }).waitFor();
  const [after] = await sql`select hp_max, hp_current from characters where id = ${dwarfId}`;
  const [die] = await sql`select gain from hit_dice where character_id = ${dwarfId} and level = 2`;
  assert.ok(die.gain >= 1, "every hit die adds at least 1 (hit-die-floor)");
  assert.equal(after.hp_max, before.hp_max + die.gain);
  assert.equal(after.hp_current, before.hp_current + die.gain);

  // One level per award (one-level-per-adventure): 3rd-level fighter at 5,000; 16,000 would be 5th.
  const xpBox = panel(jay, "Levels and hit points").getByRole("spinbutton", { name: "XP" });
  await xpBox.fill("16000");
  await jay.getByText("No single award gains more than one level").waitFor();
  assert.equal(await panel(jay, "Levels and hit points").getByRole("button", { name: "Save" }).count(), 0);
  console.log("ok: new dwarf, starting XP, dark sight, level hit points, one level per award");

  // 2. Ashan's +1 to turning (ashan-patronage) and 0 hit points (hp-below-zero) on Test Vicar (5th level).
  await sql`update characters set deity = 'Ashan', hp_current = -5 where id = ${vicar.id}`;
  await jay.goto(`${BASE}/characters/${vicar.id}`);
  await jay.getByText("Ashan's patronage adds +1 to every turning roll").waitFor();
  await jay.getByText("Unconscious. Loses 1 hit point a round").waitFor();
  await sql`update characters set hp_current = -6 where id = ${vicar.id}`;
  await jay.reload();
  await jay.getByText("Dead: below −5").waitFor();
  console.log("ok: Ashan, unconscious and dead");

  // 3. Saving throw bonuses add together (save-bonus-stacking): halfling thief +2 and +1.
  await jay.goto(`${BASE}/characters/${raz.id}`);
  const saves = panel(jay, "Saving throw");
  await saves.getByText("Class and race bonuses add together").waitFor();
  assert.match(await saves.innerText(), /Together: \+3 vs death, \+3 vs poison/);
  console.log("ok: save bonuses add together");

  // 4. Anyone may carry anything (carry-unusable-gear); clerics don't use edged weapons.
  await pat.goto(`${BASE}/characters/${vicar.id}`);
  await pat.getByRole("button", { name: "Edit gear" }).click();
  const sword = pat.locator("option[value=long-sword]");
  assert.equal(await sword.isDisabled(), false, "a cleric can add a long sword");
  assert.match(await sword.innerText(), /can carry, can't use/);
  console.log("ok: carry anything");

  // 5. A spell stored in a staff is lost when the staff leaves the gear (staff-loss).
  const [staff] = await sql`
    insert into inventory (character_id, name, kind, quantity, enc_units, catalog_key)
    values (${conjurer.id}, 'E2E Staff', 'Weapon', 1, 3, 'staff') returning id`;
  await sql`insert into stored_spell_events (character_id, inventory_id, slot, spell, action, actor_id)
    values (${conjurer.id}, ${staff.id}, 1, 'mu:sleep', 'load', 'u-pat')`;
  await pat.goto(`${BASE}/characters/${conjurer.id}`);
  await pat.getByRole("button", { name: "Edit gear" }).click();
  await pat.getByRole("button", { name: "Remove E2E Staff" }).click();
  await pat.getByRole("button", { name: "Remove E2E Staff" }).waitFor({ state: "detached" });
  const [last] = await sql`select action, note from stored_spell_events where character_id = ${conjurer.id} and slot = 1 order by created_at desc limit 1`;
  assert.equal(last.action, "void");
  assert.match(last.note, /staff-loss/);
  console.log("ok: stored spell lost with the staff");
} finally {
  await sql`update characters set deity = ${vicar.deity}, hp_current = ${vicar.hp_current} where id = ${vicar.id}`;
  if (dwarfId) await sql`update characters set deleted_at = now() where id = ${dwarfId}`;
  await browser.close();
  await sql.end();
}
