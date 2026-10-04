// News data layer.
//
// Reads articles from Sanity when it's configured (env vars present),
// otherwise falls back to local sample posts so the site builds and looks
// real before the CMS is connected. Once you add your Sanity project ID to
// the environment, real content takes over automatically — no code change.

import { sanityClient, isSanityConfigured } from "./sanity";
import { sampleNews } from "../data/sample-news";

export interface NewsPost {
  slug: string;
  title: string;
  excerpt: string;
  /** HTML string for the article body. */
  body: string;
  /** ISO date string. */
  publishedAt: string;
  coverImage?: string;
  coverAlt?: string;
}

// Greek → Latin transliteration so a Greek title yields a clean ASCII URL slug.
const GREEK_MAP: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i",
  θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y",
  ΰ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
};

// Build a URL slug from the title — editors never set one themselves.
function slugify(title: string): string {
  let out = "";
  for (const ch of (title || "").toLowerCase().trim()) out += GREEK_MAP[ch] ?? ch;
  const slug = out
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "arthro";
}

// Use the editor's excerpt if given, otherwise the first ~160 chars of the body.
function deriveExcerpt(excerpt?: string, body?: string): string {
  const e = (excerpt ?? "").trim();
  if (e) return e;
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 160 ? text.slice(0, 160).trimEnd() + "…" : text;
}

function sortByDateDesc(a: NewsPost, b: NewsPost) {
  return +new Date(b.publishedAt) - +new Date(a.publishedAt);
}

// One query returns everything we render. The slug is derived from the title
// (falling back to any stored slug), with collisions disambiguated; the plain
// body text powers the excerpt fallback. For a club's volume of posts a single
// fetch is cheap and keeps the slug logic in one place.
const allProjection = `{
  title,
  excerpt,
  "storedSlug": slug.current,
  "body": pt::text(body),
  publishedAt,
  "coverImage": coverImage.asset->url,
  "coverAlt": coverImage.alt
}`;
type RawPost = Omit<NewsPost, "slug"> & { storedSlug?: string };

async function fetchAllPosts(): Promise<NewsPost[]> {
  // Assign slugs oldest-first so an older post keeps its slug if a newer post
  // ever collides; display order is newest-first.
  const query = `*[_type == "post" && defined(title) && defined(publishedAt)] | order(publishedAt asc) ${allProjection}`;
  const raw = await sanityClient!.fetch<RawPost[]>(query);
  const seen = new Set<string>();
  const posts = raw.map(({ storedSlug, ...p }) => {
    const base = (storedSlug || "").trim() || slugify(p.title);
    let slug = base;
    for (let n = 2; seen.has(slug); n++) slug = `${base}-${n}`;
    seen.add(slug);
    return { ...p, slug, excerpt: deriveExcerpt(p.excerpt, p.body) } as NewsPost;
  });
  return posts.sort(sortByDateDesc);
}

export async function getAllNews(): Promise<NewsPost[]> {
  if (isSanityConfigured && sanityClient) return fetchAllPosts();
  return [...sampleNews].sort(sortByDateDesc);
}

export async function getNewsBySlug(slug: string): Promise<NewsPost | null> {
  if (isSanityConfigured && sanityClient) {
    const posts = await fetchAllPosts();
    return posts.find((p) => p.slug === slug) ?? null;
  }
  return sampleNews.find((p) => p.slug === slug) ?? null;
}

export async function getLatestNews(limit = 3): Promise<NewsPost[]> {
  const all = await getAllNews();
  return all.slice(0, limit);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
