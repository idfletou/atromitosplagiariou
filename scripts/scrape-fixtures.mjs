// Scrapes each configured league's FULL-SEASON fixtures & results from epsm.gr
// and writes src/data/fixtures-<key>.json (one per league — see leagues.mjs).
//
// Per league, two sources are combined:
//   • table_analytika.asp — every matchday with our fixtures, real matchday
//     numbers, and final scores once played.
//   • scores.asp — the imminent round with date + venue + kickoff, enriching the
//     "current"/"next" matchup cards.
// From the list we derive results (newest first), current (this gameweek),
// next, and postponed. See the derivation comments below.
//
// Fail-safe: a league whose pages fail to fetch/parse is SKIPPED (its last-good
// file kept) and the others still update.
//
// Run locally with:  npm run scrape:fixtures

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";
import { writeIfChanged, norm, deaccent, makeIsOurs } from "./lib.mjs";
import { LEAGUES } from "./leagues.mjs";

const MIN_FIXTURES = 10; // safety floor
const POSTPONE_GRACE_MS = 48 * 60 * 60 * 1000;
const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data");

// Youth programmes may append a tiebreak marker to names, e.g. "… ΙΣΟΒ. 0".
const cleanTeam = (name) => norm(name).replace(/\s*ΙΣΟΒ\.?\s*-?\d+\s*$/u, "").trim();
// dd.mm.yyyy → JS Date at UTC midnight (or null).
const toDate = (d) => {
  const m = (d || "").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
};

// Current gameweek runs Monday→Sunday of the run date (shared across leagues).
const now = new Date();
const dow = now.getUTCDay(); // 0=Sun … 6=Sat
const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (dow === 0 ? -6 : 1 - dow)));
const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekStart.getUTCDate() + 7); // exclusive: next Monday 00:00

async function scrapeFixtures(league) {
  const tag = `fixtures:${league.key}`;
  const isOurs = makeIsOurs(league.ourTeam);
  const enc = encodeURIComponent(league.diorganosi);
  const ANALYTIKA_URL = `https://www.epsm.gr/table_analytika.asp?diorganosi=${enc}`;
  const SCORES_URL = `https://www.epsm.gr/scores.asp?diorganosi=${enc}`;
  const TABLE_URL = `https://www.epsm.gr/table.asp?diorganosi=${enc}`;
  const out = resolve(DATA_DIR, `fixtures-${league.key}.json`);
  const skip = (msg) => {
    console.error(`[${tag}] ${msg} — keeping last-good`);
    return false;
  };
  const fetchHtml = async (url, label) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "AtromitosPlagiariouBot/1.0 (+club website fixtures sync)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${label}`);
    return res.text();
  };

  let analytikaHtml, scoresHtml;
  try {
    analytikaHtml = await fetchHtml(ANALYTIKA_URL, "the analytic fixtures page");
    scoresHtml = await fetchHtml(SCORES_URL, "the scores page");
  } catch (e) {
    return skip(`fetch failed: ${e.message}`);
  }

  // ── 1) Full season from table_analytika.asp ───────────────────────────────
  const $ = cheerio.load(analytikaHtml);
  let currentMd = null;
  const all = [];
  $(".matchday-title, .match-row").each((_, el) => {
    const $el = $(el);
    if ($el.hasClass("matchday-title")) {
      const m = $el.text().match(/(\d+)/);
      if (m) currentMd = Number(m[1]);
      return;
    }
    const rawHtml = $el.html() || "";
    const date = (rawHtml.match(/match_date=(\d{1,2}\.\d{1,2}\.\d{4})/) || [])[1] || null;
    const parts = rawHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, "\u0001")
      .split(/\u0001+/)
      .map((s) => norm(s))
      .filter(Boolean);
    const teamsPart = parts.find((p) => / - /.test(p));
    if (!teamsPart) return;
    const [home, away] = teamsPart.split(/ - /).map((s) => cleanTeam(s));
    if (!home || !away) return;
    const rest = parts.slice(parts.indexOf(teamsPart) + 1).join(" ");
    const sc = rest.match(/(\d+)\s*-\s*(\d+)/);
    all.push({
      matchday: currentMd,
      home,
      away,
      homeScore: sc ? Number(sc[1]) : null,
      awayScore: sc ? Number(sc[2]) : null,
      date,
      time: null,
      venue: null,
    });
  });

  let fixtures = all.filter((f) => isOurs(f.home) || isOurs(f.away));
  if (fixtures.length < MIN_FIXTURES) return skip(`only ${fixtures.length} of our fixtures parsed`);

  // ── 2) Enrich the imminent round with date/venue/time from scores.asp ──────
  const $$ = cheerio.load(scoresHtml);
  const detailByPair = new Map();
  const pairKey = (home, away) => `${deaccent(home)}|${deaccent(away)}`;
  $$(".results-game").each((_, el) => {
    const t = norm($$(el).text());
    const teams = t.match(/^(.+?)\s+-\s+(.+?)\s*:/);
    if (!teams) return;
    const home = cleanTeam(teams[1]);
    const away = cleanTeam(teams[2]);
    if (!isOurs(home) && !isOurs(away)) return;
    detailByPair.set(pairKey(home, away), {
      venue: (t.match(/Γήπεδο:\s*([^••]+?)\s*(?:[••]|Ημ\/?νία|Ώρα|$)/) || [])[1]?.trim() || null,
      date: (t.match(/Ημ\/?νία:\s*(\d{1,2}\.\d{1,2}\.\d{4})/) || [])[1] || null,
      time: (t.match(/Ώρα:\s*(\d{1,2}[:.]\d{2})/) || [])[1]?.replace(":", ".") || null,
    });
  });
  fixtures = fixtures.map((f) => {
    const d = detailByPair.get(pairKey(f.home, f.away));
    return d ? { ...f, date: f.date || d.date, time: f.time || d.time, venue: f.venue || d.venue } : f;
  });

  // ── 2b) Enrich the NEXT game from table.asp's "ΕΠΟΜΕΝΗ ΑΓΩΝΙΣΤΙΚΗ" ──────────
  // analytika/scores.asp only carry a game's date once epsm folds it into the
  // current round, so the upcoming fixture often has no date for days. The
  // standings page lists the next matchday earlier: each row's info icon links
  // to game.asp?game_number=N, whose detail page holds ΗΜΕΡΟΜΗΝΙΑ/ΩΡΑ/ΓΗΠΕΔΟ.
  // We find our row there, follow its game page, and backfill the date/time/
  // venue. Non-fatal: any failure just leaves the date to appear later.
  try {
    const tableHtml = await fetchHtml(TABLE_URL, "the standings page");
    const nextIdx = tableHtml.indexOf("ΕΠΟΜΕΝΗ ΑΓΩΝΙΣΤΙΚΗ");
    if (nextIdx >= 0) {
      const endIdx = tableHtml.indexOf("ΒΑΘΜΟΛΟΓΙΑ", nextIdx);
      const $n = cheerio.load(tableHtml.slice(nextIdx, endIdx > nextIdx ? endIdx : nextIdx + 4000));
      let gameNo = null, nHome = null, nAway = null;
      $n(".match-row").each((_, el) => {
        if (gameNo) return;
        const $el = $n(el);
        const home = cleanTeam($el.find(".match-home").text());
        const away = cleanTeam($el.find(".match-away").text());
        if (!home || !away || (!isOurs(home) && !isOurs(away))) return;
        gameNo = (($el.find(".match-info").attr("onclick") || "").match(/game_number=(\d+)/) || [])[1] || null;
        nHome = home;
        nAway = away;
      });
      if (gameNo) {
        const gameHtml = await fetchHtml(
          `https://www.epsm.gr/game.asp?game_number=${gameNo}`,
          "the game detail page"
        );
        const gt = norm(cheerio.load(gameHtml).text());
        const gDate = (gt.match(/ΗΜΕΡΟΜΗΝΙΑ\s*(\d{1,2}\.\d{1,2}\.\d{4})/) || [])[1] || null;
        const gTime = (gt.match(/ΩΡΑ\s*(\d{1,2}[:.]\d{2})/) || [])[1]?.replace(":", ".") || null;
        const gVenue = (gt.match(/ΓΗΠΕΔΟ\s*(.+?)\s*ΗΜΕΡΟΜΗΝΙΑ/) || [])[1]?.trim() || null;
        if (gDate) {
          const key = (h, a) => `${deaccent(h)}|${deaccent(a)}`;
          const want = key(nHome, nAway);
          fixtures = fixtures.map((f) =>
            key(f.home, f.away) === want
              ? { ...f, date: f.date || gDate, time: f.time || gTime, venue: f.venue || gVenue }
              : f
          );
        }
      }
    }
  } catch (e) {
    console.error(`[${tag}] next-round date enrich skipped: ${e.message}`);
  }

  // ── 3) Shape each fixture from our club's point of view ────────────────────
  const shaped = fixtures.map((f) => {
    const weAreHome = isOurs(f.home);
    const played = f.homeScore !== null && f.awayScore !== null;
    let result = null;
    if (played) {
      const us = weAreHome ? f.homeScore : f.awayScore;
      const them = weAreHome ? f.awayScore : f.homeScore;
      result = us > them ? "W" : us < them ? "L" : "D";
    }
    return {
      matchday: f.matchday,
      home: f.home,
      away: f.away,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      played,
      weAreHome,
      opponent: weAreHome ? f.away : f.home,
      result,
      date: f.date,
      time: f.time,
      venue: f.venue,
    };
  });
  shaped.sort((a, b) => a.matchday - b.matchday);

  // ── 4) Derive results / current / next / postponed ─────────────────────────
  const results = shaped.filter((f) => f.played).slice().sort((a, b) => b.matchday - a.matchday);

  const inThisWeek = shaped
    .filter((f) => {
      const d = toDate(f.date);
      return d && d >= weekStart && d < weekEnd;
    })
    .sort((a, b) => a.matchday - b.matchday);

  // Highest matchday the league itself has played (any team) — a round at/below
  // this that WE haven't played is postponed/behind, never "current".
  const leaguePlayedThrough = all.reduce(
    (m, f) => (f.homeScore !== null && f.matchday > m ? f.matchday : m),
    0
  );
  const ourPlayed = shaped.filter((f) => f.played);
  const ourUnplayed = shaped.filter((f) => !f.played);

  // Postponed = unplayed, from a round the league already played, AND epsm has
  // dropped it: date cleared, or >48h since its date with no result (the 48h
  // grace stops a slow-to-be-entered weekend score being mislabelled on Monday).
  const isPostponed = (f) => {
    if (f.played || f.matchday > leaguePlayedThrough) return false;
    const d = toDate(f.date);
    if (!d) return true;
    return now.getTime() - d.getTime() > POSTPONE_GRACE_MS;
  };
  const postponed = ourUnplayed.filter(isPostponed);
  const upcoming = ourUnplayed.filter((f) => !isPostponed(f));

  let current = null;
  if (inThisWeek.length) current = inThisWeek[0];
  else if (ourPlayed.length) current = ourPlayed[ourPlayed.length - 1];
  else current = upcoming[0] ?? postponed[0] ?? null;

  const next = upcoming.find((f) => !current || f.matchday > current.matchday) ?? null;

  const data = {
    updatedAt: new Date().toISOString(),
    competition: league.diorganosi,
    sources: [ANALYTIKA_URL, SCORES_URL, TABLE_URL],
    fixtures: shaped,
    results,
    postponed,
    current,
    next,
  };
  const wrote = writeIfChanged(out, data, tag);
  console.log(
    `[${tag}] ${wrote ? "wrote" : "unchanged:"} ${shaped.length} fixtures, ${results.length} played, ` +
      `${postponed.length} postponed, current=${current ? "MD" + current.matchday : "no"}, ` +
      `next=${next ? "MD" + next.matchday : "no"} → fixtures-${league.key}.json`
  );
  return true;
}

for (const league of LEAGUES) {
  await scrapeFixtures(league);
}
