const { Sim, T_WALL, T_OPEN, T_HEAT, T_FAN } = require('./src/scripts/sim.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const finite = (s) => { for (const a of [s.u, s.v, s.fresh, s.age, s.temp, s.p]) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };

function box(s, x0, y0, x1, y1) {
  for (let x = x0; x <= x1; x++) { s.cell[s.idx(x, y0)] = T_WALL; s.cell[s.idx(x, y1)] = T_WALL; }
  for (let y = y0; y <= y1; y++) { s.cell[s.idx(x0, y)] = T_WALL; s.cell[s.idx(x1, y)] = T_WALL; }
}
function open(s, x0, y0, x1, y1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) s.cell[s.idx(x, y)] = T_OPEN; }
function run(s, secs) { let n = 0; while (s.t < secs) { s.step(s.suggestDt()); n++; } return n; }

// 1. free stream
{
  const s = new Sim(120, 80); s.setWind(3, 270); s.resetFlow();
  run(s, 10);
  let mu = 0, mv = 0, n = 0;
  for (let j = 1; j <= 80; j++) for (let i = 1; i <= 120; i++) { const c = i + j * s.S; mu += s.u[c]; mv += Math.abs(s.v[c]); n++; }
  ok(finite(s), 'free stream finite');
  ok(Math.abs(mu / n - 3) < 0.05, 'free stream u ~ 3 (got ' + (mu / n).toFixed(3) + ')');
  ok(mv / n < 0.02, 'free stream v ~ 0 (got ' + (mv / n).toFixed(4) + ')');
}

// 2. building: opposite windows vs same-side windows
function house(kind) {
  const s = new Sim(120, 80); s.setWind(3, 270);
  box(s, 30, 20, 89, 59);
  if (kind === 'cross') { open(s, 30, 26, 30, 33); open(s, 89, 46, 89, 53); }
  if (kind === 'same') { open(s, 30, 26, 30, 33); open(s, 30, 46, 30, 53); }
  if (kind === 'sealed') { }
  s.rebuild(); s.resetFlow();
  return s;
}
const res = {};
for (const k of ['cross', 'same', 'sealed']) {
  const s = house(k);
  const t0 = Date.now(); const n = run(s, 120); const ms = Date.now() - t0;
  const st = s.roomStats(0.1), sc = Sim.score(st);
  res[k] = sc;
  console.log(k, 'steps', n, 'ms/step', (ms / n).toFixed(2), 'rooms', st.length, 'fresh', sc.flush.toFixed(3), 'dead', sc.dead.toFixed(3), 'speed', sc.speed.toFixed(3), 'age', sc.age.toFixed(1), 'score', sc.score);
  ok(finite(s), k + ' finite');
  ok(s.maxV < 12, k + ' maxV bounded (' + s.maxV.toFixed(2) + ')');
}
ok(res.cross.flush > res.same.flush, 'cross-ventilation flushes more than same-side');
ok(res.same.flush > res.sealed.flush - 0.001, 'same-side >= sealed');
ok(res.cross.score > res.sealed.score, 'cross score > sealed score');
ok(res.sealed.flush < 0.02, 'sealed stays stale (' + res.sealed.flush.toFixed(4) + ')');

// 3. flow actually passes through the openings and around the house
{
  const s = house('cross'); run(s, 20);
  let inU = 0, n = 0;
  for (let y = 26; y <= 33; y++) { inU += s.u[s.idx(30, y)]; n++; }
  ok(inU / n > 0.3, 'inflow through west window (u=' + (inU / n).toFixed(2) + ')');
  // wake behind a sealed house is slower than free stream
  const z = house('sealed'); run(z, 20);
  const wake = z.spd[z.idx(100, 40)], free = z.spd[z.idx(110, 5)];
  ok(wake < free, 'wake slower than free stream (' + wake.toFixed(2) + ' < ' + free.toFixed(2) + ')');
  let leak = 0; for (let y = 22; y < 58; y++) for (let x = 32; x < 88; x++) leak = Math.max(leak, Math.abs(z.u[z.idx(x, y)]), Math.abs(z.v[z.idx(x, y)]));
  ok(leak < 0.05, 'sealed interior still (max ' + leak.toFixed(4) + ')');
}

// 4. section mode: heater drives rising air with no wind
{
  const s = new Sim(120, 80); s.mode = 'section'; s.cellSize = 0.1; s.setWind(0, 270);
  box(s, 30, 44, 90, 72);
  open(s, 30, 62, 30, 68); open(s, 58, 44, 62, 44);
  for (let x = 59; x <= 61; x++) s.cell[s.idx(x, 70)] = T_HEAT;
  s.rebuild(); s.resetFlow();
  run(s, 30);
  ok(finite(s), 'section finite');
  let up = 0, n = 0;
  for (let y = 50; y < 66; y++) for (let x = 56; x < 64; x++) { up += s.v[s.idx(x, y)]; n++; }
  ok(up / n < -0.02, 'plume rises (mean v ' + (up / n).toFixed(3) + ' m/s, up is negative)');
  ok(s.maxV < 3, 'section maxV bounded (' + s.maxV.toFixed(2) + ')');
  const sc = Sim.score(s.roomStats(0.1));
  console.log('section fresh', sc.flush.toFixed(3));
  ok(sc.flush > 0.05, 'stack ventilation flushes the room');
}

// 5. fan creates a jet
{
  const s = new Sim(120, 80); s.setWind(0, 270);
  box(s, 30, 20, 89, 59); s.rebuild();
  s.cell[s.idx(40, 40)] = T_FAN; s.fdir[s.idx(40, 40)] = 0; s.rebuild(); s.resetFlow();
  run(s, 5);
  ok(finite(s) && s.u[s.idx(46, 40)] > 0.3, 'fan jet moves air east (u=' + s.u[s.idx(46, 40)].toFixed(2) + ')');
}

// 6. divergence residual
{
  const s = house('cross'); run(s, 10);
  let mx = 0, sum = 0, n = 0;
  for (let j = 3; j < 78; j++) for (let i = 3; i < 118; i++) {
    const c = i + j * s.S; if (s.pNeu[c] || s.pNeu[c - 1] || s.pNeu[c + 1] || s.pNeu[c - s.S] || s.pNeu[c + s.S]) continue;
    const d = Math.abs(0.5 * (s.u[c + 1] - s.u[c - 1] + s.v[c + s.S] - s.v[c - s.S])); mx = Math.max(mx, d); sum += d; n++;
  }
  console.log('div mean', (sum / n).toFixed(4), 'max', mx.toFixed(4), '(m/s per cell)');
  ok(sum / n < 0.01, 'mean divergence small');
}

// 7. angled wind
{
  const s = new Sim(120, 80); s.setWind(4, 225); s.resetFlow(); // from SW
  run(s, 8);
  const c = s.idx(60, 40);
  ok(finite(s) && s.u[c] > 1 && s.v[c] < -1, 'SW wind blows to NE (u=' + s.u[c].toFixed(2) + ', v=' + s.v[c].toFixed(2) + ')');
}

// 8. performance at large size
{
  const s = new Sim(160, 106); s.setWind(3, 270); box(s, 50, 30, 110, 75); s.rebuild(); s.resetFlow();
  const t0 = Date.now(); for (let i = 0; i < 100; i++) s.step(0.05); const ms = (Date.now() - t0) / 100;
  console.log('160x106 ms/step', ms.toFixed(2));
}

// 9. plan heat gain: stagnant rooms run warmer than ventilated ones
{
  const t={};
  for (const k of ['cross','same','sealed']) { const s=house(k); run(s,240); t[k]=Sim.score(s.roomStats(0.1)); const st=s.roomStats(0.1)[0]; t[k].temp=st.temp; }
  console.log('temp rise cross/same/sealed', t.cross.temp.toFixed(2), t.same.temp.toFixed(2), t.sealed.temp.toFixed(2));
  ok(t.sealed.temp > t.same.temp && t.same.temp > t.cross.temp, 'worse ventilation means warmer room');
  ok(t.sealed.temp > 0.8 && t.sealed.temp < 6, 'sealed room warms plausibly (' + t.sealed.temp.toFixed(2) + ' K)');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);