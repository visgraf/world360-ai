# Agent Notes

## Project Shape

- This is a single Vite React TypeScript app; there is no monorepo or test suite yet.
- App entrypoint is `src/main.tsx`; UI composition starts in `src/App.tsx`.
- The current layout is `Header` above a full-height R3F `MainCanvas`.
- Use `motion/react` for Motion imports, not `framer-motion`.

## Commands

- Install dependencies with `npm install`; `package-lock.json` is the lockfile.
- Start local dev server with `npm run dev`.
- Verify changes with `npm run lint` before `npm run build`.
- `npm run lint` is read-only (`eslint .`); do not assume it formats or fixes code.
- There is no `npm test` script yet.

## Build And Deploy Gotchas

- `vite.config.ts` sets `base: '/world360-ai/'` for project-path deployment; do not remove it unless the deployment target changes.
- `npm run build` runs both TS configs before Vite: `tsc -p tsconfig.json && tsc -p tsconfig.node.json && vite build`.
- A large chunk warning is expected while Three/R3F are bundled into the initial app; the warning does not mean the build failed.

## Layout Gotchas

- `.canvas-shell` is sized to `calc(100svh - var(--header-height))`; vertical transforms on this full-height element cause a temporary page scrollbar.
- If adding slide motion, animate an inner wrapper with clipping instead of moving `.canvas-shell` itself.
