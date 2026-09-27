# public/team/ — team photos

Wide "team lineup" banner photos, one per squad. Referenced from:
- **Men's team:** `src/pages/squads/men.astro` → the `teamPhoto` value (e.g. `/team/men-2026.jpg`).
- **Academy teams:** `src/data/academy.ts` → each group's `photo` (e.g. `/team/k16-2026.jpg`).

Leave the value `undefined` to show a placeholder banner until a photo is ready.

## Naming
- Lowercase, no spaces, **no Greek/accented letters**.
- Suggested: `men-2026.jpg`, `k16-2026.jpg`, `k14-2026.jpg` (squad + season year).

## Prep
- **JPG**, landscape (wide) — it renders as a full-width banner.
- ~1600px wide, compressed to **under ~500 KB**.
