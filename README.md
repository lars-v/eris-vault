# Eris Vault

A character keeper for one private OD&D table playing the Planet Eris campaign. Players build and manage their characters. Jay, the GM, approves them. Lars is the admin.

Live at [eris.myconoid.com](https://eris.myconoid.com). Hosted on Railway (one web service and one Postgres database).

Thanks for helping out. This page covers what you need to get going. [CLAUDE.md](CLAUDE.md) has the same rules in more detail and is what AI coding agents read, so keep the two in step.

## What it does

- Sign in with GitHub (and Google when its keys are set).
- See the whole party on one roster.
- Build a character step by step: abilities, race, class, hit points, kit. The server rolls every die and logs it.
- Upload an existing character sheet (fillable Planet Eris or OD&D PDF). The app reads it into a draft and flags anything that breaks the rules for Jay.
- Jay reviews submissions, grants re-rolls, answers open rules questions and reads the audit log.
- Lars manages people, roles and settings.

## The one rule: follow the books, never invent

Every game mechanic must come from the campaign sources, in this order:

1. **Jay's rulings** (the `rulings` table, seeded in [scripts/migrate.mjs](scripts/migrate.mjs)).
2. **Woundwort's Warren** (WW), the Planet Eris house rules. It wins wherever it covers a topic.
3. **Men & Magic** (M&M) and the other OD&D "brown books" for everything else.
4. **Planet Eris Gazetteer** for setting words only (names, places, gods). It is not a rules source.

In practice:

- Cite the page next to every rule, in a comment or a `*_SOURCE` constant (`// WW p. 6`).
- If the books are silent, unclear, or leave it to the referee, don't pick an answer. Add a `pending` entry to the rulings seed and leave the behavior open for Jay.
- Unknown values stay unknown. Price-list weights come from WW p. 18 (read from the page image). An imported item with no weight entered stays `null`, and the total is shown as a floor. Don't fill it with guesses.
- Only the four races with rules: human, dwarf, elf, halfling.

If you're working on rules and don't have the books, ask Lars.

## Invariants

These protect the fairness of the game. A change that breaks one won't be merged.

- **The server rolls every die** (`node:crypto` `randomInt`). Every roll is written to `rolls` before it touches a character. No code path may let a client choose a result.
- `rolls` and `audit_log` are insert-only, enforced by database triggers ([drizzle/0001_insert_only_tables.sql](drizzle/0001_insert_only_tables.sql)).
- One ability set per character. Re-rolls only through a GM or admin grant, and the replaced roll stays in the log.
- Random buttons for player choices (name, race, class and so on) only fill the form, respect choices already made, and are not logged as rolls.
- Abilities, race and class lock once hit points are rolled.
- Nothing that references users is hard-deleted. Characters are soft-deleted; duplicate accounts are merged.
- Every GM and admin action writes to `audit_log` via `writeAudit`.

## Getting started

You need Node 22 or newer and a Postgres database. Docker is the easy way:

```bash
docker run -d --name eris-pg -e POSTGRES_PASSWORD=eris -e POSTGRES_DB=eris -p 55432:5432 postgres:16
```

Install and set up:

```bash
npm install

export DATABASE_URL=postgres://postgres:eris@localhost:55432/eris
export AUTH_SECRET=dev-only-secret
export AUTH_GITHUB_ID=dummy AUTH_GITHUB_SECRET=dummy
export ADMIN_GITHUB_IDS=0
export AUTH_URL=http://localhost:3000

npm run migrate   # creates tables and seeds the rulings
npm run dev       # http://localhost:3000
```

### Signing in locally

Real OAuth keys aren't needed. Create a user and a session in the database, then set the session cookie in your browser.

```sql
INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('u-gm', 'Local GM', 'gm@example.test', now());
INSERT INTO profiles (user_id, role) VALUES ('u-gm', 'gm');
INSERT INTO session ("sessionToken", "userId", expires) VALUES ('tok-gm', 'u-gm', now() + interval '30 days');
```

Then set the cookie `authjs.session-token` to `tok-gm` for `localhost:3000` (browser dev tools, or `context.addCookies` in Playwright). Use `role` `player` for a player account. Admin comes only from `ADMIN_GITHUB_IDS` and needs a real GitHub sign-in.

## Commands

```bash
npm run dev          # local dev server
npm test             # vitest unit tests in tests/
npm run typecheck
npm run lint
npm run build        # needs DATABASE_URL set
npm run db:generate  # new SQL migration after editing src/db/schema.ts
npm run migrate      # apply migrations and seed rulings (also runs on npm start)
```

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned) with database sessions.
- Drizzle ORM with Postgres.
- Vitest.

Next.js 16 differs from older versions: `params`, `searchParams` and `headers()` are Promises, and middleware is called "proxy". When unsure, read the docs bundled in `node_modules/next/dist/docs/`.

## Where things live

| Path | What |
| --- | --- |
| [src/lib/rules/](src/lib/rules/) | Pure rules modules, each citing its source. Keep them pure and tested. |
| [src/lib/session.ts](src/lib/session.ts) | The only place to learn who is asking (`requireUser`, `requireStaff`, `requireAdmin`). |
| [src/lib/roles.ts](src/lib/roles.ts) | The permission matrix (`can.*`). |
| [src/lib/sheets.ts](src/lib/sheets.ts) | Reads uploaded PDF sheets into a draft. |
| [src/app/(app)/characters/actions.ts](src/app/(app)/characters/actions.ts) | Creation wizard and GM server actions. |
| [src/db/schema.ts](src/db/schema.ts) | Database schema. Migrations are in [drizzle/](drizzle/). |
| [src/auth.ts](src/auth.ts) | Sign-in setup. |
| [scripts/migrate.mjs](scripts/migrate.mjs) | Runs migrations, seeds rulings, creates the signing secret on first boot. |
| [tests/](tests/) | Unit tests. |

## How to contribute

- **Don't push to `main`.** A push to `main` deploys straight to the live site the table uses. Work on a branch and open a pull request.
- Before opening a PR, run `npm test`, `npm run typecheck` and `npm run lint`.
- New or changed rules need a page citation and a test.
- Schema changes go through `npm run db:generate`. Don't hand-edit old migrations.
- Never commit secrets. Production secrets are set on Railway by Lars only.
- Have a rules question? Open an issue, or add a `pending` ruling in your PR so Jay can decide.

## Writing style

For UI text and docs: plain, short sentences. No em dashes or double dashes. When a screen states a rule, name the source page.
