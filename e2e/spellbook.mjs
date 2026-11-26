// Browser check for the magic-user spellbook (table ruling magic-user-spellbook,
// 25 Nov 2026). Not part of `npm test`.
//
// Runs against a local build with seeded sessions (see CLAUDE.md, "Local
// Postgres for browser testing"): `tok-pat` owns the test character, `tok-sam`
// is a second player who owns none, `tok-jay` is the GM. Never point this at
// production.
//
//   DATABASE_URL=postgres://...local... BASE_URL=http://localhost:3001 \
//   PLAYWRIGHT=/path/to/node_modules/playwright node e2e/spellbook.mjs
//
// Needs a magic-user owned by u-pat with at least one 1st-level slot
// (CHARACTER, default "Test Conjurer"). Resets its spellbook to Sleep and its
// prepared spells to Sleep. If it has an Int bonus and a staff set as the
// focus, also checks that the staff offers only spellbook spells.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const NAME = process.env.CHARACTER ?? "Test Conjurer";
const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("DATABASE_URL must be a local database.");

const sql = postgres(url, { max: 1 });
const [c] = await sql`
  select c.id from characters c join character_classes k on k.character_id = c.id and k.active and k.class = 'magic-user'
  where c.name = ${NAME} and c.owner_id = 'u-pat' and c.deleted_at is null`;
assert.ok(c, `No magic-user named ${NAME} owned by u-pat`);

// Setup: Sleep in the book and prepared.
await sql`update characters set spellbook = ${["mu:sleep"]}, spells_prepared = ${["mu:sleep"]} where id = ${c.id}`;
const book = async () => (await sql`select spellbook from characters where id = ${c.id}`)[0].spellbook;
const prepared = async () => (await sql`select spells_prepared from characters where id = ${c.id}`)[0].spells_prepared;
const audits = async () => (await sql`select actor_id from audit_log where character_id = ${c.id} and action = 'spellbook.changed'`).map((r) => r.actor_id);
const [{ n: rollsBefore }] = await sql`select count(*)::int as n from rolls`;
const auditBefore = (await audits()).length;

const browser = await chromium.launch();
const as = async (token) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "authjs.session-token", value: token, url: BASE }]);
  return ctx.newPage();
};
const spellsPanel = (page) => page.locator("section", { has: page.getByRole("heading", { name: "Spells", exact: true }) }).first();
const options = async (select) => (await select.locator("option").allTextContents()).map((t) => t.trim());

async function waitFor(check, what) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

try {
  // The owner adds Charm Person.
  const pat = await as("tok-pat");
  await pat.goto(`${BASE}/characters/${c.id}`);
  const panel = spellsPanel(pat);
  const sb = panel.getByRole("region", { name: "Spellbook" });
  await sb.getByRole("heading", { name: "Spellbook · 1 spell" }).waitFor();
  await sb.getByRole("button", { name: "Edit spellbook" }).click();
  await sb.getByRole("button", { name: "Charm Person" }).click();
  await sb.getByRole("button", { name: "Charm Person", pressed: true }).waitFor();
  await waitFor(async () => (await book()).includes("mu:charm-person"), "Charm Person in the book");
  await sb.getByRole("button", { name: "Done" }).click();
  await sb.getByRole("heading", { name: "Spellbook · 2 spells" }).waitFor();
  assert.deepEqual(await book(), ["mu:charm-person", "mu:sleep"]);
  console.log("ok: owner added Charm Person; the book is saved in list order");

  // The prepare picker offers only spells in the book.
  await panel.getByRole("button", { name: "Change prepared spells" }).click();
  const first = panel.locator("select[name=slot]").first();
  assert.deepEqual(await options(first), ["Open slot", "Charm Person", "Sleep"]);
  await panel.getByRole("button", { name: "Cancel" }).click();
  console.log("ok: the prepare picker offers only Charm Person and Sleep");

  // Taking out a prepared spell leaves it prepared today, with a note and no warning.
  await sb.getByRole("button", { name: "Edit spellbook" }).click();
  await sb.getByRole("button", { name: "Sleep", pressed: true }).click();
  await sb.getByRole("button", { name: "Sleep", pressed: false }).waitFor();
  await waitFor(async () => !(await book()).includes("mu:sleep"), "Sleep out of the book");
  await sb.getByRole("button", { name: "Done" }).click();
  await pat.reload();
  await panel.getByText("Sleep is prepared but not in the spellbook. It stays today and can't be prepared again.").waitFor();
  assert.equal(await panel.getByText("Saved spells no longer fit").count(), 0, "no warning for a spell taken out of the book");
  assert.deepEqual(await prepared(), ["mu:sleep"]);
  console.log("ok: Sleep left the book but stays prepared, with a note");

  // Preparing again: Sleep can't be picked, and its slot opens.
  await panel.getByRole("button", { name: "Change prepared spells" }).click();
  await panel.getByText("Sleep isn't in the spellbook any more, so its slot opens when you save.").waitFor();
  assert.deepEqual(await options(first), ["Open slot", "Charm Person"]);
  await first.selectOption({ label: "Charm Person" });
  await panel.getByRole("button", { name: "Save prepared spells" }).click();
  await waitFor(async () => (await prepared()).join() === "mu:charm-person", "Charm Person prepared");
  console.log("ok: preparing again offers only the book and saves Charm Person");

  // The staff offers only 1st-level spells in the book.
  const staff = pat.locator("section", { has: pat.getByRole("heading", { name: "Spell staff" }) });
  const load = staff.getByTestId("staff-slot-1").getByRole("button", { name: "Load" });
  if (await load.isVisible()) {
    await load.click();
    assert.deepEqual(await options(staff.locator("select[name=spell]")), ["Choose a spell", "Charm Person"]);
    await staff.getByRole("button", { name: "Cancel" }).click();
    console.log("ok: the staff offers only Charm Person");
  } else {
    console.log("skip: staff slot 1 can't be loaded now (no Int bonus, no focus, or a spell stored)");
  }

  // Another player sees the book read-only.
  const sam = await as("tok-sam");
  await sam.goto(`${BASE}/characters/${c.id}`);
  const samBook = spellsPanel(sam).getByRole("region", { name: "Spellbook" });
  await samBook.getByRole("heading", { name: "Spellbook · 1 spell" }).waitFor();
  await samBook.getByText("Charm Person").waitFor();
  assert.equal(await samBook.getByRole("button").count(), 0, "a non-owner player sees no spellbook buttons");
  console.log("ok: a non-owner player sees the book read-only");

  // Player changes aren't audited; Jay's are.
  assert.equal((await audits()).length, auditBefore, "player spellbook changes write no audit rows");
  const jay = await as("tok-jay");
  await jay.goto(`${BASE}/characters/${c.id}`);
  const jayBook = spellsPanel(jay).getByRole("region", { name: "Spellbook" });
  await jayBook.getByRole("button", { name: "Edit spellbook" }).click();
  await jayBook.getByRole("button", { name: "Web" }).click();
  await waitFor(async () => (await book()).includes("mu:web"), "Web in the book");
  await waitFor(async () => (await audits()).length === auditBefore + 1, "the audit row");
  assert.deepEqual((await audits()).slice(auditBefore), ["u-jay"]);
  console.log("ok: Jay added Web and audit_log has spellbook.changed");

  const [{ n: rollsAfter }] = await sql`select count(*)::int as n from rolls`;
  assert.equal(rollsAfter, rollsBefore, "spellbook changes never write to rolls");
  console.log("ok: rolls unchanged");
} finally {
  await browser.close();
  await sql.end();
}
