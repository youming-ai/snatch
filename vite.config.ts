import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    rollupOptions: {
      external: [
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'puppeteer',
        'crawlee',
        '@crawlee/browser-pool',
        'playwright',
        'playwright-extra',
      ],
    },
  },
  ssr: {
    noExternal: ['lucide-react', 'framer-motion'],
    external: [
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
      'puppeteer',
      'crawlee',
      '@crawlee/browser-pool',
      'playwright',
      'playwright-extra',
    ],
  },
})

export default config
