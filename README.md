# Advantage

> Your one stop insurance platform — quote, buy, manage and claim, all in the browser.

[![Deploy to GitHub Pages](https://github.com/charles2ke/Advantage/actions/workflows/deploy.yml/badge.svg)](https://github.com/charles2ke/Advantage/actions/workflows/deploy.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev/)

Advantage is a generic insurance platform that covers the full customer journey in one
application: browse the product catalogue, get an instant quote, buy the policy, manage it and
claim against it. It runs entirely in the browser — no backend, no database and no API keys.

**Live site:** <https://charles2ke.github.io/Advantage/>

![Advantage homepage](docs/screenshots/01-home.png)

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Accessibility and UX](#accessibility-and-ux)
- [Integrations](#integrations)
- [How the premium is calculated](#how-the-premium-is-calculated)
- [Renewals, cancellations and claims](#renewals-cancellations-and-claims)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Features

- **Product catalogue** — motor, home, life and travel cover, each with its own rating factors,
  optional extras and excess options (`src/domain/catalog.ts`).
- **Quoting** — a three step wizard collects the applicant details, the cover options and the
  answers to the risk questions, and prices the risk live as you type. Returning customers find
  their details filled in from their last quote, with a button to clear them
  (`src/components/QuoteWizard.tsx`).
- **Rating engine** — a deterministic pricing engine that builds the premium from the base rate,
  age and risk loadings, optional coverages, excess, loyalty discount and insurance premium tax,
  and returns a full breakdown (`src/domain/rating.ts`).
- **Policy administration** — quotes are saved for 30 days and can be discarded; expired quotes
  and quotes for products taken off sale are marked and cannot be bought. Accepted quotes are
  issued as 12 month policies. A policy can be renewed in the 30 days before expiry at a price
  worked out again for the new period of cover, or cancelled with a pro rata refund of the unused
  premium. Policies can be searched and filtered by status, and each one has a printable policy
  schedule at `#/policies/<policy number>` (`src/domain/policies.ts`,
  `src/pages/PolicySchedulePage.tsx`).
- **Claims** — claims are validated against the policy (cover period, sum insured), given a
  reference and tracked through submitted → in review → approved/declined → settled. Claims in the
  same period of cover share the sum insured, handlers can add a note to each step, the settlement
  is calculated net of the policy excess and recorded when the claim is paid, and the claims list
  can be filtered by status (`src/domain/claims.ts`).
- **Admin portal** — a setup area at `#/admin` where the platform is named, products are put on or
  taken off sale, the pricing rules (tax, instalment loading, loyalty discount, quote validity) are
  tuned, and the stored data can be backed up to a file, restored from one or cleared
  (`src/pages/AdminPage.tsx`, `src/domain/settings.ts`, `src/state/backup.ts`).
- **Real world integrations** — the platform calls live public services from the browser: postcodes
  are verified against postcodes.io and quote prices can be shown in another currency using the
  European Central Bank reference rates published by Frankfurter (`src/integrations/`).
- **Accessible by default** — a skip link, focus management on validation errors, per page
  document titles and a quote wizard you can step back through (`src/App.tsx`,
  `src/components/ErrorSummary.tsx`).
- **Persistence** — quotes, policies and claims are stored in the browser's local storage, so the
  platform runs as a static site with no backend. Data saved by earlier versions is checked and
  upgraded when it is loaded, and changes made in one tab appear in the other open tabs
  (`src/state/storage.ts`, `src/state/AppProvider.tsx`).

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org/) 24 (the version used in CI) and npm.

```bash
git clone https://github.com/charles2ke/Advantage.git
cd Advantage
npm install
npm run dev
```

The app is served on <http://localhost:5173>.

First run through the app:

1. Open the home page and pick a product.
2. Complete the three step quote wizard and review the premium breakdown.
3. Accept the quote to issue a policy, then view its schedule, renew it or cancel it on the
   **Policies** page.
4. Submit a claim against the policy on the **Claims** page.
5. Visit `#/admin` to rename the platform, change the pricing rules, or back up, restore or clear
   the stored data.

All data lives in your browser's local storage; clearing site data resets the platform, so download
a backup from the admin portal first if you want to keep it.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type check and build the production bundle into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Lint the source with oxlint |
| `npm test` | Run the unit and component tests with Vitest |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run the Playwright end to end tests (builds and previews the app) |

## Testing

- **Unit and component tests** (`tests/`) run on Vitest with Testing Library and jsdom. They cover
  the rating engine, policy and claim lifecycles, settings, the state reducer, persistence and
  backups, the integration clients, the accessibility behaviour (skip link, focus on errors, page
  titles) and the pages that use them.
- **End to end tests** (`e2e/advantage.spec.ts`) run on Playwright against the production build and
  walk the full journey: quote → policy → claim → admin, plus renewal, cancellation, the policy
  schedule, backup and restore, and syncing between tabs. The screenshots in `docs/screenshots` are
  produced by this suite, so they stay in step with the UI.

Playwright needs its browser once per machine:

```bash
npx playwright install --with-deps chromium
```

CI runs `npm run lint`, `npm test` and `npm run build` on every push to `main` before deploying.

## Project structure

```
src/domain       pure business logic: catalogue, rating, policies, claims, settings, dates, formatting
src/integrations clients for the external services the platform calls
src/state        reducer, selectors, React context provider, local storage persistence and backups
src/components   reusable UI: quote wizard, premium summary, product card, status badge, confirm panel
src/pages        home, quote, policies, policy schedule, claims and admin pages
src/router.ts    minimal hash router so the app deploys as static files
tests            Vitest unit and component tests
e2e              Playwright end to end tests (screenshots are written to docs/screenshots)
```

## Architecture

- **Pure domain layer.** Everything in `src/domain` is side effect free: ids are passed in by the
  caller, and timestamps are injectable but default to the current date when omitted, so quoting,
  issuing, renewing and claiming remain easy to test.
- **Single reducer.** Every state change goes through the pure reducer in `src/state/appReducer.ts`;
  `src/state/AppProvider.tsx` wires it to React context, mirrors the state into local storage and
  picks up changes that another tab saves there.
- **Static by design.** A minimal hash router (`src/router.ts`) keeps the app deployable as plain
  files on any static host, including GitHub Pages.
- **Isolated integrations.** External calls are confined to `src/integrations` behind a single
  result contract, so the rest of the app never deals with network failures directly.

## Accessibility and UX

The platform is keyboard and screen reader friendly:

- **Skip to main content.** The first control on every page moves focus straight to `<main>`,
  past the navigation.
- **Announced errors.** Validation problems are collected into a single summary
  (`src/components/ErrorSummary.tsx`) that is announced with `role="alert"` and takes focus, so
  the reason a quote or claim was rejected is never missed.
- **A wizard you can revisit.** The quote wizard shows which step you are on and which are
  complete, and completed steps are buttons that take you back with your answers intact.
- **Honest page titles.** The document title follows the route (`Get a quote — Advantage`), so
  tabs, history and bookmarks stay meaningful.
- **Live feedback.** The price panel updates as you answer, empty states explain what to do next,
  and every status is shown as a labelled badge rather than colour alone.
- **Confirm before acting.** Renewing or cancelling a policy and restoring a backup open an inline
  confirmation that takes focus and shows the new price, the refund or the contents of the backup
  first. Backing out returns focus to the control that opened it, and confirming moves focus to
  the result.
- **Printable schedule.** The policy schedule prints without the site navigation and buttons, so it
  can be printed or saved as a PDF from the browser.

## Integrations

Advantage talks to real, keyless public APIs so the platform works end to end as a static site with
no backend and no secrets to manage.

| Integration | Service | Used for |
| --- | --- | --- |
| Address lookup | [postcodes.io](https://postcodes.io/docs) (Ordnance Survey and ONS open data) | Verifying the postcode in the quote wizard and showing its district and region |
| Exchange rates | [Frankfurter](https://www.frankfurter.app/docs) (European Central Bank reference rates) | Showing the price of a quote in another currency |

Each integration lives in `src/integrations` behind a small contract: the client takes the request
and an optional endpoint, timeout, abort signal and `fetch` implementation, and always resolves to
`{ ok: true, data }` or `{ ok: false, error }`. Network errors, timeouts, error statuses and
unexpected payloads are turned into a readable message, so an outage never blocks a quote, and the
tests stub `fetch` instead of touching the network.

Administrators manage them under **Integrations** in the admin portal: each one can be turned off,
pointed at another https endpoint (for example a proxy of your own) and tested with a live
connection check. The configuration is validated and persisted with the rest of the settings.

Adding another integration means adding its client under `src/integrations` and registering it in
`src/integrations/catalog.ts`; the settings, persistence and admin portal pick it up from there.

## How the premium is calculated

1. **Base premium** — the product's flat premium plus a rate per 1,000 of the sum insured.
2. **Risk adjustment** — the age band multiplier and every risk answer multiplier applied to the
   base premium.
3. **Optional cover** — each selected extra adds a percentage of the risk adjusted premium.
4. **Excess** — a lower excess loads the premium, a higher excess discounts it.
5. **Loyalty discount** — 5% for each other policy in force, capped at 15%. Lapsed and cancelled
   policies do not count.
6. **Minimum premium, tax and instalments** — the net premium never falls below the product
   minimum, insurance premium tax of 12% is added, and paying monthly carries a 5% loading.

The tax rate, instalment loading, loyalty discount and quote validity are defaults that an
administrator can change in the admin portal; new quotes and renewals are rated with the saved
settings.

## Renewals, cancellations and claims

- **Quotes** can be bought for 30 days (an administrator can change this) and only while the
  product is on sale. Expired quotes are marked as such and can be discarded or quoted again with
  your details filled in.
- **Renewal** opens 30 days before a policy ends and stays open once it has lapsed. The new 12
  months start when the current cover ends, or on the day of renewal for a lapsed policy, and are
  priced again with the current settings, the policyholder's age on the new start date and the
  other policies in force. A policy saved by an earlier version without its risk answers keeps its
  current premium.
- **Cancellation** ends the cover straight away and refunds the unused days of the premium pro
  rata, so cancelling before the cover starts refunds it in full. No refund is due once a claim has
  been made in the current period of cover, unless that claim was declined.
- **Claims** must be for an incident during the period of cover. All the claims in one period of
  cover share its sum insured, apart from declined claims. The settlement is the amount claimed
  less the excess, and is recorded when the claim is settled.

**Known limitation:** a policy holds one period of cover at a time. Renewing replaces the current
period with the new one straight away, so claims can then only be made for incidents in the new
period, and cancelling before the new period starts refunds its premium in full but nothing for
the rest of the current one.

## Deployment

The app is a static site (hash routing, browser local storage) and is published to GitHub Pages by
the `.github/workflows/deploy.yml` workflow on every push to `main`. To enable it, set
**Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

The workflow builds with `BASE_PATH=/<repository name>/` so the assets resolve under the project
page URL. Locally `npm run build` defaults to a base of `/`; set `BASE_PATH` yourself to reproduce
the deployed build:

```bash
BASE_PATH=/Advantage/ npm run build && npm run preview
```

Any other static host works too: build the app and serve the contents of `dist/`.

## Screenshots

| Quote details | Quote result |
| --- | --- |
| ![Quote details](docs/screenshots/02-quote-details.png) | ![Quote result](docs/screenshots/03-quote-result.png) |

| Policies | Claim submitted |
| --- | --- |
| ![Policies](docs/screenshots/04-policies.png) | ![Claim submitted](docs/screenshots/05-claim-submitted.png) |

| Claim settled | Admin portal |
| --- | --- |
| ![Claim settled](docs/screenshots/06-claim-settled.png) | ![Admin portal](docs/screenshots/07-admin.png) |

| Quote with a converted price | Integrations in the admin portal |
| --- | --- |
| ![Converted price](docs/screenshots/08-integrations.png) | ![Admin integrations](docs/screenshots/09-admin-integrations.png) |

| Policy schedule | Renewal at the new price |
| --- | --- |
| ![Policy schedule](docs/screenshots/10-policy-schedule.png) | ![Renewal](docs/screenshots/11-renewal.png) |

| Cancellation with a refund | Claims filtered by status |
| --- | --- |
| ![Cancellation](docs/screenshots/12-cancellation.png) | ![Claims filtered by status](docs/screenshots/13-claims-filter.png) |

| Backup and restore | Details filled in for a returning customer |
| --- | --- |
| ![Backup and restore](docs/screenshots/14-backup-restore.png) | ![Returning customer](docs/screenshots/15-quote-prefill.png) |

## Contributing

Issues and pull requests are welcome. Before opening a pull request:

```bash
npm run lint
npm test
npm run build
```

Keep business logic in `src/domain` pure, route state changes through `src/state/appReducer.ts`,
and add tests alongside the existing suites in `tests/`.

## Security

Advantage stores everything in your browser and calls only public, keyless APIs, so there are no
credentials to manage. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

Released under the [GNU Affero General Public License v3.0](LICENSE).

---

Advantage is a demonstration platform: no real insurance cover is provided and all data stays in
your browser.
