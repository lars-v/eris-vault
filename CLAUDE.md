# Eris Vault

Character keeper for one private OD&D table playing the Planet Eris campaign. Players build and manage characters; the GM (Jay) approves them; Lars is the admin.

Live: https://eris.myconoid.com (also https://web-production-9dfd2.up.railway.app) · Repo: github.com/lars-v/eris-vault (private) · Hosting: Railway project `eris-vault` (web service + Postgres).

@AGENTS.md

## The one rule: follow the books, never invent

Every game mechanic in this app must come from the campaign sources, in this order:

1. **Jay's rulings** (the `rulings` table, seeded in `scripts/migrate.mjs`).
2. **Woundwort's Warren** (WW), the Planet Eris house rules. It wins wherever it covers a topic.
3. **Men & Magic** (M&M) and the other "brown books" for everything else.
4. **Planet Eris Gazetteer** for setting words only (names, places, gods). It is not a rules source.

- Cite the page in a comment or `*_SOURCE` constant next to every rule (e.g. `// WW p. 6`).
- If the books are silent, ambiguous or optional ("at the referee's discretion"), do not pick an answer. Add a `pending` entry to the rulings seed in `scripts/migrate.mjs` and leave the behavior open for Jay.
- Unknown values stay unknown. Item encumbrance (WW p. 18) is printed as dots that the text copy loses; `CATALOG[].enc` was read from the page image (dot = 1 unit, circle = 0). An imported item with no weight entered keeps `inventory.enc_units = null` and the encumbrance total says it is a floor. Never fill unknowns with guesses.
- Flag conflicts in imported sheets (see `importFlags`) instead of silently correcting them.
- Only the four races with rules: human, dwarf, elf, halfling.

## Commands

```bash
npm run dev          # local dev, needs DATABASE_URL
npm run build
npm test             # vitest, unit tests in tests/
npm run typecheck
npm run lint
npm run db:generate  # drizzle-kit: new SQL migration from src/db/schema.ts
npm run migrate      # apply migrations + seed rulings (also runs on every `npm start`)
```

Local Postgres for browser testing: any Postgres works; set `DATABASE_URL` plus dummy `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET`, `ADMIN_GITHUB_IDS`, `AUTH_URL=http://localhost:3000`. Seed users and `session` rows directly and set the `authjs.session-token` cookie to sign in as them (Playwright).

## Stack and layout

- Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (`@theme` tokens in `src/app/globals.css`), self-hosted OFL fonts in `src/fonts`.
  - Next 16: `params`, `searchParams`, `headers()` are Promises; middleware is called "proxy"; no `cacheComponents`. Check `node_modules/next/dist/docs/` before using an API you're unsure of.
- Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned) with the Drizzle adapter and database sessions: `src/auth.ts`.
  - GitHub always; Google when its keys exist. GitHub emails must be verified (checked in the `signIn` callback).
  - The signing secret is generated on first boot by `scripts/migrate.mjs` and stored in `app_settings`; an `AUTH_SECRET` env var overrides it.
- Drizzle ORM + `postgres` driver: schema `src/db/schema.ts`, migrations `drizzle/`.
- `src/lib/session.ts`: the only place pages and actions learn who is asking (`requireUser`, `requireStaff`, `requireAdmin`).
- `src/lib/roles.ts`: the permission matrix (`can.*`). Admins come from `ADMIN_GITHUB_IDS` (GitHub numeric IDs) on Railway and can't be changed in the app.
- `src/lib/rules/`: pure rules modules, each citing its source. Keep them pure and tested.
  - `abilities.ts` (WW p. 5), `advancement.ts` (WW pp. 7-10), `encumbrance.ts` (WW pp. 16, 47), `dice.ts` (WW pp. 5-6, M&M p. 10), `equipment.ts` (WW p. 17 price list; class limits WW p. 9, M&M pp. 6, 8), `spells.ts` (spells per day WW pp. 5, 7-8; lists and starting books WW pp. 25-26), `creation.ts`, `names.ts` (Gazetteer word lists for random buttons).
- `src/app/(app)/characters/actions.ts`: creation wizard and GM server actions. Player-facing actions go through `guard()`, which sends rule errors back to the build page as `?error=`.
- `src/lib/sheets.ts` reads uploaded sheets (fillable Planet Eris or OD&D PDF) into a draft; `src/lib/rules/import.ts` checks an imported character and returns `importFlags`. Uploads live in `sheet_uploads` (file kept for Jay, served by `/api/sheets/[id]` to the owner and staff). Imports go straight to "submitted" with `source = 'sheet-import'`, write no rolls, and players can't open the build wizard on them.
- Pages: `/party`, `/characters/new`, `/characters/import`, `/characters/import/[uploadId]`, `/characters/[id]`, `/characters/[id]/build`, `/rolls`, `/account`, `/gm`, `/admin`, `/claim`, `/privacy`.

## Invariants (don't break these)

- **The server rolls every die** (`node:crypto` `randomInt`), and every roll is written to `rolls` before it touches a character. `rolls` and `audit_log` are insert-only, enforced by database triggers (`drizzle/0001_insert_only_tables.sql`). Never update or delete them, and never add a code path that lets a client choose a result.
- One ability set per character. Re-rolls only through a GM/admin grant (`roll_grants`); the replaced roll stays in the log.
- Random buttons for player choices (name, race, class, alignment, patron, arrangement, kit) only fill the form, must respect the rules for the choices already made, and are not logged as rolls.
- Abilities, race and class lock once hit points are rolled.
- Nothing that references users is hard-deleted: characters are soft-deleted (`deleted_at`); duplicate accounts are merged (`profiles.status = 'merged'`).
- Every GM and admin action writes `audit_log` via `writeAudit`; Jay can read it.

## Deploying

Push to `main` on GitHub and Railway deploys automatically; migrations run at start. Check with `railway deployment list --service web` and `/api/health`. Railway variables: `DATABASE_URL`, `PORT=3000`, `ADMIN_GITHUB_IDS`, `AUTH_URL` (the public https URL; GitHub sign-in fails without it), `AUTH_GITHUB_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`.

Secrets are pasted by Lars, never by an agent. Don't print, log or commit them.

## Writing style for UI copy and docs

Plain, short sentences. No em dashes or double dashes. Name the source page when a screen states a rule.
