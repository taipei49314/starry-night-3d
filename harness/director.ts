// M8 harness: placeholder landmark scene (§2 positions), the director camera at ?t=<sec>, and numeric tests (?tests).
//   harness/director.html?t=45            director camera at loop time 45 s
//   harness/director.html?t=45&view=far   overview camera (also: view=near, view=funnel)
//   harness/director.html?t=10&free&hud   start in free mode (ring + HUD visible)
//   harness/director.html?tests           numeric tests -> window.__report, console.error on failure
import * as THREE from 'three';
import { CAMERA_FAR, CAMERA_NEAR, CANVAS_ASPECT, HILL_WALL_D, LOOP_SECONDS, MOON_DEF, MOON_RING_D, MOON_RING_RHO, STAR_RING_D, STAR_RING_RHO, STARS, VORTICES } from '../src/contracts';
import { canvasPoseFovDeg, canvasToWorld, EYE, FORWARD, groundHitDepth, jetPoint, worldToCanvas } from '../src/shared/canvasSpace';
import { armPoint, ridgeV } from '../src/shared/flowField';
import { mulberry32 } from '../src/shared/rng';
import { alignOf, Director, poseQuaternion, REJOIN_SAMPLES } from '../src/camera/director';
import {
  catmullRomCentripetal, CriticalSpring3, dollyZoomFov, ease, funnelCameraPoint, hermite, logPolarAboutEye, vanWijkNuij,
} from '../src/camera/paths';
import { applyComfort, KEYFRAME_CHECKS, KEYS, newPose, SHOTS, shotAt, Timeline, timelineEnv, newEnv, trunkAxisAt } from '../src/camera/shots';

const q = new URLSearchParams(location.search);
const T = q.has('t') ? Number(q.get('t')) : 0;
const VIEW = q.get('view');
const RUN_TESTS = q.has('tests');
const W = window.innerWidth;
const H = window.innerHeight;
const DEG = Math.PI / 180;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x050a18);
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(36, W / H, CAMERA_NEAR, CAMERA_FAR);
const scene = new THREE.Scene();

const basic = (color: number, o: Partial<THREE.MeshBasicMaterialParameters> = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const lineMat = (color: number, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
const polyline = (pts: THREE.Vector3[], mat: THREE.Material, loop = false) => {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = loop ? new THREE.LineLoop(g, mat) : new THREE.Line(g, mat);
  l.frustumCulled = false;
  return l;
};
const marker = (p: THREE.Vector3, color: number, minR = 2, fixed = false) => {
  const r = fixed ? minR : Math.max(minR, 0.0035 * p.distanceTo(EYE));
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), basic(color));
  m.position.copy(p);
  return m;
};
/** Canvas annulus (ring k of a halo): a flat strip at constant depth, inner/outer radius in h-units. */
const annulus = (cu: number, cv: number, rho: number, d: number, width: number, color: number, opacity = 1) => {
  const n = 96;
  const pos: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (const rr of [rho * (1 - width), rho * (1 + width)]) {
      canvasToWorld(cu + (rr * Math.cos(a)) / CANVAS_ASPECT, cv + rr * Math.sin(a), d, P);
      pos.push(P.x, P.y, P.z);
    }
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, basic(color, { side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
  m.frustumCulled = false;
  return m;
};

function buildScene(): void {
  // far canvas frame (240 km) + 10 % grid, and the generated extent
  const D = 240000;
  const C = (u: number, v: number) => canvasToWorld(u, v, D);
  const grid: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) { grid.push(C(i / 10, 0), C(i / 10, 1), C(0, i / 10), C(1, i / 10)); }
  const gl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), lineMat(0x3a4a7a, 0.55));
  gl.frustumCulled = false;
  scene.add(gl);
  scene.add(polyline([C(0, 0), C(1, 0), C(1, 1), C(0, 1)], lineMat(0xd9b44a), true));
  scene.add(polyline([C(-0.3, -0.12), C(1.3, -0.12), C(1.3, 1.1), C(-0.3, 1.1)], lineMat(0x2a52be, 0.6), true));
  // underpainting slab (dark) at 245 km
  const up = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
    canvasToWorld(-0.3, -0.12, 245000), canvasToWorld(1.3, -0.12, 245000), canvasToWorld(1.3, 1.1, 245000),
    canvasToWorld(-0.3, -0.12, 245000), canvasToWorld(1.3, 1.1, 245000), canvasToWorld(-0.3, 1.1, 245000),
  ]), basic(0x0b1a3a, { side: THREE.DoubleSide }));
  up.frustumCulled = false;
  scene.add(up);

  // ground plane (earth region x -3..4 km, z 0..-6.5 km) + 250 m grid, knoll
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 13000), basic(0x18261c, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(500, 0, -3250);
  scene.add(ground);
  const gpts: THREE.Vector3[] = [];
  for (let x = -6500; x <= 7500; x += 250) gpts.push(v3(x, 0.05, 3250), v3(x, 0.05, -9750));
  for (let z = 3250; z >= -9750; z -= 250) gpts.push(v3(-6500, 0.05, z), v3(7500, 0.05, z));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gpts), lineMat(0x2f4a36, 0.8)));
  const knoll = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 16), basic(0x22331f));
  knoll.scale.set(1, 14 / 110, 1);
  knoll.position.set(-50, 0, -195);
  scene.add(knoll);

  // cypress: tapered tube along base (-50, 10, -200) -> top (-51, 154, -175), plus axis markers
  const cb = v3(-50, 10, -200), ct = v3(-51, 154, -175);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(3, 19, cb.distanceTo(ct), 14, 1), basic(0x1d2b1f));
  cyl.position.copy(cb).lerp(ct, 0.5);
  cyl.quaternion.setFromUnitVectors(v3(0, 1, 0), ct.clone().sub(cb).normalize());
  scene.add(cyl);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 8), basic(0x2f3d26));
  flame.position.copy(ct).add(v3(0, 7, 0));
  scene.add(flame);
  scene.add(marker(cb, 0x8fb8a8, 3), marker(ct, 0x8fb8a8, 3));

  // church: nave (40 long x 16 wide x 18 high, yaw 15 deg), octagonal shaft to 75 m, spire to 145 m
  const cbase = v3(27, 0, -678);
  const nave = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 40), basic(0x4a5a73));
  nave.position.copy(cbase).add(v3(0, 9, -14));
  nave.rotation.y = 15 * DEG;
  scene.add(nave);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 75, 8), basic(0x5b6b85));
  shaft.position.copy(cbase).add(v3(0, 37.5, 0));
  scene.add(shaft);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4, 70, 8), basic(0x6b7b95));
  spire.position.copy(cbase).add(v3(0, 110, 0));
  scene.add(spire);
  scene.add(marker(v3(27, 145, -678), 0xf2c230, 3));

  // village: 40 houses at canvas ground hits + lit window squares
  const rng = mulberry32(11);
  const P = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    const u = rng.range(0.32, 1.1), v = rng.range(0.06, 0.195);
    if (Math.hypot((u - 0.55) * CANVAS_ASPECT, v - 0.11) < 0.04) continue;
    const d = groundHitDepth(u, v);
    canvasToWorld(u, v, d, P);
    const w = rng.range(10, 24), h = rng.range(6, 10), dd = rng.range(8, 16);
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), basic(0x3a4660));
    house.position.set(P.x, h / 2, P.z);
    house.rotation.y = Math.atan2(-P.x, -P.z) + Math.PI + rng.range(-0.35, 0.35);
    scene.add(house);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), basic(0xf5d860, { side: THREE.DoubleSide }));
    win.position.set(0, 0, dd / 2 + 0.05);
    house.add(win);
  }

  // hills: three sloped walls (crest ridgeV, depth law of §2.3)
  const hillCol = [0x2a3d5e, 0x24365a, 0x1e2f52];
  for (let k = 0; k < 3; k++) {
    const pos: number[] = [];
    const idx: number[] = [];
    const n = 160;
    const crest: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const u = -0.3 + (1.6 * i) / n;
      const rv = ridgeV(u, k);
      const base = HILL_WALL_D[k] + 300 * Math.sin(2.6 * u + k);
      const top = canvasToWorld(u, rv, base, new THREE.Vector3());
      const bot = canvasToWorld(u, 0.2, base - 900, new THREE.Vector3());
      crest.push(top);
      pos.push(top.x, top.y, top.z, bot.x, bot.y, bot.z);
      if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    scene.add(new THREE.Mesh(g, basic(hillCol[k], { side: THREE.DoubleSide })));
    scene.add(polyline(crest, lineMat(0x5e8fb0)));
  }

  // stars: cores + rings (Venus: all 9 rings + ring-centre markers on its ray)
  STARS.forEach((s, si) => {
    const core = canvasToWorld(s.u, s.v, s.dCore);
    const rCore = Math.max(s.rhoCore * 2 * 0.3249197 * s.dCore * 0.5, 0.0035 * s.dCore);
    const m = new THREE.Mesh(new THREE.SphereGeometry(rCore, 20, 14), basic(si === 0 ? 0xfff2b0 : 0xf5e27a));
    m.position.copy(core);
    scene.add(m);
    const rings = si === 0 ? s.rings : 2;
    for (let k = 0; k < rings; k++) {
      const kk = si === 0 ? k : k * (s.rings - 1);
      const rho = s.rhoCore * (1 + STAR_RING_RHO * kk);
      const d = s.dCore * (1 + STAR_RING_D * kk);
      scene.add(annulus(s.u, s.v, rho, d, 0.05, kk % 2 === 0 ? 0xf2c230 : 0x8fb8a8));
      if (si === 0) scene.add(marker(canvasToWorld(s.u, s.v, d), 0xffffff, 20));
    }
  });
  // moon + bell
  const moon = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), basic(0xd98a1e));
  moon.position.copy(canvasToWorld(MOON_DEF.u, MOON_DEF.v, MOON_DEF.d));
  scene.add(moon);
  for (let k = 1; k < MOON_DEF.rings; k += 2) {
    scene.add(annulus(MOON_DEF.u, MOON_DEF.v, MOON_DEF.rCrescent + MOON_RING_RHO * k, MOON_DEF.d * (1 + MOON_RING_D * k), 0.04, 0xf2c230, 0.8));
  }

  // vortex funnels: translucent cone surface, throat/mouth rings, both arms
  VORTICES.forEach((V, vi) => {
    const big = vi < 2;
    const nr = 28, nt = 64;
    const pos: number[] = [];
    const idx: number[] = [];
    const Q = new THREE.Vector3();
    for (let i = 0; i <= nr; i++) {
      const r = V.r0 * Math.pow(V.rmax / V.r0, i / nr);
      const d = V.dThroat * Math.pow(r / V.r0, V.expo);
      for (let j = 0; j <= nt; j++) {
        const a = (j / nt) * Math.PI * 2;
        canvasToWorld(V.u + (r * Math.cos(a)) / CANVAS_ASPECT, V.v + r * Math.sin(a), d, Q);
        pos.push(Q.x, Q.y, Q.z);
        if (i < nr && j < nt) { const b = i * (nt + 1) + j; idx.push(b, b + nt + 1, b + 1, b + 1, b + nt + 1, b + nt + 2); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const surf = new THREE.Mesh(g, basic(big ? (vi === 0 ? 0x2a52be : 0x5e8fb0) : 0x3a5a8a, { side: THREE.DoubleSide, transparent: true, opacity: big ? 0.32 : 0.22, depthWrite: false }));
    surf.frustumCulled = false;
    scene.add(surf);
    for (const [r, col] of [[V.r0, 0xffffff], [V.rmax, 0xe8edf0]] as const) {
      scene.add(annulus(V.u, V.v, r, V.dThroat * Math.pow(r / V.r0, V.expo), big ? 0.06 : 0.04, col));
    }
    for (const arm of [0, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 200; i++) { const a = armPoint(vi, arm, i / 200, 0); pts.push(canvasToWorld(a.u, a.v, a.d)); }
      scene.add(polyline(pts, lineMat(0xe8edf0)));
    }
    // throat / mouth centres: small fixed markers (a big sphere would hide the village seen through the throat)
    if (big) {
      const throat = canvasToWorld(V.u, V.v, V.dThroat);
      const mouth = canvasToWorld(V.u, V.v, V.dThroat * Math.pow(V.rmax / V.r0, V.expo));
      scene.add(marker(throat, 0xffffff, 6, true), marker(mouth, 0x8fb8a8, 60));
    }
  });

  // wind jet (three filaments)
  for (const off of [-0.004, 0, 0.004]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 200; i++) { const j = jetPoint(i / 200, off); pts.push(canvasToWorld(j.u, j.v, j.d)); }
    scene.add(polyline(pts, lineMat(0x8fb8a8)));
  }

  // keyframe landmarks
  scene.add(marker(EYE, 0xff3355, 1.5));
  scene.add(marker(KEYS.V6, 0xff66cc), marker(KEYS.V6B, 0xff66cc), marker(KEYS.P_MID, 0xffaa00, 80));
  scene.add(marker(KEYS.A47, 0x66ffcc, 12, true), marker(KEYS.A44, 0x66ffcc, 12, true), marker(KEYS.H0, 0xff3355, 3));
  scene.add(marker(KEYS.C1_MOUTH_TABLE, 0xff8800, 120));
}

const timeline = new Timeline();
function buildPath(): void {
  const hues = [0.0, 0.08, 0.16, 0.28, 0.42, 0.55, 0.62, 0.72, 0.82, 0.92];
  const pos: number[] = [];
  const col: number[] = [];
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i <= 4800; i++) {
    const t = (i / 4800) * LOOP_SECONDS;
    timeline.position(t, p);
    pos.push(p.x, p.y, p.z);
    c.setHSL(hues[shotAt(t)], 0.9, 0.6);
    col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  l.frustumCulled = false;
  scene.add(l);
}

// ---------------------------------------------------------------- tests
type Row = { name: string; ok: boolean; detail: string };
const report: { rows: Row[]; failures: number; tableBuildMs?: number; [k: string]: unknown } = { rows: [], failures: 0 };
const out = document.getElementById('out')!;
const check = (name: string, ok: boolean, detail: string) => {
  report.rows.push({ name, ok, detail });
  if (!ok) { report.failures++; console.error(`FAIL ${name}: ${detail}`); }
  out.textContent += `${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}\n`;
};
const angDeg = (a: THREE.Vector3, b: THREE.Vector3) => Math.acos(Math.max(-1, Math.min(1, a.clone().normalize().dot(b.clone().normalize())))) / DEG;

function testPaths(): void {
  const a = v3(1, 2, 3), b = v3(-4, 5, 9), m0 = v3(1, 0, 0), m1 = v3(0, 1, 0), o = new THREE.Vector3();
  check('hermite endpoints', hermite(a, m0, b, m1, 0, o).distanceTo(a) < 1e-12 && hermite(a, m0, b, m1, 1, o).distanceTo(b) < 1e-12, 'p(0)=p0, p(1)=p1');
  const pts = [v3(0, 0, 0), v3(10, 0, 0), v3(10, 30, 0), v3(-5, 31, 2), v3(0, 0, 50)];
  let crErr = 0;
  for (let i = 0; i < pts.length; i++) crErr = Math.max(crErr, catmullRomCentripetal(pts, i / (pts.length - 1), o).distanceTo(pts[i]));
  check('catmullRomCentripetal interpolates', crErr < 1e-9, `max ${crErr.toExponential(1)}`);
  const A = v3(-2501, 12196, -42537);
  const mid = logPolarAboutEye(A, KEYS.H0, 0.5, new THREE.Vector3());
  const dA = A.distanceTo(EYE), dH = KEYS.H0.distanceTo(EYE);
  check('logPolarAboutEye ends + log-lerp', logPolarAboutEye(A, KEYS.H0, 0, o).distanceTo(A) < 1e-6 && logPolarAboutEye(A, KEYS.H0, 1, o).distanceTo(KEYS.H0) < 1e-9
    && Math.abs(mid.distanceTo(EYE) - Math.sqrt(dA * dH)) < 1e-6, `mid dist ${mid.distanceTo(EYE).toFixed(2)} vs ${Math.sqrt(dA * dH).toFixed(2)}`);
  const vw = vanWijkNuij(v3(0, 0, 0), 10, v3(1000, 0, 0), 20, Math.SQRT2);
  const s0 = vw.at(0), s1 = vw.at(1), sm = vw.at(0.5);
  check('vanWijkNuij ends + zoom-out', s0.center.length() < 1e-9 && Math.abs(s0.width - 10) < 1e-9 && s1.center.distanceTo(v3(1000, 0, 0)) < 1e-6 && Math.abs(s1.width - 20) < 1e-6 && sm.width > 100,
    `S=${vw.duration.toFixed(3)} w(0.5)=${sm.width.toFixed(1)}`);
  check('dollyZoomFov shot 3', Math.abs(dollyZoomFov(40, 411.4, 315.6) - 50.8) < 0.05, dollyZoomFov(40, 411.4, 315.6).toFixed(2));
  const th = funnelCameraPoint(0, 0.02, 0, 0);
  check('funnelCameraPoint c1 throat', th.distanceTo(v3(-2274, 11092, -38670)) < 3, `${th.x.toFixed(0)}, ${th.y.toFixed(0)}, ${th.z.toFixed(0)}`);
  const sp = new CriticalSpring3(20).reset(v3(1, 0, 0));
  for (let i = 0; i < 30; i++) sp.step(v3(0, 0, 0), 1 / 60);
  check('CriticalSpring3 settle 0.5 s', sp.value.length() < 1e-3, `err ${sp.value.length().toExponential(2)} m`);
  check('ease ends', ['inOutCubic', 'inOutSine', 'smootherstep', 'outQuint'].every((k) => Math.abs((ease as Record<string, (t: number) => number>)[k](0)) < 1e-12 && Math.abs((ease as Record<string, (t: number) => number>)[k](1) - 1) < 1e-12), 'f(0)=0, f(1)=1');
}

function testKeyframes(): void {
  const P = newPose();
  const aspect = 16 / 9;
  for (const k of KEYFRAME_CHECKS) {
    timeline.pose(k.t, P);
    applyComfort(P, aspect, false);
    const parts: string[] = [];
    let ok = true;
    const dist = P.p.distanceTo(EYE);
    if (k.pos) {
      const e = P.p.distanceTo(v3(...k.pos));
      const tol = k.approx ?? Math.max(0.5, 0.001 * dist);
      parts.push(`pos err ${e.toFixed(2)} m (tol ${tol.toFixed(1)})`);
      ok &&= e <= tol;
    }
    if (k.look || k.lookAt) {
      const want = k.look ? v3(...k.look) : v3(...k.lookAt!).sub(P.p);
      const e = angDeg(P.d, want);
      parts.push(`look err ${e.toFixed(3)} deg`);
      ok &&= e <= 0.2;
    }
    if (k.fov !== undefined) {
      const e = Math.abs(P.fov - k.fov);
      parts.push(`fov ${P.fov.toFixed(2)} (want ${k.fov})`);
      ok &&= e <= 0.1;
    }
    if (k.roll !== undefined) {
      const e = Math.abs(P.roll - k.roll);
      parts.push(`roll ${P.roll.toFixed(2)}`);
      ok &&= e <= 0.2;
    }
    check(`key t=${k.t} ${k.label}${k.approx ? ' [approx]' : ''}`, ok, parts.join(', ') + ` @ (${P.p.x.toFixed(1)}, ${P.p.y.toFixed(1)}, ${P.p.z.toFixed(1)})`);
  }
  // t = 96 == t = 0
  const A = newPose(), B = newPose();
  timeline.pose(0, A); timeline.pose(96, B);
  applyComfort(A, aspect, false); applyComfort(B, aspect, false);
  const qa = poseQuaternion(A.d, A.roll, new THREE.Quaternion()), qb = poseQuaternion(B.d, B.roll, new THREE.Quaternion());
  const dp = A.p.distanceTo(B.p), dq = qa.angleTo(qb);
  check('loop t=96 == t=0', dp <= 1e-3 && dq <= 1e-4 && Math.abs(A.fov - B.fov) < 1e-6, `dp ${dp.toExponential(2)} m, dq ${dq.toExponential(2)} rad, fov ${A.fov.toFixed(6)} / ${B.fov.toFixed(6)}`);
}

function testContinuity(): void {
  const N = 96 * 120;
  const P = newPose();
  const pos = new Float64Array((N + 1) * 3);
  const dirs: THREE.Vector3[] = [];
  const roll = new Float64Array(N + 1);
  const fov = new Float64Array(N + 1);
  const heading = new Float64Array(N + 1);
  const aspect = 16 / 9;
  const t0 = performance.now();
  for (let i = 0; i <= N; i++) {
    timeline.pose(i / 120, P);
    applyComfort(P, aspect, false);
    pos[i * 3] = P.p.x; pos[i * 3 + 1] = P.p.y; pos[i * 3 + 2] = P.p.z;
    dirs.push(P.d.clone());
    roll[i] = P.roll;
    fov[i] = P.fov;
    heading[i] = Math.atan2(-P.d.x, -P.d.z);
  }
  report.sampleMs = (performance.now() - t0) / (N + 1);
  const step = new Float64Array(N);
  const astep = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    step[i] = Math.hypot(pos[i * 3 + 3] - pos[i * 3], pos[i * 3 + 4] - pos[i * 3 + 1], pos[i * 3 + 5] - pos[i * 3 + 2]);
    astep[i] = angDeg(dirs[i], dirs[i + 1]);
  }
  // jump test: step vs mean of the +-12 neighbours (0.1 s each side), excluding itself
  const jumps = (arr: Float64Array, floor: number) => {
    let worst = 0, at = 0;
    const bad: string[] = [];
    for (let i = 0; i < N; i++) {
      let s = 0, n = 0;
      for (let j = Math.max(0, i - 12); j <= Math.min(N - 1, i + 12); j++) if (j !== i) { s += arr[j]; n++; }
      const local = s / n;
      const ratio = arr[i] / (local + floor);
      if (ratio > worst) { worst = ratio; at = i / 120; }
      if (arr[i] > 3 * local + floor && bad.length < 6) bad.push(`t=${(i / 120).toFixed(3)} step ${arr[i].toExponential(2)} local ${local.toExponential(2)}`);
    }
    return { worst, at, bad };
  };
  const pj = jumps(step, 1e-4);
  check('position continuity (no step > 3x local, 1/120 s)', pj.bad.length === 0, `worst ratio ${pj.worst.toFixed(2)} at t=${pj.at.toFixed(3)} ${pj.bad.join('; ')}`);
  const aj = jumps(astep, 2e-4);
  check('view-direction continuity (no step > 3x local)', aj.bad.length === 0, `worst ratio ${aj.worst.toFixed(2)} at t=${aj.at.toFixed(3)} ${aj.bad.join('; ')}`);
  // speeds per shot
  const shotStats = SHOTS.map((s) => ({ name: s.name, maxSpeed: 0, maxAng: 0, maxRoll: 0, maxRollRate: 0, maxFov: 0 }));
  let maxRoll = 0, maxRollRate = 0, maxFov = 0, rollRateAt = 0;
  for (let i = 0; i < N; i++) {
    const st = shotStats[shotAt(i / 120)];
    st.maxSpeed = Math.max(st.maxSpeed, step[i] * 120);
    st.maxAng = Math.max(st.maxAng, astep[i] * 120);
    const rr = Math.abs(roll[i + 1] - roll[i]) * 120;
    st.maxRoll = Math.max(st.maxRoll, Math.abs(roll[i]));
    st.maxRollRate = Math.max(st.maxRollRate, rr);
    st.maxFov = Math.max(st.maxFov, fov[i]);
    maxRoll = Math.max(maxRoll, Math.abs(roll[i]));
    if (rr > maxRollRate) { maxRollRate = rr; rollRateAt = i / 120; }
    maxFov = Math.max(maxFov, fov[i]);
  }
  report.shotStats = shotStats.map((s) => ({ ...s, maxSpeed: Math.round(s.maxSpeed), maxAng: +s.maxAng.toFixed(1), maxRoll: +s.maxRoll.toFixed(1), maxRollRate: +s.maxRollRate.toFixed(1), maxFov: +s.maxFov.toFixed(1) }));
  check('roll <= 30 deg', maxRoll <= 30 + 1e-9, `max ${maxRoll.toFixed(2)}`);
  check('roll rate <= 25 deg/s', maxRollRate <= 25, `max ${maxRollRate.toFixed(2)} at t=${rollRateAt.toFixed(2)}`);
  check('FOV <= 80 deg (16:9)', maxFov <= 80, `max ${maxFov.toFixed(2)}`);
  // shot 7: roll = clamp(0.6 x turn rate) about the c1 axis, ~25 deg, one sign (co-rotation, like shot 8's drift)
  let spMin = 0, spMax = -1e9;
  for (let i = Math.round(56 * 120); i <= 64 * 120; i++) { spMin = Math.min(spMin, roll[i]); spMax = Math.max(spMax, roll[i]); }
  check('shot 7 spiral bank ~25 deg, one sign', spMin <= -20 && spMin >= -25 && spMax < 0, `roll range ${spMin.toFixed(2)} .. ${spMax.toFixed(2)} over 56-64 s`);
  // pirouette heading rate
  let maxYaw = 0, yawAt = 0;
  for (let i = 73 * 120; i < 88 * 120; i++) {
    let dh = heading[i + 1] - heading[i];
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const r = Math.abs(dh) / DEG * 120;
    if (r > maxYaw) { maxYaw = r; yawAt = i / 120; }
  }
  check('shot 9 yaw pirouette <= 33 deg/s', maxYaw <= 33, `max ${maxYaw.toFixed(2)} deg/s at t=${yawAt.toFixed(2)} (window ${timeline.pirouette.t0}-${timeline.pirouette.t1}, turn ${timeline.pirouette.deltaDeg.toFixed(1)} deg)`);
  // calm + narrow aspect caps
  let calmRoll = 0, calmFov = 0, narrowFov = 0;
  for (let i = 0; i <= N; i += 4) {
    timeline.pose(i / 120, P); applyComfort(P, aspect, true);
    calmRoll = Math.max(calmRoll, Math.abs(P.roll)); calmFov = Math.max(calmFov, P.fov);
    timeline.pose(i / 120, P); applyComfort(P, 0.5, false);
    narrowFov = Math.max(narrowFov, P.fov);
  }
  check('calm: roll <= 15, FOV <= 70', calmRoll <= 15 && calmFov <= 70, `roll ${calmRoll.toFixed(2)}, fov ${calmFov.toFixed(2)}`);
  check('aspect 0.5: canvas pose widened, FOV <= max(80, canvas)', narrowFov <= Math.max(80, canvasPoseFovDeg(0.5)) + 1e-9, `canvas ${canvasPoseFovDeg(0.5).toFixed(2)}, max ${narrowFov.toFixed(2)}`);
  // keyframe-ish facts from §5 text
  const p74 = timeline.position(74.35, new THREE.Vector3());
  check('shot 9 passes the c1 throat ~74 s', Math.abs(p74.distanceTo(EYE) - canvasToWorld(0.43, 0.66, 40000).distanceTo(EYE)) < 300, `|C-E| at 74.35 = ${p74.distanceTo(EYE).toFixed(0)} m`);
  let minV = 9;
  for (let t = 73; t <= 88; t += 0.05) {
    const p = timeline.position(t, new THREE.Vector3());
    const rel = p.clone().sub(EYE);
    const vq = 0.5 + (rel.y * Math.cos(10 * DEG) + rel.z * Math.sin(10 * DEG)) / (2 * 0.3249197 * (-(-rel.y * Math.sin(10 * DEG) + rel.z * Math.cos(10 * DEG))));
    minV = Math.min(minV, vq);
  }
  check('shot 9 stays above the hills (v >= 0.45)', minV >= 0.45, `min v ${minV.toFixed(3)}`);
}

/**
 * Framing checks for the reworked shots (integration review):
 *  - shot 4 (20-29.5 s): some point of the trunk axis is on screen, and the frame centre looks into the painted sky
 *    (its direction from E lands on the canvas continuation u in [-0.6, 1.6], v in [0.2, 1.6]), never back at E's side;
 *  - shot 6 (47-52 s): both funnels in front with their mouths on screen, seen broadside (sight line >= 45 deg off the
 *    axis), and at most 15 % of the frame looking below the horizontal (the dark below-horizon backdrop).
 */
function testFraming(): void {
  const P = newPose();
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, CAMERA_NEAR, CAMERA_FAR);
  const setCam = (t: number) => {
    timeline.pose(t, P);
    applyComfort(P, 16 / 9, false);
    cam.fov = P.fov;
    cam.position.copy(P.p);
    poseQuaternion(P.d, P.roll, cam.quaternion);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  };
  const onScreen = (w: THREE.Vector3, m = 1) => {
    const q = w.clone().applyMatrix4(cam.matrixWorldInverse);
    if (q.z >= 0) return false;
    const n = w.clone().project(cam);
    return Math.abs(n.x) <= m && Math.abs(n.y) <= m;
  };
  // shot 4
  let worstTrunk = 99, worstTrunkAt = 0, badSky: string[] = [];
  const ax = new THREE.Vector3();
  for (let t = 20; t <= 29.5 + 1e-9; t += 0.25) {
    setCam(t);
    let n = 0;
    for (let y = 15; y <= 160; y += 5) if (onScreen(trunkAxisAt(y, ax), 0.97)) n++;
    if (n < worstTrunk) { worstTrunk = n; worstTrunkAt = t; }
    const c = worldToCanvas(EYE.clone().addScaledVector(P.d, 1e5));
    if (!(c.d > 0 && c.u > -0.6 && c.u < 1.6 && c.v > 0.2 && c.v < 1.6) && badSky.length < 4) badSky.push(`t=${t.toFixed(2)} (u ${c.u.toFixed(2)}, v ${c.v.toFixed(2)}, d ${c.d.toFixed(0)})`);
  }
  check('shot 4: trunk on screen 20-29.5 s', worstTrunk >= 1, `fewest trunk-axis samples on screen ${worstTrunk} of 30 at t=${worstTrunkAt.toFixed(2)}`);
  check('shot 4: view into the painted sky 20-29.5 s', badSky.length === 0, badSky.length ? badSky.join('; ') : 'frame centre on the canvas continuation throughout');
  // shot 6
  const dMouth = (vi: number) => VORTICES[vi].dThroat * Math.pow(VORTICES[vi].rmax / VORTICES[vi].r0, VORTICES[vi].expo);
  let minBroad = 90, maxDown = 0, mouthsOk = true, detail = '';
  const dir = new THREE.Vector3();
  for (let t = 47; t <= 52 + 1e-9; t += 0.25) {
    setCam(t);
    for (let vi = 0; vi < 2; vi++) {
      const V = VORTICES[vi];
      const thr = canvasToWorld(V.u, V.v, V.dThroat);
      const mou = canvasToWorld(V.u, V.v, dMouth(vi));
      if (!onScreen(mou, 1)) { mouthsOk = false; detail = `t=${t.toFixed(2)} ${V.name} mouth off screen`; }
      const axis = mou.clone().sub(thr).normalize();
      const sight = thr.clone().lerp(mou, 0.6).sub(P.p).normalize();
      minBroad = Math.min(minBroad, Math.acos(Math.abs(axis.dot(sight))) / DEG);
    }
    let down = 0;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) {
      dir.set(((i + 0.5) / 16) * 2 - 1, ((j + 0.5) / 9) * 2 - 1, 0.5).unproject(cam).sub(cam.position).normalize();
      if (dir.y < -0.02) down++;
    }
    maxDown = Math.max(maxDown, down / 144);
  }
  check('shot 6: both funnels broadside, mouths on screen, 47-52 s', mouthsOk && minBroad >= 45, `${detail || 'mouths on screen'}; min sight-line angle to the axes ${minBroad.toFixed(1)} deg`);
  check('shot 6: <= 15 % of the frame below the horizontal, 47-52 s', maxDown <= 0.15, `max ${(maxDown * 100).toFixed(1)} %`);
}

/**
 * C1 check (§5.1 "all position tracks are C1 across boundaries"): a velocity kink shows up as one large step of the
 * finite-difference velocity between quiet neighbours on BOTH sides (an acceleration jump, which C1 allows, only
 * changes the level on one side). Same test for the view's angular velocity, the roll rate and the FOV rate.
 */
function testC1(): void {
  const R = 240; // samples per second
  const N = 96 * R;
  const P = newPose();
  const aspect = 16 / 9;
  const p: THREE.Vector3[] = [], d: THREE.Vector3[] = [], roll: number[] = [], fov: number[] = [];
  for (let i = 0; i <= N; i++) {
    timeline.pose(i / R, P);
    applyComfort(P, aspect, false);
    p.push(P.p.clone()); d.push(P.d.clone()); roll.push(P.roll); fov.push(P.fov);
  }
  const vel = (i: number) => p[i + 1].clone().sub(p[i]).multiplyScalar(R);
  const ang = (i: number) => d[i].clone().cross(d[i + 1]).multiplyScalar(R / DEG);
  const kinks = (label: string, rate: (i: number) => THREE.Vector3 | number, floorOf: (r: THREE.Vector3 | number) => number) => {
    const rates: (THREE.Vector3 | number)[] = [];
    for (let i = 0; i < N; i++) rates.push(rate(i));
    const diff = (a: THREE.Vector3 | number, b: THREE.Vector3 | number) =>
      typeof a === 'number' ? Math.abs((b as number) - a) : (b as THREE.Vector3).distanceTo(a);
    const dv: number[] = [];
    for (let i = 0; i + 1 < rates.length; i++) dv.push(diff(rates[i], rates[i + 1]));
    const bad: string[] = [];
    let worst = 0, worstAt = 0;
    const K = 6;
    for (let i = K; i < dv.length - K; i++) {
      let l = 0, r = 0;
      for (let j = 1; j <= K; j++) { l += dv[i - j]; r += dv[i + j]; }
      const local = Math.max(l, r) / K;
      const floor = floorOf(rates[i]);
      const ratio = dv[i] / (local + floor);
      if (ratio > worst) { worst = ratio; worstAt = i / R; }
      if (dv[i] > 4 * local + floor && bad.length < 8) bad.push(`t=${(i / R).toFixed(3)} jump ${dv[i].toPrecision(3)} local ${local.toPrecision(2)}`);
    }
    check(`C1 ${label}`, bad.length === 0, `worst ratio ${worst.toFixed(2)} at t=${worstAt.toFixed(3)} ${bad.join('; ')}`);
  };
  kinks('position (velocity kinks)', vel, (v) => 0.02 + 1e-3 * (v as THREE.Vector3).length());
  kinks('view direction (angular-velocity kinks)', ang, () => 0.05);
  kinks('roll (roll-rate kinks)', (i) => (roll[i + 1] - roll[i]) * R, () => 0.05);
  kinks('FOV (FOV-rate kinks)', (i) => (fov[i + 1] - fov[i]) * R, () => 0.05);
}

function testDirectorRuntime(): void {
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, CAMERA_NEAR, CAMERA_FAR);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;visibility:hidden';
  document.body.appendChild(host);
  const t0 = performance.now();
  const d = new Director(cam, host, { calm: false, startTime: 0, firstBoot: true, ui: false, listen: false });
  report.constructMs = +(performance.now() - t0).toFixed(2);
  report.tableBuildMs = +d.tableBuildMs.toFixed(2);
  check('rejoin table build <= 15 ms', d.tableBuildMs <= 15, `${d.tableBuildMs.toFixed(2)} ms for ${REJOIN_SAMPLES} samples (timeline + table)`);
  const P = newPose();
  let maxErr = 0, worstMs = 0, totalMs = 0, cuts = 0, n = 0, wrapJump = 0, firstBootFrames = 0;
  const prev = new THREE.Vector3();
  let prevT = 0;
  for (let i = 0; i < 60 * 100; i++) {
    const s = performance.now();
    const f = d.update(i === 0 ? 0 : 1 / 60);
    const ms = performance.now() - s;
    if (i > 10) { worstMs = Math.max(worstMs, ms); totalMs += ms; n++; }
    if (f.cut) cuts++;
    if (f.firstBoot) firstBootFrames++;
    timeline.pose(f.loopTime, P);
    applyComfort(P, 16 / 9, false);
    maxErr = Math.max(maxErr, cam.position.distanceTo(P.p) / Math.max(1, P.p.distanceTo(EYE)));
    if (i > 0 && f.loopTime < prevT) wrapJump = cam.position.distanceTo(prev);
    prev.copy(cam.position);
    prevT = f.loopTime;
  }
  check('director cinematic == timeline (rel 1e-6)', maxErr < 1e-6, `max rel err ${maxErr.toExponential(2)}`);
  // CPU: time a whole second loop pass in one block (performance.now() is coarse per call)
  const tp = performance.now();
  let breath = 0;
  for (let i = 0; i < 60 * 96; i++) {
    const f = d.update(1 / 60);
    if (f.loopTime < 2) breath = Math.max(breath, f.env.impastoGain);
  }
  const passMs = (performance.now() - tp) / (60 * 96);
  check('director CPU per frame <= 0.3 ms', passMs <= 0.3, `avg ${passMs.toFixed(4)} ms over a 96 s pass (per-call sampling: avg ${(totalMs / n).toFixed(3)}, worst ${worstMs.toFixed(2)} ms)`);
  check('loop re-entry impasto breath 1 -> 1.15 -> 1', Math.abs(breath - 1.15) < 0.002, `peak ${breath.toFixed(4)}`);
  check('one cut (first frame), wrap continuous', cuts === 1 && wrapJump < 1e-3, `cuts ${cuts}, wrap step ${wrapJump.toExponential(2)} m`);
  check('firstBoot flag covers the first 6 s only', firstBootFrames >= 355 && firstBootFrames <= 361, `firstBoot frames ${firstBootFrames} (60 fps)`);
  // envelopes
  const e = newEnv();
  const env = (t: number) => ({ ...timelineEnv(t, timeline.position(t, new THREE.Vector3()).distanceTo(EYE), false, e) });
  check('env: matte 1 at 3, 0 at 10..92, 1 at 96', env(3).matte === 1 && env(10).matte === 0 && env(92).matte === 0 && env(96).matte === 1, `${env(94.25).matte.toFixed(2)} at 94.25`);
  check('env: storm 0 at 69, 1 at 75..88, dust 1 at 30, 0 at 96', env(69).storm === 0 && env(75).storm === 1 && env(88).storm === 1 && env(30).dust === 1 && env(96).dust < 1e-6, `dust(88)=${env(88).dust.toFixed(2)}`);
  check('env: exposure dip 0.5 at 37.6, bloom 1.6 at 37.5', Math.abs(env(37.6).exposure - 0.5) < 1e-9 && Math.abs(env(37.5).bloom - 1.6) < 1e-9, `exp(37.6)=${env(37.6).exposure}`);
  check('env: loop wrap equal', JSON.stringify(env(0)) === JSON.stringify(env(96)), JSON.stringify(env(96)));
  const calm = timelineEnv(37.6, 12000, true, newEnv());
  check('env calm: smear 0, punch dip halved', calm.smear === 0 && Math.abs(calm.exposure - 0.75) < 1e-9, `smear ${calm.smear}, exposure ${calm.exposure}`);
  d.dispose();
  host.remove();
}

async function testModes(): Promise<void> {
  // real DOM events against a live director (listen: true), stepping update() manually
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, CAMERA_NEAR, CAMERA_FAR);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0';
  document.body.appendChild(host);
  const d = new Director(cam, host, { calm: false, startTime: 45, firstBoot: false, ui: true, listen: true });
  const step = (sec: number, dt = 1 / 60) => { let f = d.update(dt); for (let t = dt; t < sec - 1e-9; t += dt) f = d.update(dt); return f; };
  step(0.5);
  const ptr = (type: string, x: number, y: number, o: PointerEventInit = {}) =>
    host.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1, pointerType: 'mouse', ...o }));
  const key = (code: string, type = 'keydown', o: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, ...o }));

  ptr('pointerdown', 300, 200);
  let f = d.update(1 / 60);
  check('hand-off within one frame (pointerdown)', f.mode === 'free', `mode ${f.mode}`);
  const camVel = Math.hypot(...f.camVelocity);
  check('hand-off keeps velocity (inertia)', camVel > 100, `|v| ${camVel.toFixed(0)} m/s`);
  const q0 = cam.quaternion.clone();
  ptr('pointermove', 360, 200);
  step(0.5);
  check('drag looks (yaw)', cam.quaternion.angleTo(q0) > 0.01, `turned ${(cam.quaternion.angleTo(q0) / DEG).toFixed(2)} deg`);
  ptr('pointerup', 360, 200);
  const p0 = cam.position.clone();
  key('KeyW');
  step(1);
  key('KeyW', 'keyup');
  check('W moves forward', cam.position.distanceTo(p0) > 10, `${cam.position.distanceTo(p0).toFixed(0)} m`);
  host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, shiftKey: true, bubbles: true, cancelable: true }));
  f = d.update(1 / 60);
  check('wheel speed / shift-wheel warp', d.input!.speedExp === 1 && Math.abs(f.warpK - 1.1) < 1e-9, `n ${d.input!.speedExp}, warpK ${f.warpK}`);
  // stir: alt-drag
  ptr('pointerdown', 320, 120, { altKey: true, pointerId: 9 });
  ptr('pointermove', 330, 125, { altKey: true, pointerId: 9 });
  f = d.update(1 / 60);
  const st = f.stir;
  check('alt-drag stirs (strength 1, radius 0.08)', !!st && st[2] === 1 && st[3] === 0.08 && Number.isFinite(st[0]) && Number.isFinite(st[1]), JSON.stringify(st?.map((x) => +x.toFixed(3))));
  ptr('pointerup', 330, 125, { pointerId: 9 });
  f = step(1.5);
  check('stir decays e^(-t/1.5)', !!f.stir && Math.abs(f.stir[2] - Math.exp(-1)) < 0.02, `strength after 1.5 s ${f.stir?.[2].toFixed(3)}`);
  key('KeyG');
  f = d.update(1 / 60);
  const g1 = f.stormToggled;
  f = d.update(1 / 60);
  check('G: stormToggled for one frame', g1 && !f.stormToggled, `${g1} then ${f.stormToggled}`);
  key('KeyH'); key('KeyM');
  f = d.update(1 / 60);
  check('H toggles HUD, M toggles calm', f.hud && f.calm, `hud ${f.hud}, calm ${f.calm}`);
  key('KeyM');
  // free ring visible away from E
  const ring = document.querySelector('.pn-ring') as HTMLElement | null;
  check('free-mode ring shown off-axis', !!ring && ring.style.display === 'block', `display ${ring?.style.display}`);
  // jump to shot 5 (key 5 -> index 4, t = 32)
  key('Digit5');
  f = d.update(0.1);
  const midFade = f.env.fade;
  f = d.update(0.1);
  check('digit 5: fade, cut, cinematic at 32 s', midFade > 0.3 && f.cut && f.mode === 'cinematic' && Math.abs(f.loopTime - 32) < 1e-9 && f.camVelocity.every((x) => x === 0),
    `fade ${midFade.toFixed(2)}, cut ${f.cut}, t ${f.loopTime}`);
  f = step(0.3);
  check('fade returns to 0', f.env.fade === 0, `${f.env.fade}`);
  // Space: return to the eye
  key('Space');
  f = d.update(1 / 60);
  check('Space -> returning', f.mode === 'returning', f.mode);
  let maxDt = 0;
  for (let i = 0; i < 60 * 15 && d.mode === 'returning'; i++) { d.update(1 / 60); maxDt = i / 60; }
  f = d.update(1 / 60);
  check('return ends in free mode at E (canvas pose)', f.mode === 'free' && cam.position.distanceTo(EYE) < 1e-3 && f.align > 0.99,
    `after ${maxDt.toFixed(2)} s: mode ${f.mode}, |C-E| ${cam.position.distanceTo(EYE).toExponential(2)}, align ${f.align.toFixed(3)}, fov ${cam.fov.toFixed(2)}`);
  const ringAtE = document.querySelector('.pn-ring') as HTMLElement | null;
  check('ring hidden when aligned', !!ringAtE && ringAtE.style.display === 'none', `display ${ringAtE?.style.display}`);
  // idle 12 s at E -> rejoin to t = 0 -> cinematic
  f = step(12.2);
  check('idle 12 s -> rejoin', f.mode === 'rejoin', `${f.mode}`);
  for (let i = 0; i < 60 * 6 && d.mode === 'rejoin'; i++) f = d.update(1 / 60);
  f = d.update(1 / 60);
  check('rejoin near E resumes at t = 0', f.mode === 'cinematic' && f.loopTime < 0.1, `mode ${f.mode}, t ${f.loopTime.toFixed(3)}`);
  // rejoin from far: hand off at 60 s, fly away sideways, idle -> picks a sample, arrives on the timeline
  key('Digit7');
  step(0.5);
  step(2.0);
  ptr('pointerdown', 100, 100, { pointerId: 11 }); ptr('pointerup', 100, 100, { pointerId: 11 });
  d.update(1 / 60);
  const choice = d.rejoinChoice(cam.position, new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion));
  f = step(12.2);
  const modeAtIdle = f.mode;
  let steps = 0;
  let maxJump = 0;
  const pp = cam.position.clone();
  while (d.mode === 'rejoin' && steps < 600) { f = d.update(1 / 60); maxJump = Math.max(maxJump, cam.position.distanceTo(pp)); pp.copy(cam.position); steps++; }
  const Pz = newPose(); timeline.pose(f.loopTime, Pz); applyComfort(Pz, 16 / 9, false);
  check('far rejoin: flies to the timeline and continues', modeAtIdle === 'rejoin' && f.mode === 'cinematic' && cam.position.distanceTo(Pz.p) < 1e-3 * Math.max(1, Pz.p.distanceTo(EYE)),
    `chosen sample t=${(choice.index * 0.1).toFixed(1)} cost ${choice.cost.toFixed(3)}, flight ${(steps / 60).toFixed(2)} s, end t=${f.loopTime.toFixed(2)}, max step ${maxJump.toFixed(0)} m`);
  d.dispose();
  host.remove();

  // free mode taken over at t = 71 (FOV 26): the lens relaxes to the canvas FOV, so flying back to E can align
  const cam2 = new THREE.PerspectiveCamera(36, 16 / 9, CAMERA_NEAR, CAMERA_FAR);
  const d2 = new Director(cam2, host, { calm: false, startTime: 71, free: true, firstBoot: false, ui: false, listen: false });
  let g = d2.update(0);
  const fov0 = cam2.fov;
  for (let i = 0; i < 60 * 8; i++) g = d2.update(1 / 60);
  const fov8 = cam2.fov;
  d2.pilot.takeOver(EYE, poseQuaternion(FORWARD, 0, new THREE.Quaternion()), d2.pilot.fov, new THREE.Vector3());
  g = d2.update(1 / 60);
  check('free lens relaxes to the canvas FOV (align reachable at E)', Math.abs(fov0 - 26) < 1e-6 && Math.abs(fov8 - canvasPoseFovDeg(16 / 9)) < 0.05 && g.align > 0.95,
    `fov ${fov0.toFixed(2)} -> ${fov8.toFixed(3)} after 8 s; align at E ${g.align.toFixed(3)}`);
  d2.dispose();
}

// ---------------------------------------------------------------- main
const lbl = document.getElementById('lbl')!;
buildScene();
buildPath();

let director: Director | null = null;
function viewOverride(): boolean {
  if (VIEW === 'far') { camera.position.set(70000, 90000, 60000); camera.fov = 50; camera.lookAt(-6000, 14000, -45000); }
  else if (VIEW === 'near') { camera.position.set(900, 700, 600); camera.fov = 50; camera.lookAt(-60, 120, -300); }
  else if (VIEW === 'funnel') { camera.position.set(-45000, 60000, -20000); camera.fov = 50; camera.lookAt(-2000, 16000, -60000); }
  else return false;
  camera.updateProjectionMatrix();
  return true;
}

if (RUN_TESTS) {
  out.style.display = 'block';
  testPaths();
  testKeyframes();
  testContinuity();
  testFraming();
  testC1();
  testDirectorRuntime();
  await testModes();
  report.pirouette = timeline.pirouette;
  report.jetEndSlope = timeline.jetEndSlope;
  out.textContent += `\n${report.failures} failure(s)\n${JSON.stringify(report.shotStats)}\n`;
  (window as unknown as { __report: unknown }).__report = report;
}

director = new Director(camera, renderer.domElement, { calm: q.has('calm'), startTime: T, free: q.has('free'), firstBoot: false });
if (q.has('hud')) director.setHud(true);
director.setHudText('harness · placeholder scene');
const frame = director.update(0);
const overridden = viewOverride();
renderer.render(scene, camera);
const P = newPose();
timeline.pose(T, P);
const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
lbl.textContent = `t ${T.toFixed(2)} s  shot ${frame.shot + 1} ${SHOTS[frame.shot].name}${overridden ? `  [view ${VIEW}]` : ''}\n` +
  `pos (${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)})  |C-E| ${camera.position.distanceTo(EYE).toFixed(0)} m\n` +
  `fov ${camera.fov.toFixed(1)}  roll ${P.roll.toFixed(1)}  dir (${fwd.x.toFixed(3)}, ${fwd.y.toFixed(3)}, ${fwd.z.toFixed(3)})\n` +
  `env bloom ${frame.env.bloom.toFixed(2)} exp ${frame.env.exposure.toFixed(2)} matte ${frame.env.matte.toFixed(2)} smear ${frame.env.smear.toFixed(2)} storm ${frame.env.storm.toFixed(2)} dust ${frame.env.dust.toFixed(2)}`;
(window as unknown as { __frame: unknown }).__frame = { ...frame, pos: camera.position.toArray(), fov: camera.fov, align: alignOf(camera.position, camera.quaternion, camera.fov, W / H), fwdF: fwd.dot(FORWARD) };
(window as unknown as { __ready: boolean }).__ready = true;
