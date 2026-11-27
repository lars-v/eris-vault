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
  ["magic-user-all-spells", "Which magic-user spells does a magic-user (or an elf casting as one) have?", "Table decision (Lars), 16 Nov 2026; overrides WW p. 25 (spellbooks bought one level at a time) and WW p. 10 (an elf's mental book grown by study)", "Replaced by magic-user-spellbook (25 Nov 2026): a magic-user has the spells in their spellbook.", "decided"],
  // Replaces magic-user-all-spells. On a database seeded before 25 Nov, that row keeps its old
  // answer until it is changed on /gm/rulings.
  ["magic-user-spellbook", "Which spells does a magic-user (or an elf casting as one) prepare, and how does a spell get into the spellbook?", "Table decision (Lars), 25 Nov 2026; replaces magic-user-all-spells (16 Nov 2026) and sets aside WW p. 25 (spellbooks bought one level at a time) and WW p. 10 (an elf's mental book grown by study)", "Only spells in their spellbook, which is also where spells stored in a staff or wand come from. The player adds or removes any spell on the magic-user list at any time, with no cost or limit. A spell taken out while prepared stays prepared that day. Spells per day still follow WW p. 7.", "decided"],
  ["starting-gold", "Is 3d6 x 10 gp a shopping budget or what is left after gear?", "Men & Magic p. 10; campaign ruling", "It is what remains after buying starting gear.", "decided"],
  // Answered by Jay on /gm/rulings, 17 Nov 2026 (the seed only fills a fresh database).
  ["hit-die-floor", "Can a hit die total fall below 1 after 1st level?", "WW p. 6 silent; M&M p. 11 sets 1 for its own Con rule; Jay's ruling, 17 Nov 2026", "No. Every hit die adds at least 1 hit point.", "decided"],
  ["low-int-literacy", "Int 4 to 6: limit reading and writing?", "WW p. 11 (referee may); Jay's ruling, 17 Nov 2026", "Yes. A character with Int 4 to 6 can't read or write.", "decided"],
  ["dwarf-darkvision", "Does a player dwarf have the 2 in 6 latent sight in the dark?", "WW p. 10 (referee's discretion); Jay's ruling, 17 Nov 2026", "Player must roll the 2in6 chance of sight in the dark at player creation. If a 1 or 2 are rolled player dwarf can see in the dark.", "decided"],
  ["save-bonus-stacking", "Do class and race saving throw bonuses add together?", "WW p. 23 silent; Jay's ruling, 17 Nov 2026", "Yes. Class and race saving throw bonuses add together.", "decided"],
  ["wis-vs-mind", "Apply the Wisdom modifier to saves vs charms and illusions?", "WW p. 5 (referee's discretion); Jay's ruling, 17 Nov 2026", "No. Wisdom doesn't change those saves.", "decided"],
  ["survive-adversity", "Exact odds to survive adversity for each Constitution band", "M&M p. 11, via WW p. 5; Jay's ruling, 17 Nov 2026 (as printed); table decision, 25 Nov 2026", "Con 1-3 0%, Con 4 10%, Con 5 20%, Con 6 30%, Con 7 40%, Con 8 50%, Con 9 60%, Con 10 70%, Con 11 80%, Con 12 90%, Con 13 and above 100%.", "decided"],
  ["cleric-l1-scroll", "1st-level cleric with Wis 15+: prayer scroll of one or two spells?", "WW p. 25; Jay's ruling, 17 Nov 2026", "1 spell and player can pick", "decided"],
  ["cleric-edged-weapons", "May clerics use ordinary edged weapons?", "M&M p. 7; WW silent; Jay's ruling, 17 Nov 2026", "No. Clerics use non-edged weapons only.", "decided"],
  ["ashan-patronage", "What does Ashan's patronage grant Liz?", "Campaign note; Jay's ruling, 17 Nov 2026", "+1 to turn undead rolls", "decided"],
  ["elf-second-class-hp", "An elf keeps separate hit points per class (WW p. 10). When are hit points for the second class rolled?", "WW p. 10; Jay's ruling, 17 Nov 2026", "At creation, one roll for each class.", "decided"],
  ["name-level-xp", "What does '+100,000' mean for 10th level XP?", "WW pp. 7 to 9; Jay's ruling, 17 Nov 2026", "Each level after 9th needs 100,000 more XP than the one before.", "decided"],
  ["level-hp-current", "When a character gains a level, does the new hit die raise current hit points as well as the maximum?", "WW p. 6 silent; Jay's ruling, 17 Nov 2026", "Yes. Current hit points rise by the same amount as the maximum.", "decided"],
  ["prepare-same-spell", "May a caster prepare the same spell in more than one slot?", "WW pp. 7, 8, 25 silent; Jay's ruling, 17 Nov 2026", "Yes. A caster may prepare the same spell in several slots.", "decided"],
  ["cleric-wis-penalty", "Does a Wisdom penalty (Wis 3 to 6) take 1st-level spells away from a cleric?", "WW p. 5 names only bonuses; Jay's ruling, 17 Nov 2026", "No. A low Wisdom never takes spells away.", "decided"],
  ["carry-unusable-gear", "May a character carry gear the class can't use (a magic-user carrying a sword as loot, a thief carrying plate mail)? Until then, players can't add it from the price list; Jay can, and the sheet flags it.", "M&M p. 6 and WW p. 9 say what a class may arm itself with, not what it may carry; Jay's ruling, 17 Nov 2026", "Yes. Anyone may carry anything. Class limits are about using it, not carrying it.", "decided"],
  ["con-change-hp", "If Jay changes Constitution after hit points are rolled, does maximum hit points change with the new modifier? Until then, maximum hit points stay as they are.", "WW pp. 5-6 silent; Jay's ruling, 17 Nov 2026", "Yes. Recount maximum hit points with the new modifier for every level.", "decided"],
  ["ability-range", "Can an ability score go below 3 or above 18 (for example through magic)? Until then, hand-set scores stay within 3 to 18.", "WW p. 5 (3d6) silent; Jay's ruling, 17 Nov 2026", "No. Scores stay between 3 and 18.", "decided"],
  ["hp-below-zero", "What happens to a character at 0 hit points or below? Until then, the sheet only shows the number.", "WW silent; M&M silent; Jay's ruling, 17 Nov 2026", "PCs are unconscious at 0 and lose 1hp per round. Dead at negative their level so a 3rd level pc could go to -3.", "decided"],
  ["cleric-l1-scroll-spells", "Who picks the spells on a 1st-level cleric's limited prayer scroll: the player, or Jay?", "WW p. 25; Jay's ruling, 17 Nov 2026", "Player", "decided"],
  ["mu-combat-rows", "The Character Combat Matrix lists magic-user levels 4-6 in one row and 5-9 in the next. Does a 5th or 6th level magic-user use the second row or the third? WW p. 19 says magic-users improve every 3 levels. Until then, the sheet shows both rows.", "WW pp. 19-20; Jay's ruling, 17 Nov 2026", "The 4-6 row. The '5-9' row is a misprint for 7-9, since magic-users improve every 3 levels.", "decided"],
  ["neutral-cleric-fourth", "A neutral cleric must choose Law or Chaos before advancing to 4th level 'under most circumstances'. Should the vault stop a neutral cleric's 4th-level hit die roll until the alignment changes? Until then, the sheet warns but does not stop it.", "WW p. 8; Jay's ruling, 17 Nov 2026", "Yes. Stop the 4th level hit die roll until the cleric chooses Law or Chaos.", "decided"],
  ["drain-xp", "When a Wight, Wraith, Spectre or Vampire drains a level, what XP does the character keep? Until then, Jay enters the new XP each time.", "M&T p. 9 says a hit removes the level and its hit die, not what XP is left; WW silent; Jay's ruling, 17 Nov 2026", "No level drain - only ability drain. See pg 56 of house rules.", "decided"],
  ["drain-hp-current", "When a level drain lowers maximum hit points, do current hit points drop too? Until then, current hit points stay as they are.", "M&T p. 9 silent; Jay's ruling, 17 Nov 2026", "Not using level drain. Using Melan’s energy drain which drains a PCs stats temporarily with hits. For instance wights drain con (amount of hp drained also = amount of con drained). If an ability goes to 0 character dies.", "decided"],
  ["regain-drained-level", "When a drained character earns a lost level back, is a new hit die rolled for it? Until then, yes, like any new level.", "M&T p. 9 silent; WW p. 6; Jay's ruling, 17 Nov 2026", "No level drain - just energy drain - see page 56.", "decided"],
  ["large-shield-ac", "WW p. 17 sells a large shield (15 gp) but the Armor Class Table names only 'Shield'. Is a large shield better than a shield? Until then, it counts as a shield.", "WW p. 17; Jay's ruling, 17 Nov 2026", "No. A large shield counts as a shield.", "decided"],
  ["magic-armor-ac", "Does magic armor lower the armor class number? M&T p. 30 says its bonus comes off the attacker's roll instead. On the WW to-hit tables that is the same as a better AC except where 20 is needed. Until then, the sheet shows the book AC and, beside it, the AC with the armor's bonus in. A magic shield's bonus is never folded in, since it counts one blow in three.", "M&T p. 30; WW pp. 17, 19-20 silent on magic armor; Jay's ruling, 17 Nov 2026", "Yes. Magic armor lowers armor class by its bonus. A magic shield also lowers ac by its bonus.", "decided"],
  ["dart-long-range", "WW p. 19 prints dart ranges as short 1-15, medium 16-30, long 21-45, so long overlaps medium. Is long range 31-45? Until then, the sheet shows the ranges as printed.", "WW p. 19; Jay's ruling, 17 Nov 2026", "Yes. Dart long range is 31-45 feet.", "decided"],
  ["sling-long-range", "WW p. 19 prints sling ranges as short 1-40, medium 41-80, long 80-160, so 80 feet is in both medium and long. Is long range 81-160? Until then, the sheet shows the ranges as printed.", "WW p. 19; Jay's ruling, 17 Nov 2026", "Yes. Sling long range is 81-160 feet.", "decided"],
  ["one-level-per-adventure", "Men & Magic recommends that no single adventure awards more XP than it takes to gain one level. Does the table use this? Until then, the award form warns when an award gains more than one level, but allows it.", "M&M p. 18; Jay's ruling, 17 Nov 2026", "Yes. No single award gains more than one level.", "decided"],
  ["starting-magic-items", "Does a new character start with magic items (for example two)? If so, how many, and does the player choose them or does Jay? Until then, new characters start with none and only Jay can add one.", "WW silent (p. 33 covers random treasure found in play); M&M p. 10 gives only 3d6 x 10 gp; Jay's ruling, 17 Nov 2026", "Each new character starts with one magic item.  Players can either pick from the list or roll on the DMG magic item table.", "decided"],
  ["starting-xp", "Does a new character start with a minimum number of experience points? If so, how many? Until then, new characters start at 0 XP and Jay can set XP by hand.", "WW silent (p. 6 sets a minimum of 3 starting hit points, not XP; p. 11 covers XP earned in play); Jay's ruling, 17 Nov 2026", "New characters start at 5000xp", "decided"],
  ["staff-carry-over-rest", "Does a spell stored in a magic-user's staff or wand stay stored through rest, so the magic-user has an extra spell the next day? Until then, a stored spell stays until it is released.", "WW p. 7 says a stored spell may be loosed 'at any time' and is silent on rest; Jay's ruling, 17 Nov 2026", "Yes. A stored spell stays until it is used, through any amount of rest.", "decided"],
  ["staff-same-spell-twice", "With Int 18, may both staff slots hold the same spell? Until then, it is allowed and the sheet flags it.", "WW p. 7 silent; Jay's ruling, 17 Nov 2026", "Yes. Both slots may hold the same spell.", "decided"],
  ["staff-loss", "Is a stored spell lost if the staff or wand is broken, stolen or dropped? Until then, nothing is cleared: the sheet warns and Jay can void the slot.", "WW p. 7 silent; Jay's ruling, 17 Nov 2026", "Yes. If the staff or wand is broken, stolen or dropped, the stored spells are lost.", "decided"],
  ["elf-wand-int", "Does an elf using a staff or wand also need an Intelligence bonus to store spells? Until then, elves follow the same Intelligence rule as magic-users.", "WW p. 7 names magic-users and elves for the wand; the Intelligence rule (WW pp. 5, 7) names magic-users; Jay's ruling, 17 Nov 2026", "Yes. Elves need an Intelligence bonus (15+) like any magic-user.", "decided"],
  // Feedback from the table on elves, passed on by Lars, 27 Nov 2026.
  ["elf-starting-xp", "An elf keeps separate XP for each of its two classes (WW p. 10). How are the 5,000 starting XP (ruling starting-xp) shared between them, and where does XP from an adventure go?", "WW p. 10 (a separate record of experience for each class); table decision (Lars), 27 Nov 2026", "The player chooses how many of the 5,000 go to each class. XP from an adventure goes to the class the elf played it as.", "decided"],
  ["staff-int-drop", "If Intelligence drops after spells are stored (for example after a re-roll grant), what happens to a stored spell past the new limit? Until then, nothing is cleared: the sheet warns and Jay can void the slot.", "WW pp. 5, 7 silent; Jay's ruling, 17 Nov 2026", "The stored spell stays until it is released, but no new spell can be loaded past the limit.", "decided"],
  // Open questions where the books are silent, optional or ambiguous.
  ["elf-switch-wounds", "An elf keeps separate hit points for each class (WW p. 10). If a wounded elf switches class, does the damage carry over to the other class? Until then, each class keeps its own current hit points, as they were when the elf last played it.", "WW p. 10 silent; Men & Magic p. 8 silent", null, "pending"],
  ["elf-switch-spells", "When an elf switches from magic-user to fighting-man and back, does it keep the spells it had prepared? And may it loose a spell stored in its staff or wand while it is a fighting-man? Until then, a switch clears nothing, and the staff works in either class.", "WW pp. 7, 10 silent", null, "pending"],
  ["elf-unsafe-switch", "WW p. 10 has an optional rule: if the referee allows it, an elf may switch class in a dungeon or the wilderness in one round, losing 1 point of Constitution for good. Does the table use it? Until then, the vault takes nothing off when an elf switches; Jay can lower Constitution with Set stats by hand.", "WW p. 10 (optional, the referee's choice)", null, "pending"],
  ["energy-drain", "Energy drain (Jay's ruling drain-hp-current): undead drain abilities, temporarily. The vault's copy of the house rules ends at p. 52, so p. 56 isn't in it. Please share p. 56: which undead drain which ability, how much, and how the points come back. Until then, the vault doesn't track ability drain; Jay notes it on the sheet.", "House rules p. 56 (not in the vault's copy); Jay's rulings drain-xp, drain-hp-current, regain-drained-level", null, "pending"],
  ["past-tenth-level", "What changes past 10th level? WW pp. 7-9 give saving throws and cleric spells only to 10th, and point magic-user spells to Men & Magic p. 17. Until then, the vault stops at 10th level; XP keeps counting.", "WW pp. 7-9; Jay's ruling name-level-xp", null, "pending"],
  ["starting-magic-item-list", "Jay's ruling starting-magic-items lets players pick their one magic item from a list. Which list? The vault has no magic item list, and the DMG table isn't one of the campaign books, so the vault can't roll on it. Until then, Jay adds each new character's magic item on the sheet.", "Jay's ruling starting-magic-items; WW silent", null, "pending"],
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
