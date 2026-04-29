import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    integrations: [react()],
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
