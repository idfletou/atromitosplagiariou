// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Canonical site origin — used for the sitemap, canonical URLs and OG tags.
  site: 'https://atromitosplagiariou.gr',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
