# PLAN.md

## Goal
A credible demo that architects and engineers will actually try: bring their own plan, get numbers in their language, trust the limits.

## Now (shipped)
Plan + Section views, fans, heaters, room heat gain, metrics + score, A/B tests, presets, export/import, light/dark theme.
Rewritten as a Next.js (App Router, TypeScript) static site with vitest tests for the solver and layout codes.

> Direction and audience research: see `docs/ROADMAPS.md`. Short-term tasks: `docs/TODO.md`.

## Next (in order)
0. **Hardening and CI:** GitHub Actions running typecheck, tests and build; UI smoke test (Playwright); speed up the solver suite.
   Done when: every push is checked and a failing change cannot be merged.
1. **Trace a plan:** import image/PDF/DXF underlay, set scale from a known distance.
   Done when: a scanned plan can be traced and walls land at correct metres.
2. **Wind-direction sweep:** run 8 or 16 directions automatically, show score per direction (wind-rose chart).
   Done when: one click gives a ranked table and a rose; results match a manual run.
3. **Engineer metrics:** air changes per hour, m3/h per opening, pass/fail against a chosen standard (ASHRAE 62.1, EN 16798, TCVN).
   Done when: numbers are explained in-app with assumptions listed.
4. **Report export:** one-page PNG/PDF with layout, metrics, assumptions. Needs a hosted build (artifact sandbox blocks downloads).
5. **Wind sources:** inlet, outlet/extractor, and per-side wind zones.

## Later
- Scenarios: opening schedules, CO2/smoke sources, infection-risk estimate, time of day
- Operable windows (partial open), louvers, shading, furniture library
- Auto-suggest: search window positions/sizes to maximise score
- Projects, sharing, comments, version history
- Validation page: published benchmark cases with error shown
- Linked 2.5D (plan + section share openings), then optional coarse 3D
- "Pro run": send layout to OpenFOAM on a server for accurate results

## Known issues
- 2D plan overstates indoor speeds and wind deflection (no flow over roof)
- Corner velocity spikes at sharp block corners (potential-flow singularity)
- Wall heat loss constants are plausible, not measured
- Large grid (160x106) is slow (~8 ms/step)
- Layouts saved per browser only
- Solver suite is slow (~2 min); no UI/browser tests yet
- Next.js port verified by typecheck, build and unit tests, not yet by automated browser tests

## Risks
- Users quoting numbers as certified: keep disclaimers, add validation page early.
- Solver accuracy ceiling: stay positive about comparison, not certification.

## Decision log
- 2025-10: single static file, no backend (fast to ship, free hosting)
- 2025-10: Stam solver over LBM (simpler, stable at any wind speed)
- 2025-10: Section view uses a free-slip lid (open sky pulled 17% of flow upward)
- 2025-10: Plan heat is a passive tracer with room heat gain, not a recolour of fresh air
- 2026-10: rewrite to Next.js static export (`output: 'export'`) to get components, typed modules and testable layout code; still no backend
- 2026-10: solver, layout codes and UI split into `lib/` (pure) and `components/` (React); the canvas engine stays imperative and React reads snapshots via `useSyncExternalStore`
- 2026-10: layout-code `deserialize` is strict (version, wind, cell values, exact length) instead of silently padding
