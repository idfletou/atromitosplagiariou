// Scrapes the club's cup run (results + next fixture) from epsm.gr/cup.asp and
// writes src/data/cup.json.
//
// The cup page lists every tie across all rounds ("φάση"); we keep only the
// matches involving our club. Fails safe: if the page can't be parsed it exits
// WITHOUT writing, keeping the last-good data.
//
// Run locally with:  npm run scrape:cup

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";

// ── Config ──────────────────────────────────────────────────────────────────
const URL = "https://www.epsm.gr/cup.asp";
const OUR_TEAM = ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"];
const MIN_MATCHES = 4; // safety: the whole page should parse to many ties

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/cup.json");

// ── Helpers ─────────────────────────────────────────────────────────────────
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const deaccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const isOurs = (name) => {
  const n = deaccent(norm(name));
  return OUR_TEAM.every((t) => n.includes(deaccent(t)));
};
const fail = (msg) => {
  console.error(`[cup] ${msg}`);
  process.exit(1);
};

// ── Fetch ───────────────────────────────────────────────────────────────────
let html;
try {
  const res = await fetch(URL, {
    headers: { "User-Agent": "AtromitosPlagiariouBot/1.0 (+club website cup sync)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) fail(`HTTP ${res.status} fetching the cup page`);
  html = await res.text();
} catch (e) {
  fail(`fetch failed: ${e.message}`);
}

const $ = cheerio.load(html);

// ── Parse every tie, grouped by round, then keep ours ───────────────────────
let total = 0;
const ourMatches = [];

$(".cup-phase").each((_, phaseEl) => {
  const phase = norm($(phaseEl).find(".cup-phase-title").first().text());
  $(phaseEl)
    .find(".cup-match")
    .each((__, m) => {
      total += 1;
      const home = norm($(m).find(".cup-team-home").text());
      const away = norm($(m).find(".cup-team-away").text());
      if (!home || !away) return;
      if (!isOurs(home) && !isOurs(away)) return;

      // Stable, title-independent ordering key: each match links to
      // game.asp?game_number=NNNN and that number grows with every new round,
      // so we never need to interpret the phase's name ("1η φάση", "Ημιτελικά", …).
      const infoHref = $(m).find(".cup-match-info").attr("href") || "";
      const gnMatch = infoHref.match(/game_number=(\d+)/);
      const gameNumber = gnMatch ? parseInt(gnMatch[1], 10) : null;

      const scoreTxt = norm($(m).find(".cup-score").text());
      const sc = scoreTxt.match(/(\d+)\s*-\s*(\d+)/);
      const homeScore = sc ? parseInt(sc[1], 10) : null;
      const awayScore = sc ? parseInt(sc[2], 10) : null;

      // Details: venue / date / time (identified by their icon).
      let venue = null, date = null, time = null;
      $(m).find(".cup-detail-item").each((___, item) => {
        const icon = ($(item).find("i").attr("class") || "").toLowerCase();
        const val = norm($(item).text());
        if (icon.includes("geo")) venue = val;
        else if (icon.includes("calendar")) date = val;
        else if (icon.includes("clock")) time = val;
      });

      const weAreHome = isOurs(home);
      let result = null;
      if (homeScore !== null) {
        const us = weAreHome ? homeScore : awayScore;
        const them = weAreHome ? awayScore : homeScore;
        result = us > them ? "W" : us < them ? "L" : "D";
      }

      ourMatches.push({
        phase, // display label only — passed through verbatim from the source
        gameNumber,
        home,
        away,
        homeScore,
        awayScore,
        played: homeScore !== null,
        weAreHome,
        result,
        venue,
        date,
        time,
      });
    });
});

// Sortable key from a "dd.mm.yyyy" date → 20260919 (or null).
const dateKey = (m) => {
  const d = (m.date || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return d ? Number(d[3] + d[2] + d[1]) : null;
};

// Newest round first. Primary key: game_number (always present & monotonic).
// Fallback: match date. Last resort: keep the page's order. None of this ever
// looks at the phase name.
ourMatches.sort((a, b) => {
  if (a.gameNumber != null && b.gameNumber != null && a.gameNumber !== b.gameNumber) {
    return b.gameNumber - a.gameNumber;
  }
  const da = dateKey(a), db = dateKey(b);
  if (da != null && db != null && da !== db) return db - da;
  return 0;
});

if (total < MIN_MATCHES) {
  fail(`only ${total} tie(s) parsed (< ${MIN_MATCHES}); keeping last-good data`);
}

// Competition name, e.g. Κύπελλο «ΑΝΝΑ-ΜΑΡΙΑ ΠΑΝΤΑΖΩΝΗ»
const cupName = (norm($("body").text()).match(/Κυπέλλου\s*(«[^»]*»)/) || [])[1];
const competition = cupName ? `Κύπελλο ${cupName}` : "Κύπελλο ΕΠΣ Μακεδονίας";

// ourMatches is newest-first, so the soonest unplayed tie is the last upcoming.
const upcoming = ourMatches.filter((m) => !m.played);
const next = upcoming.length ? upcoming[upcoming.length - 1] : null;

const data = {
  updatedAt: new Date().toISOString(),
  competition,
  source: URL,
  matches: ourMatches, // newest round first (page order)
  next,
};

writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(
  `[cup] parsed ${total} ties, kept ${ourMatches.length} of ours ` +
    `(next=${next ? "yes" : "no"}) → src/data/cup.json`
);
