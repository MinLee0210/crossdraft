# CLAUDE.md

## What this is
Crossdraft: Next.js (App Router, TypeScript) static site, a 2D airflow sketchpad for architects and engineers. The previous single-file version is kept in `legacy/` for reference.

## Commands
- Dev: `npm run dev`. Build: `npm run build` (static export to `out/`). Types: `npm run typecheck`.
- Tests: `npm test` (vitest). Must pass before any commit; re-run after touching `lib/sim.ts` or `lib/layout.ts`.

## Architecture
- `lib/sim.ts`: pure solver, no DOM. Class `Sim`.
- `lib/layout.ts`: layout-code format (`rle`, `serialize`, strict `deserialize`). Pure.
- `lib/edit.ts`, `lib/presets.ts`, `lib/tools.ts`: drawing helpers, example layouts, tool metadata.
- `lib/engine.ts`: class `Engine` owns the solver, editing state, canvas rendering, particles, A/B tests, persistence and the rAF loop. React never touches the canvas; it reads `engine.getSnapshot()` through `useSyncExternalStore` and calls engine methods.
- `components/`: `App` (shell, keyboard), `Stage` (tools, canvas), `Side` (wind, rooms, compare, layouts, physics, save/load), `ThemeToggle` (sun/moon button; sets `data-theme` on `<html>`, saved as `crossdraft.theme`).
- `app/`: layout (fonts via `next/font`), page, `globals.css` (CSS tokens, light and dark).

## Conventions
- Units: m, s, m/s. `cellSize` converts cells to metres.
- Padded grid: index = (x+1) + (y+1)*S, where S = W+2. Ghost ring at 0 and W+1 / H+1. Use `sim.idx(x,y)`.
- Cell types: 0 empty, 1 wall, 2 opening, 3 fan (dir in `fdir`), 4 heater.
- Side kinds: 0 outflow, 1 inflow, 2 wall. Plan: wind-facing sides are inflow, all others outflow. Section: ground and lid are walls.
- Wind: `deg` is where it comes FROM (0 = N, 90 = E). Screen y points down.
- After any layout, wind or mode change call `sim.rebuild()`. After changing fields call `sim.resetFlow()`.
- Keep `lib/sim.ts` and `lib/layout.ts` free of DOM and React.
- Theme: every colour is a CSS token with light and dark values (`app/globals.css`). `app/layout.tsx` has an inline script that applies the saved theme before paint; the engine re-reads colours when `data-theme` or the OS scheme changes. Canvas reads tokens in `Engine.readColors()`.

## Hard-won gotchas
- SOR omega 1.95 diverges. Keep omega <= 1.8. More pressure iterations did not reduce residual divergence (it is structural), so keep iters ~16.
- `suggestDt()` clamps the CFL estimate: corner cells spike far above the free stream and would stall the sim.
- `analyze()` marks the ghost ring as -9. Rooms touching the edge are "outside" (-1). Openings split rooms.
- Sampling skips solid cells and renormalises weights. Do not use plain bilinear near walls.
- ResizeObserver: defer resizes with requestAnimationFrame and react only to width changes, or the browser logs a loop error.
- `Engine` boots once (`booted` flag) because React StrictMode mounts effects twice in dev; `detach()` must undo everything `attach()` adds.
- The solver test suite is slow (~2 min, runs 120-240 s simulations). `legacy/` is excluded from tsc and tests.
- Vorticity confinement skips cells next to walls, otherwise it amplifies wall noise.

## Rules
- Do not recolour a field to imply physics the solver does not compute. Add the model first.
- Keep "indicative, not CFD" visible. Do not promise engineering accuracy.
- Always wrap localStorage access in try/catch (blocked in some browsers).
- Keep sim.js free of DOM so tests stay fast.