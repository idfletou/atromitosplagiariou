// Scrapes our club's FULL-SEASON fixtures & results from epsm.gr and writes
// src/data/fixtures.json.
//
// Two sources are combined:
//   • table_analytika.asp — every matchday of the season with our fixtures,
//     real matchday numbers, and final scores once played. This is what powers
//     the results list and gives each fixture its correct matchday (so we never
//     guess a matchday from a section header again).
//   • scores.asp — the current/imminent round with date + venue + kickoff time,
//     which enriches the "current" and "next" matchup cards.
//
// From the fixture list we derive, at build time:
//   • results  — all completed matches (newest first)
//   • current  — our game for the CURRENT gameweek (Mon–Sun of the build date),
//                anchored to each fixture's real date so postponements follow
//                the game instead of a blind calendar flip
//   • next     — our game in the following gameweek
//
// Fails safe: if a fetch fails or the page parses to too few fixtures, it exits
// WITHOUT writing, so the last-good data is kept.
//
// Run locally with:  npm run scrape:fixtures

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";
import { writeIfChanged, norm, deaccent, makeIsOurs } from "./lib.mjs";

// ── Config ──────────────────────────────────────────────────────────────────
const DIORGANOSI = "Α ΕΡΑΣΙΤΕΧΝΙΚΗ - 3ος ΟΜΙΛΟΣ";
const OUR_TEAM = ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"];
const MIN_FIXTURES = 12; // safety floor: a full season lists ~28 of our games

const enc = encodeURIComponent(DIORGANOSI);
const ANALYTIKA_URL = `https://www.epsm.gr/table_analytika.asp?diorganosi=${enc}`;
const SCORES_URL = `https://www.epsm.gr/scores.asp?diorganosi=${enc}`;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/fixtures.json");

const isOurs = makeIsOurs(OUR_TEAM);
const fail = (msg) => {
  console.error(`[fixtures] ${msg}`);
  process.exit(1);
};

const fetchHtml = async (url, label) => {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AtromitosPlagiariouBot/1.0 (+club website fixtures sync)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) fail(`HTTP ${res.status} fetching ${label}`);
    return await res.text();
  } catch (e) {
    fail(`fetch failed for ${label}: ${e.message}`);
  }
};

// dd.mm.yyyy → sortable YYYYMMDD number (or null).
const dateKey = (d) => {
  const m = (d || "").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  return m ? Number(m[3] + m[2].padStart(2, "0") + m[1].padStart(2, "0")) : null;
};
// dd.mm.yyyy → JS Date at UTC midnight (or null).
const toDate = (d) => {
  const m = (d || "").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
};

// ── 1) Full season from table_analytika.asp ─────────────────────────────────
const $ = cheerio.load(await fetchHtml(ANALYTIKA_URL, "the analytic fixtures page"));

let currentMd = null;
const all = [];
$(".matchday-title, .match-row").each((_, el) => {
  const $el = $(el);
  if ($el.hasClass("matchday-title")) {
    const m = $el.text().match(/(\d+)/);
    if (m) currentMd = Number(m[1]);
    return;
  }
  // A match-row is: "<i…date…> HOME - AWAY &nbsp;&nbsp;&nbsp; SCORE".
  const rawHtml = $el.html() || "";
  const date = (rawHtml.match(/match_date=(\d{1,2}\.\d{1,2}\.\d{4})/) || [])[1] || null;

  // Preserve the &nbsp; gap as a delimiter between the teams and the score.
  const parts = rawHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, "\u0001")
    .split(/\u0001+/)
    .map((s) => norm(s))
    .filter(Boolean);
  const teamsPart = parts.find((p) => / - /.test(p));
  if (!teamsPart) return;
  const [home, away] = teamsPart.split(/ - /).map((s) => s.trim());
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

if (fixtures.length < MIN_FIXTURES) {
  fail(`only ${fixtures.length} of our fixtures parsed (< ${MIN_FIXTURES}); keeping last-good data`);
}

// ── 2) Enrich the imminent round(s) with date/venue/time from scores.asp ─────
// Each ".results-game" reads like:
//   "HOME - AWAY : SCORE Γήπεδο: <venue> • Ημ/νία: dd.mm.yyyy • Ώρα: HH.MM"
const $$ = cheerio.load(await fetchHtml(SCORES_URL, "the scores page"));
const detailByPair = new Map();
const pairKey = (home, away) => `${deaccent(home)}|${deaccent(away)}`;
$$(".results-game").each((_, el) => {
  const t = norm($$(el).text());
  const teams = t.match(/^(.+?)\s+-\s+(.+?)\s*:/);
  if (!teams) return;
  const home = teams[1].trim();
  const away = teams[2].trim();
  if (!isOurs(home) && !isOurs(away)) return;
  detailByPair.set(pairKey(home, away), {
    venue: (t.match(/Γήπεδο:\s*([^••]+?)\s*(?:[••]|Ημ\/?νία|Ώρα|$)/) || [])[1]?.trim() || null,
    date: (t.match(/Ημ\/?νία:\s*(\d{1,2}\.\d{1,2}\.\d{4})/) || [])[1] || null,
    time: (t.match(/Ώρα:\s*(\d{1,2}[:.]\d{2})/) || [])[1]?.replace(":", ".") || null,
  });
});

fixtures = fixtures.map((f) => {
  const d = detailByPair.get(pairKey(f.home, f.away));
  return d
    ? { ...f, date: f.date || d.date, time: f.time || d.time, venue: f.venue || d.venue }
    : f;
});

// ── 3) Shape each fixture from our club's point of view ──────────────────────
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

// ── 4) Derive results / current / next ───────────────────────────────────────
// Results: completed matches, newest first (latest result on top).
const results = shaped.filter((f) => f.played).slice().sort((a, b) => b.matchday - a.matchday);

// Current gameweek runs Monday→Sunday of the build date. A fixture belongs to
// the week of its own date, so a postponed game moves with its date instead of
// being flipped away on a fixed day.
const now = new Date();
const dow = now.getUTCDay(); // 0=Sun … 6=Sat
const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (dow === 0 ? -6 : 1 - dow)));
const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekStart.getUTCDate() + 7); // exclusive: next Monday 00:00

const inThisWeek = shaped
  .filter((f) => {
    const d = toDate(f.date);
    return d && d >= weekStart && d < weekEnd;
  })
  .sort((a, b) => a.matchday - b.matchday);

const playedAsc = shaped.filter((f) => f.played);
const upcoming = shaped.filter((f) => !f.played);

let current = null;
if (inThisWeek.length) {
  current = inThisWeek[0]; // this week's game — preview, or with its score once played
} else if (playedAsc.length) {
  current = playedAsc[playedAsc.length - 1]; // between weeks / bye → show last result
} else {
  current = upcoming[0] ?? null; // season not started → first fixture
}

// Next = our soonest game in a later matchday than `current`.
const next = current
  ? upcoming.find((f) => f.matchday > current.matchday) ?? null
  : upcoming[0] ?? null;

// ── Write ─────────────────────────────────────────────────────────────────
const data = {
  updatedAt: new Date().toISOString(),
  competition: DIORGANOSI,
  sources: [ANALYTIKA_URL, SCORES_URL],
  fixtures: shaped,
  results,
  current,
  next,
};

const wrote = writeIfChanged(OUT, data, "fixtures");
console.log(
  `[fixtures] ${wrote ? "wrote" : "unchanged:"} ${shaped.length} fixtures, ` +
    `${results.length} played, current=${current ? "MD" + current.matchday : "no"}, ` +
    `next=${next ? "MD" + next.matchday : "no"} → src/data/fixtures.json`
);
