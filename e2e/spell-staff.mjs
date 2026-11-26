// Browser check for the spell staff (WW pp. 5, 7). Not part of `npm test`.
//
// Runs against a local build with seeded sessions (see CLAUDE.md, "Local
// Postgres for browser testing"): `tok-pat` owns the test characters, `tok-sam`
// is a second player who owns none. Never point this at production.
//
//   DATABASE_URL=postgres://...local... BASE_URL=http://localhost:3001 \
//   PLAYWRIGHT=/path/to/node_modules/playwright node e2e/spell-staff.mjs
//
// Needs an approved magic-user owned by u-pat with Int 15+ (CHARACTER, default
// "Test Conjurer"). Adds a price-list staff to it if it has none.
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
const [c] = await sql`select id, int, status from characters where name = ${NAME} and owner_id = 'u-pat' and deleted_at is null`;
assert.ok(c, `No character named ${NAME} owned by u-pat`);
assert.ok(c.int >= 15 && c.status === "approved", `${NAME} must be approved with Int 15+`);

// Setup: a price-list staff in the gear, and no spell stored.
const staffs = await sql`select id from inventory where character_id = ${c.id} and catalog_key = 'staff'`;
if (staffs.length === 0) {
  await sql`insert into inventory (character_id, name, kind, quantity, enc_units, catalog_key) values (${c.id}, 'Staff', 'Weapon', 1, 3, 'staff')`;
}
// Only spells in the spellbook can be cast on the staff (ruling magic-user-spellbook).
await sql`update characters set spellbook = array_append(spellbook, 'mu:sleep') where id = ${c.id} and not ('mu:sleep' = any(spellbook))`;
const latest = await sql`
  select distinct on (slot) slot, action from stored_spell_events
  where character_id = ${c.id} order by slot, created_at desc`;
assert.ok(latest.every((e) => e.action !== "load"), "Release any stored spell on the test character first.");
const [{ n: rollsBefore }] = await sql`select count(*)::int as n from rolls`;
const [{ n: auditBefore }] = await sql`select count(*)::int as n from audit_log where character_id = ${c.id} and action like 'staff.%'`;

const browser = await chromium.launch();
const as = async (token) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "authjs.session-token", value: token, url: BASE }]);
  return ctx.newPage();
};

try {
  // The owner sets the staff, loads Sleep, sees it, releases it.
  const pat = await as("tok-pat");
  await pat.goto(`${BASE}/characters/${c.id}`);
  const card = pat.locator("section", { has: pat.getByRole("heading", { name: "Spell staff" }) });
  await card.waitFor();
  const slot1 = card.getByTestId("staff-slot-1");
  if (await card.getByRole("button", { name: "Set as spell focus" }).isVisible()) {
    await card.getByRole("button", { name: "Set as spell focus" }).click();
    await card.locator("select[name=itemId]").selectOption({ label: "Staff" });
    await card.getByRole("button", { name: "Save" }).click();
    await card.getByText("Change staff or wand").waitFor();
  }
  await slot1.getByText("Empty: recast to load").waitFor();

  await slot1.getByRole("button", { name: "Load" }).click();
  await slot1.getByText("Loading uses one of the day's castings").waitFor();
  await slot1.locator("select[name=spell]").selectOption({ label: "Sleep" });
  await slot1.getByRole("button", { name: "Cast on the staff" }).click();
  await slot1.getByText("Sleep", { exact: true }).waitFor();
  console.log("ok: owner loaded Sleep and sees the token");

  await pat.goto(`${BASE}/party`);
  await pat.getByText("Staff: Sleep ready").first().waitFor();
  console.log("ok: party page shows Staff: Sleep ready");

  // A different player sees the card read-only.
  const sam = await as("tok-sam");
  await sam.goto(`${BASE}/characters/${c.id}`);
  const samCard = sam.locator("section", { has: sam.getByRole("heading", { name: "Spell staff" }) });
  await samCard.getByTestId("staff-slot-1").getByText("Sleep", { exact: true }).waitFor();
  assert.equal(await samCard.getByRole("button").count(), 0, "a non-owner player sees no buttons on the card");
  console.log("ok: a non-owner player sees the card read-only");

  await pat.goto(`${BASE}/characters/${c.id}`);
  await slot1.getByRole("button", { name: "Release" }).click();
  await slot1.getByText("Release Sleep?").waitFor();
  await slot1.getByRole("button", { name: "Yes, release Sleep" }).click();
  await slot1.getByText("Empty: recast to load").waitFor();
  console.log("ok: owner released Sleep and the slot shows empty");

  await pat.goto(`${BASE}/party`);
  await pat.getByText("Staff: empty").first().waitFor();
  console.log("ok: party page shows Staff: empty");

  const [{ n: rollsAfter }] = await sql`select count(*)::int as n from rolls`;
  assert.equal(rollsAfter, rollsBefore, "loading and releasing never write to rolls");
  const audits = await sql`select action from audit_log where character_id = ${c.id} and action like 'staff.%' order by created_at`;
  const added = audits.slice(auditBefore).map((a) => a.action);
  assert.ok(added.includes("staff.load") && added.includes("staff.release"), `audit_log has load and release (got ${added.join(", ")})`);
  console.log(`ok: audit_log has ${added.join(", ")}; rolls unchanged`);
} finally {
  await browser.close();
  await sql.end();
}
