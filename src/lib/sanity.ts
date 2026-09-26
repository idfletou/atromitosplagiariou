// Sanity client. Stays inert until you provide a project ID via env vars,
// which lets the whole site build with sample content in the meantime.
//
// Configure in a `.env` file (see .env.example):
//   PUBLIC_SANITY_PROJECT_ID=xxxxxxxx
//   PUBLIC_SANITY_DATASET=production
//
// Content is fetched at BUILD TIME, so after an editor publishes in Sanity you
// trigger a Cloudflare rebuild (via a Sanity webhook → deploy hook) and the new
// article goes live a minute or two later.

import { createClient, type SanityClient } from "@sanity/client";

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET ?? "production";

export const isSanityConfigured = Boolean(projectId);

export const sanityClient: SanityClient | null = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: true, // build-time reads; CDN is fine and fast
    })
  : null;
