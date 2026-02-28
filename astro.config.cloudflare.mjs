// Astro configuration for Cloudflare Pages deployment
// Usage: Rename this file to astro.config.mjs when deploying to Cloudflare

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    integrations: [react()],
    output: 'server',
    adapter: cloudflare({
        platform: 'pages',
    }),
    vite: {
        plugins: [tailwindcss()],
        ssr: {
            noExternal: ["lucide-react", "framer-motion"],
        },
    },
});
