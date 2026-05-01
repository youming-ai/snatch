import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    // Required for @astrojs/sitemap and canonical URLs. Override at build time
    // via SITE_URL=https://example.com if you deploy to a different host.
    site: process.env.SITE_URL || 'https://snatch.umuo.app',
    integrations: [react(), sitemap()],
    output: 'server',
    adapter: node({
        mode: 'standalone',
    }),
    vite: {
        plugins: [tailwindcss()],
        ssr: {
            // Bundle all dependencies into dist/server/entry.mjs so the runtime
            // image doesn't need node_modules. Shrinks the web Docker image dramatically.
            noExternal: true,
        },
    },
});
