// Cloudflare Pages Function — runs on every request to this project.
// Permanently redirects the default *.pages.dev URL to the custom domain so
// only atromitosplagiariou.gr is reachable/indexed (avoids duplicate content).
// Path + query string are preserved. Lives at the repo root (NOT in dist/);
// Cloudflare Pages deploys the functions/ directory automatically alongside the
// static Astro build. To disable, just delete this file.
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Only the canonical production host — preview/branch deploys
  // (<hash>.atromitosplagiariou.pages.dev) are left working.
  if (url.hostname === "atromitosplagiariou.pages.dev") {
    url.hostname = "atromitosplagiariou.gr";
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
