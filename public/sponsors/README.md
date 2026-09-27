# public/sponsors/ — sponsor logos

Sponsor logos shown in the footer strip. Referenced from `src/data/site.ts` in
the `sponsors` array via each entry's `logo` field.

## Naming
- Lowercase, no spaces, **no Greek/accented letters** — e.g. `acme-foods.png`.

## How to reference it
In `src/data/site.ts`:

```ts
export const sponsors: Sponsor[] = [
  { name: "Acme Foods", logo: "/sponsors/acme-foods.png", url: "https://acme.example" },
  // entries without a `logo` render a dashed placeholder tile
];
```

## Prep
- **Transparent PNG** or **SVG** reads best (the footer tints logos on hover).
- Keep it modest — a few hundred px wide is plenty; **under ~200 KB**.
