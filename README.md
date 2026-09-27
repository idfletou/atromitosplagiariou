# Ατρόμητος Πλαγιαρίου F.C. — website

Mobile-first website for the club, built with **Astro** + **Tailwind CSS**, with
news managed in **Sanity** (a friendly CMS your editors use from any device) and
hosted for free on **Cloudflare Pages**.

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

Until Sanity is connected, the site shows sample news from
`src/data/sample-news.ts` so you can develop and preview freely.

## What lives where

| I want to edit…            | File                                        | Who        |
| -------------------------- | ------------------------------------------- | ---------- |
| Club name, town, socials   | `src/data/site.ts`                          | You        |
| Club history / about text  | `src/pages/about.astro`                     | You        |
| Men's team roster          | `src/data/roster.json`                      | You        |
| Men's coaching staff       | `src/pages/squads/men.astro` (`staff`)      | You        |
| Academy / youth teams      | `src/data/academy.ts` (`academyGroups`)     | You        |
| Squads overview            | `src/pages/squads/index.astro`              | You        |
| Team photos                | `public/team/` + `TeamPhoto` `src` prop     | You        |
| Sponsors (footer strip)    | `src/data/site.ts` (`sponsors`) + `public/sponsors/` | You |
| League & Cup results       | auto-scraped from epsm.gr (see below)       | Automatic  |
| News articles              | Sanity Studio (once set up)                 | Editors    |
| Colors / theme             | `src/styles/global.css` (`@theme`)          | You        |

### Academy / youth teams

All youth teams live on the single **Ακαδημίες** page (`/squads/academy`), each
shown as: a title, a team photo, and its coaches — stacked one after another.
Edit the `academyGroups` array in `src/data/academy.ts`: add/remove/reorder
groups, rename the `title`, set the `coaches`, and (optionally) a `photo` path
under `/public/team/`. No new files or routes needed.

### Adding a team photo

Drop the image in `public/team/` and pass its path to the `TeamPhoto` component
via the `teamPhoto` variable at the top of the relevant page (e.g. `men.astro`
or an academy page). Without a path it shows a labelled placeholder.

### Adding a player

Edit `src/data/roster.json` — add an object with a unique `id`, `name`,
`number`, and `position` (`GK`, `DEF`, `MID`, or `FWD`). Optional fields fill in
the flip-card:

- `photo` — portrait path, e.g. `/players/name.jpg` (shown on the card front)
- `birthDate` — date of birth as `YYYY-MM-DD` (displayed as `DD/MM/YYYY`)
- `height` — in cm

`birthDate` and `height` appear in the info list on the card back. The card
flips on tap (mobile) / hover (desktop) to reveal it. The build validates the
data, so a typo (e.g. a bad position or a wrongly-formatted date) fails loudly
instead of silently.

## League & Cup (auto-updated from epsm.gr)

Two pages, **no manual upkeep** — both scraped from the official federation site:

- **Αποτελέσματα → Πρωτάθλημα** (`/protathlima`) — the current & next matchup
  (with date, venue & kickoff), a full list of the team's completed results, and
  the league table.
- **Αποτελέσματα → Κύπελλο** (`/kypello`) — the team's cup run (each round's
  result + next tie).

How it works:

1. Three scrapers fetch the epsm.gr pages, parse only what concerns our club, and
   write JSON to `src/data/`:
   - `scrape-standings.mjs` → `standings.json` (the ranking table + legend)
   - `scrape-fixtures.mjs` → `fixtures.json` (full-season results + current/next
     matchup with date/venue/kickoff)
   - `scrape-cup.mjs` → `cup.json` (the cup run)
2. The Astro pages read that JSON at build time. The current/next matchup is
   **gameweek-anchored** (each fixture belongs to the week of its own date), so it
   stays on this week's game until Monday and postponements just follow the game.
3. A GitHub Action (`.github/workflows/standings.yml`) runs all three on a
   schedule (`npm run scrape`), commits the JSON if it changed, and that commit
   triggers a Cloudflare Pages rebuild — so the site refreshes a couple of
   minutes later.

**Safety:** if a fetch fails or a page looks empty, that scraper exits without
writing, so the last-good data is kept (pages never blank out). And a scrape that
finds no real change doesn't rewrite the files, so there's no needless rebuild.

Refresh locally any time: `npm run scrape` (or `scrape:standings` /
`scrape:fixtures` / `scrape:cup`).

**If the team changes division/group** (e.g. promotion), edit the one `DIORGANOSI`
line at the top of `scripts/scrape-standings.mjs` — copy the exact `diorganosi`
value from the epsm.gr standings URL. The cup scraper needs no such config.
(`OUR_TEAM` in both scripts is how we recognise our club; adjust only if the
federation renames it.)

> The scheduled auto-update only runs once the repo is on GitHub with Actions
> enabled (part of deployment). Until then, run the scrapers manually.

## News: connecting Sanity

The site reads news from Sanity when configured, and falls back to sample data
otherwise — no code change needed to switch over. Full step-by-step guide:
**[`sanity/README.md`](sanity/README.md)**.

Short version:

1. Create the Studio: `npm create sanity@latest -- --template clean --create-project "Atromitos FC" --dataset production --output-path studio`
2. Copy the schema from `sanity/schemaTypes/` into `studio/schemaTypes/`.
3. Put your project ID in `.env` (copy from `.env.example`).
4. `cd studio && npm run deploy` — send editors the Studio URL; they post from their phones.

Because the site is statically built, a published article goes live after a
rebuild. A **Sanity webhook → Cloudflare deploy hook** makes that automatic
(~1–2 min). See `sanity/README.md` step 6.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub/GitLab.
2. In the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers &
   Pages** → **Create** → **Pages** → **Connect to Git**, pick this repo.
3. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variables `PUBLIC_SANITY_PROJECT_ID` and
   `PUBLIC_SANITY_DATASET` (once Sanity is set up).
5. Deploy. Every push to the main branch redeploys automatically.

## Notes

- **Language:** the UI is in Greek (`lang="el"`).
- **Fonts:** self-hosted via Fontsource (no external requests) — **Inter** for
  body/UI and **Roboto Condensed** for display headings, both with the Greek
  subset. Configured in `src/styles/global.css` (`--font-sans` / `--font-display`);
  imported in `src/layouts/Layout.astro`. Big titles (`h1`/`h2`, plus the crest
  wordmark and player surnames via `font-display`) use the condensed face.
- **Performance:** near-zero JS (only the mobile menu toggle) and self-hosted
  fonts, so it's fast on mobile — where ~95% of traffic is expected.
- `TODO` comments mark placeholder content (founding year, history, staff names)
  to replace with real info.
