import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
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
  // Cloudflare Pages specific configuration
  preview: {
    port: 3000,
  },
  define: {
    // Add environment variables for different platforms
    __CLOUDFLARE_PAGES__: JSON.stringify(true),
    __BROWSER_ENV__: JSON.stringify(true),
  },
});

export default config;
