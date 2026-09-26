// Central place for club-wide info. Edit these and they update everywhere
// (header, footer, page titles, structured data, etc.).

export const site = {
  name: "Ατρόμητος Πλαγιαρίου F.C.",
  shortName: "Ατρόμητος Πλαγιαρίου",
  nickname: "Ατρόμητος",
  founded: 1952,
  town: "Πλαγιάρι, Θεσσαλονίκη",
  // Used for absolute URLs (sitemap, Open Graph). Currently the Cloudflare
  // Pages URL — change to the custom domain once it's connected.
  url: "https://atromitosplagiariou.pages.dev",
  description:
    "Επίσημη ιστοσελίδα του Ατρόμητου Πλαγιαρίου F.C. — νέα, αγώνες, ρόστερ και η ιστορία του συλλόγου.",
  email: "info@atromitos-plagiariou.gr", // TODO
  phone: "+30 2310 000000", // TODO: real number (placeholder)
  social: {
    facebook: "", // e.g. "https://facebook.com/..."
    instagram: "",
    youtube: "",
  },
} as const;

// Main navigation. A item can be a plain link, or a parent with `children`
// (rendered as a dropdown on desktop / a group on mobile).
export type NavLeaf = { label: string; href: string };
export type NavParent = { label: string; children: NavLeaf[] };
export type NavItem = NavLeaf | NavParent;

export const nav: NavItem[] = [
  { label: "Αρχική", href: "/" },
  { label: "Ο Σύλλογος", href: "/about" },
  { label: "Νέα", href: "/news" },
  { label: "Ομάδες", href: "/squads" },
  {
    label: "Αποτελέσματα",
    children: [
      { label: "Πρωτάθλημα", href: "/protathlima" },
      { label: "Κύπελλο", href: "/kypello" },
    ],
  },
];

export const isNavParent = (item: NavItem): item is NavParent =>
  "children" in item;

// Team sponsors shown in the footer strip. For each: a `name`, a `logo` image in
// /public/sponsors/ (a transparent PNG or SVG reads best), and the sponsor's
// `url`. Entries without a `logo` render a placeholder tile until you add one;
// empty the array to hide the whole sponsors band.
export type Sponsor = { name: string; logo?: string; url?: string };
export const sponsors: Sponsor[] = [
  { name: "Ο χορηγός σας" },
  { name: "Ο χορηγός σας" },
  { name: "Ο χορηγός σας" },
  { name: "Ο χορηγός σας" },
];

// Home ground, used for the footer map.
// `mapQuery` is what Google Maps searches for — a place name or exact "lat,lng".
// For a guaranteed-correct pin, set it to coordinates (e.g. "40.4497,22.9906")
// copied from Google Maps (right-click the spot → the coords at the top).
export const stadium = {
  name: "Γήπεδο Πλαγιαρίου «Αθ. Πλώτσικας»",
  mapQuery: "Γήπεδο Πλαγιαρίου Ατρόμητος",
};
