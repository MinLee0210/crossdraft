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
- [x] Tool: screen / plant / curtain as a porous obstacle (cell type 5, quadratic drag `SCREEN_K`, key 9 is now Erase and 8 is Screen). Door-alignment check flags a screen on the line, and there is an "Aligned windows with a screen" example for A/B tests. Loss coefficient is plausible, not measured.
- [x] Closed rule list (`lib/fengshui.ts`): four airflow rules (front-to-back line, entrance buffer, wind and openings, stagnant air), each shown with a status, what tradition says, and what the simulation measured. A "not checked" list names what Crossdraft does not cover. No luck score; tests fail if luck, wealth or health words appear in the text.
- [ ] Source links for the tradition statements in the feng shui panel (currently unreferenced, from the research notes in `docs/ROADMAPS.md`).
- [ ] Decide: separate page or a toggle? (see ROADMAPS open questions)

## Later: "Explain with AI" (OpenRouter free tier)
Decision: consider later. The rule list above is the closed input and guardrail for it. Evaluation so far (see `docs/ROADMAPS.md`, "Explain with AI"):
- [ ] Browser test first: does `openrouter.ai/api/v1` accept calls straight from the browser (CORS), does the "Sign in with OpenRouter" PKCE login work from a static page, and can the free model list be fetched?
- [ ] Bake-off: run 5 sample layouts through 3-4 current `:free` models, in English and Vietnamese, and pick by how well they follow the closed rules (no invented doctrine, no luck claims).
- [ ] Button "Explain with AI (free)": PKCE login so each visitor uses their own free quota (shared key is not viable: ~20 requests/min and ~50/day per account without a $10 purchase). Key kept in local storage.
- [ ] Send only the structured payload (rule results, room stats, wind, sweep summary), no address or personal data; ask for no data collection; show a privacy note.
- [ ] Guardrails: closed rule list in the prompt, short answer, "AI-generated, tradition not engineering" label, word check on the reply with fallback to the template text, cache by input hash, friendly message when the daily limit is hit, fall back to another model when one disappears.
- [ ] Re-check OpenRouter's current limits and privacy terms on its own site before building (figures came from secondary sources).

## Quality (needed before promoting widely)
- [x] GitHub Actions: typecheck, test, build on every push.
- [x] Speed up the solver tests: ~125 s to ~45 s locally. Split into `tests/solver.{basic,houses,heat,units}.test.ts` so vitest runs them in parallel, and the heat-gain test uses a smaller grid (wider ordering margins). Shared setup in `tests/helpers.ts`.
- [ ] Browser smoke test (Playwright): load page, draw a wall, switch theme, export/import a code. The Next.js port has only been checked by typecheck, build and unit tests.
- [ ] Touch and phone check of drawing; fix pointer issues if any.
- [x] Unit tests for `roomStats` / `Sim.score` edge cases and all 8 fan directions (`tests/solver.units.test.ts`, `tests/solver.basic.test.ts`).

## Carried over from PLAN.md
- [x] Wind-direction sweep with a wind rose (`lib/sweep.ts`, `components/WindRose.tsx`): 8 or 16 directions, ranked table, click to apply a wind. Runs time-sliced on the main thread (about a minute); a Web Worker would be smoother.
- [ ] Trace a plan (image underlay with scale)
- [ ] PNG export of the result
- [ ] Engineer metrics (air changes per hour, flow per opening)

## Known tidy-ups
- [x] Fan jet near grid edges: verified it cannot wrap (neighbours are at most one cell away, so they land in the ghost ring); `fanJetCells` extracted and tested. The new direction tests found a different bug, fixed: diagonal fans were weak because their three cells only touched at corners (see `docs/PLAN.md`).
- [ ] Room names (`R1`, `R2`) change when the layout is edited; consider stable ids or user names.
- [ ] Use `textContent`-style rendering (React already escapes) if room renaming is added; keep it escaped.
