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
npm run scrape           # refresh standings + cup JSON from epsm.gr
npm run scrape:standings # just the league table
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
`DD/MM/YYYY`), `height` (cm), `photo` (`/players/…`). The build validates it.

### Adding a youth team
Edit the `academyGroups` array in `src/data/academy.ts` — each entry is
`{ title, photo?, coaches:[{name, role}] }` and renders as title + photo +
coaches, stacked. No new files/routes.

Shared components: `TeamPhoto.astro` (photo banner, shows a placeholder when no
`src`), `Coaches.astro` (staff grid), `PlayerCard.astro` (flip card),
`SectionHeading.astro` (blue-accent section title), `Sponsors.astro`,
`StadiumMap.astro`, `StandingsTable.astro`, `NewsCard.astro`.

## News (Sanity CMS)

News is read by `src/lib/news.ts`: **if `PUBLIC_SANITY_PROJECT_ID` is set it
pulls from Sanity, otherwise it falls back to `src/data/sample-news.ts`** (three
placeholder posts) so the site always builds. No code change needed to switch.

### How editors add a news post (once Sanity is set up)
1. Go to the deployed **Sanity Studio** URL (editors log in from any device/phone).
2. Create a new **Άρθρο (post)**: title, slug (auto), excerpt, category, date,
   cover image, body.
3. Publish. Because the site is statically built, a **Sanity webhook → Cloudflare
   deploy hook** rebuilds the site and the post is live in ~1–2 minutes.

### Setting up Sanity (one time)
Full walkthrough in **`sanity/README.md`**. Summary: `npm create sanity@latest`
(clean template) → copy the schema from `sanity/schemaTypes/` into the studio →
put the project id in `.env` (see `.env.example`) → `cd studio && npm run deploy`
→ add a webhook pointing at a Cloudflare deploy hook. The post schema field names
must match the GROQ queries in `src/lib/news.ts`.

For local dev without Sanity, edit `src/data/sample-news.ts`.

## Standings & Cup (auto-scraped from epsm.gr)

`/protathlima` and `/kypello` are generated from JSON that scrapers produce from
the official federation site — **no manual upkeep**.

- `scripts/scrape-standings.mjs` → `src/data/standings.json` (league table + our
  last result & next fixture). Config at top: **`DIORGANOSI`** (the league/group;
  change this one line on promotion/relegation) and `OUR_TEAM` (name-match strings).
- `scripts/scrape-cup.mjs` → `src/data/cup.json` (our cup run). Match ordering is
  keyed off `game_number` (falls back to date) — **never** the phase title, so
  renamed rounds ("Ημιτελικά", "Τελικός") just work.
- Both use **cheerio** (devDependency) and are **fail-safe**: if a fetch fails or
  the page looks empty/wrong, the script exits **without writing**, keeping the
  last-good JSON. The standings scraper also verifies `W+D+L == games played`
  (catches a column-layout change) and that our club is present.
- **`.github/workflows/standings.yml`** runs `npm run scrape` on a schedule
  (daily + Sunday evenings), commits the JSON if it changed, which triggers a
  Cloudflare rebuild. This only runs once the repo is on GitHub with Actions
  enabled — until then, run `npm run scrape` manually and commit.

Render-layer display tweaks live in `StandingsTable.astro` (NOT the scraper/JSON,
which stay a faithful mirror): the white "promotion" zone marker is shown teal,
and legend labels are tidied (`displayColor()` / `cleanLabel()`).

## Deploying to Cloudflare Pages

**Status: LIVE.** Deployed 2026-09-26.
- **Live site:** https://atromitosplagiariou.pages.dev (custom domain pending).
- **GitHub repo:** https://github.com/idfletou/atromitosplagiariou (branch `main`).
- **Auto-deploy:** every push to `main` triggers a Cloudflare rebuild (git integration).

Build settings already configured in the Pages project: framework preset **Astro**,
build command **`npm run build`**, output dir **`dist`**, production branch **`main`**.

Still to do:
- **Env vars** (add in Cloudflare once Sanity is set up): `PUBLIC_SANITY_PROJECT_ID`,
  `PUBLIC_SANITY_DATASET` (= `production`). Until then the site builds with sample news.
- **Deploy hook** (Settings → Builds & deployments) pointed at by a **Sanity webhook**,
  so publishing a news post triggers a rebuild. (The standings/cup GitHub Action doesn't
  need the hook — its commits to the repo already trigger Cloudflare's git build.)
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
- Standings/cup JSON is machine-generated — don't hand-edit; change the scraper or
  the display components instead.
- Dev server: `npm run dev`. In the Claude Code preview pane, the Google Maps
  iframe can cause occasional blank screenshots — retry, or verify via DOM/JS.

## Astro docs

Full docs: https://docs.astro.build — see guides for
[routing](https://docs.astro.build/en/guides/routing/),
[components](https://docs.astro.build/en/basics/astro-components/),
[content collections](https://docs.astro.build/en/guides/content-collections/),
and [styling/Tailwind](https://docs.astro.build/en/guides/styling/).
