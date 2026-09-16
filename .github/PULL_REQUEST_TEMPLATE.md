## What and why

<!-- The problem this solves, and what it changes. Link an issue if there is one. -->

## How it was verified

<!--
UI changes: which browser and which path — `bun dev:api` + `bun dev`, open
localhost:5173, paste a URL.
API changes: which test in `packages/api/test/`, or the request you made.
-->

## Checklist

- [ ] `bunx biome ci .` passes
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] `bun run build` produces `packages/web/dist/client` and `packages/api/dist/index.js`
- [ ] No new runtime dependency in `packages/shared`
- [ ] The old code path was deleted rather than shimmed
- [ ] AI-assisted commits carry the `Co-Authored-By` trailer

<!--
Architecture, conventions and the full Definition of Done live in AGENTS.md.
-->
