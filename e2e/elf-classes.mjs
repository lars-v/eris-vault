// Browser check for an elf's two classes (WW p. 10; Jay's ruling
// elf-second-class-hp; table decision elf-starting-xp) and the race panel.
// Not part of `npm test`.
//
// Runs against a local server with seeded sessions (see CLAUDE.md, "Local
// Postgres for browser testing"): `tok-pat` is a player, `tok-jay` the GM.
// Never point this at production.
//
//   DATABASE_URL=postgres://...local... BASE_URL=http://localhost:3000 NO_HMR=1 \
//   PLAYWRIGHT=/path/to/node_modules/playwright node e2e/elf-classes.mjs
//
// 1. Pat builds a new elf: begins as a fighting-man, shares 5,000 XP as
//    2,000 / 3,000, rolls hit points for both classes, sends it to Jay.
// 2. Jay approves it. Pat rolls 2nd-level hit points for the magic-user,
//    switches to magic-user, takes 1 damage, and switches back.
// 3. Jay gives an elf made before this change (OLD_ELF, default "Sparnus of
//    Fezoor", submitted, with fighting-man hit dice rolled) its magic-user
//    record: XP can't drop below a rolled level, then the record is added and
//    its hit points rolled. Skipped if that elf already has both records.
// 4. A halfling's sheet shows its race panel; a human's has none.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OLD_ELF = process.env.OLD_ELF ?? "Sparnus of Fezoor";
const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("DATABASE_URL must be a local database.");

const sql = postgres(url, { max: 1 });
// The build guide opens by itself for a new draft; mark it seen so it doesn't cover the page.
await sql`update profiles set guides_seen = array_append(guides_seen, 'build') where user_id = 'u-pat' and not ('build' = any(guides_seen))`;

const classes = (id) => sql`select id, class, xp, active, hp_max, hp_current, hp_roll_id from character_classes where character_id = ${id} order by class`;
const copy = async (id) => (await sql`select hp_max, hp_current from characters where id = ${id}`)[0];
/** Polls the database until `check` passes, for changes a server action makes after a click. */
async function until(what, check) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for: ${what}`);
}

const browser = await chromium.launch();
const as = async (token) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "authjs.session-token", value: token, url: BASE }]);
  // Next dev reloads headless pages on every rebuild message; keep the socket, drop those.
  if (process.env.NO_HMR) {
    await ctx.routeWebSocket(/\/_next\/(webpack-)?hmr/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => !/"(action|type)":"(building|turbopack-message)"/.test(String(m)) && ws.send(m));
      ws.onMessage((m) => server.send(m));
    });
  }
  return ctx.newPage();
};
const section = (page, title) => page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) });

try {
  const pat = await as("tok-pat");
  const jay = await as("tok-jay");

  /* ---------- 1. A new elf ---------- */
  await pat.goto(`${BASE}/characters/new`);
  await pat.getByRole("button", { name: "Roll 3d6 six times" }).click();
  await pat.waitForURL(/\/characters\/[0-9a-f-]{36}\/build/);
  const id = pat.url().match(/characters\/([0-9a-f-]{36})/)[1];

  await pat.getByRole("button", { name: "Arrange the sets at random" }).click();
  await pat.getByRole("button", { name: "Save abilities" }).click();
  await pat.getByRole("button", { name: "Saved" }).first().waitFor();

  const identity = pat.locator("form", { has: pat.locator("input[name=name]") });
  await identity.locator("input[name=name]").fill(`E2E Elf ${Date.now() % 100000}`);
  await identity.locator("select[name=race]").selectOption("elf");
  await identity.getByText("Begins as").waitFor();
  await identity.locator("select[name=cls]").selectOption("fighting-man");
  await identity.locator("select[name=alignment]").selectOption("neutral");
  await identity.getByText("XP for each class: 5,000 to share").waitFor();
  await identity.locator('input[name="xp:fighting-man"]').fill("2000");
  assert.equal(await identity.locator('input[name="xp:magic-user"]').inputValue(), "3000", "typing one class's XP fills in the other");
  await identity.getByText("2nd level, Warrior").waitFor();
  await identity.getByText("2nd level, Seer").waitFor();
  await identity.getByRole("button", { name: "Save", exact: true }).click();
  await identity.getByRole("button", { name: "Saved" }).waitFor();
  let rows = await classes(id);
  assert.deepEqual(
    rows.map((k) => [k.class, k.xp, k.active]),
    [
      ["fighting-man", 2000, true],
      ["magic-user", 3000, false],
    ],
  );
  console.log("ok: a new elf keeps both classes with the XP shared 2,000 / 3,000");

  await pat.getByRole("button", { name: "Roll hit points for both" }).click();
  await pat.getByText(/Magic-User: 1d6 − 1/).waitFor();
  rows = await classes(id);
  assert.ok(rows.every((k) => k.hp_max >= 3 && k.hp_current === k.hp_max && k.hp_roll_id), "each class rolled its own 1st-level hit points");
  const fm = rows.find((k) => k.class === "fighting-man");
  const mu = rows.find((k) => k.class === "magic-user");
  assert.equal((await copy(id)).hp_max, fm.hp_max, "the character shows the fighting-man's hit points");
  const [{ n: hpRolls }] = await sql`select count(*)::int as n from rolls where character_id = ${id} and purpose = 'hp'`;
  assert.equal(hpRolls, 2, "one logged roll per class");
  console.log(`ok: hit points rolled for each class (fighting-man ${fm.hp_max}, magic-user ${mu.hp_max})`);

  await pat.getByRole("button", { name: "Roll starting gold" }).click();
  await pat.getByRole("button", { name: "Send to Jay for approval" }).waitFor();
  await pat.getByRole("button", { name: "Send to Jay for approval" }).click();
  await pat.waitForURL(new RegExp(`/characters/${id}$`));

  /* ---------- 2. Approved: level, switch, damage ---------- */
  await jay.goto(`${BASE}/characters/${id}`);
  await jay.getByRole("button", { name: "Approve" }).click();
  await jay.getByText("Approved").first().waitFor();

  await pat.goto(`${BASE}/characters/${id}`);
  await pat.getByText("Elf, playing as Fighting-Man").waitFor();
  const hpPanel = section(pat, "Hit points");
  await hpPanel.getByText("Fighting-Man's hit points.").waitFor();
  await hpPanel.locator("li", { hasText: "Magic-User:" }).getByText(`${mu.hp_max} / ${mu.hp_max}`).waitFor();
  await section(pat, "Elf").getByText(/secret doors and passages on 1-4 in 6/).waitFor();
  console.log("ok: sheet shows the class played, the other class's hit points, and the race panel");

  const levels = section(pat, "Levels and hit points");
  const muBlock = levels.locator("div", { has: pat.getByRole("heading", { name: /^Magic-User/ }) }).last();
  await muBlock.getByRole("button", { name: "Roll hit points for 2nd level" }).click();
  await until("the magic-user's 2nd-level die", async () => (await sql`select 1 from hit_dice where character_id = ${id} and class = 'magic-user' and level = 2`).length === 1);
  await muBlock.getByText("2nd level", { exact: true }).waitFor();
  rows = await classes(id);
  const muAfter = rows.find((k) => k.class === "magic-user");
  assert.ok(muAfter.hp_max > mu.hp_max, "the magic-user's maximum grew");
  assert.equal(rows.find((k) => k.class === "fighting-man").hp_max, fm.hp_max, "the fighting-man's stayed");
  assert.equal((await copy(id)).hp_max, fm.hp_max, "the character still shows the fighting-man's");
  console.log("ok: a level's hit die goes to that class only");

  await pat.getByRole("button", { name: "Switch to Magic-User" }).click();
  await pat.getByText("Elf, playing as Magic-User").waitFor();
  await hpPanel.getByText("Magic-User's hit points.").waitFor();
  assert.deepEqual(await copy(id), { hp_max: muAfter.hp_max, hp_current: muAfter.hp_current });
  await section(pat, "Spells").waitFor();
  const [audit] = await sql`select before, after from audit_log where character_id = ${id} and action = 'character.class_switched' order by created_at desc limit 1`;
  assert.deepEqual([audit.before.class, audit.after.class], ["fighting-man", "magic-user"], "the switch is in Jay's log");
  console.log("ok: switching shows the magic-user's own hit points and spells, and is audited");

  await hpPanel.getByRole("button", { name: "Take 1 damage" }).click();
  await until("1 damage on the magic-user", async () => (await classes(id)).find((k) => k.class === "magic-user").hp_current === muAfter.hp_current - 1);
  rows = await classes(id);
  assert.equal(rows.find((k) => k.class === "magic-user").hp_current, muAfter.hp_current - 1, "damage goes to the class played");
  assert.equal(rows.find((k) => k.class === "fighting-man").hp_current, fm.hp_max, "the other class keeps its own");

  await pat.getByRole("button", { name: "Switch to Fighting-Man" }).click();
  await pat.getByText("Elf, playing as Fighting-Man").waitFor();
  assert.deepEqual(await copy(id), { hp_max: fm.hp_max, hp_current: fm.hp_max });
  console.log("ok: damage stays with the magic-user; switching back shows the fighting-man's own");

  /* ---------- 3. An elf made before both records ---------- */
  const [old] = await sql`select id, status from characters where name = ${OLD_ELF} and race = 'elf' and deleted_at is null`;
  if (!old) {
    console.log(`skip: no elf named ${OLD_ELF}`);
  } else if ((await classes(old.id)).length > 1) {
    console.log(`skip: ${OLD_ELF} already has both records`);
  } else {
    const [k] = await classes(old.id);
    const [{ top }] = await sql`select max(level)::int as top from hit_dice where character_id = ${old.id} and class = ${k.class} and lost_at is null`;
    await jay.goto(`${BASE}/characters/${old.id}/build`);
    await jay.getByText("This elf has a record for one class only").waitFor();
    const form = jay.locator("form", { has: jay.locator("input[name=name]") });
    const other = k.class === "fighting-man" ? "magic-user" : "fighting-man";
    assert.equal(await form.locator(`input[name="xp:${k.class}"]`).inputValue(), String(k.xp));
    assert.equal(await form.locator(`input[name="xp:${other}"]`).inputValue(), "0");
    if (top) {
      await form.locator(`input[name="xp:${other}"]`).fill(String(k.xp));
      await form.getByRole("button", { name: "Save", exact: true }).click();
      await jay.getByRole("alert").getByText(`already has hit points for level ${top}`).waitFor();
      console.log(`ok: XP can't move below the ${k.class}'s rolled level ${top}`);
      await jay.goto(`${BASE}/characters/${old.id}/build`);
    }
    await form.locator(`input[name="xp:${other}"]`).fill("0");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await jay.getByRole("button", { name: "Roll hit points" }).waitFor();
    await jay.getByRole("button", { name: "Roll hit points" }).click();
    await jay.getByText(new RegExp(`${other === "magic-user" ? "Magic-User" : "Fighting-Man"}: 1d6`)).waitFor();
    const after = await classes(old.id);
    assert.equal(after.length, 2);
    assert.ok(after.every((r) => r.hp_max !== null), "both records have hit points");
    assert.equal(after.find((r) => r.class === k.class).hp_max, k.hp_max, "the first class keeps its hit points");
    console.log(`ok: ${OLD_ELF} got its ${other} record and rolled its hit points`);
  }

  /* ---------- 4. Race panels ---------- */
  const [halfling] = await sql`select id from characters where race = 'halfling' and deleted_at is null limit 1`;
  if (halfling) {
    await jay.goto(`${BASE}/characters/${halfling.id}`);
    await section(jay, "Halfling").getByText(/One class for good/).waitFor();
    console.log("ok: a halfling's sheet shows its race panel");
  }
  const [human] = await sql`select id from characters where race = 'human' and deleted_at is null limit 1`;
  if (human) {
    await jay.goto(`${BASE}/characters/${human.id}`);
    await section(jay, "Abilities").waitFor();
    assert.equal(await section(jay, "Human").count(), 0, "humans have no race panel");
    console.log("ok: a human's sheet has no race panel");
  }
  console.log("all elf checks passed");
} finally {
  await browser.close();
  await sql.end();
}
