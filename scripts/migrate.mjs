// Runs database migrations, then seeds the rulings ledger (idempotent).
// Called by `npm start` before the server boots, so every Railway deploy
// brings the database up to date.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const RULINGS = [
  // Decided campaign rulings already on file.
  ["magic-gear-encumbrance", "Does magic gear count toward encumbrance?", "Campaign ruling (overrides Woundwort's Warren p. 16)", "No. Magic gear counts as 0 units.", "decided"],
  ["one-ability-set", "Can a player throw away a set of ability rolls and roll again?", "WW p. 5 silent; table decision (Lars), 1 Nov 2026", "No. One set per character, kept in the public roll log. Only the GM or admin can grant a re-roll.", "decided"],
  ["cleric-all-spells", "Which cleric spells does a cleric have?", "Table decision (Lars), 16 Nov 2026; overrides WW p. 25 (prayer scrolls from the church one level at a time)", "Every spell on the cleric list. Spells per day still follow WW pp. 5 and 8.", "decided"],
  ["magic-user-all-spells", "Which magic-user spells does a magic-user (or an elf casting as one) have?", "Table decision (Lars), 16 Nov 2026; overrides WW p. 25 (spellbooks bought one level at a time) and WW p. 10 (an elf's mental book grown by study)", "Every spell on the magic-user list. Spells per day still follow WW p. 7.", "decided"],
  ["starting-gold", "Is 3d6 x 10 gp a shopping budget or what is left after gear?", "Men & Magic p. 10; campaign ruling", "It is what remains after buying starting gear.", "decided"],
  // Open questions where the books are silent, optional or ambiguous.
  ["hit-die-floor", "Can a hit die total fall below 1 after 1st level?", "WW p. 6 silent; M&M p. 11 sets 1 for its own Con rule", null, "pending"],
  ["low-int-literacy", "Int 4 to 6: limit reading and writing?", "WW p. 11 (referee may)", null, "pending"],
  ["dwarf-darkvision", "Does a player dwarf have the 2 in 6 latent sight in the dark?", "WW p. 10 (referee's discretion)", null, "pending"],
  ["save-bonus-stacking", "Do class and race saving throw bonuses add together?", "WW p. 23 silent", null, "pending"],
  ["wis-vs-mind", "Apply the Wisdom modifier to saves vs charms and illusions?", "WW p. 5 (referee's discretion)", null, "pending"],
  ["survive-adversity", "Exact odds to survive adversity for each Constitution band", "M&M p. 11, via WW p. 5", null, "pending"],
  ["cleric-l1-scroll", "1st-level cleric with Wis 15+: prayer scroll of one or two spells?", "WW p. 25", null, "pending"],
  ["cleric-edged-weapons", "May clerics use ordinary edged weapons?", "M&M p. 7; WW silent", null, "pending"],
  ["ashan-patronage", "What does Ashan's patronage grant Liz?", "Campaign note", null, "pending"],
  ["elf-second-class-hp", "An elf keeps separate hit points per class (WW p. 10). When are hit points for the second class rolled?", "WW p. 10", null, "pending"],
  ["name-level-xp", "What does '+100,000' mean for 10th level XP?", "WW pp. 7 to 9", null, "pending"],
  ["level-hp-current", "When a character gains a level, does the new hit die raise current hit points as well as the maximum?", "WW p. 6 silent", null, "pending"],
  ["prepare-same-spell", "May a caster prepare the same spell in more than one slot?", "WW pp. 7, 8, 25 silent", null, "pending"],
  ["cleric-wis-penalty", "Does a Wisdom penalty (Wis 3 to 6) take 1st-level spells away from a cleric?", "WW p. 5 names only bonuses", null, "pending"],
  ["carry-unusable-gear", "May a character carry gear the class can't use (a magic-user carrying a sword as loot, a thief carrying plate mail)? Until then, players can't add it from the price list; Jay can, and the sheet flags it.", "M&M p. 6 and WW p. 9 say what a class may arm itself with, not what it may carry", null, "pending"],
  ["con-change-hp", "If Jay changes Constitution after hit points are rolled, does maximum hit points change with the new modifier? Until then, maximum hit points stay as they are.", "WW pp. 5-6 silent", null, "pending"],
  ["ability-range", "Can an ability score go below 3 or above 18 (for example through magic)? Until then, hand-set scores stay within 3 to 18.", "WW p. 5 (3d6) silent", null, "pending"],
  ["hp-below-zero", "What happens to a character at 0 hit points or below? Until then, the sheet only shows the number.", "WW silent; M&M silent", null, "pending"],
  ["cleric-l1-scroll-spells", "Who picks the spells on a 1st-level cleric's limited prayer scroll: the player, or Jay?", "WW p. 25", null, "pending"],
  ["mu-combat-rows", "The Character Combat Matrix lists magic-user levels 4-6 in one row and 5-9 in the next. Does a 5th or 6th level magic-user use the second row or the third? WW p. 19 says magic-users improve every 3 levels. Until then, the sheet shows both rows.", "WW pp. 19-20", null, "pending"],
  ["neutral-cleric-fourth", "A neutral cleric must choose Law or Chaos before advancing to 4th level 'under most circumstances'. Should the vault stop a neutral cleric's 4th-level hit die roll until the alignment changes? Until then, the sheet warns but does not stop it.", "WW p. 8", null, "pending"],
  ["drain-xp", "When a Wight, Wraith, Spectre or Vampire drains a level, what XP does the character keep? Until then, Jay enters the new XP each time.", "M&T p. 9 says a hit removes the level and its hit die, not what XP is left; WW silent", null, "pending"],
  ["drain-hp-current", "When a level drain lowers maximum hit points, do current hit points drop too? Until then, current hit points stay as they are.", "M&T p. 9 silent", null, "pending"],
  ["regain-drained-level", "When a drained character earns a lost level back, is a new hit die rolled for it? Until then, yes, like any new level.", "M&T p. 9 silent; WW p. 6", null, "pending"],
  ["large-shield-ac", "WW p. 17 sells a large shield (15 gp) but the Armor Class Table names only 'Shield'. Is a large shield better than a shield? Until then, it counts as a shield.", "WW p. 17", null, "pending"],
  ["magic-armor-ac", "Does magic armor lower the armor class number? M&T p. 30 says its bonus comes off the attacker's roll instead. On the WW to-hit tables that is the same as a better AC except where 20 is needed. Until then, the sheet shows the book AC and, beside it, the AC with the armor's bonus in. A magic shield's bonus is never folded in, since it counts one blow in three.", "M&T p. 30; WW pp. 17, 19-20 silent on magic armor", null, "pending"],
  ["dart-long-range", "WW p. 19 prints dart ranges as short 1-15, medium 16-30, long 21-45, so long overlaps medium. Is long range 31-45? Until then, the sheet shows the ranges as printed.", "WW p. 19", null, "pending"],
  ["sling-long-range", "WW p. 19 prints sling ranges as short 1-40, medium 41-80, long 80-160, so 80 feet is in both medium and long. Is long range 81-160? Until then, the sheet shows the ranges as printed.", "WW p. 19", null, "pending"],
  ["one-level-per-adventure", "Men & Magic recommends that no single adventure awards more XP than it takes to gain one level. Does the table use this? Until then, the award form warns when an award gains more than one level, but allows it.", "M&M p. 18", null, "pending"],
  ["starting-magic-items", "Does a new character start with magic items (for example two)? If so, how many, and does the player choose them or does Jay? Until then, new characters start with none and only Jay can add one.", "WW silent (p. 33 covers random treasure found in play); M&M p. 10 gives only 3d6 x 10 gp", null, "pending"],
  ["starting-xp", "Does a new character start with a minimum number of experience points? If so, how many? Until then, new characters start at 0 XP and Jay can set XP by hand.", "WW silent (p. 6 sets a minimum of 3 starting hit points, not XP; p. 11 covers XP earned in play)", null, "pending"],
  ["staff-carry-over-rest", "Does a spell stored in a magic-user's staff or wand stay stored through rest, so the magic-user has an extra spell the next day? Until then, a stored spell stays until it is released.", "WW p. 7 says a stored spell may be loosed 'at any time' and is silent on rest", null, "pending"],
  ["staff-same-spell-twice", "With Int 18, may both staff slots hold the same spell? Until then, it is allowed and the sheet flags it.", "WW p. 7 silent", null, "pending"],
  ["staff-loss", "Is a stored spell lost if the staff or wand is broken, stolen or dropped? Until then, nothing is cleared: the sheet warns and Jay can void the slot.", "WW p. 7 silent", null, "pending"],
  ["elf-wand-int", "Does an elf using a staff or wand also need an Intelligence bonus to store spells? Until then, elves follow the same Intelligence rule as magic-users.", "WW p. 7 names magic-users and elves for the wand; the Intelligence rule (WW pp. 5, 7) names magic-users", null, "pending"],
  ["staff-int-drop", "If Intelligence drops after spells are stored (for example after a re-roll grant), what happens to a stored spell past the new limit? Until then, nothing is cleared: the sheet warns and Jay can void the slot.", "WW pp. 5, 7 silent", null, "pending"],
];

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  for (const [key, question, sources, answer, status] of RULINGS) {
    await sql`
      insert into rulings (key, question, sources, answer, status)
      values (${key}, ${question}, ${sources}, ${answer}, ${status})
      on conflict (key) do nothing`;
  }
  // The Auth.js signing secret is generated by the server on first boot and
  // kept in the database, so no person ever has to create or paste it.
  // An AUTH_SECRET variable, if set on Railway, still takes precedence.
  if (!process.env.AUTH_SECRET) {
    const fresh = randomBytes(48).toString("base64url");
    await sql`insert into app_settings (key, value) values ('auth_secret', ${fresh}) on conflict (key) do nothing`;
    const [row] = await sql`select value from app_settings where key = 'auth_secret'`;
    writeFileSync(".auth-secret", row.value, { mode: 0o600 });
  }
  console.log("Migrations applied; rulings ledger seeded.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
