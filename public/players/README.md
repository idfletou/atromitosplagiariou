# public/players/ — player portraits

Drop each player's portrait photo here, then point to it from
`src/data/roster.json` via the player's `photo` field.

## Naming
- Lowercase, no spaces, **no Greek/accented letters** (they break in URLs).
- Suggested pattern: `<number>-<surname>.jpg` — e.g. `10-papadopoulos.jpg`, `1-ioannou.jpg`.

## How to reference it
In `src/data/roster.json`, add the path (starts with `/players/`):

```json
{
  "id": "10",
  "name": "Γιώργος Παπαδόπουλος",
  "number": 10,
  "position": "MID",
  "birthDate": "1998-04-21",
  "height": 178,
  "photo": "/players/10-papadopoulos.jpg"
}
```

`photo` is optional — players without one show the crest placeholder, so you can
add photos later.

## Prep
- **JPG**, portrait or square, subject centred (cards crop to a portrait frame).
- ~600–800px wide, compressed to **under ~500 KB**.
