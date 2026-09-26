// Academy / youth teams. Each group renders on the /squads/academy page as:
// a title, a team photo, and its coaches — stacked one after another.
// Add, remove, or reorder groups freely; rename the titles to your real
// categories. Put photos in /public/team/ and set the `photo` path.
export type AcademyGroup = {
  title: string;
  photo?: string;
  coaches: { name: string; role: string }[];
};

export const academyGroups: AcademyGroup[] = [
  {
    title: "Κ16 – Παίδες",
    photo: undefined,
    coaches: [
      { name: "Όνομα Επώνυμο", role: "Προπονητής" },
      { name: "Όνομα Επώνυμο", role: "Βοηθός Προπονητή" },
    ],
  },
  {
    title: "Κ14 – Προπαίδες",
    photo: undefined,
    coaches: [{ name: "Όνομα Επώνυμο", role: "Προπονητής" }],
  },
  {
    title: "Κ12 – Τζούνιορ",
    photo: undefined,
    coaches: [{ name: "Όνομα Επώνυμο", role: "Προπονητής" }],
  },
];
