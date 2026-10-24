// Leagues we scrape from epsm.gr. Each entry produces its own
// `src/data/standings-<key>.json` and `src/data/fixtures-<key>.json`.
// Add a team here to start scraping it — copy the exact `diorganosi` value from
// the epsm.gr URL (…/table.asp?diorganosi=…).
export const LEAGUES = [
  {
    key: "men",
    label: "Ανδρική Ομάδα",
    diorganosi: "Α ΕΡΑΣΙΤΕΧΝΙΚΗ - 3ος ΟΜΙΛΟΣ",
    ourTeam: ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"],
  },
  {
    key: "k17",
    label: "Κ17",
    diorganosi: "Κ17 LEAGUE 1",
    ourTeam: ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"],
  },
];
