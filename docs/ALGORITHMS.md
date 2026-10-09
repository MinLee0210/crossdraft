# How Crossdraft shows the wind flow

Crossdraft is a small 2D fluid simulation that runs in your browser. It is **indicative, not CFD**: it is built to show *how* air tends to move through a plan or section so layouts can be compared, not to certify a design.

Code map: solver `lib/sim.ts`, drawing `lib/engine.ts`, room reading `lib/insights.ts`, `lib/openings.ts`, `lib/phongthuy.ts`.

## 1. The model in one paragraph
The drawing is a grid of cells (`cellSize` metres each). Every cell stores a velocity `(u, v)` in m/s, a pressure, and three tracers: **fresh air** (0 to 1), **air age** (seconds) and **temperature rise** (K). Each frame the solver advances these fields by a few small time steps. The screen then colours the grid by one field and draws moving streaks on top of it.

## 2. Solver: "stable fluids" (Jos Stam)
This is the method from Stam's *Stable Fluids* (SIGGRAPH 1999) and *Real-Time Fluid Dynamics for Games* (2003). It is chosen because it never blows up at any wind speed, which suits a teaching tool. The air is treated as incompressible (it is not squeezed). One step (`Sim.step`) does:

```
apply boundary conditions
1. forces        buoyancy (Section only), fans, vorticity confinement, heaters
2. advect        move velocity along itself (semi-Lagrangian)
3. project       remove compression: solve for pressure, subtract its gradient
4. scalars       advect fresh air / age / temperature, mix, cool, add heat gain
```

### 2.1 Grid
A "padded" grid: `W x H` real cells plus a one-cell **ghost ring** around them that holds the boundary values. Cell `(x, y)` is index `(x+1) + (y+1)*S` with `S = W+2`. Cell types: empty, wall, opening, fan, heater. Walls are solid; openings are ordinary air cells that also separate rooms for the statistics.

### 2.2 Time step
`suggestDt()` follows a CFL rule: `dt = 0.8 * cellSize / vmax`, clamped to 0.01 to 0.1 s. `vmax` is the largest speed seen, but capped at 2.5 times the free-stream speed, because single corner cells spike and would otherwise stall the simulation.

### 2.3 Forces
- **Buoyancy (Section view only):** the Boussinesq approximation. Warm air is pushed up with `dv = -dt * 9.81/293 * temperature`. (Screen y points down, so minus is up.)
- **Fans:** a three-cell-wide jet, with the velocity set directly to `fanSpeed` along one of eight directions.
- **Vorticity confinement** (Fedkiw, Stam, Jensen, 2001): the semi-Lagrangian step smears out small eddies, so a small force `eps * (N x w)` pushes them back. `w` is the curl of the velocity, `N` the normalised gradient of `|w|`. It skips cells next to walls, otherwise it amplifies wall noise. The "Swirl boost" slider is `eps`.
- **Heaters:** their cells are pinned at `heatDT` kelvin above ambient.

### 2.4 Advection (semi-Lagrangian)
For each cell, trace backward along the velocity for one step and read the field at that spot: `x_old = x - dt/h * u`. The read uses **bilinear interpolation that ignores solid cells** and renormalises the remaining weights, so air never gets "dragged" out of a wall. If all four neighbours are solid it keeps the local value. This is unconditionally stable but adds some numerical blur.

### 2.5 Projection (pressure solve)
Real air does not compress, but the steps above can create divergence. Projection fixes that (a Helmholtz-Hodge step):
1. Compute divergence with central differences.
2. Solve the pressure Poisson equation with **SOR** (successive over-relaxation, a faster Gauss-Seidel): 16 iterations, relaxation factor `omega = 1.8`. (1.95 diverges; more iterations do not reduce the remaining divergence, which is structural.)
3. Subtract the pressure gradient from the velocity.

Wall cells and the ghost cells on inflow and closed sides use a Neumann mask (`pNeu`): they are skipped as pressure neighbours, so no air flows through a wall. Velocity inside walls is set to zero. Pressure is kept in velocity units, which is why no `dt` shows up in these formulas.

### 2.6 Scalars: fresh air, air age, temperature
Each is advected the same way, then mixed by **explicit eddy diffusion** with `kk = min(0.2, mixing * dt / h^2)`. The diffusion is conservative and has no flux into walls. The `0.2` cap keeps it stable (the 2D limit is 0.25).
- **Fresh air:** 1 outside and at inflow, 0 inside at the start. Clamped to [0, 1].
- **Air age:** grows by `dt` every step and is carried by the flow. Fresh inflow has age 0.
- **Temperature:** decays at a cooling rate (`cool`, `coolPlan`). In Plan view, rooms also gain heat: `gain / (1200 * ceilH)` K/s, where 1200 J/m3K is the volumetric heat capacity of air and `ceilH` converts W/m2 of floor into a rise in the air column.
- **Speed for statistics:** an exponentially smoothed speed (time constant 3 s), so "dead zone" does not flicker. Speeds are clamped at 30 m/s as a safety net.

### 2.7 Boundaries
Each of the four sides is one of: **inflow** (the side facing the wind, ghost cells hold the wind vector), **outflow** (zero gradient), or **wall** (Section view: both the lid and the ground are closed, with the normal velocity mirrored, which is free-slip, and the drawn ground cells below the house are solid). The wind vector comes from the compass bearing the wind blows *from*: `wx = -speed * sin(deg)`, `wy = speed * cos(deg)`. Section view uses only the east-west part.

## 3. Reading the rooms
- **Rooms:** a breadth-first flood fill over empty cells. Walls and openings block the fill, so an opening separates two regions. A region touching the edge is *outside*; a region under 4 cells is a *pocket*; the others become rooms R1, R2, ...
- **Statistics:** per room, the means of speed, fresh air, age and temperature; the **dead zone** is the share of cells whose smoothed speed is below the threshold; **T90** is the first time the room's mean fresh air reaches 90%.
- **Score:** `50 x flushed + 30 x (1 - dead zone) + 20 x comfort`, where comfort is 1 up to 0.3 m/s and falls linearly to 0 at 1.5 m/s.
- **Insights** (`lib/insights.ts`): rules over those numbers and the openings: sealed room, one opening, openings that only lead to other rooms, many openings but little flow, a well-flushed room, large dead zones, no wind. Openings are found as connected groups of opening cells (`lib/openings.ts`) with the rooms they touch.
- **Feng shui check** (`lib/phongthuy.ts`): looks at pairs of exterior openings of the same room that sit within 2 cells of one axis, at least 10 cells apart, with no wall along the straight line between them. It reports the mean air speed along that line. It detects geometry and measures air only. It does not score luck.

## 4. Drawing the flow
- **Colour fields:** the chosen field (heat, fresh air, speed, air age) goes through a 256-entry colour ramp into an `ImageData` of `W x H` pixels, which the canvas scales up with smoothing. Ramps differ for light and dark themes.
- **Flow streaks:** about 7% as many particles as cells. Each particle is moved by the velocity at its position (the same solid-skipping interpolation), lives 3 to 10 s, and respawns, more often near inflow sides. A streak is the local velocity drawn as a 0.4 s tail, so long streaks mean fast air and slow air shows as dots.
- **Arrows:** sampled every few cells, with length growing with the square root of the speed.
- **Dead zones:** hatched, drawn from run-length paths of the cells below the threshold.

## 5. Limits (read before quoting a number)
- **2D only.** A plan has no flow over the roof, so indoor speeds and deflection around buildings are overstated.
- **No turbulence model.** Turbulence is approximated by a constant eddy diffusivity and vorticity confinement, not by k-epsilon or LES.
- **First-order numerics.** Semi-Lagrangian advection blurs sharp fronts; some divergence remains near corners.
- **Cell-aligned walls**, thin openings, and constants (heat loss, heat gain) that are plausible, not measured.
- **Qualitative:** compare layouts against each other. For accuracy use a validated CFD tool such as OpenFOAM.

## References
- J. Stam, *Stable Fluids*, SIGGRAPH 1999.
- J. Stam, *Real-Time Fluid Dynamics for Games*, GDC 2003.
- R. Fedkiw, J. Stam, H. W. Jensen, *Visual Simulation of Smoke*, SIGGRAPH 2001 (vorticity confinement).
- Successive over-relaxation and the Boussinesq approximation are standard textbook methods.

These references are cited from memory of the field; check the originals before quoting them.
