# Ατρόμητος Πλαγιαρίου F.C. — website

Official site for a Greek amateur football club (Α.Σ. Ατρόμητος Πλαγιαρίου, ΕΠΣ
Μακεδονίας). **Mobile-first** (~95% of traffic is phones). UI is **in Greek**
(`lang="el"`) — keep all user-facing copy Greek.

## Stack

- **Astro 7** (static output) + **Tailwind CSS v4** (CSS-first config), TypeScript strict.
- Node **>= 22.12**.
- **News CMS:** Sanity (with a local sample-data fallback until it's connected).
- **Standings/Cup:** auto-scraped from epsm.gr (see below).
- **Hosting:** Cloudflare Pages (static).
- Fonts self-hosted via Fontsource (no external requests): **Inter** (body) +
  **Roboto Condensed** (display). Configured in `src/styles/global.css`
  (`--font-sans` / `--font-display`), imported in `src/layouts/Layout.astro`.
  `h1`/`h2` and anything with the `font-display` class use the condensed face.
- Brand colours: `--color-brand-*` (blue scale) in `global.css` `@theme`. Club
  colours are blue & white. Crest: `public/crest.png`.

## Commands

```bash
npm install
npm run dev              # dev server → http://localhost:4321
npm run build            # production build → dist/
npm run preview          # serve the production build
npm run scrape           # refresh standings + fixtures + cup JSON from epsm.gr
npm run scrape:standings # just the league table
npm run scrape:fixtures  # just the fixtures/results (full season)
npm run scrape:cup       # just the cup
```

## Routes & pages

| Route | File | What |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | Hero + latest news + squads teaser |
| `/about` | `src/pages/about.astro` | Club history/identity (real content) |
| `/squads` | `src/pages/squads/index.astro` | Overview: Ανδρική Ομάδα + Ακαδημίες |
| `/squads/men` | `src/pages/squads/men.astro` | Men's roster (flip cards) + coaches |
| `/squads/academy` | `src/pages/squads/academy.astro` | All youth teams, stacked |
| `/news` | `src/pages/news/index.astro` | News listing |
| `/news/[slug]` | `src/pages/news/[slug].astro` | News article |
| `/protathlima` | `src/pages/protathlima.astro` | League table (Αποτελέσματα › Πρωτάθλημα) |
| `/kypello` | `src/pages/kypello.astro` | Cup run (Αποτελέσματα › Κύπελλο) |

**Nav** is data-driven in `src/data/site.ts` (`nav`), and supports dropdown
parents via `children` (rendered by `Header.astro`; `Footer.astro` flattens it).
Current order: Αρχική · Ο Σύλλογος · Νέα · Ομάδες · Αποτελέσματα (▾ Πρωτάθλημα,
Κύπελλο).

## Where content lives (editing guide)

| To change… | Edit |
| --- | --- |
| Club name, town, founded, url, **email**, **phone**, socials | `src/data/site.ts` (`site`) |
| Navigation | `src/data/site.ts` (`nav`) |
| Sponsors (footer strip) | `src/data/site.ts` (`sponsors`) + logos in `public/sponsors/` |
| Stadium / footer map | `src/data/site.ts` (`stadium`) |
| Club history / about text | `src/pages/about.astro` |
| Men's roster (players) | `src/data/roster.json` (schema: `src/content.config.ts`) |
| Men's coaching staff | `src/pages/squads/men.astro` (`staff`) |
| Academy / youth teams | `src/data/academy.ts` (`academyGroups`) |
| Team photos | `public/team/` + the `photo` field / `TeamPhoto` `src` |
| Colours / fonts | `src/styles/global.css` |

### Adding a men's player
Add an object to `src/data/roster.json`: unique `id`, `name`, `number`,
`position` (`GK`/`DEF`/`MID`/`FWD`), optional `birthDate` (`YYYY-MM-DD`, shown
`DD/MM/YYYY`), `previousTeam` (shown as "Πρ. Ομάδα" on the card back), `photo`
(`/players/…`). The build validates it.

### Adding a youth team
Edit the `academyGroups` array in `src/data/academy.ts` — each entry is
`{ title, photo?, coaches:[{name, role}] }` and renders as title + photo +
coaches, stacked. No new files/routes.

Shared components: `TeamPhoto.astro` (photo banner, shows a placeholder when no
`src`), `Coaches.astro` (staff grid), `PlayerCard.astro` (flip card),
`SectionHeading.astro` (blue-accent section title), `Sponsors.astro`,
`StadiumMap.astro`, `StandingsTable.astro`, `NewsCard.astro`.

## News (Sanity CMS)

**Status: LIVE & fully automatic** (set up 2026-09-26). Editors publish → the
public site rebuilds itself and the post is live in ~1–2 min. No developer needed.

- **Editor Studio:** https://atromitos-plagiariou.sanity.studio (team logs in here
  from any device/phone).
- **Sanity project:** id `8xb5eyjm`, dataset `production`. Studio source lives
  in-repo at **`studio/`** (its own package; Cloudflare ignores it and builds only
  the site root). Redeploy the Studio after schema changes: `cd studio && npm run deploy`.
- The site reads news in `src/lib/news.ts`: **if `PUBLIC_SANITY_PROJECT_ID` is set
  it pulls from Sanity, else it falls back to `src/data/sample-news.ts`**. The env
  vars are set both locally (`.env`, gitignored) and in Cloudflare Production, so
  live + local both use Sanity. (For local dev *without* Sanity, blank the env var;
  it then uses the sample posts.)

### How editors add a news post
1. Open **https://atromitos-plagiariou.sanity.studio**, log in.
2. **Άρθρο → +**: **title** + **body** are all that's needed. Date (defaults to
   now), cover image and an optional excerpt are extra. The **slug
   is auto-derived from the title** (the field is hidden — no "Generate" click),
   and if the **excerpt** is left blank the site uses the start of the body for
   card/social previews. Slug derivation + excerpt fallback live in
   `src/lib/news.ts` (`slugify()` transliterates Greek → ASCII); the schema makes
   both fields optional/hidden, so **redeploy the Studio after schema edits**
   (`cd studio && npm run deploy`).
3. **Publish.** A Sanity webhook hits a Cloudflare deploy hook → the site rebuilds
   and the post appears in ~1–2 min. Deleting/editing a post works the same way.

### Editing the schema
The post schema is `studio/schemaTypes/postType.ts` (mirrored in `sanity/schemaTypes/`).
Field names must match the GROQ queries in `src/lib/news.ts`. After changing it,
`cd studio && npm run deploy`. Full original setup walkthrough: `sanity/README.md`.

## Standings, Fixtures & Cup (auto-scraped from epsm.gr)

`/protathlima` and `/kypello` are generated from JSON that scrapers produce from
the official federation site — **no manual upkeep**. Shared helpers (incl. the
write-only-on-change guard) live in `scripts/lib.mjs`. Config lives at the top of
each script: **`DIORGANOSI`** (the league/group — change this one line on
promotion/relegation) and `OUR_TEAM` (name-match strings).

- `scripts/scrape-standings.mjs` → `src/data/standings.json` — just the ranking
  **table** + zone legend (from `table.asp`).
- `scripts/scrape-fixtures.mjs` → `src/data/fixtures.json` — our **full-season
  fixtures/results**, from `table_analytika.asp` (every matchday, real matchday
  numbers, scores) enriched with date/venue/kickoff for the imminent round from
  `scores.asp`. Derives `results` (played, newest first), `current`, and `next`.
  - **current/next are gameweek-anchored:** a week runs Mon→Sun and each fixture
    belongs to the week of *its own date*, so `current` stays on this week's game
    (with its score once played) until Monday, and postponements follow the game
    instead of a blind calendar flip. Fallbacks: bye/gap week → `current` = last
    result; far-future fixtures have no date yet (shown "Ημερομηνία σύντομα").
  - **Postponed games:** an unplayed fixture from a round the league has *already
    played* (tracked via `leaguePlayedThrough` = highest matchday any team has
    played in the full programme) is classed as **postponed** when epsm has
    clearly dropped it — **its date is cleared to null** (removed from the
    schedule), OR **>48h have passed since its date** with still no result. The
    48h grace is deliberate: epsm is often slow to enter weekend scores, so a game
    played Sat/Sun is NOT mislabelled on Monday — it only flags from ~48h after
    its date (a re-dated/future fixture is never flagged). Postponed games go in a
    separate `postponed` list, are NEVER shown as current/next (otherwise the page
    gets stuck on an old round), and appear as a row in the results table
    (`ResultsTable`) with an **"Αναβλ."** badge instead of a score. Byes (our group
    has an odd number of teams, so one team sits out each round) just leave a gap
    in our matchday numbers and don't affect any of this.
  - This is also why matchday numbers are always correct — each fixture carries
    its own `matchday`, never guessed from a page header.
- `scripts/scrape-cup.mjs` → `src/data/cup.json` (our cup run). Match ordering is
  keyed off `game_number` (falls back to date) — **never** the phase title, so
  renamed rounds ("Ημιτελικά", "Τελικός") just work.
- All use **cheerio** (devDependency) and are **fail-safe**: if a fetch fails or a
  page parses to too little, the script exits **without writing**, keeping the
  last-good JSON. Standings also verifies `W+D+L == games played` (catches a
  column-layout change) and that our club is present; fixtures requires a minimum
  count of our games.
- **Write-only-on-change:** `writeIfChanged()` skips the write when only the
  `updatedAt` timestamp would differ, so the scheduled job doesn't commit (or
  rebuild Cloudflare) when nothing actually changed.
- **`.github/workflows/standings.yml`** runs `npm run scrape` on a schedule
  (daily + Sunday evenings), commits the JSON if it changed, which triggers a
  Cloudflare rebuild. Needs "Read and write permissions" under repo Settings →
  Actions → General.

UI: `MatchupCard.astro` (current/next cards), `ResultsTable.astro` (our completed
results, opponent-centric), `StandingsTable.astro` (the table). Render-layer
display tweaks live in `StandingsTable.astro` (NOT the scraper/JSON, which stay a
faithful mirror): the white "promotion" zone marker is shown teal, and legend
labels are tidied (`displayColor()` / `cleanLabel()`).

## Deploying to Cloudflare Pages

**Status: LIVE.** Deployed 2026-09-26.
- **Live site:** https://atromitosplagiariou.pages.dev (custom domain pending).
- **GitHub repo:** https://github.com/idfletou/atromitosplagiariou (branch `main`).
- **Auto-deploy:** every push to `main` triggers a Cloudflare rebuild (git integration).

Build settings already configured in the Pages project: framework preset **Astro**,
build command **`npm run build`**, output dir **`dist`**, production branch **`main`**.

Configured:
- **Env vars** (Cloudflare Production, plain text): `PUBLIC_SANITY_PROJECT_ID=8xb5eyjm`,
  `PUBLIC_SANITY_DATASET=production` — live site reads news from Sanity.
- **Deploy hook** on branch `main` (Settings → Builds & deployments), pointed at by a
  **Sanity webhook** (create/update/delete of `post`) — publishing news auto-rebuilds
  the site. (The standings/cup GitHub Action doesn't use the hook — its commits already
  trigger Cloudflare's git build.)

Still to do:
- **Custom domain:** when connected (Pages project → Custom domains), update `site.url`
  in `src/data/site.ts` to it (used for canonical/OG URLs).

Everyday update workflow: `git add -A && git commit -m "…" && git push` → auto-deploys.

## Notes / gotchas for agents

- **Everything is Greek.** Keep copy in Greek; don't introduce English UI text.
- **PowerShell `Get-Content` mangles Greek** (console encoding) — the JSON/TS
  files are correct UTF-8; verify with the Read tool, not `Get-Content`.
- `StadiumMap.astro` nudges the Google Maps iframe `top:-46px` on purpose to crop
  Google's "Χάρτες" control; the whole map is a link to Google Maps. Don't "fix"
  the negative offset.
- The footer map loads third-party Google content (the only external request;
  fonts are self-hosted).
- Standings/fixtures/cup JSON is machine-generated — don't hand-edit; change the
  scraper or the display components instead.
- **Never put `[skip ci]` (or `[ci skip]`, `[skip-ci]`, `[CF-Pages-Skip]`, …) in a
  commit message.** Cloudflare Pages honors it and **skips the deployment**, so the
  live site silently stops updating. (The scraper Action used to do this and the
  site got stuck on stale data — the Action runs on a schedule, not on push, so it
  never needed it.) If the scheduled scrape ever adds a data source, also add its
  JSON to the `git add` + change-check in `standings.yml`.
- Dev server: `npm run dev`. In the Claude Code preview pane, the Google Maps
  iframe can cause occasional blank screenshots — retry, or verify via DOM/JS.

## Astro docs

Full docs: https://docs.astro.build — see guides for
[routing](https://docs.astro.build/en/guides/routing/),
[components](https://docs.astro.build/en/basics/astro-components/),
[content collections](https://docs.astro.build/en/guides/content-collections/),
and [styling/Tailwind](https://docs.astro.build/en/guides/styling/).
