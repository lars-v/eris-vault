import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "@auth/core/adapters";

/* ---------- Auth.js tables (shape required by @auth/drizzle-adapter) ---------- */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* ---------- App tables ---------- */

export type Role = "player" | "gm" | "admin";
/** "merged": the account was folded into another one; its sign-ins moved there. */
export type AccountStatus = "active" | "blocked" | "merged";

/** One row per signed-in person. Railway-listed admins are checked live, not stored here. */
export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").$type<Role>().notNull().default("player"),
  status: text("status").$type<AccountStatus>().notNull().default("active"),
  // Keys of the first-time guides this person has finished or skipped (src/lib/guide.ts).
  guidesSeen: text("guides_seen").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type Race = "human" | "dwarf" | "elf" | "halfling";
export type Alignment = "lawful" | "neutral" | "chaotic";
export type CharacterStatus = "draft" | "submitted" | "approved" | "dead" | "retired";
export type CharacterClass = "fighting-man" | "magic-user" | "cleric" | "thief";

export type ImportFlag = { title: string; body: string; source: string };

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  // Null while a draft is still being built in the creation wizard.
  race: text("race").$type<Race>(),
  alignment: text("alignment").$type<Alignment>(),
  status: text("status").$type<CharacterStatus>().notNull().default("draft"),
  str: smallint("str"),
  int: smallint("int"),
  wis: smallint("wis"),
  dex: smallint("dex"),
  con: smallint("con"),
  cha: smallint("cha"),
  abilityRollId: uuid("ability_roll_id"),
  hpRollId: uuid("hp_roll_id"),
  goldRollId: uuid("gold_roll_id"),
  hpCurrent: smallint("hp_current"),
  hpMax: smallint("hp_max"),
  coinsGp: integer("coins_gp").notNull().default(0),
  coinsSp: integer("coins_sp").notNull().default(0),
  coinsCp: integer("coins_cp").notNull().default(0),
  deity: text("deity"),
  // Spell keys from src/lib/rules/spells.ts. `spellsKnown` holds only what Jay
  // recorded (books and scrolls bought or found, WW p. 25); starting spells are
  // derived. `spellsPrepared` has one entry per filled slot.
  spellsKnown: text("spells_known").array().notNull().default(sql`'{}'::text[]`),
  spellsPrepared: text("spells_prepared").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  source: text("source").notNull().default("app"),
  importFlags: jsonb("import_flags").$type<ImportFlag[]>().notNull().default([]),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** Elves keep a row per class (Woundwort's Warren p. 10); everyone else has one. */
export const characterClasses = pgTable("character_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  class: text("class").$type<CharacterClass>().notNull(),
  xp: integer("xp").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export type ItemLocation = "carried" | "stashed" | "mount";

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  quantity: smallint("quantity").notNull().default(1),
  // Units from Woundwort's Warren p. 18. Null = not known (an imported item with no weight entered).
  encUnits: smallint("enc_units"),
  catalogKey: text("catalog_key"),
  isMagic: boolean("is_magic").notNull().default(false),
  magicBonus: smallint("magic_bonus"),
  location: text("location").$type<ItemLocation>().notNull().default("carried"),
  notes: text("notes"),
});

export type RollPurpose = "abilities" | "hp" | "gold" | "play";

/** Insert-only. Every die is kept. */
export const rolls = pgTable("rolls", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  characterId: uuid("character_id").references(() => characters.id),
  purpose: text("purpose").$type<RollPurpose>().notNull(),
  formula: text("formula").notNull(),
  dice: jsonb("dice").$type<number[][]>().notNull(),
  totals: jsonb("totals").$type<number[]>().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** A GM or admin lets a player roll one purpose again for one character. */
export const rollGrants = pgTable("roll_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id),
  purpose: text("purpose").$type<Exclude<RollPurpose, "play">>().notNull(),
  grantedBy: text("granted_by")
    .notNull()
    .references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  usedRollId: uuid("used_roll_id"),
  usedAt: timestamp("used_at", { mode: "date" }),
});

export const rulings = pgTable("rulings", {
  key: text("key").primaryKey(),
  question: text("question").notNull(),
  sources: text("sources").notNull(),
  answer: text("answer"),
  status: text("status").$type<"pending" | "decided">().notNull().default("pending"),
  decidedBy: text("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { mode: "date" }),
});

export const gmClaims = pgTable("gm_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  note: text("note"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedBy: text("used_by").references(() => users.id),
  usedAt: timestamp("used_at", { mode: "date" }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").references(() => users.id),
  actorRole: text("actor_role").$type<Role | "system">().notNull(),
  characterId: uuid("character_id").references(() => characters.id),
  targetUserId: text("target_user_id").references(() => users.id),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/**
 * A character sheet a player uploaded to bring an existing character in.
 * The file is kept so Jay can check the imported numbers against it.
 * `fields` holds the form fields read from a fillable PDF (empty for images).
 * `characterId` is set once the player sends the imported character to Jay.
 */
export const sheetUploads = pgTable("sheet_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  characterId: uuid("character_id").references(() => characters.id),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** Server-owned settings, e.g. the Auth.js signing secret generated on first boot. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
