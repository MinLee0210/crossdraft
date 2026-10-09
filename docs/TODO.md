# TODO

Next steps, in order. Longer-term direction is in `docs/ROADMAPS.md`; shipped work and decisions are in `docs/PLAN.md`.

## Do next (small, high value for students)
- [x] Add 3 local example layouts (tube house with light well, one-sided apartment, courtyard house) to `lib/presets.ts`, each with a short "what to notice" line shown under the picker. (Plan only; a Section version of the tube house is still open.)
- [x] Plain-language insight box under Rooms (`lib/insights.ts`, `lib/openings.ts`). Waits 40 s without edits before judging a run.
- [x] Share link: layout in the URL hash (`toHash` / `fromHash`), loaded on startup, "Share link" button in the header.
- [x] Wind presets for Vietnam (`lib/winds.ts`), labelled typical, not site data. Directions come from general knowledge and one VnExpress article: please review before promoting.
- [x] UI strings in a dictionary (`lib/i18n.ts`), English and Vietnamese, EN/VI switch in the header. **Needs a native-speaker review** of the Vietnamese.

## Then: Phong Thuy mode (opt-in)
- [x] Detect "front door aligned with back door/window" (`lib/phongthuy.ts`) and mark it with a dashed line; opt-in "Phong Thuy checks" overlay.
- [ ] Measure and show: through-flow speed at the entrance (done: mean speed along the aligned line) and how long air lingers near it (air age in an entrance zone, not done).
- [ ] Tool: screen / plant / curtain as porous obstacle (solver needs a partial-blockage term; start with a thin low-flow block).
- [ ] "Tradition vs. physics" panel with sources and a clear "belief, not engineering" label. No luck score. (A first version appears per detected alignment; it covers only the door-alignment rule and has no source links yet.)
- [ ] Decide: separate page or a toggle? (see ROADMAPS open questions)

## Quality (needed before promoting widely)
- [x] GitHub Actions: typecheck, test, build on every push.
- [ ] Speed up `tests/solver.test.ts` (~2 min): shorter runs or a smaller grid where physics allows.
- [ ] Browser smoke test (Playwright): load page, draw a wall, switch theme, export/import a code. The Next.js port has only been checked by typecheck, build and unit tests.
- [ ] Touch and phone check of drawing; fix pointer issues if any.
- [ ] More unit tests for `roomStats` / `Sim.score` edge cases and non-east fans.

## Carried over from PLAN.md
- [ ] Wind-direction sweep with a wind rose
- [ ] Trace a plan (image underlay with scale)
- [ ] PNG export of the result
- [ ] Engineer metrics (air changes per hour, flow per opening)

## Known tidy-ups
- [ ] Fan jet near grid edges may wrap across rows (`lib/sim.ts`, fan block in `step`); verify and fix.
- [ ] Room names (`R1`, `R2`) change when the layout is edited; consider stable ids or user names.
- [ ] Use `textContent`-style rendering (React already escapes) if room renaming is added; keep it escaped.
