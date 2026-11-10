// Scrapes each configured league's FULL-SEASON fixtures & results for OUR club
// from epsm.gr and writes src/data/fixtures-<key>.json (one per league).
//
// Source: table_team.asp?diorganosi=<league>&team=<our club> — epsm's per-team
// page, which lists every one of our fixtures in a single table with matchday,
// date, kickoff, home/away, score (once played) and venue. This replaced the old
// analytika/scores/table scraping after epsm redesigned those pages (Nov 2026).
//
// From the list we derive results (newest first), current (this gameweek), next,
// and postponed. See the derivation comments below.
//
// Fail-safe: a league whose page fails to fetch/parse is SKIPPED (its last-good
// file kept) and the others still update.
//
// Run locally with:  npm run scrape:fixtures

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";
import { writeIfChanged, norm, makeIsOurs } from "./lib.mjs";
import { LEAGUES } from "./leagues.mjs";

const MIN_FIXTURES = 10; // safety floor
const POSTPONE_GRACE_MS = 48 * 60 * 60 * 1000;
const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data");
const intOr = (v, fb = null) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fb : n;
};

// Youth programmes may append a tiebreak marker to names, e.g. "… ΙΣΟΒ. 0".
const cleanTeam = (name) => norm(name).replace(/\s*ΙΣΟΒ\.?\s*-?\d+.*$/u, "").trim();
// Drop a trailing pitch-surface tag epsm sometimes appends to the venue.
const cleanVenue = (v) =>
  norm(v).replace(/\s*[-–(]\s*(?:Πλαστικό|Χόρτο|ΠΛΑΣΤΙΚΟ|ΧΟΡΤΟ)\s*\)?\s*$/iu, "").trim();
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
  const url =
    `https://www.epsm.gr/table_team.asp?diorganosi=${encodeURIComponent(league.diorganosi)}` +
    `&team=${encodeURIComponent(league.team)}`;
  const out = resolve(DATA_DIR, `fixtures-${league.key}.json`);
  const skip = (msg) => {
    console.error(`[${tag}] ${msg} — keeping last-good`);
    return false;
  };

  let html;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AtromitosPlagiariouBot/1.0 (+club website fixtures sync)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return skip(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return skip(`fetch failed: ${e.message}`);
  }

  // ── 1) Parse our fixtures from the per-team table ──────────────────────────
  // Row layout: [date+time] [matchday] [home] [score] [away] [venue] [details]
  const $ = cheerio.load(html);
  const parsed = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const dateCell = $tr.find(".tv-date").first();
    if (!dateCell.length) return;
    const tds = $tr.find("td").toArray();
    const sIdx = tds.findIndex((td) => $(td).hasClass("tv-score"));
    if (sIdx < 2) return; // need matchday+home before the score cell

    const matchday = intOr(norm($(tds[sIdx - 2]).text()));
    const home = cleanTeam($(tds[sIdx - 1]).text());
    const away = cleanTeam($(tds[sIdx + 1]).text());
    if (!matchday || !home || !away) return;

    const date = (norm(dateCell.clone().children().remove().end().text()).match(/\d{1,2}\.\d{1,2}\.\d{4}/) || [])[0] || null;
    const time = norm($tr.find(".tv-time").first().text()) || null;
    const venue = tds[sIdx + 2] ? cleanVenue($(tds[sIdx + 2]).text()) || null : null;
    const sc = norm($(tds[sIdx]).text()).match(/(\d+)\s*[-:]\s*(\d+)/);

    parsed.push({
      matchday,
      home,
      away,
      homeScore: sc ? Number(sc[1]) : null,
      awayScore: sc ? Number(sc[2]) : null,
      date,
      time,
      venue,
    });
  });

  const fixtures = parsed.filter((f) => isOurs(f.home) || isOurs(f.away));
  if (fixtures.length < MIN_FIXTURES) return skip(`only ${fixtures.length} of our fixtures parsed`);

  // ── 2) Shape each fixture from our club's point of view ────────────────────
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

  // ── 3) Derive results / current / next / postponed ─────────────────────────
  const results = shaped.filter((f) => f.played).slice().sort((a, b) => b.matchday - a.matchday);

  const inThisWeek = shaped
    .filter((f) => {
      const d = toDate(f.date);
      return d && d >= weekStart && d < weekEnd;
    })
    .sort((a, b) => a.matchday - b.matchday);

  // Postponed = unplayed and its date is >48h in the past (should have been
  // played, epsm hasn't entered a score). The 48h grace stops a slow-to-be-
  // entered weekend score being mislabelled on Monday. A game with no date yet
  // is simply not scheduled (future), never postponed.
  const isPostponed = (f) => {
    if (f.played) return false;
    const d = toDate(f.date);
    return !!d && now.getTime() - d.getTime() > POSTPONE_GRACE_MS;
  };
  const postponed = shaped.filter(isPostponed);
  const ourPlayed = shaped.filter((f) => f.played);
  const upcoming = shaped.filter((f) => !f.played && !isPostponed(f)).sort((a, b) => a.matchday - b.matchday);

  let current = null;
  if (inThisWeek.length) current = inThisWeek[0];
  else if (ourPlayed.length) current = ourPlayed[ourPlayed.length - 1];
  else current = upcoming[0] ?? postponed[0] ?? null;

  const next = upcoming.find((f) => !current || f.matchday > current.matchday) ?? null;

  const data = {
    updatedAt: new Date().toISOString(),
    competition: league.diorganosi,
    sources: [url],
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
