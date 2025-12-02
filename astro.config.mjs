import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    integrations: [react()],
    output: 'server',
    adapter: node({
        mode: 'standalone',
    }),
    vite: {
        plugins: [tailwindcss()],
        build: {
            rollupOptions: {
                external: [
                    "puppeteer-extra",
                    "puppeteer-extra-plugin-stealth",
                    "puppeteer",
                    "crawlee",
                    "@crawlee/browser-pool",
                    "playwright",
                    "playwright-extra",
                ],
            },
        },
        ssr: {
            noExternal: ["lucide-react", "framer-motion"],
            external: [
                "puppeteer-extra",
                "puppeteer-extra-plugin-stealth",
                "puppeteer",
                "crawlee",
                "@crawlee/browser-pool",
                "playwright",
                "playwright-extra",
            ],
        },
    },
});
