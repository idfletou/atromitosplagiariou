# Sanity Studio — setup (one time)

The **Studio** is the friendly dashboard where non-technical editors write news.
It's a small separate app you host for free on Sanity's servers. You only set
this up once.

The files in this folder (`schemaTypes/`) define the shape of a news article and
are ready to drop into a fresh Studio.

## 1. Create the Studio

From the **project root**, run:

```bash
npm create sanity@latest -- --template clean --create-project "Atromitos FC" --dataset production --output-path studio
```

- Log in (Google/GitHub/email) when prompted — this creates your free Sanity account.
- Choose **TypeScript: Yes**, package manager **npm**.
- When it finishes, note the **Project ID** it prints (8 characters).

## 2. Add the schema

Copy the schema from this folder into the new studio:

```bash
cp sanity/schemaTypes/postType.ts studio/schemaTypes/postType.ts
cp sanity/schemaTypes/index.ts studio/schemaTypes/index.ts
```

(The `clean` template already imports `./schemaTypes`, so this just replaces the
empty starter.)

## 3. Connect the website to Sanity

Create a `.env` file in the project root (copy from `.env.example`) and fill in:

```
PUBLIC_SANITY_PROJECT_ID=your8charid
PUBLIC_SANITY_DATASET=production
```

Restart `npm run dev`. The site now pulls news from Sanity instead of the sample
data — no code change needed.

## 4. Let the website read your content (CORS)

In the [Sanity dashboard](https://www.sanity.io/manage) → your project → **API** →
**CORS origins**, add your site URLs (e.g. `http://localhost:4321` and your
Cloudflare Pages URL). Public read is fine — no token needed for published content.

## 5. Run / deploy the Studio

```bash
cd studio
npm run dev      # edit locally at http://localhost:3333
npm run deploy   # publish to https://atromitos-fc.sanity.studio  ← editors use this
```

Send editors the deployed Studio URL. They log in and post from any device,
including their phone.

## 6. Auto-publish to the live site (deploy hook)

Because the website is statically built, new articles appear after a rebuild:

1. In **Cloudflare Pages** → your project → **Settings → Builds & deployments →
   Deploy hooks**, create a hook and copy its URL.
2. In the [Sanity dashboard](https://www.sanity.io/manage) → **API → Webhooks**,
   add a webhook pointing at that URL, triggered on create/update/delete of
   `post` documents.

Now publishing an article triggers a Cloudflare rebuild and it goes live in ~1–2
minutes.
