# ROADMAPS.md

Product direction for Crossdraft, based on a scan of related tools (October 2026) and the current audience.

## Focus and audience
- **Focus now:** demonstrate how wind moves through a house. Visual, instant, easy to understand. Not certification.
- **Audience:** random visitors online, with a deliberate lean towards **engineering and architecture students** designing a home. Many are in Asia, where **Phong Thuy** (feng shui) shapes how people judge a floor plan, and air flow is central to it ("feng shui" literally means wind and water).
- **Position:** between "look at a diagram in a textbook" and "learn a CFD or Grasshopper workflow". Zero install, sketch in seconds, see air move.

## What exists (landscape)

| Tool | What it does | Cost / access | Gap Crossdraft can fill |
|---|---|---|---|
| [Autodesk Forma](https://www.autodesk.com/learn/ondemand/module/evaluating-environmental-performance-in-early-design-with-forma/unit/4k7yQZa6MWVAWDdWzcJWmh) | Early-design site analysis: wind flow and comfort maps around massing, microclimate (UTCI) | Cloud, Autodesk subscription | Outdoor/site scale, not rooms inside a house; not a learning tool |
| [SimScale](https://www.simscale.com/wind-tunnel-simulator-online/) | Browser CFD, virtual wind tunnel | Browser, free tier (limits not verified) | Real CFD means meshes, setup and wait time; too heavy for a first sketch |
| Autodesk Flow Design | Virtual wind tunnel | [Discontinued 2018](https://www.autodesk.com/sg/support/account/manage/billing/retired-products) | The "quick virtual wind tunnel" slot is empty |
| [Ventorah](https://toolradar.com/tools/ventorah) | Browser CFD, aerodynamic flows | Free tier limited to demos | Aimed at aerodynamics, not houses |
| [Climate Consultant](https://research.uaeu.ac.ae/en/publications/climate-consultant-30-a-tool-for-visualizing-building-energy-impl/) and [CBE Clima Tool](https://ar5iv.labs.arxiv.org/html/2212.04609) | Climate analysis, wind roses and design strategies from weather files | Free, desktop / web | Tells you which way the wind blows, not what it does inside your plan |
| [Ladybug Tools](https://discourse.ladybug.tools/t/making-a-wind-rose-analysis/11981) | Parametric environmental analysis in Grasshopper | Requires Rhino + Grasshopper | Steep learning curve |

**Takeaway:** the tools that give an answer are heavy; the tools that are light give climate data, not room-scale airflow. Crossdraft's niche is *draw a plan, see the flow now*. Nothing found does that for students and the Phong Thuy question.

## Phong Thuy: how to treat it honestly
Sources (practitioner articles, not science) agree on a few airflow-related ideas:
- The **front door is where energy ("khi") enters**; the entrance should be able to gather it rather than let it pass through. ([Master Sean Chan](https://www.masterseanchan.com/feng-shui-front-back-door-myth/), [Lamudi](https://www.lamudi.com.ph/journal/five-tips-feng-shui-friendly-home/))
- **Front door in line with the back door or a large window** lets energy run straight through. Common remedies are a screen, large plant, shelf, curtain, an L-shaped corridor or an entrance buffer (huyen quan). ([Vietnamese guide](https://thuviennhadat.vn/cam-nang-nha-dat/nhung-loi-thuong-gap-khi-thiet-ke-cua-chinh-theo-phong-thuy-va-cach-sua-chua-605037.html))
- **"Tang phong tu khi"** (hide the wind, gather the air): block harsh wind, keep the good breeze. VnExpress describes shielding cold north / north-east wind and letting south / south-east breeze in. ([VnExpress](https://vnexpress.net/cay-xanh-trong-phong-thuy-2428975.html))
- Stairs facing the entrance, a cramped door, or a living room at the back of the house are also flagged.

Important: these are **traditional beliefs, not measured outcomes**. Crossdraft must not claim they affect wealth or health. What it *can* do is show the physics next to the rule. Notably, aligned doors do give good cross-ventilation (and possibly drafts), so the tension between the tradition and comfort is itself something students find interesting.

**Principle:** show *what the air does* (measured by the solver), then *what tradition says* (labelled "Phong Thuy rule"), and let the user decide. Never show a "good luck" score.

## Local design context (Vietnam / SE Asia)
- Tube houses (narrow, deep, side walls shared) struggle for light and air. Architects use **light wells, voids, courtyards, openable partitions and breeze blocks** for cross and stack ventilation. ([ArchDaily](https://www.archdaily.com/1036530/whatsapp:/send), [Dezeen: ANH House](https://www.dezeen.com/2013/08/28/anh-house-by-sanuki-nishizawa/amp/), [Designboom](https://www.designboom.com/?p=1179079))
- Hanoi and Ho Chi Minh City have different climates, so passive strategies differ. ([Transsolar](https://transsolar.com/approach/transsolar-academy/2015/vu-hoang-vietnam))
- These make good built-in examples because they are the layouts students actually design.

## Roadmap

### Phase 1: Student-ready demo (next)
Goal: a student can open the link, load a familiar house, and understand why the air does what it does.
1. **Local examples:** tube house with light well (Plan + Section), apartment with one-sided windows, courtyard house, open-plan flat. Each with a one-line "what to notice".
2. **Wind presets by place and season:** e.g. NE winter monsoon / S-SE summer breeze for northern and southern Vietnam; a simple city picker with typical prevailing directions. Data source to confirm (CBE Clima / EPW wind roses), keep it a preset list first.
3. **Plain-language insights:** after a run, say in words: "Room R2 stays stale because there is only one opening" / "air enters at the west window and leaves at the east window". Built from existing room stats and paths.
4. **Shareable links:** put the layout code in the URL hash so students can send a design to a teacher or friend. No backend.
5. **Vietnamese UI** (then English-first with room for Chinese, Thai, Indonesian): strings moved out of components.
6. **Touch / phone support** and a short first-visit tour.

### Phase 2: Phong Thuy mode (opt-in toggle)
1. **Rule checks drawn on the plan:** front door aligned with back door or large window; stairs facing the entrance; entrance with no buffer. Each check is a labelled marker, with the physical airflow measured next to it (through-flow speed, how long air lingers near the door).
2. **Remedy tools:** screen / huyen quan, large plant, curtain as *porous* obstacles (needs a partial-blockage model in the solver, not just solid blocks). Before / after in one click using the existing A/B test.
3. **"Gather the air" metric:** how long incoming air stays in the entrance zone vs. passing straight through (uses air age and tracer already in the solver).
4. **Tradition vs. physics panel:** short explanation of each rule, what it says, what the simulation shows, and an explicit "belief, not engineering" label. Cite sources.
5. **Compass overlay** (la ban style orientation) with the plan's facing direction, to talk about which side the good breeze comes from.

### Phase 3: Design aids
1. **Wind-direction sweep:** score per direction as a wind rose (already planned in PLAN.md).
2. **Window suggestions:** try openings along walls and recommend positions that raise the score.
3. **Trace a plan:** image underlay with scale, so students can trace their own drawings.
4. **Export:** PNG / short GIF of the flow plus metrics for assignments and posts.
5. **Engineer metrics:** air changes per hour, flow per opening (from PLAN.md), explained in-app.

### Later / maybe
- Linked plan + section, optional coarse 3D
- Teacher mode: shared exercises, "fix this house" challenges, scoring
- Validation page with benchmark cases and shown error
- Optional "pro run" to a real CFD backend

## Risks
- **Over-claiming:** Phong Thuy plus a score invites "the app says my house is lucky". Mitigation: no luck score, clear labels, keep "indicative, not CFD".
- **Physics limits:** 2D, no roof flow, indoor speeds overstated. Fine for teaching, must stay visible.
- **Scope creep:** Phong Thuy has many schools (Bat Trach, Flying Stars, ...). Start with the airflow-only rules above; do not model compass-luck systems.
- **Local data accuracy:** wind presets are typical directions, not site data. Say so.
- **Translation quality:** have a native speaker review the Vietnamese text and the rule explanations.

## Open questions
- Which regions first (Vietnam only, or Vietnam + China / Taiwan / Singapore)?
- Does the Phong Thuy mode ship as a separate page (clearer positioning) or a toggle?
- Hosting for sharing: static only (URL hash) is enough for now; revisit if the audience wants saved galleries.

## Sources checked
Search coverage was thin on some tools (Forma ventilation capabilities, SimScale free-tier limits, Ventorah accuracy claims are not independently verified). Treat the table as a starting map, and recheck before quoting.
