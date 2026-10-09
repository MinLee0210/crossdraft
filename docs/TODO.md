# TODO

Next steps, in order. Longer-term direction is in `docs/ROADMAPS.md`; shipped work and decisions are in `docs/PLAN.md`.

## Do next (small, high value for students)
- [x] Add 3 local example layouts (tube house with light well, one-sided apartment, courtyard house) to `lib/presets.ts`, each with a short "what to notice" line shown under the picker. (Plan only; a Section version of the tube house is still open.)
- [ ] Plain-language insight box under Rooms ("R2 stays stale: only one opening"). Derive from `roomStats` and `sim.labels`.
- [ ] Share link: store the layout code in the URL hash (`serialize` / `deserialize` already exist), load it on startup, add a "Copy link" button.
- [ ] Wind presets by season and city (start with a hard-coded list for Vietnam: NE winter monsoon, S/SE summer breeze). Mark clearly as typical, not site data.
- [ ] Move UI strings into a dictionary and add Vietnamese.

## Then: Phong Thuy mode (opt-in)
- [ ] Detect "front door aligned with back door/window" (line of sight through two openings crossing a room) and mark it on the canvas.
- [ ] Measure and show: through-flow speed at the entrance and how long air lingers near it (air age in an entrance zone).
- [ ] Tool: screen / plant / curtain as porous obstacle (solver needs a partial-blockage term; start with a thin low-flow block).
- [ ] "Tradition vs. physics" panel with sources and a clear "belief, not engineering" label. No luck score.
- [ ] Decide: separate page or a toggle? (see ROADMAPS open questions)

## Quality (needed before promoting widely)
- [ ] GitHub Actions: typecheck, test, build on every push.
- [ ] Speed up `tests/solver.test.ts` (~2 min): shorter runs or a smaller grid where physics allows.
- [ ] Browser smoke test (Playwright): load page, draw a wall, switch theme, export/import a code. The Next.js port has only been checked by typecheck, build and unit tests.
- [ ] Touch and phone check of drawing; fix pointer issues if any.
- [ ] Unit tests for `roomStats` / `Sim.score` edge cases and non-east fans.

## Carried over from PLAN.md
- [ ] Wind-direction sweep with a wind rose
- [ ] Trace a plan (image underlay with scale)
- [ ] PNG export of the result
- [ ] Engineer metrics (air changes per hour, flow per opening)

## Known tidy-ups
- [ ] Fan jet near grid edges may wrap across rows (`lib/sim.ts`, fan block in `step`); verify and fix.
- [ ] Room names (`R1`, `R2`) change when the layout is edited; consider stable ids or user names.
- [ ] Use `textContent`-style rendering (React already escapes) if room renaming is added; keep it escaped.
