// Leagues we scrape from epsm.gr. Each entry produces its own
// `src/data/standings-<key>.json` and `src/data/fixtures-<key>.json`.
// Add a team here to start scraping it — copy the exact `diorganosi` value from
// the epsm.gr URL (…/table.asp?diorganosi=…). `team` is our club's exact name as
// epsm spells it, used for the per-team fixtures page (table_team.asp?…&team=…).
export const LEAGUES = [
  {
    key: "men",
    label: "Ανδρική Ομάδα",
    diorganosi: "Α ΕΡΑΣΙΤΕΧΝΙΚΗ - 3ος ΟΜΙΛΟΣ",
    team: "ΑΤΡΟΜΗΤΟΣ ΠΛΑΓΙΑΡΙΟΥ",
    ourTeam: ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"],
  },
  {
    key: "k17",
    label: "Κ17",
    diorganosi: "Κ17 LEAGUE 1",
    team: "ΑΤΡΟΜΗΤΟΣ ΠΛΑΓΙΑΡΙΟΥ",
    ourTeam: ["ΑΤΡΟΜΗΤΟΣ", "ΠΛΑΓΙΑΡ"],
  },
];
