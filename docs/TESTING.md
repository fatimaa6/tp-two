# TESTING — Testing strategy

**Status:** v1.0, implemented 2026-11-25. Tags: **[R]** recommendation. Numbers below are from the run of 2026-11-25.

**Changes from v0.1:** Python tools (pytest, hypothesis, Mailpit) replaced by their TypeScript equivalents (Vitest, a seeded property test, an in-memory mailer); load, Lighthouse, ZAP and Schemathesis moved to the backlog.

## 1. Principles

1. Business rules are pure functions in `src/server/domain`, so most of them are tested without a database.
2. Anything touching the database runs against **real PostgreSQL 16**. The no-double-booking guarantee lives in a PostgreSQL constraint; mocks would prove nothing.
3. Time is always injected (`Deps.now`, explicit `now` in domain functions). No test depends on today's date, except the E2E tests, which pick "the third available day".
4. Few E2E tests, on the journeys a grader will try.
5. CI is the source of truth.

| Layer                             | Count                | Time   |
| --------------------------------- | -------------------- | ------ |
| Unit (Vitest)                     | 32                   | ~1.5 s |
| Integration (Vitest + PostgreSQL) | 28                   | ~3 s   |
| E2E (Playwright + axe)            | 8 (desktop + mobile) | ~15 s  |

## 2. Unit tests (`tests/unit`)

| File                             | What is tested                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `availability.test.ts`           | 15-minute grid; a service must fit entirely in a window (3 h balayage); lunch break; misaligned window start; closed Sunday/Monday; partial overlaps with bookings; closures; 2-hour lead time; 90-day horizon (including the DST hour); "no preference" union with stylist lists; Paris offset in output; **DST: 29 March 2026 (no 02:xx, 12 slots between 01:00 and 05:00) and 25 October 2026 (02:00 twice, 20 slots)**; property test over 200 random schedules: no slot overlaps a booking, all inside working hours, no duplicates |
| `booking-rules.test.ts`          | `checkStart` (grid, too soon, exactly 2 h, too far); `canClientCancel` (24 h 01, exactly 24 h, 23 h 59); `orderByLoad` (fewest bookings, then display order)                                                                                                                                                                                                                                                                                                                                                                             |
| `security-and-templates.test.ts` | scrypt hash/verify, 12-character minimum, malformed hash; 256-bit base64url tokens; constant-time comparison; emails show Paris time and escape HTML; manage link uses the fragment; email masking in logs                                                                                                                                                                                                                                                                                                                               |

## 3. Integration tests (`tests/integration/api.test.ts`)

Each run drops and recreates the schema, applies migrations, loads the fictional catalogue, and calls the real router with a fixed clock and an in-memory mailer.

| Area                    | Cases                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema                  | Exclusion constraint exists after migration                                                                                                                                                                                                                                                                                                                               |
| Availability            | Tuesday has slots, Monday none; 42-day cap (422); stylist not eligible (422); slot disappears after booking and returns after cancellation; time off removes slots; closures remove slots                                                                                                                                                                                 |
| **Concurrency (AC-02)** | Two simultaneous `POST /bookings` for the same slot, **25 rounds**: always one 201 and one 409 `slot_taken`, exactly one row                                                                                                                                                                                                                                              |
| Booking                 | 201 shape; email sent with fragment link; token stored only as hash; booking kept when email fails (logged `failed`); partial overlap refused; "no preference" falls through to another stylist, then 409; BR-07 with case-insensitive email; lead time, grid, lunch break; strict validation (unknown field, bad email, honeypot, non-JSON → 415); 5 bookings/h/IP → 429 |
| Manage link             | View; unknown token 404; cancel refused under 24 h (403 `too_late_to_cancel`); allowed before, emails client and salon; second cancel 409                                                                                                                                                                                                                                 |
| Admin (AC-08)           | **Every admin route** (read from the router) returns 401 without cookie and with a forged cookie; 5 failures then 429 even with the right password, unlocked after 15 min; agenda, salon cancellation email, time off (and invalid range 422), closures affect availability, logout revokes the session; foreign `Origin` → 403                                           |
| Jobs (AC-06)            | Reminder sent once even when run twice; failed reminder retried next run; purge anonymises after 12 months and deletes contact messages after 90 days                                                                                                                                                                                                                     |
| Misc                    | Contact form stores and emails the salon; `/readyz`; unknown route 404 in the common error shape                                                                                                                                                                                                                                                                          |

## 4. End-to-end tests (`e2e/`)

Run with Playwright against `scripts/local-server.ts` (the built `dist/` plus the same router as the Netlify function) and a seeded PostgreSQL.

| Spec                                    | Covers                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking.spec.ts` (desktop and Pixel 5) | Home → "Homme" tab → "Coupe homme" → calendar → slot → details → confirmation → private link (token removed from the URL) → cancellation. FR-01, FR-05 to FR-09, NFR-05                     |
| `site.spec.ts`                          | axe-core (WCAG 2.0/2.1 A and AA): **no critical or serious violation** on `/`, `/reserver`, `/confidentialite`, `/mentions-legales`, `/admin` (AC-10); admin login rejects a wrong password |

The first axe run found a real issue (list items inside an element with `role="tabpanel"`), which was fixed.

## 5. Linting and quality gates (CI)

| Tool                                                                         | Gate                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ESLint (typescript-eslint, react-hooks, `no-console` except info/warn/error) | 0 warnings                                                                |
| Prettier                                                                     | `--check`                                                                 |
| TypeScript `strict` + `noUncheckedIndexedAccess`                             | `tsc --noEmit`                                                            |
| Coverage (v8)                                                                | ≥ 90 % lines on `src/server/domain` (current: 100 %); overall server 92 % |
| Conventional Commits                                                         | Squash-merge titles (convention, not enforced yet)                        |

## 6. Security tests

| Test                                                         | Where                    | Status                  |
| ------------------------------------------------------------ | ------------------------ | ----------------------- |
| Authorization matrix from the route table                    | Integration              | Done                    |
| Login brute-force limit and generic error                    | Integration              | Done                    |
| Booking/contact rate limits, honeypot                        | Integration              | Done                    |
| CSRF (Origin, JSON-only)                                     | Integration              | Done                    |
| Token handling (hash at rest, fragment, 404 on unknown)      | Unit + integration + E2E | Done                    |
| HTML escaping in emails                                      | Unit                     | Done                    |
| Dependency audit (`npm audit --omit=dev --audit-level=high`) | CI                       | Done: 0 vulnerabilities |
| Secret scan (gitleaks)                                       | CI                       | Done                    |
| API fuzzing (Schemathesis), ZAP baseline                     | —                        | Backlog                 |

## 7. Performance and accessibility

- axe-core in CI (done).
- Lighthouse CI and a k6 load test at 20 req/s on `/api/availability` (NFR-02, NFR-03): backlog.

## 8. Acceptance testing

Before each release, on the `main` branch deploy (staging):

- [ ] Book a service with "Peu importe" on a phone; confirmation email received in the Gmail test inbox.
- [ ] Open the private link, cancel; slot reappears.
- [ ] Book within 24 h; check that online cancellation is refused with the phone message.
- [ ] Admin: log in, see the booking in the agenda, cancel it, add a day off and a closure, check the public calendar.
- [ ] Check the Netlify function logs contain no email address.
- [ ] CI green on the tagged commit.

## 9. Test data

`src/server/db/seed.ts` loads the fictional salon (11 services, Inès, Malik, Camille, hours Tuesday–Friday 9:30–13:00 and 14:00–19:00, Saturday 9:00–18:00). Test emails use `example.com`. The seed refuses to run in production unless `ALLOW_SEED_PRODUCTION=yes` (needed once, to load the catalogue).
