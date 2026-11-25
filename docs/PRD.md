# PRD — Salon booking web application

|                  |                                                                                 |
| ---------------- | ------------------------------------------------------------------------------- |
| **Working name** | Studio Sillage (fictional salon)                                                |
| **Status**       | **v1.0, approved 2026-11-25.** MVP implemented the same day (see `ROADMAP.md`). |
| **Owner**        | One student, course project, submission 2026-11-25                              |

**Legend**

- **[C] Confirmed**: you stated it, or accepted it when the assumptions were reviewed on 2026-11-25.
- **[R] Recommendation**: a technical or product choice made by the plan, open to challenge.
- **Deferred**: agreed, but not in today's release.

**Changes from v0.2:** deadline is today, so the scope is cut to a same-day MVP; stack moved to Netlify + Nodemailer (Gmail); business rules BR-01 to BR-09 accepted; testimonials removed; open questions closed (section 9).

---

## 1. Problem statement and objectives

**Problem [C].** A hair salon takes appointments by phone and in person. Clients cannot see availability, and the owner has no single view of the agenda.

**Business objective [C].** Clients discover the salon and book online at any time, with no phone call. The owner has one place to see and manage bookings.

**Project objective [C].** Course project judged on engineering quality (tests, CI, deployment, documentation), not revenue. The salon, prices, team, illustrations and legal texts are **fictional placeholders**. Real personal data is only entered by testers.

## 2. Target users

| User                   | Status       | Description                                                                    |
| ---------------------- | ------------ | ------------------------------------------------------------------------------ |
| **Client (guest)**     | [C]          | Books from a phone or laptop. No account.                                      |
| **Admin (owner)**      | [C]          | One account. Sees the agenda, cancels bookings, records days off and closures. |
| Stylist with own login | [C] excluded | Clients plus one admin only.                                                   |
| Grader                 | [C]          | Reads the repository, CI results and the live site.                            |

## 3. Requirements

Priority: **M** = must, **S** = should, **C** = could. "Today" = shipped in v1.0.

### 3.1 Functional

| ID    | Requirement                                                                                               | Prio | v1.0                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| FR-01 | List services (name, description, duration, price) by category: women, men, children.                     | M    | Today                                                                                 |
| FR-02 | Show the team (name, specialty, short bio).                                                               | M    | Today                                                                                 |
| FR-03 | Gallery of work (illustrations, no real photos).                                                          | M    | Today                                                                                 |
| FR-04 | Contact: address, hours, schematic map, form that emails the salon.                                       | M    | Today                                                                                 |
| FR-05 | Online booking: service → stylist or "no preference" → day on a calendar → time slot → details → confirm. | M    | Today                                                                                 |
| FR-06 | Guest booking: name, email, optional phone, optional note.                                                | M    | Today                                                                                 |
| FR-07 | Confirmation email with a private link to view or cancel.                                                 | M    | Today                                                                                 |
| FR-08 | Reminder email about 24 h before.                                                                         | M    | Today                                                                                 |
| FR-09 | Client cancels through the private link, free until 24 h before.                                          | M    | Today                                                                                 |
| FR-10 | Cancellation emails to client and salon.                                                                  | S    | Today                                                                                 |
| FR-11 | Admin login and logout.                                                                                   | M    | Today                                                                                 |
| FR-12 | Admin manages services (create, edit, deactivate).                                                        | M    | **Deferred**: services come from the seed file                                        |
| FR-13 | Admin manages stylists: services, weekly hours, days off, salon closures.                                 | M    | **Partly**: days off and closures today; services and weekly hours from the seed file |
| FR-14 | Admin lists bookings by week and cancels one.                                                             | M    | Today                                                                                 |
| FR-15 | Admin creates a booking manually.                                                                         | S    | Deferred                                                                              |
| FR-16 | Legal notice and privacy policy (templates).                                                              | M    | Today                                                                                 |
| FR-17 | Admin marks completed / no-show.                                                                          | C    | Deferred (statuses already exist in the schema)                                       |

### 3.2 Non-functional

| ID     | Requirement                                        | Target                                                                          | v1.0                        |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| NFR-01 | No double booking, even under concurrent requests. | Enforced by a PostgreSQL exclusion constraint                                   | Done, tested                |
| NFR-02 | Availability query speed.                          | p95 < 500 ms at 20 req/s                                                        | Deferred (no load test yet) |
| NFR-03 | Front-end performance.                             | Lighthouse ≥ 90 mobile                                                          | Deferred (not measured)     |
| NFR-04 | Accessibility.                                     | WCAG 2.1 AA; zero critical or serious axe violations; keyboard-operable booking | axe in CI on 5 pages        |
| NFR-05 | Responsive.                                        | 360–1440 px                                                                     | E2E on desktop and Pixel 5  |
| NFR-06 | Language.                                          | French UI                                                                       | Done                        |
| NFR-07 | Time zone.                                         | Shown in Europe/Paris, stored in UTC                                            | Done, DST tested            |
| NFR-08 | Privacy.                                           | Minimisation, information notice, retention limits (section 7)                  | Done                        |
| NFR-09 | Security.                                          | OWASP Top 10 mitigations (`ARCHITECTURE.md` section 8)                          | Done for MVP scope          |
| NFR-10 | Cost.                                              | €0/month (Netlify Free, Neon Free, Gmail)                                       | By design                   |
| NFR-11 | Availability.                                      | Best effort                                                                     | —                           |
| NFR-12 | Maintainability.                                   | CI green on `main`, lint enforced, tests on all business rules                  | Done                        |
| NFR-13 | Browsers.                                          | Last 2 versions of Chrome, Firefox, Safari, Edge                                | Chromium tested in CI       |

## 4. Business rules [C] (accepted as written)

| ID    | Rule                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| BR-01 | One service per booking. Durations fixed per service.                                                      |
| BR-02 | A stylist is bookable only for services they perform, inside working hours, outside days off and closures. |
| BR-03 | "No preference" picks the free eligible stylist with the fewest bookings that day (tie: display order).    |
| BR-04 | Slots start every 15 minutes (local time).                                                                 |
| BR-05 | Minimum lead time 2 hours. Horizon 90 days.                                                                |
| BR-06 | Client cancellation allowed until 24 hours before the start; after that, phone the salon.                  |
| BR-07 | At most 3 future confirmed bookings per email address.                                                     |
| BR-08 | Payment at the salon. No online payment.                                                                   |
| BR-09 | Prices in euros, VAT included.                                                                             |

## 5. MVP scope (v1.0, shipped today)

**In:** FR-01 to FR-11, FR-13 (days off and closures), FR-14, FR-16; NFR-01, 04–10, 12.
**Backlog:** FR-12, rest of FR-13, FR-15, FR-17; NFR-02, NFR-03 measurement; AC-09, AC-13 (see `ROADMAP.md` section 3).

## 6. Explicitly out of scope

| Out                                                      | Why                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Online payment, deposits, no-show fees                   | PCI and refund complexity; no confirmed need.                                                       |
| SMS                                                      | Paid per message; you chose email.                                                                  |
| Client accounts and history                              | Guest booking chosen.                                                                               |
| Stylist logins                                           | One admin only.                                                                                     |
| Multi-salon, multi-language, multi-currency              | Not requested.                                                                                      |
| Multi-service bookings, recurring bookings, waiting list | Little course value.                                                                                |
| Reviews and **testimonials**                             | Not requested. The demo's invented client quotes were **removed**: they would read as real reviews. |
| Calendar sync                                            | Not requested.                                                                                      |
| Native app                                               | Responsive web only.                                                                                |
| Admin password reset by email, 2FA                       | Reset = generate a new hash with `npm run admin:hash` and update the environment variable.          |
| Real photos, prices, legal review                        | Placeholders.                                                                                       |

## 7. Data and privacy rules

- Collected from clients: name, email, optional phone, optional note. Nothing else. No analytics, no cookies on public pages.
- **Lawful basis: performance of the requested service (GDPR art. 6(1)(b)), not consent.** The booking form shows an information notice linking to the privacy policy; the booking stores the notice version shown (`privacy_notice_version`). Emails are service messages.
- Booking personal data is anonymised 12 months after the appointment; contact messages are deleted after 90 days (nightly scheduled function).
- The private link token is never stored in clear (SHA-256 hash only). Consequence: the reminder email links to the site, not to the private link.
- The privacy policy page states these rules. It is a template, not legal advice.

## 8. Measurable acceptance criteria

| ID    | Criterion                                                                                                                                  | Verified by                                                          | v1.0                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| AC-01 | A visitor completes a booking in a handful of interactions after choosing the service (stylist optional, day, slot, name, email, confirm). | E2E (`e2e/booking.spec.ts`)                                          | Pass                                     |
| AC-02 | Two simultaneous requests for the same stylist and slot: exactly one 201, the other 409 `slot_taken`.                                      | Integration test, 25 rounds                                          | Pass                                     |
| AC-03 | No slot outside working hours, on days off, closures, or inside the lead time.                                                             | Unit + integration                                                   | Pass                                     |
| AC-04 | Correct availability on DST change days.                                                                                                   | Unit tests (29 March and 25 October 2026)                            | Pass                                     |
| AC-05 | Confirmation email sent with a working private link.                                                                                       | Integration (in-memory mailer) + E2E (link on the confirmation page) | Pass                                     |
| AC-06 | Reminder job sends exactly one reminder per booking even if run twice; failed sends are retried.                                           | Integration                                                          | Pass                                     |
| AC-07 | Cancel via link before 24 h frees the slot; after 24 h refused with a clear message.                                                       | Integration + E2E                                                    | Pass                                     |
| AC-08 | Every admin route returns 401 without a valid session; after 5 failed logins in 15 min, the 6th attempt returns 429.                       | Integration (route list read from the router)                        | Pass                                     |
| AC-09 | Admin creates a service and sees it bookable.                                                                                              | —                                                                    | Deferred with FR-12                      |
| AC-10 | Zero critical or serious axe violations on public pages.                                                                                   | E2E + axe in CI                                                      | Pass (5 pages)                           |
| AC-11 | Coverage ≥ 90 % lines on domain rules.                                                                                                     | CI coverage gate                                                     | Pass (100 % lines)                       |
| AC-12 | CI green on `main`; deployment from the pipeline.                                                                                          | GitHub Actions + Netlify                                             | To verify after you connect the accounts |
| AC-13 | Backup restore rehearsed.                                                                                                                  | Manual drill                                                         | Deferred                                 |
| AC-14 | No secret in the repo; no high or critical vulnerability in production dependencies.                                                       | gitleaks + `npm audit` in CI                                         | Pass (0 vulnerabilities on 2026-11-25)   |
| AC-15 | Recurring hosting cost €0.                                                                                                                 | Billing pages                                                        | By design                                |

## 9. Decisions recorded on 2026-11-25

1. **Context:** course project, solo, due today. [C]
2. **Content:** French only, fictional content; testimonials removed. [C]
3. **Repository and hosting:** new public GitHub repository, no custom domain, CI in the style of the DevOps lab. [C]
4. **Email:** Nodemailer through a Gmail account with an app password (no domain needed). [C]
5. **Hosting:** Netlify (site + functions) with Neon Postgres. [C]
6. **Business rules:** BR-01 to BR-09 accepted as written. [C]
