// Scrapes the club's league standings + our latest result & next fixture from
// epsm.gr and writes src/data/standings.json.
//
// Designed to run on a schedule (GitHub Actions). If the fetch or parse fails,
// or the table looks suspiciously empty, it exits WITHOUT writing — so the site
// keeps the last-good data instead of blanking out.
//
// Run locally with:  npm run scrape:standings

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";
import { writeIfChanged } from "./lib.mjs";

// ── Config ──────────────────────────────────────────────────────────────────
// The league group on epsm.gr. Update this ONE line if the team changes
// division/group (e.g. after promotion) — copy the exact "diorganosi" value
// from the epsm.gr standings URL.
const DIORGANOSI = "Α ΕΡΑΣΙΤΕΧΝΙΚΗ - 3ος ΟΜΙΛΟΣ";

// Substrings that identify OUR club in the federation's naming. Matched
// accent-insensitively and all must be present.
const OUR_TEAM = ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"];

// Safety floor: refuse to overwrite with a suspiciously small table.
const MIN_TEAMS = 4;

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/standings.json");
const URL = `https://www.epsm.gr/table.asp?diorganosi=${encodeURIComponent(DIORGANOSI)}`;

// ── Helpers ─────────────────────────────────────────────────────────────────
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const deaccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const isOurs = (name) => {
  const n = deaccent(norm(name));
  return OUR_TEAM.every((t) => n.includes(deaccent(t)));
};
const intOr = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};
const fail = (msg) => {
  console.error(`[standings] ${msg}`);
  process.exit(1);
};

// ── Fetch ───────────────────────────────────────────────────────────────────
let html;
try {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "AtromitosPlagiariouBot/1.0 (+club website standings sync)",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) fail(`HTTP ${res.status} fetching the standings page`);
  html = await res.text();
} catch (e) {
  fail(`fetch failed: ${e.message}`);
}

const $ = cheerio.load(html);

// ── Standings table ─────────────────────────────────────────────────────────
// Each team row looks like:  [·] [■colour] "NN. TEAM" pts games GF-GA W-D-L …
const posRe = /^\s*(\d{1,2})\.\s*(.+?)\s*$/;
const table = [];
const seen = new Set();

$("tr").each((_, tr) => {
  const cells = $(tr).children("td").map((__, td) => norm($(td).text())).get();
  const idx = cells.findIndex((c) => posRe.test(c));
  if (idx === -1) return;

  const [, posStr, team] = cells[idx].match(posRe);
  const position = intOr(posStr, 0);
  if (!position || seen.has(position)) return; // nested tables can duplicate rows

  const points = parseInt(cells[idx + 1], 10);
  const played = parseInt(cells[idx + 2], 10);
  if (Number.isNaN(points) || Number.isNaN(played)) return;

  const [gf, ga] = (cells[idx + 3] || "").split("-").map((n) => intOr(n));
  const [won, drawn, lost] = (cells[idx + 4] || "").split("-").map((n) => intOr(n));

  // Zone marker colour (promotion / play-off / relegation).
  let markerColor = null;
  $(tr).find("font").each((__, f) => {
    if ($(f).text().includes("■")) {
      const m = ($(f).attr("style") || "").match(/color:\s*(#[0-9a-fA-F]{3,6})/);
      if (m) markerColor = m[1].toLowerCase();
    }
  });

  seen.add(position);
  table.push({
    position,
    team,
    isOurTeam: isOurs(team),
    points,
    played,
    won,
    drawn,
    lost,
    gf,
    ga,
    gd: gf - ga,
    markerColor,
  });
});

if (table.length < MIN_TEAMS) {
  fail(`only ${table.length} team(s) parsed (< ${MIN_TEAMS}); keeping last-good data`);
}
table.sort((a, b) => a.position - b.position);

// Integrity guard: wins + draws + losses must equal games played on every row.
// This identity always holds (even with point deductions), so if epsm.gr ever
// shifts/reorders the stat columns, the W-D-L stops reconciling with games and
// we bail rather than publish wrong numbers. One-off source typos are tolerated;
// a real column shift breaks every row.
const inconsistent = table.filter((r) => r.won + r.drawn + r.lost !== r.played);
if (inconsistent.length >= 2) {
  fail(
    `${inconsistent.length}/${table.length} rows fail (W+D+L == games) — the table ` +
      `layout may have changed on epsm.gr; keeping last-good data`
  );
}

// We should always be listed in our own group's table. If not, the DIORGANOSI
// URL is wrong or the club was renamed at the federation — surface it loudly.
if (!table.some((r) => r.isOurTeam)) {
  fail(`our club not found in the table — check DIORGANOSI / OUR_TEAM; keeping last-good data`);
}

// ── Zone legend (self-describing: colour → label straight from the page) ─────
// The legend is a block of `<font ■></font> LABEL<br>` rows. We read the text
// node that follows each coloured ■; team-row markers have no label and are
// skipped. This adapts to each group's own promotion/relegation wording.
const legend = [];
const seenColors = new Set();
$("font").each((_, f) => {
  if (!$(f).text().includes("■")) return;
  const color = (($(f).attr("style") || "").match(/color:\s*(#[0-9a-fA-F]{3,6})/) || [])[1];
  if (!color) return;
  let label = "";
  for (let node = f.next; node && node.type !== "tag"; node = node.next) {
    if (node.type === "text") label += node.data;
  }
  label = norm(label);
  const c = color.toLowerCase();
  if (label.length >= 3 && !seenColors.has(c)) {
    seenColors.add(c);
    legend.push({ color: c, label });
  }
});

// ── Write ───────────────────────────────────────────────────────────────────
// Note: our latest result & next fixture (with correct matchday numbers) come
// from the dedicated fixtures scraper (scrape-fixtures.mjs → fixtures.json),
// which reads the full-season programme. This file is just the ranking table.
const data = {
  updatedAt: new Date().toISOString(),
  competition: DIORGANOSI,
  source: URL,
  legend,
  table,
};

const wrote = writeIfChanged(OUT, data, "standings");
console.log(
  `[standings] ${wrote ? "wrote" : "unchanged:"} ${table.length} teams, legend=${legend.length} → src/data/standings.json`
);
