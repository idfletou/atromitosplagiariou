import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

// Senior team roster. Edit src/data/roster.json to update players — the schema
// below validates it at build time so typos get caught early.
const players = defineCollection({
  loader: file("src/data/roster.json"),
  schema: z.object({
    name: z.string(),
    number: z.number().int().positive().optional(),
    // GK = Τερματοφύλακας, DEF = Αμυντικός, MID = Μέσος, FWD = Επιθετικός
    position: z.enum(["GK", "DEF", "MID", "FWD"]),
    // Front-of-card portrait. Path under /public, e.g. "/players/name.jpg"
    photo: z.string().optional(),
    // Card back info (all optional) — shown as a list when the card flips.
    // Date of birth in ISO form (YYYY-MM-DD); displayed as DD/MM/YYYY.
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Χρησιμοποιήστε μορφή YYYY-MM-DD")
      .optional(),
    height: z.number().int().positive().optional(), // in cm
  }),
});

export const collections = { players };
