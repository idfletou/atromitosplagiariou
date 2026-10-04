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
  category?: string;
  coverImage?: string;
  coverAlt?: string;
}

// `excerpt` is optional in the CMS. When an editor leaves it blank we fall back
// to the start of the article body, so cards and social/OG previews still have
// text. `bodyText` is the plain-text body used for that fallback.
type RawPost = NewsPost & { bodyText?: string };

// GROQ projections. `body`/`bodyText` are converted from Portable Text to plain
// text with pt::text (good enough for simple articles; can be upgraded to full
// rich-text rendering later).
const listProjection = `{
  "slug": slug.current,
  title,
  excerpt,
  "bodyText": pt::text(body),
  publishedAt,
  category,
  "coverImage": coverImage.asset->url,
  "coverAlt": coverImage.alt
}`;

const fullProjection = `{
  "slug": slug.current,
  title,
  excerpt,
  "body": pt::text(body),
  publishedAt,
  category,
  "coverImage": coverImage.asset->url,
  "coverAlt": coverImage.alt
}`;

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

export async function getAllNews(): Promise<NewsPost[]> {
  if (isSanityConfigured && sanityClient) {
    const query = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) ${listProjection}`;
    const posts = await sanityClient.fetch<RawPost[]>(query);
    return posts.map(({ bodyText, ...p }) => ({ ...p, excerpt: deriveExcerpt(p.excerpt, bodyText) }));
  }
  return [...sampleNews].sort(sortByDateDesc);
}

export async function getNewsBySlug(slug: string): Promise<NewsPost | null> {
  if (isSanityConfigured && sanityClient) {
    const query = `*[_type == "post" && slug.current == $slug][0] ${fullProjection}`;
    const post = await sanityClient.fetch<NewsPost | null>(query, { slug });
    return post ? { ...post, excerpt: deriveExcerpt(post.excerpt, post.body) } : null;
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
