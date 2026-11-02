# Eris Vault

Character keeper for the Planet Eris OD&D campaign (Rath Denacht). Players sign in with GitHub or Google, see the whole party, and build characters by Woundwort's Warren (house rules) first and Men & Magic second. Jay runs it as GM; Lars is admin.

Plan and mockups: the "Eris Character Vault" design canvas in Claude.

## What's in this build (walking skeleton)

- GitHub sign-in (Google turns on when its keys are set). GitHub sign-ins must use an email GitHub has verified.
- Roles: player, gm, admin. Admin comes from `ADMIN_GITHUB_IDS` on Railway and can't be changed inside the app.
- One-time GM claim links (hash stored, 48-hour expiry, single use).
- Party roster, read-only character sheet, GM tools (review queue, rulings ledger, audit log), admin view (people, roles, blocking, settings status).
- Liz the Giz import from her PDF sheet, with her five flags for Jay.
- Rolls and the audit log are insert-only in the database (triggers).
- Rules so far: ability modifiers (WW p. 5), advancement tables to 9th level (WW pp. 7-9), encumbrance bands (WW pp. 16, 47). Each cites its page.

## Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Railway reference to Postgres | set |
| `PORT` | Railway | `3000` |
| `ADMIN_GITHUB_IDS` | Railway | numeric GitHub IDs, comma separated |
| `AUTH_SECRET` | Railway, secret | optional; the server generates and stores one at first boot |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Railway, secret | GitHub OAuth app |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Railway, secret | optional; Google client must be External |

## Commands

```bash
npm run dev        # local dev (needs DATABASE_URL)
npm test           # rules and permission tests
npm run build
npm start          # runs migrations + seeds rulings, then next start
npm run db:generate  # new migration after editing src/db/schema.ts
```
