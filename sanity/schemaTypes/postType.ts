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
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Περίληψη",
      type: "text",
      rows: 3,
      description: "Σύντομη περιγραφή που εμφανίζεται στις κάρτες και στα social.",
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: "category",
      title: "Κατηγορία",
      type: "string",
      options: {
        list: [
          { title: "Αγώνες", value: "Αγώνες" },
          { title: "Ομάδα", value: "Ομάδα" },
          { title: "Ακαδημίες", value: "Ακαδημίες" },
          { title: "Ανακοινώσεις", value: "Ανακοινώσεις" },
        ],
        layout: "radio",
      },
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
    select: { title: "title", subtitle: "category", media: "coverImage" },
  },
});
