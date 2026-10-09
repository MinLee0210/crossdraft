/* Crossdraft solver: 2D incompressible "stable fluids" on a padded grid.
   Units: velocity m/s, time s, length m (cellSize m per cell).
   Padded index: (x+1) + (y+1)*S, ghost ring at 0 and W+1 / H+1. */
(function (root) {
'use strict';

const T_EMPTY = 0, T_WALL = 1, T_OPEN = 2, T_FAN = 3, T_HEAT = 4;
const R2 = Math.SQRT1_2;
// 8 fan directions: E, SE, S, SW, W, NW, N, NE (screen coords, y down)
const FAN_VEC = [[1, 0], [R2, R2], [0, 1], [-R2, R2], [-1, 0], [-R2, -R2], [0, -1], [R2, -R2]];
const FAN_STEP = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// Bilinear sample that ignores solid cells (weights renormalised).
function bil(q, x, y, W, H, S, solid, fb) {
  if (x < 0.5) x = 0.5; else if (x > W + 0.5) x = W + 0.5;
  if (y < 0.5) y = 0.5; else if (y > H + 0.5) y = H + 0.5;
  const i0 = x | 0, j0 = y | 0, s1 = x - i0, t1 = y - j0, s0 = 1 - s1, t0 = 1 - t1;
  const a = i0 + j0 * S, b = a + 1, c = a + S, d = c + 1;
  let w0 = s0 * t0, w1 = s1 * t0, w2 = s0 * t1, w3 = s1 * t1;
  if (solid[a]) w0 = 0; if (solid[b]) w1 = 0; if (solid[c]) w2 = 0; if (solid[d]) w3 = 0;
  const sw = w0 + w1 + w2 + w3;
  if (sw < 1e-5) return fb;
  return (w0 * q[a] + w1 * q[b] + w2 * q[c] + w3 * q[d]) / sw;
}

class Sim {
  constructor(W, H) {
    this.mode = 'plan';        // 'plan' (top-down, no gravity) | 'section' (side view, buoyancy on)
    this.cellSize = 0.25;      // metres per cell
    this.speed = 3; this.deg = 270; this.wx = 3; this.wy = 0; // wind: m/s, "from" bearing in degrees
    this.mixing = 0.03;        // eddy diffusivity, m^2/s
    this.swirl = 0.5;          // vorticity confinement strength
    this.heatDT = 15;          // heater excess temperature, K
    this.fanSpeed = 3;         // m/s at fan face
    this.iters = 16; this.omega = 1.8; // pressure iterations, SOR factor
    this.cool = 0.03;          // section: heat loss rate of the plume, 1/s
    this.coolPlan = 0.0015;    // plan: slow envelope loss, 1/s
    this.gain = 25;            // plan: internal heat gain (people, appliances, sun), W per m2 of floor
    this.ceilH = 2.7;          // ceiling height in m, converts W/m2 into K/s
    this.alloc(W, H);
  }

  alloc(W, H) {
    this.W = W; this.H = H; this.S = W + 2;
    const N = this.N = (W + 2) * (H + 2);
    const F = () => new Float32Array(N);
    this.u = F(); this.v = F(); this.u0 = F(); this.v0 = F(); this.p = F(); this.div = F();
    this.om = F(); this.aw = F();
    this.fresh = F(); this.fresh0 = F(); this.age = F(); this.age0 = F();
    this.temp = F(); this.temp0 = F(); this.spd = F();
    this.cell = new Uint8Array(N); this.fdir = new Uint8Array(N);
    this.solid = new Uint8Array(N); this.pNeu = new Uint8Array(N);
    this.labels = new Int16Array(N); this.rooms = [];
    this.fans = []; this.heaters = [];
    this.sideKind = [0, 0, 0, 0]; // L,R,T,B : 0 outflow, 1 inflow, 2 wall
    this.t = 0; this.maxV = 0; this.track = {}; this.trackAcc = 0; this.dirty = false;
    this._sv = [0, 0];
    this.queue = new Int32Array(W * H);
    this.ex = this.wx; this.ey = this.wy;
  }

  idx(x, y) { return (x + 1) + (y + 1) * this.S; }

  setWind(speed, deg) {
    this.speed = speed; this.deg = deg;
    const r = deg * Math.PI / 180;
    // "deg" is where the wind comes FROM (0 = N, 90 = E); screen y points down.
    this.wx = -speed * Math.sin(r);
    this.wy = speed * Math.cos(r);
    this.rebuild();
  }

  /* Recompute masks, boundary kinds and room labels after any layout/wind/mode change. */
  rebuild() {
    const W = this.W, H = this.H, S = this.S, cell = this.cell, solid = this.solid, pNeu = this.pNeu;
    solid.fill(0); pNeu.fill(0); this.fans.length = 0; this.heaters.length = 0;
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        const t = cell[c];
        if (t === T_WALL) { solid[c] = 1; pNeu[c] = 1; this.u[c] = 0; this.v[c] = 0; }
        else if (t === T_FAN) this.fans.push(c);
        else if (t === T_HEAT) this.heaters.push(c);
      }
    }
    const sec = this.mode === 'section';
    this.ex = this.wx; this.ey = sec ? 0 : this.wy;
    const eps = 1e-3, k = this.sideKind;
    k[0] = this.ex > eps ? 1 : 0; k[1] = this.ex < -eps ? 1 : 0;
    k[2] = this.ey > eps ? 1 : 0; k[3] = this.ey < -eps ? 1 : 0;
    if (sec) { k[2] = 2; k[3] = 2; } // free-slip lid above, closed ground below; west/east stay open
    const mark = (c, kind) => { if (kind === 1) pNeu[c] = 1; else if (kind === 2) { pNeu[c] = 1; solid[c] = 1; } };
    for (let j = 1; j <= H; j++) { mark(j * S, k[0]); mark(j * S + W + 1, k[1]); }
    for (let i = 1; i <= W; i++) { mark(i, k[2]); mark(i + (H + 1) * S, k[3]); }
    const cm = (c, a, b) => { pNeu[c] = 1; if (a === 2 || b === 2) solid[c] = 1; };
    cm(0, k[0], k[2]); cm(W + 1, k[1], k[2]);
    cm((H + 1) * S, k[0], k[3]); cm((H + 1) * S + W + 1, k[1], k[3]);
    this.analyze();
    this.track = {}; this.trackAcc = 0;
  }

  /* Label connected free regions. Walls and openings separate regions.
     label -1 = outside (touches domain edge), k>=1 = room k, -3 = tiny pocket. */
  analyze() {
    const W = this.W, H = this.H, S = this.S, cell = this.cell, lab = this.labels, q = this.queue;
    lab.fill(0);
    for (let i = 0; i <= W + 1; i++) { lab[i] = -9; lab[i + (H + 1) * S] = -9; } // ghost ring: visited, marks the border
    for (let j = 0; j <= H + 1; j++) { lab[j * S] = -9; lab[j * S + W + 1] = -9; }
    const rooms = []; let next = 1;
    for (let j = 1; j <= H; j++) {
      for (let i = 1; i <= W; i++) {
        const c = i + j * S, t = cell[c];
        if (lab[c] !== 0 || t === T_WALL || t === T_OPEN) continue;
        let head = 0, tail = 0, border = false, sx = 0, sy = 0;
        q[tail++] = c; lab[c] = -2;
        while (head < tail) {
          const m = q[head++]; sx += m % S; sy += (m / S) | 0;
          let z = m - 1;
          if (lab[z] === -9) border = true; else if (lab[z] === 0 && cell[z] !== T_WALL && cell[z] !== T_OPEN) { lab[z] = -2; q[tail++] = z; }
          z = m + 1;
          if (lab[z] === -9) border = true; else if (lab[z] === 0 && cell[z] !== T_WALL && cell[z] !== T_OPEN) { lab[z] = -2; q[tail++] = z; }
          z = m - S;
          if (lab[z] === -9) border = true; else if (lab[z] === 0 && cell[z] !== T_WALL && cell[z] !== T_OPEN) { lab[z] = -2; q[tail++] = z; }
          z = m + S;
          if (lab[z] === -9) border = true; else if (lab[z] === 0 && cell[z] !== T_WALL && cell[z] !== T_OPEN) { lab[z] = -2; q[tail++] = z; }
        }
        let L;
        if (border) L = -1;
        else if (tail < 4) L = -3;
        else { L = next++; rooms.push({ id: L, name: 'R' + L, cells: tail, cx: sx / tail - 1, cy: sy / tail - 1 }); }
        for (let n = 0; n < tail; n++) lab[q[n]] = L;
      }
    }
    this.rooms = rooms;
  }

  /* Reset all fields. Outside air starts fresh and moving, inside air starts stale and still. */
  resetFlow() {
    const W = this.W, H = this.H, S = this.S;
    for (const a of [this.u, this.v, this.u0, this.v0, this.p, this.div, this.om, this.aw,
      this.fresh, this.fresh0, this.age, this.age0, this.temp, this.temp0, this.spd]) a.fill(0);
    this.analyze();
    const lab = this.labels, f = this.fresh, cell = this.cell;
    for (let j = 1; j <= H; j++) {
      for (let i = 1; i <= W; i++) {
        const c = i + j * S;
        if (lab[c] === -1) { f[c] = 1; this.u[c] = this.ex; this.v[c] = this.ey; }
        else if (cell[c] === T_OPEN) f[c] = 0.5;
      }
    }
    this.setGhost(f, 1);
    this.t = 0; this.track = {}; this.trackAcc = 0; this.dirty = false; this.maxV = 0;
    this.applyVelBC(this.u, this.v);
  }

  suggestDt() {
    // CFL guide. Corner cells can spike far above the free stream, so the estimate is clamped to a band around it.
    let base = Math.max(Math.hypot(this.ex, this.ey), 1);
    if (this.fans.length) base = Math.max(base, this.fanSpeed);
    const vmax = Math.min(Math.max(this.maxV, base), 2.5 * base);
    return Math.min(0.1, Math.max(0.01, 0.8 * this.cellSize / vmax));
  }

  applyVelBC(u, v) {
    const W = this.W, H = this.H, S = this.S, k = this.sideKind, ex = this.ex, ey = this.ey;
    for (let j = 1; j <= H; j++) {
      const a = j * S, b = a + W + 1;
      if (k[0] === 1) { u[a] = ex; v[a] = ey; } else if (k[0] === 2) { u[a] = -u[a + 1]; v[a] = v[a + 1]; } else { u[a] = u[a + 1]; v[a] = v[a + 1]; }
      if (k[1] === 1) { u[b] = ex; v[b] = ey; } else if (k[1] === 2) { u[b] = -u[b - 1]; v[b] = v[b - 1]; } else { u[b] = u[b - 1]; v[b] = v[b - 1]; }
    }
    for (let i = 1; i <= W; i++) {
      const a = i, b = i + (H + 1) * S;
      if (k[2] === 1) { u[a] = ex; v[a] = ey; } else if (k[2] === 2) { u[a] = u[a + S]; v[a] = -v[a + S]; } else { u[a] = u[a + S]; v[a] = v[a + S]; }
      if (k[3] === 1) { u[b] = ex; v[b] = ey; } else if (k[3] === 2) { u[b] = u[b - S]; v[b] = -v[b - S]; } else { u[b] = u[b - S]; v[b] = v[b - S]; }
    }
    const cr = (c, a, b) => { u[c] = 0.5 * (u[a] + u[b]); v[c] = 0.5 * (v[a] + v[b]); };
    cr(0, 1, S); cr(W + 1, W, W + 1 + S);
    cr((H + 1) * S, (H + 1) * S + 1, H * S); cr((H + 1) * S + W + 1, (H + 1) * S + W, H * S + W + 1);
  }

  setGhost(q, val) {
    const W = this.W, H = this.H, S = this.S, k = this.sideKind;
    if (k[0] !== 2) for (let j = 0; j <= H + 1; j++) q[j * S] = val;
    if (k[1] !== 2) for (let j = 0; j <= H + 1; j++) q[W + 1 + j * S] = val;
    if (k[2] !== 2) for (let i = 0; i <= W + 1; i++) q[i] = val;
    if (k[3] !== 2) for (let i = 0; i <= W + 1; i++) q[i + (H + 1) * S] = val;
  }

  /* Semi-Lagrangian advection of a scalar by (u,v). Ghost cells hold ambient air. */
  advS(q, q0, dtc, ambient) {
    const W = this.W, H = this.H, S = this.S, u = this.u, v = this.v, solid = this.solid;
    q0.set(q); this.setGhost(q0, ambient); this.setGhost(q, ambient);
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        if (solid[c]) continue;
        q[c] = bil(q0, i - dtc * u[c], j - dtc * v[c], W, H, S, solid, q0[c]);
      }
    }
  }

  /* Explicit eddy diffusion, conservative, no flux through walls. */
  diffuse(q, q0, kk) {
    if (kk <= 0) return;
    const W = this.W, H = this.H, S = this.S, solid = this.solid;
    q0.set(q);
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        if (solid[c]) continue;
        const qc = q0[c]; let s = 0;
        if (!solid[c - 1]) s += q0[c - 1] - qc;
        if (!solid[c + 1]) s += q0[c + 1] - qc;
        if (!solid[c - S]) s += q0[c - S] - qc;
        if (!solid[c + S]) s += q0[c + S] - qc;
        q[c] = qc + kk * s;
      }
    }
  }

  project() {
    const W = this.W, H = this.H, S = this.S, u = this.u, v = this.v, p = this.p, div = this.div, pNeu = this.pNeu;
    this.applyVelBC(u, v);
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        if (pNeu[c]) { div[c] = 0; p[c] = 0; continue; }
        div[c] = -0.5 * (u[c + 1] - u[c - 1] + v[c + S] - v[c - S]);
      }
    }
    const om = this.omega, it = this.iters;
    for (let k = 0; k < it; k++) {
      for (let j = 1; j <= H; j++) {
        let c = j * S + 1;
        for (let i = 1; i <= W; i++, c++) {
          if (pNeu[c]) continue;
          let n = 0, s = 0;
          if (!pNeu[c - 1]) { n++; s += p[c - 1]; }
          if (!pNeu[c + 1]) { n++; s += p[c + 1]; }
          if (!pNeu[c - S]) { n++; s += p[c - S]; }
          if (!pNeu[c + S]) { n++; s += p[c + S]; }
          if (n === 0) continue;
          p[c] += om * ((s + div[c]) / n - p[c]);
        }
      }
    }
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        if (pNeu[c]) { u[c] = 0; v[c] = 0; continue; }
        const pc = p[c];
        const pl = pNeu[c - 1] ? pc : p[c - 1], pr = pNeu[c + 1] ? pc : p[c + 1];
        const pt = pNeu[c - S] ? pc : p[c - S], pb = pNeu[c + S] ? pc : p[c + S];
        u[c] -= 0.5 * (pr - pl); v[c] -= 0.5 * (pb - pt);
      }
    }
  }

  step(dt) {
    const W = this.W, H = this.H, S = this.S, h = this.cellSize, dtc = dt / h;
    const u = this.u, v = this.v, u0 = this.u0, v0 = this.v0, solid = this.solid, temp = this.temp;
    const sec = this.mode === 'section';
    this.applyVelBC(u, v);

    // 1. body forces ------------------------------------------------------
    if (sec) { // Boussinesq buoyancy: warm air rises (screen y is down)
      const kb = dt * 9.81 / 293;
      for (let j = 1; j <= H; j++) {
        let c = j * S + 1;
        for (let i = 1; i <= W; i++, c++) if (!solid[c]) v[c] -= kb * temp[c];
      }
    }
    for (const c of this.fans) { // fans: 3-cell wide jet
      const d = this.fdir[c], fx = FAN_VEC[d][0] * this.fanSpeed, fy = FAN_VEC[d][1] * this.fanSpeed;
      const px = -FAN_STEP[d][1], py = FAN_STEP[d][0];
      for (let k = -1; k <= 1; k++) {
        const x = c + k * px + k * py * S;
        if (x > S && x < this.N - S && !solid[x]) { u[x] = fx; v[x] = fy; }
      }
    }
    if (this.swirl > 0) { // vorticity confinement keeps eddies alive
      const om = this.om, aw = this.aw, eps = this.swirl * h;
      om.fill(0); aw.fill(0);
      for (let j = 2; j < H; j++) {
        let c = j * S + 2;
        for (let i = 2; i < W; i++, c++) {
          if (solid[c] || solid[c - 1] || solid[c + 1] || solid[c - S] || solid[c + S]) continue;
          const w = 0.5 * ((v[c + 1] - v[c - 1]) - (u[c + S] - u[c - S])) / h;
          om[c] = w; aw[c] = Math.abs(w);
        }
      }
      for (let j = 3; j < H - 1; j++) {
        let c = j * S + 3;
        for (let i = 3; i < W - 1; i++, c++) {
          if (om[c] === 0) continue;
          let nx = 0.5 * (aw[c + 1] - aw[c - 1]), ny = 0.5 * (aw[c + S] - aw[c - S]);
          const l = Math.sqrt(nx * nx + ny * ny) + 1e-9; nx /= l; ny /= l;
          u[c] += dt * eps * ny * om[c]; v[c] -= dt * eps * nx * om[c];
        }
      }
    }
    for (const c of this.heaters) temp[c] = this.heatDT;

    // 2. advect velocity -------------------------------------------------
    u0.set(u); v0.set(v); this.applyVelBC(u0, v0);
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        if (solid[c]) continue;
        const x = i - dtc * u0[c], y = j - dtc * v0[c];
        u[c] = bil(u0, x, y, W, H, S, solid, u0[c]);
        v[c] = bil(v0, x, y, W, H, S, solid, v0[c]);
      }
    }

    // 3. project to divergence-free ---------------------------------------
    this.project();

    // 4. scalars: fresh air, air age, temperature ------------------------
    const kk = Math.min(0.2, this.mixing * dt / (h * h));
    this.advS(this.fresh, this.fresh0, dtc, 1); this.diffuse(this.fresh, this.fresh0, kk);
    this.advS(this.age, this.age0, dtc, 0); this.diffuse(this.age, this.age0, kk);
    this.advS(temp, this.temp0, dtc, 0); this.diffuse(temp, this.temp0, kk);
    const decay = Math.exp(-(sec ? this.cool : this.coolPlan) * dt), age = this.age, fresh = this.fresh, lab = this.labels;
    const gainRate = sec ? 0 : this.gain / (1200 * this.ceilH); // K/s: W/m2 over (rho*cp = 1200 J/m3K) x ceiling height
    let mx = 0; const a = 1 - Math.exp(-dt / 3), spd = this.spd;
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        if (solid[c]) continue;
        age[c] += dt; temp[c] *= decay;
        if (gainRate > 0 && lab[c] > 0) temp[c] += gainRate * dt; // heat load inside rooms only
        if (fresh[c] < 0) fresh[c] = 0; else if (fresh[c] > 1) fresh[c] = 1;
        let uu = u[c], vv = v[c];
        let s = Math.sqrt(uu * uu + vv * vv);
        if (s > 30) { const f = 30 / s; u[c] = uu * f; v[c] = vv * f; s = 30; }
        spd[c] += (s - spd[c]) * a;
        if (s > mx) mx = s;
      }
    }
    for (const c of this.heaters) temp[c] = this.heatDT;
    this.maxV = mx;
    this.t += dt;
    this.trackAcc += dt;
    if (this.trackAcc >= 0.5) { this.trackAcc = 0; this.updateTrack(); }
  }

  updateTrack() {
    const st = this.roomStats(0.1);
    for (const r of st) {
      const tr = this.track[r.id] || (this.track[r.id] = { t50: null, t90: null });
      if (tr.t50 === null && r.fresh >= 0.5) tr.t50 = this.t;
      if (tr.t90 === null && r.fresh >= 0.9) tr.t90 = this.t;
    }
  }

  /* Per-room statistics. deadThr is the still-air speed threshold in m/s. */
  roomStats(deadThr) {
    const W = this.W, H = this.H, S = this.S, lab = this.labels, spd = this.spd;
    const R = this.rooms, n = R.length;
    const acc = R.map(() => ({ sv: 0, dead: 0, fr: 0, ag: 0, tp: 0 }));
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++) {
        const L = lab[c]; if (L < 1) continue;
        const a = acc[L - 1];
        a.sv += spd[c]; a.fr += this.fresh[c]; a.ag += this.age[c]; a.tp += this.temp[c];
        if (spd[c] < deadThr) a.dead++;
      }
    }
    const h2 = this.cellSize * this.cellSize, out = [];
    for (let k = 0; k < n; k++) {
      const r = R[k], a = acc[k], c = r.cells, tr = this.track[r.id] || { t50: null, t90: null };
      out.push({
        id: r.id, name: r.name, cells: c, area: c * h2, cx: r.cx, cy: r.cy,
        speed: a.sv / c, dead: a.dead / c, fresh: a.fr / c, age: a.ag / c, temp: a.tp / c,
        t50: tr.t50, t90: tr.t90
      });
    }
    return out;
  }

  sampleVel(x, y) {
    const W = this.W, H = this.H, S = this.S, sv = this._sv;
    sv[0] = bil(this.u, x, y, W, H, S, this.solid, 0);
    sv[1] = bil(this.v, x, y, W, H, S, this.solid, 0);
    return sv;
  }

  static score(stats) {
    if (!stats || !stats.length) return null;
    let A = 0, fr = 0, dd = 0, cm = 0, sp = 0, ag = 0, worst = 0, unk = false;
    for (const r of stats) {
      A += r.area; fr += r.area * r.fresh; dd += r.area * r.dead; sp += r.area * r.speed; ag += r.area * r.age;
      const v = r.speed, c = v <= 0.3 ? 1 : Math.max(0, Math.min(1, (1.5 - v) / 1.2));
      cm += r.area * c;
      if (r.t90 === null) unk = true; else if (r.t90 > worst) worst = r.t90;
    }
    const flush = fr / A, dead = dd / A, comfort = cm / A;
    return {
      score: Math.round(50 * flush + 30 * (1 - dead) + 20 * comfort),
      flush, dead, comfort, speed: sp / A, age: ag / A, worstT90: unk ? null : worst, area: A
    };
  }
}

const api = { Sim, T_EMPTY, T_WALL, T_OPEN, T_FAN, T_HEAT, FAN_VEC, FAN_STEP };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);