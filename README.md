# Studio Sillage — online booking for a (fictional) hair salon

Course project. Guests book a haircut online with no account; a single admin manages the agenda. The salon, team, prices and illustrations are fictional.

**Stack:** React + TypeScript + Vite · Netlify Functions (TypeScript) · Neon PostgreSQL · Nodemailer over Gmail SMTP · GitHub Actions.

|                            |                                                |
| -------------------------- | ---------------------------------------------- |
| Product scope              | [`docs/PRD.md`](docs/PRD.md)                   |
| Design and security        | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Tests                      | [`docs/TESTING.md`](docs/TESTING.md)           |
| CI/CD, environments, setup | [`docs/DEVOPS.md`](docs/DEVOPS.md)             |
| Phases and backlog         | [`docs/ROADMAP.md`](docs/ROADMAP.md)           |

## What it does

- Public site in French: services and prices by category, team, gallery, hours, FAQ, contact form, legal pages.
- Booking: service → stylist or "peu importe" → calendar of available days → 15-minute slots → name and email → instant confirmation.
- **No double booking, even under concurrent requests**: enforced by a PostgreSQL exclusion constraint and tested with simultaneous requests.
- Confirmation email with a private link (token in the URL fragment, only its hash stored) to view or cancel up to 24 h before.
- Hourly reminder email ~24 h before (Netlify scheduled function); nightly anonymisation after 12 months.
- Admin area (`/admin`): weekly agenda, cancel a booking (client is emailed), stylists' days off, salon closures.

## Run locally

Requirements: Node 22, PostgreSQL 16 (local install or `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`).

```bash
npm ci
cp .env.example .env                      # set DATABASE_URL, ADMIN_EMAIL, MAIL_MODE=log
npm run admin:hash -- "choose-a-long-password"   # paste the output into ADMIN_PASSWORD_HASH
set -a && . ./.env && set +a
npm run db:migrate && npm run db:seed
npm run build && npm run serve:local      # http://localhost:8888
```

`npx netlify dev` also works if you have the Netlify CLI.

## Tests

```bash
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/salon_test   # empty database, recreated by the tests
npm test                 # 32 unit + 28 integration tests
npm run test:coverage    # domain rules: 100 % lines
npm run e2e              # Playwright + axe (needs the .env variables above)
npm run lint && npm run typecheck && npm run format:check
```

## Deploy

One-time setup of GitHub, Neon, Gmail and Netlify (about 20 minutes): [`docs/DEVOPS.md` section 4](docs/DEVOPS.md#4-one-time-setup--20-minutes-needs-your-accounts).
After that: merge to `main` → staging (free branch deploy); tag `vX.Y.Z` → approve → production.

## Known limitations

- Services and weekly hours are edited in `src/server/db/seed.ts`, not yet in the admin area (backlog A1–A2).
- No automated backups beyond Neon's 6-hour restore window (backlog B1).
- Emails are sent from a Gmail address (no custom domain).
