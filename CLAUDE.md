# CLAUDE.md

## What this is
Crossdraft: Next.js (App Router, TypeScript) static site, a 2D airflow sketchpad for architects and engineers. The previous single-file version is kept in `legacy/` for reference.

## Commands
- Dev: `npm run dev`. Build: `npm run build` (static export to `out/`). Types: `npm run typecheck`.
- Format: `npm run format` (Prettier, config in `.prettierrc.json`); `npm run format:check` verifies. Run it before committing. `lib/i18n.ts` and `lib/presets.ts` are ignored on purpose (hand-laid-out data tables); `legacy/` and `docs/internal/` too.
- Browser tests: `npm run build` then `npm run e2e` (Playwright, Chromium; `npx playwright install chromium` once). They run against `out/` through `e2e/serve.mjs`, and CI runs them after the build job.
- Tests: `npm test` (vitest). Must pass before any commit; re-run after touching `lib/sim.ts` or `lib/layout.ts`.

## Architecture
- `lib/sim.ts`: pure solver, no DOM. Class `Sim`, plus `fanJetCells` (which cells a fan drives).
- `lib/layout.ts`: layout-code format (`rle`, `serialize`, strict `deserialize`). Pure.
- `lib/edit.ts`, `lib/presets.ts`, `lib/tools.ts`: drawing helpers, example layouts (each with a `note`), tool metadata.
- `lib/fengshui.ts`: the CLOSED list of feng shui rules (`FS_RULES`) and the not-checked list (`FS_NOT_CHECKED`); `evaluateFengShui`. Adding a rule means: a new id, result keys, `fs.<id>.title|tradition|physics` in both languages, and tests. Rules must be about airflow measured on the plan, never luck, wealth or health (a test scans the text).
- `lib/openings.ts`, `lib/insights.ts`, `lib/phongthuy.ts`, `lib/winds.ts`: opening detection, plain-language room insights, door-alignment check, typical wind presets. All pure.
- `lib/world.ts`: the world layer, notes and arrows drawn around the board (`WorldItem`, `cleanWorld`, `hitItem`). Pure. Metres from the board's top-left, saved in the layout code as optional `world`, never seen by the solver.
- `lib/project.ts`: the project format (v3): boards (id, name, world position, layout per mode, reserved `link`), active board and notes; `serializeProject`, strict `deserializeProject` (also reads a single-board v2 layout code), `#p=` share hash. Pure. Storage key `crossdraft.v3`.
- `lib/site.ts`, `lib/seo.ts`, `lib/content.ts`, `components/Doc.tsx`, `components/Guide.tsx`, `app/learn/`, `app/vi/learn/`, `app/sitemap.ts`, `app/robots.ts`: SEO and GEO. The guide pages (what it is, cross-ventilation basics, how it works, feng shui and airflow, examples, FAQ) are server-rendered, bilingual (`/learn`, `/vi/learn`), with canonical and hreflang metadata, JSON-LD (WebApplication on `/`, TechArticle, FAQPage, BreadcrumbList), a sitemap and robots.txt. Text lives in `lib/content.ts`; it must describe behaviour the app really has and keep the "indicative, not CFD" and "tradition, not engineering" framing. The site URL comes from `NEXT_PUBLIC_SITE_URL` (default the Vercel alias). `public/og.png` is the social preview, `public/llms.txt` is an optional summary for AI tools. `tests/seo.test.ts` checks both languages exist for every page.
- `lib/i18n.ts`: `EN` (source of truth) and `VI` dictionaries plus `translate(lang, key, vars)`. Components use `useT()`; the engine uses its own `t`. Every key must exist in both languages; `tests/i18n.test.ts` enforces it.
- `lib/gif.ts`: animated GIF encoder (`medianCut`, `Quantizer`, `GifEncoder`). Pure. The engine records the canvas into it (`recordGif`) and stamps the "not CFD" caption on every frame.
- `lib/sweep.ts`: `Sweep` runs a layout against 8 or 16 wind directions on its own `Sim`, time-sliced via `advance(budgetMs)`; `summarise`. Pure. The engine drops results (`dropSweep`) whenever the drawing changes.
- `lib/storage.ts`: localStorage access for the project (`saveProjectCode` returns a result, never throws; `readProjectCode`, `readLegacyV2`, `projectIsDrawn`). A failed save sets `UiState.saveWarn`, shown as a banner.
- `lib/render.ts`: all canvas drawing as free functions over an `Engine` (`render`, `drawBoard`, `drawHUD`, ...). The engine members it reads are public on purpose; keep state and behaviour in `engine.ts`.
- `lib/export.ts`: PNG and GIF export (`exportPng`, `recordGif`, `captureGif`, `finishGif`) as free functions over an `Engine`.
- `lib/flow.ts`: `flowThrough` gives flow through outside openings and air changes per hour from the velocity field. Pure, plan view only, assumes full-height openings.
- `lib/sweepRunner.ts`, `lib/sweep.worker.ts`: the wind sweep runs one direction per Web Worker (up to 4), and falls back to in-thread `Sweep` where workers are missing or fail. The engine only sees the `SweepJob` interface.
- `lib/engine.ts`: class `Engine` owns the solver, editing state, canvas rendering, particles, A/B tests, persistence and the rAF loop. React never touches the canvas; it reads `engine.getSnapshot()` through `useSyncExternalStore` and calls engine methods.
- `components/`: `App` (shell, keyboard), `Stage` (tools, canvas), `Side` (wind, rooms, compare, layouts, physics, save/load), `WindRose` (sweep chart), `ThemeToggle` (sun/moon button; sets `data-theme` on `<html>`, saved as `crossdraft.theme`).
- `app/`: layout (fonts via `next/font`), page, `globals.css` (CSS tokens, light and dark).

## Conventions
- Boards and world: a project has up to 8 boards, each with its own `Sim`, wind, mode, undo history and field bitmap (`Board` in `engine.ts`). The engine's `sim`, `hist`, `redoStack`, `saved`, `fc/img` and particle arrays are the ACTIVE board's, bound by `bind()` and written back by `unbind()`; use `withBoard(b, fn)` to run code against another board, and call `unbind()` before reading a board record's fields. The selected board runs at full speed, the others get one solver step every other frame (`stepIdle`). The canvas fills the window; the view is `zoom`, `offX/offY` (screen position of world origin), `pm` (px per metre) and `P = pm * cellSize` for the bound board. Notes and arrows (`lib/world.ts`) live in absolute world metres. `setInsets` tells the engine how much floating UI covers. `tests/engine.boards.test.ts` runs the engine with a stubbed DOM; keep it passing when touching the engine.
- Board create, delete, move, rename and unlink are steps on a project-level stack (`ops`, `pushOp`); each carries a `seq` that orders it against the active board's cell and note steps, so Ctrl+Z undoes whatever happened last. Undo and redo callbacks must not record steps themselves.
- A board with `link` follows its source: `syncLinks()` (each frame, between strokes) copies the source's size, mode, cells and fans onto it, and drawing on it is refused with a toast. Wind and physics stay its own. Deleting the source turns followers into ordinary boards.
- Dragging an edge or corner of the selected plan board with the Select tool resizes it (`resizeDrag`); the drawing keeps its place and undo history is cleared.
- Keyboard drawing goes through the same pointer path (`kbMove`, `kbPress`, `kbCancel`); the engine builds synthetic pointer events, so linked-board and tool rules apply unchanged.
- Vietnamese compass names differ from English letters (N is Nam). Always call `compass(deg, lang)`; see `docs/VIETNAMESE.md`.
- Undo history (`hist`, `redoStack`) holds cell snapshots and world snapshots (`{ world }`); notes and arrows are undone through the active board's history.
- A new tunable on `Sim` goes in `Sim.PARAMS` so a resize keeps it.
- Units: m, s, m/s. `cellSize` converts cells to metres.
- Padded grid: index = (x+1) + (y+1)*S, where S = W+2. Ghost ring at 0 and W+1 / H+1. Use `sim.idx(x,y)`.
- Cell types: 0 empty, 1 wall, 2 opening, 3 fan (dir in `fdir`), 4 heater, 5 screen (porous: not solid, damped by quadratic drag, listed in `sim.screens`), 6 door (`T_DOOR`: a closed door, solid like a wall; the door tool toggles it with an opening). Layout bytes: 0-6, and 10+d for a fan facing d.
- Side kinds: 0 outflow, 1 inflow, 2 wall. Plan: wind-facing sides are inflow, all others outflow. Section: ground and lid are walls.
- Wind: `deg` is where it comes FROM (0 = N, 90 = E). Screen y points down.
- After any layout, wind or mode change call `sim.rebuild()`. After changing fields call `sim.resetFlow()`.
- Keep `lib/sim.ts` and `lib/layout.ts` free of DOM and React.
- Theme: every colour is a CSS token with light and dark values (`app/globals.css`). `app/layout.tsx` has an inline script that applies the saved theme before paint; the engine re-reads colours when `data-theme` or the OS scheme changes. Canvas reads tokens in `Engine.readColors()`.

## Rules for new UI text
- Never hard-code user-facing strings. Add a key to `EN` and `VI` in `lib/i18n.ts`. Insight and Phong Thuy text must say "tradition, not engineering" where relevant and never score luck.

## Hard-won gotchas
- SOR omega 1.95 diverges. Keep omega <= 1.8. More pressure iterations did not reduce residual divergence (it is structural), so keep iters ~16.
- `suggestDt()` clamps the CFL estimate: corner cells spike far above the free stream and would stall the sim.
- `analyze()` marks the ghost ring as -9. Rooms touching the edge are "outside" (-1). Openings split rooms.
- Sampling skips solid cells and renormalises weights. Do not use plain bilinear near walls.
- ResizeObserver: defer resizes with requestAnimationFrame and react only to width changes, or the browser logs a loop error.
- `Engine` boots once (`booted` flag) because React StrictMode mounts effects twice in dev; `detach()` must undo everything `attach()` adds.
- The solver tests run 120-240 s simulations (~45 s in total). They are split across `tests/solver.*.test.ts` so vitest runs them in parallel: keep a new slow test in its own file, not appended to a big one. Shared setup is in `tests/helpers.ts`. `legacy/` is excluded from tsc and tests.
- Vorticity confinement skips cells next to walls, otherwise it amplifies wall noise.

## Rules
- Do not recolour a field to imply physics the solver does not compute. Add the model first.
- Keep "indicative, not CFD" visible. Do not promise engineering accuracy.
- Always wrap localStorage access in try/catch (blocked in some browsers).
- Keep `lib/sim.ts` free of DOM so tests stay fast.