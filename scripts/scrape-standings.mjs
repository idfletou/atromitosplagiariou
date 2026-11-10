// Scrapes each configured league's standings table from epsm.gr and writes
// src/data/standings-<key>.json (one file per league — see scripts/leagues.mjs).
//
// Fail-safe: a league whose page fails to fetch/parse is SKIPPED (its last-good
// file is kept) and the other leagues still update. Our latest result & next
// fixture come from the fixtures scraper; this file is just the ranking table.
//
// Run locally with:  npm run scrape:standings

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";
import { writeIfChanged, norm, makeIsOurs } from "./lib.mjs";
import { LEAGUES } from "./leagues.mjs";

const MIN_TEAMS = 4; // safety floor: refuse a suspiciously small table
const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data");
const intOr = (v, fb = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fb : n;
};
// epsm appends a tiebreak marker + an "ΑΝΑΛΥΣΗ ΙΣΟΒΑΘΜΙΑΣ" tooltip to the team
// cell, e.g. "… ΙΣΟΒ. 0ΑΝΑΛΥΣΗ ΙΣΟΒΑΘΜΙΑΣ…". Cut everything from that marker on,
// and drop any leading "NN. " position prefix from the team link.
const cleanTeam = (name) =>
  norm(name)
    .replace(/^\d{1,2}\.\s*/u, "")
    .replace(/\s*ΙΣΟΒ\.?\s*-?\d+.*$/u, "")
    .replace(/\s*ΑΝΑΛΥΣΗ\s+ΙΣΟΒΑΘΜΙΑΣ.*$/u, "")
    .trim();

async function scrapeStandings(league) {
  const tag = `standings:${league.key}`;
  const isOurs = makeIsOurs(league.ourTeam);
  const url = `https://www.epsm.gr/table.asp?diorganosi=${encodeURIComponent(league.diorganosi)}`;
  const out = resolve(DATA_DIR, `standings-${league.key}.json`);
  const skip = (msg) => {
    console.error(`[${tag}] ${msg} — keeping last-good`);
    return false;
  };

  let html;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AtromitosPlagiariouBot/1.0 (+club website standings sync)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return skip(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return skip(`fetch failed: ${e.message}`);
  }

  const $ = cheerio.load(html);

  // Each team row: [·] [■colour] "NN. TEAM" pts games GF-GA W-D-L …
  const posRe = /^\s*(\d{1,2})\.\s*(.+?)\s*$/;
  const table = [];
  const seen = new Set();

  $("tr").each((_, tr) => {
    const cells = $(tr).children("td").map((__, td) => norm($(td).text())).get();
    const idx = cells.findIndex((c) => posRe.test(c));
    if (idx === -1) return;

    const [, posStr, rawTeam] = cells[idx].match(posRe);
    const position = intOr(posStr, 0);
    if (!position || seen.has(position)) return; // nested tables can duplicate rows

    const points = parseInt(cells[idx + 1], 10);
    const played = parseInt(cells[idx + 2], 10);
    if (Number.isNaN(points) || Number.isNaN(played)) return;

    const [gf, ga] = (cells[idx + 3] || "").split("-").map((n) => intOr(n));
    const [won, drawn, lost] = (cells[idx + 4] || "").split("-").map((n) => intOr(n));

    // Prefer the clean team name from the row's team link (the raw cell text now
    // also contains the tiebreak-analysis tooltip); fall back to the cell text.
    const linkName = norm($(tr).find("a.mn-team-link").first().text());

    let markerColor = null;
    $(tr).find("font").each((__, f) => {
      if ($(f).text().includes("■")) {
        const m = ($(f).attr("style") || "").match(/color:\s*(#[0-9a-fA-F]{3,6})/);
        if (m) markerColor = m[1].toLowerCase();
      }
    });

    const team = cleanTeam(linkName || rawTeam);
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

  if (table.length < MIN_TEAMS) return skip(`only ${table.length} team(s) parsed`);
  table.sort((a, b) => a.position - b.position);

  // Integrity guard: W+D+L must equal games played on (nearly) every row. If
  // epsm shifts the stat columns this breaks, so we bail rather than publish
  // wrong numbers.
  const inconsistent = table.filter((r) => r.won + r.drawn + r.lost !== r.played);
  if (inconsistent.length >= 2) {
    return skip(`${inconsistent.length}/${table.length} rows fail W+D+L==games (layout changed?)`);
  }
  if (!table.some((r) => r.isOurTeam)) return skip("our club not found in the table (check config)");

  // Zone legend (colour → label straight from the page).
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

  const data = {
    updatedAt: new Date().toISOString(),
    competition: league.diorganosi,
    source: url,
    legend,
    table,
  };
  const wrote = writeIfChanged(out, data, tag);
  console.log(
    `[${tag}] ${wrote ? "wrote" : "unchanged:"} ${table.length} teams, legend=${legend.length} → standings-${league.key}.json`
  );
  return true;
}

for (const league of LEAGUES) {
  await scrapeStandings(league);
}
