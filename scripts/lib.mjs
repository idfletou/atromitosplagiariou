// Shared helpers for the epsm.gr scrapers.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Write `data` as pretty JSON to `outPath`, but ONLY if the meaningful content
 * changed. The volatile `updatedAt` field is ignored in the comparison, so a
 * run that scrapes identical data doesn't rewrite the file — which means no
 * git commit and no needless Cloudflare rebuild on the scheduled job.
 *
 * Returns true if it wrote, false if it left the file untouched.
 */
export function writeIfChanged(outPath, data, tag) {
  const strip = (o) => {
    const { updatedAt, ...rest } = o;
    return JSON.stringify(rest);
  };

  if (existsSync(outPath)) {
    try {
      const prev = JSON.parse(readFileSync(outPath, "utf8"));
      if (strip(prev) === strip(data)) {
        console.log(`[${tag}] no change — file left untouched`);
        return false;
      }
    } catch {
      // Unreadable/old-format file → fall through and overwrite it.
    }
  }

  writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return true;
}

// Collapse whitespace.
export const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Uppercase + strip accents, so "Ατρόμητος" matches "ΑΤΡΟΜΗΤΟΣ".
export const deaccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Build an "is this our club?" test from a list of required substrings. */
export const makeIsOurs = (parts) => (name) => {
  const n = deaccent(norm(name));
  return parts.every((t) => n.includes(deaccent(t)));
};
