import { defineField, defineType } from "sanity";

// The "Άρθρο" (news post) document. This is what your editors fill in.
// The field names here match the GROQ queries in src/lib/news.ts.
export const postType = defineType({
  name: "post",
  title: "Άρθρο",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Τίτλος",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Σύνδεσμος (slug)",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      // Auto-derived from the title on the website — hidden so editors never
      // need to set it or click "Generate".
      hidden: true,
    }),
    defineField({
      name: "excerpt",
      title: "Περίληψη (προαιρετικό)",
      type: "text",
      rows: 3,
      description:
        "Προαιρετική σύντομη περιγραφή για τις κάρτες και τα social. Αν μείνει κενή, χρησιμοποιείται αυτόματα η αρχή του κειμένου.",
      validation: (rule) => rule.max(200),
    }),
    defineField({
      name: "publishedAt",
      title: "Ημερομηνία δημοσίευσης",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "coverImage",
      title: "Κεντρική εικόνα",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Εναλλακτικό κείμενο (accessibility)",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Κείμενο",
      type: "array",
      of: [{ type: "block" }],
    }),
  ],
  orderings: [
    {
      title: "Νεότερα πρώτα",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", date: "publishedAt", media: "coverImage" },
    prepare({ title, date, media }) {
      return {
        title,
        media,
        subtitle: date ? new Date(date).toLocaleDateString("el-GR") : "",
      };
    },
  },
});
