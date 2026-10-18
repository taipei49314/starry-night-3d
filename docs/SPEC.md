# PUNCTUM: The Starry Night, 250 km Deep — Final Build Spec

Technical director's spec v1.0. The base concept is **anamorphic**. It takes these grafts:
- From **cosmic-vortex**: the camera spine (matte tear, cypress burst, funnel fall, the eye of the vortex, steeple homecoming).
- From **impasto-matter**: the inflation opener.
- From **one-take**: flame becomes wind, isophote halo banding, the generated GLSL header and the scene-render plumbing.

These are dropped:
- the 230 km Apex view, Duerer threads, the ember and the reticle in the cinematic
- the floating island
- fractal octaves, MRT and depth partitions
- the GPU bake, DOF, contact shadows and craquelure
- ACES tone mapping
- the moon phase orbit
- any shot longer than 15 s

---

## 1. Vision

**Name:** PUNCTUM: The Starry Night & The Van Gogh World System, 250 km Deep (5 Chapters · 30 Iconic Worlds).

**Logline.** From one exact point, up to **181,600** sculpted brushstrokes (`~178,000` in *The Starry Night*; `52,000–72,000` in each of the 29 companion worlds) scattered across 250 km line up into the painting. Step away and the painting tears open. Opening the application launches directly into the signature **96-second, 10-shot standalone *The Starry Night*** (`mode = 'theme'`, `pathId = 'single'`), where in one continuous take the camera:
1. climbs a 145 m black-flame cypress;
2. rides its tip as it turns into wind;
3. punches through Venus into a tunnel of counter-rotating halo rings;
4. sees the great swirl as two 50 km paint maelstroms;
5. falls down one of them;
6. from the calm eye, sees the tiny lit village of Saint-Rémy framed in the throat.

A storm then tears everything apart. The painting can only reassemble as the camera backs into the painter's eye $E$. The last frame is the first frame, where an invitation pill (`✦ 進入梵谷 30 個世界 · 五章三十幕旅程`) opens the 900-second, 5-Chapter, 30-Act Odyssey (§10).

**Single central mechanism: anamorphic invariance.**
- Every stroke is authored in canvas space as (u, v, Δu, Δv, width, colours), plus **one free parameter, its depth d from the eye E**.
- It is placed at `P = E + d · M · ((2u−1)·A·t, (2v−1)·t, −1)`, so its world size is proportional to d.
- Seen from E it projects to the same pixels for any d. Depth therefore becomes free expressive material. We spend it on two rules:
  1. **Paint order = depth.** Last touches are nearest: cypress, then village, hills, the moon and star cores, halo rings, the swirl funnels, the sky bands, and finally the underpainting at 250 km. Occlusion seen from E always matches the real layering. Flying outward reads as travelling back through the painting session.
  2. **Every 2D motif is the end-on view of its true 3D form.** The swirl is a pair of conical funnels with their throats toward the eye. Star halos are ring horns. The moon halo is a bell. The cypress is a twisted tower of seven flame tubes. The hills are sloped ridge walls. Houses and the steeple are real solids.

**Why it is new.**
- It is not a texture on a dome, not a 2.5D cut-out diorama, and not a swirl shader. The painting exists only as a viewpoint.
- Departing from that viewpoint and returning to it is the narrative. Reassembly is gated by camera position, not by time.
- All animation (streaming arms, spinning rings, writhing cypress, wind) is defined in canvas space before depth is applied. The image from E stays exact while it moves.
- Free mode shows the invariance directly. At E, a depth-warp slider can flatten the world to one plane or stretch it 1.6× deeper and no pixel changes. Step one metre aside and the universe refolds.

---

## 2. World layout

### 2.1 Coordinate system and the eye

- **Units:** metres, right-handed, **+Y up**. World origin on the village plain, which is y = 0.
- **Eye E** = `(0, 50, 0)`. Eye basis **M** = `rotX(+10°)`, a pitch up of 10°.
  - Forward F = `(0, 0.173648, −0.984808)`
  - Eye-up U = `(0, 0.984808, 0.173648)`
  - Right R = `(1, 0, 0)`
- **Canvas pose:** vertical FOV 36°. t = tan 18° = **0.3249197**. A = 92.1/73.7 = **1.2497**. AT = A·t = **0.4060487**.
- The true horizon (the ray parallel to the ground) sits at canvas **v = 0.2286**.
- **Canvas coordinates:**
  - Position (u, v) uses fractions: u is a fraction of canvas width, v of canvas height.
  - **Offsets and lengths** (du, dv, L, W, radii) use **canvas-height units ("h-units")**. In h-units a horizontal canvas distance is Δu·A.
  - Flow-field space uses `p = (u·A, v)` in h-units.
- At 16:9 the canvas pose shows u ∈ [−0.21, 1.21]. All content is generated over **u ∈ [−0.30, 1.30], v ∈ [−0.12, 1.10]** (extended sky `SKY_GEN_U = [−1.0, 2.0]`, `SKY_GEN_V = [0.15, 1.75]` for wide-FOV coverage near E).
  - For aspects narrower than 1.2497, the canvas-pose FOV becomes `2·atan(t·1.2497/aspect)` so the full canvas width stays visible.
- **Mapping** (TS and GLSL must be identical):
  ```
  canvasToWorld(u, v, d) = E + d' · M · ((2u−1)·AT, (2v−1)·t, −1),   d' = 1000·(d/1000)^uWarpK   (uWarpK = 1 by default)
  worldToCanvas(P): q = Mᵀ(P−E); d = −q.z; u = 0.5 + q.x/(2·AT·d); v = 0.5 + q.y/(2·t·d)
  world length of a canvas length ℓ (h-units) at depth d = ℓ · 2t · d = ℓ · 0.6498 · d
  ground hit of canvas row v (flat plain, v < 0.2286): d = −50 / (0.6400·v − 0.14633)
  ```

### 2.2 Depth table (paint order; generators must assert these ranges)

| Class | Depth d from E | Notes |
|---|---|---|
| CYPRESS | 140–245 m (axis 192 m) | nearest object |
| GROUND fields / GROVE | 200–7,500 m (ground hits & near interior solids) | real ground surface & near furniture solids (`d < 458 m`) |
| HOUSE / WINDOW / CHURCH | 450–2,900 m (ground hits) | real solids |
| HILL walls | 1.6–6.1 km | 3 sloped walls |
| WIND_JET | 0.20 → 12.5 km | cypress tip to Venus |
| MOON (crescent) | 11.0 km | MOON_RING bell 10.9–25 km |
| STAR_CORE | 11.8–16.1 km | STAR_RING horns up to ×1.96 (≤ 32 km) |
| SWIRL funnels | c1 40–90 km, c2 42–91 km | conical helices + `StrokeFlag.UNDERLAYER` funnel shells |
| EDDY funnels | 44–82 km | 4 small vortices |
| SKY_BAND decks | 94–212 km | 14 tilted strata + extended sky |
| UNDERPAINT | 229–251 km | dark ground; fills holes |
| Backdrop | ∞ (screen pass) | direction-space strokes beyond the generated canvas |

Required ordering assertions where classes overlap on the canvas (every d of the left class must be less than every d of the right class):
- STAR_CORE < STAR_RING < SWIRL < SKY_BAND < UNDERPAINT
- MOON < MOON_RING < SKY_BAND
- HILL < STAR_CORE
- EDDY < SKY_BAND
- CYPRESS < HOUSE

### 2.3 Earth (positions computed from the mapping)

**Ground.** `groundHeight(x, z) = 14·exp(−((x+50)² + (z+195)²) / (2·110²))`, a knoll under the cypress. The plain is y = 0 everywhere else. The earth region is x ∈ [−3, 4] km, z ∈ [0, −6.5] km.

**Cypress.** A canvas-authored tube bundle.
- Silhouette table `CYPRESS_SIL` (v: uL–uR):
  - −0.10: 0.10–0.29
  - 0.00: 0.08–0.30
  - 0.15: 0.06–0.30
  - 0.30: 0.05–0.30
  - 0.45: 0.06–0.29
  - 0.60: 0.08–0.28
  - 0.72: 0.10–0.27
  - 0.82: 0.12–0.25
  - 0.92: 0.14–0.24
  - 1.00: 0.16–0.23
  - 1.08: 0.19–0.21
- Axis depth 192 m. In world terms: base ≈ (−50, 10, −200) inside the knoll, top ≈ (−51, 154, −175), 38 m wide at mid-height (x −69 to −31). Flame tips reach y ≈ 165.

**Church and steeple.** Base at canvas (0.55, 0.11), which is the ground hit d = 659 m. World base is **(27, 0, −678)**.
- Nave box: 40 × 16 × 18 m, axis yawed 15°.
- Octagonal shaft: 8 m across, up to y = 75 m.
- Spire cone: up to **y = 145 m**. The tip projects to v ≈ 0.446 and pierces above the hill crest (≈ 0.36 at u = 0.55).

**Village.**
- 40 houses, Poisson-sampled in canvas with base u ∈ [0.32, 1.10] and v_base ∈ [0.06, 0.195]. Exclude u < 0.31 (cypress) and a 0.04 radius around the church.
- Base = ground hit (d 520–2,700 m). Footprint 10–24 × 8–16 m, walls 6–10 m, gable roof +4–7 m. Yaw = facing E ± 20°.

**Groves.** 220 clumps (ellipsoids 8–25 m) on the ground at u ∈ [0.30, 1.25], v_base ∈ [0.02, 0.20], plus 30 clumps around the cypress knoll.

**Fields.** Ground strokes for v ∈ [−0.12, 0.10] (d 260–760 m), across all u not covered by the cypress.

**Hills (Alpilles).** Three walls, k = 0, 1, 2.
- Crest line: `ridgeV(u,k) = 0.300 + 0.030k + 0.028·sin(2π(1.6u + 0.15 + 0.21k)) + 0.011·sin(2π(4.7u + 0.40 − 0.30k))`
- Depth: `d_k(u,v) = D_k + 300·sin(2.6u + k) − 900·(ridgeV − v)/(ridgeV − 0.20)` for v ∈ [0.20, ridgeV], with D = 3,000 / 4,200 / 5,600 m.
- Each wall is a sloped face that meets the ground at v ≈ 0.20 and has a real crest. Crest altitudes are 190–380 m (k = 0), 240–510 m (k = 1) and 300–660 m (k = 2).

### 2.4 Sky volume

**The 11 stars.** Canvas positions are tuned by eye with the debug overlay. World positions are the core centres.
- Rings k = 0…n−1 sit at depth `d_k = d_core·(1 + 0.12k)` with radius `ρ_k = ρ_core·(1 + 0.62k)` (h-units).
- Ring 0 is the core edge.
- Spin is `(−1)^k · n_k` turns per 96 s loop, with n_k = 1 + (k mod 3).

| # | Name | (u, v) | d_core | ρ_core | Rings | World core (m) | Outer ring R / depth |
|---|---|---|---|---|---|---|---|
| 1 | **Venus** | (0.300, 0.720) | 12,000 | 0.016 | 9 | (−1949, 3823, −11520) | 1.45 km @ 23.5 km |
| 2 | S2 | (0.070, 0.870) | 14,500 | 0.010 | 6 | (−5063, 6001, −13674) | 0.62 km @ 23.2 km |
| 3 | S3 | (0.265, 0.925) | 15,000 | 0.011 | 6 | (−2863, 6735, −14053) | 0.70 km @ 24.0 km |
| 4 | S4 | (0.415, 0.905) | 13,500 | 0.010 | 6 | (−932, 5893, −12678) | 0.58 km @ 21.6 km |
| 5 | S5 | (0.535, 0.860) | 14,000 | 0.011 | 6 | (398, 5707, −13219) | 0.66 km @ 22.4 km |
| 6 | S6 | (0.660, 0.900) | 15,500 | 0.010 | 6 | (2014, 6709, −14565) | 0.66 km @ 24.8 km |
| 7 | S7 | (0.745, 0.790) | 13,000 | 0.012 | 7 | (2587, 4720, −12377) | 0.86 km @ 22.4 km |
| 8 | S8 | (0.925, 0.690) | 14,500 | 0.010 | 6 | (5005, 4331, −13969) | 0.62 km @ 23.2 km |
| 9 | S9 | (0.810, 0.600) | 16,000 | 0.010 | 6 | (4028, 3852, −15576) | 0.68 km @ 25.6 km |
| 10 | S10 | (0.640, 0.520) | 13,000 | 0.011 | 6 | (1478, 2474, −12773) | 0.61 km @ 20.8 km |
| 11 | S11 | (0.470, 0.495) | 14,000 | 0.010 | 6 | (−341, 2436, −13795) | 0.60 km @ 22.4 km |

**Venus.** Core radius about 125 m, emissive 8. The horn is a tunnel 11.5 km long: rings at 12.0 / 13.4 / 14.9 / 16.3 / 17.8 / 19.2 / 20.6 / 22.1 / 23.5 km.

**Moon.**
- Centre (0.860, 0.850), d = 11,000 m, world **(3216, 4424, −10398)**.
- Crescent outer radius 0.035 h (250 m): the difference of two circles. The lit limb is upper-right and the hollow opens lower-left (tune by overlay). Colours #d98a1e→#f2c230, emissive 3.5.
- Bell: 10 rings, `ρ_k = 0.035 + 0.0095k`, `d_k = 11 km·(1 + 0.13k)`. The outer ring is 1.87 km in radius at 23.9 km. Chrome yellow, emissive 1.4→0.9.

**Great swirl** (two arms per vortex, log spirals; the arm law is in §3).
- **c1** at (0.43, 0.66), clockwise.
  - Throat r0 = 0.02 h at 40 km (radius 520 m), world (−2274, 11092, −38670).
  - Mouth r = 0.13 h at 90 km (radius 7.6 km), world (−5116, 24894, −87008).
- **c2** at (0.59, 0.61), counter-clockwise.
  - Throat r0 = 0.02 h at 42 km, world ≈ (3070, 10300, −40840).
  - Mouth r = 0.12 h at 91 km, world (6650, 22260, −88490).
- Depth law: `d = d_throat·(r/r0)^0.433`. The world radius therefore grows as r^1.433, so the funnels flare.
- The two arm systems overlap on the canvas between x 0.49 and 0.55 (the S-crest).

**Eddies** (expo 0.20, r0 0.006, so each is a shallow funnel):

| Eddy | (u, v) | Rotation | rmax | d_throat |
|---|---|---|---|---|
| E1 | (0.18, 0.62) | CW | 0.05 | 45 km |
| E2 | (0.335, 0.83) | CCW | 0.04 | 48 km |
| E3 | (0.71, 0.69) | CW | 0.045 | 52 km |
| E4 | (0.95, 0.80) | CCW | 0.05 | 50 km |

**Wind jet.**
- 32 filaments along the canvas Bézier (0.17, 1.02) → (0.24, 0.92) → (0.29, 0.80) → (0.30, 0.735).
- Depth `d(σ) = 220·(12000/220)^σ`.
- World samples: σ = 0 at (−59, 161, −204), 0.25 at (−137, 323, −559), 0.5 at (−320, 709, −1534), 0.75 at (−770, 1627, −4206), 1 at the Venus core.
- Colour ramps along σ: #2f3d26 → #5e8fb0 → #e8edf0.

**Sky decks.** 14 bands. Deck depth `d = 100 km + 6.5 km·b + 12 km·(v − 0.6)` with ±1.5 km jitter, b = 0..13.

**Underpainting.** 230–250 km, covering u ∈ [−0.3, 1.3], v ∈ [−0.12, 1.10]. That is a canvas about 200 × 160 km.

### 2.5 Camera planes and depth precision

- `PerspectiveCamera(near = 0.1 m, far = 600 km)` with **`WebGLRenderer({ logarithmicDepthBuffer: true })`**.
- Every scene material is a `ShaderMaterial` (`glslVersion: THREE.GLSL3`) that includes `logdepthbuf_pars_vertex`, `logdepthbuf_vertex`, `logdepthbuf_pars_fragment` and `logdepthbuf_fragment`.
- **RawShaderMaterial is forbidden** because it misses the define.
- Relative depth precision is about 1.4e-6·z: 0.2 m at 150 km and 0.3 mm at 200 m. No partitions, no layered scenes and no per-frame near/far changes.
- Each stroke gets a deterministic depth jitter of ±0.5% (from its seed), applied in the generator.
- Underlay meshes (ground, hill backs, house cores, cypress core) use `polygonOffset(1, 2)` so they sit behind the strokes lying on them.
- Precision with float32: shader-side canvasToWorld at 250 km has about 1.5 cm error. The camera never goes more than about 100 km from E.
- **Day-one experiment, not a requirement:** if the target Chromium exposes EXT_clip_control and three r186 offers a reversed-depth renderer option, benchmark it against log depth to recover early-Z. Ship whichever passes the acceptance list.

---

## 3. Shared flow field

One analytic field in h-unit space `p = (u·A, v)`. Its components:
- a band stream function
- six Lamb–Oseen vortices with Gaussian windows and sinks (2 swirl + 4 eddies)
- tangential halo circulation around the 11 stars and the moon
- ridge-parallel flow below the hills

**Consumers:**
- **TS:** stroke angle, colour banding and curvature in the sky, hill and field generators; debug streamlines.
- **GLSL:** pigment-dust drift (per point); the backdrop stroke orientation (per pixel); the stir-the-sky preview.
- Stroke streaming (arms, rings, bands, jet) uses the closed-form motions in §4.3, which are consistent with this field by construction. The arm law equals the field's streamlines.

**The generated header.** `src/shared/glsl/header.ts` emits the constants from TS (single source of truth). The values below are what it must generate.

```glsl
// ---------- generated by header.ts: do not edit ----------
#define CANVAS_ASPECT 1.2497
#define AT 0.4060487
#define T_HALF 0.3249197
#define N_VORT 6
#define N_STAR 11
#define LOOP_SECONDS 96.0
// VORT[i] = (cx, cy, gamma(+CCW), rc)  cx = u*A
const vec4 VORT[6] = vec4[6](
  vec4(0.53737, 0.660, -0.0200, 0.035),   // c1 great swirl, CW
  vec4(0.73732, 0.610,  0.0170, 0.030),   // c2 great swirl, CCW
  vec4(0.22495, 0.620, -0.0050, 0.020),   // E1
  vec4(0.41865, 0.830,  0.0045, 0.018),   // E2
  vec4(0.88729, 0.690, -0.0050, 0.020),   // E3
  vec4(1.18722, 0.800,  0.0045, 0.020));  // E4
// VORT_W[i] = (window sigma, sink beta)
const vec2 VORT_W[6] = vec2[6](vec2(0.16,0.17), vec2(0.15,0.17), vec2(0.06,0.10),
                               vec2(0.05,0.10), vec2(0.06,0.10), vec2(0.06,0.10));
// VORT_GEO[i] = (r0, rmax, dThroat (m), depthExpo)
const vec4 VORT_GEO[6] = vec4[6](
  vec4(0.020,0.130,40000.,0.433), vec4(0.020,0.120,42000.,0.433),
  vec4(0.006,0.050,45000.,0.200), vec4(0.006,0.040,48000.,0.200),
  vec4(0.006,0.045,52000.,0.200), vec4(0.006,0.050,50000.,0.200));
// STAR[k] = (cx, cy, rhoCore, signedHaloR)  sign = circulation direction
const vec4 STAR[11] = vec4[11](
  vec4(0.37491,0.720,0.016, 0.0954), vec4(0.08748,0.870,0.010,-0.0410),
  vec4(0.33117,0.925,0.011, 0.0451), vec4(0.51863,0.905,0.010,-0.0410),
  vec4(0.66859,0.860,0.011, 0.0451), vec4(0.82480,0.900,0.010,-0.0410),
  vec4(0.93103,0.790,0.012, 0.0566), vec4(1.15597,0.690,0.010,-0.0410),
  vec4(1.01226,0.600,0.010, 0.0410), vec4(0.79981,0.520,0.011,-0.0451),
  vec4(0.58736,0.495,0.010, 0.0410));
const vec4 STAR_D[11] = ... ; // (dCore, ringCount, 0, 0)  from the §2.4 table
const vec4 MOON = vec4(1.07474, 0.850, 0.035, 0.120);
const vec2 PAL_ULTRAMARINE = ...; // all 12 palette colours emitted as linear vec3 consts PAL_*
// ---------------------------------------------------------
```

**`src/shared/glsl/flow.glsl.ts`** (exact):

```glsl
vec2 perp(vec2 a) { return vec2(-a.y, a.x); }            // CCW 90 deg

float ridgeV(float u, float k) {                         // crest of hill wall k, canvas v
  return 0.300 + 0.030*k
       + 0.028*sin(6.2831853*(1.6*u + 0.15 + 0.21*k))
       + 0.011*sin(6.2831853*(4.7*u + 0.40 - 0.30*k));
}

float skyMask(vec2 p) {                                   // 0 below the rear ridge, 1 in sky
  float r = ridgeV(p.x / CANVAS_ASPECT, 2.0);
  return smoothstep(r, r + 0.05, p.y);
}

// Divergence-free wavy bands from psi = y - 0.022 sin(4x+9y) - 0.012 sin(9.3x-5y+1.7)
vec2 bandFlow(vec2 p) {
  float a = 4.0*p.x + 9.0*p.y;
  float b = 9.3*p.x - 5.0*p.y + 1.7;
  vec2 v = vec2(1.0 - 0.198*cos(a) + 0.060*cos(b),        //  dpsi/dy
                0.088*cos(a) + 0.1116*cos(b));            // -dpsi/dx
  float strength = 0.62 + 0.38*sin(6.2831853*7.0*p.y + 1.3*sin(2.1*p.x));  // 14 strong/weak bands
  return 0.25 * strength * v;
}

// Lamb-Oseen vortex, Gaussian-windowed, with sink (streamlines = inward log spirals, pitch beta)
vec2 vortexFlow(vec2 p, vec4 V, vec2 W) {
  vec2 d = p - V.xy;
  float r2 = max(dot(d, d), 1e-6);
  float prof = (1.0 - exp(-r2 / (V.w*V.w))) * exp(-r2 / (2.0*W.x*W.x)) / r2;
  return prof * (V.z * perp(d) - W.y * abs(V.z) * d);
}

// Tangential circulation inside a halo (stars, moon): concentric strokes
vec2 haloFlow(vec2 p, vec4 S) {
  vec2 d = p - S.xy;
  float r = length(d) + 1e-5;
  float R = abs(S.w);
  float m = smoothstep(R*1.15, R*0.85, r) * smoothstep(S.z*0.5, S.z*1.2, r);
  return 0.35 * sign(S.w) * m * perp(d) / r;
}

vec2 hillFlow(vec2 p) {                                   // ridge-parallel, below the crest
  float u = p.x / CANVAS_ASPECT, e = 0.002;
  float slope = (ridgeV(u+e, 1.0) - ridgeV(u-e, 1.0)) / (2.0*e*CANVAS_ASPECT);
  return 0.12 * normalize(vec2(1.0, slope));
}

vec2 flowField(vec2 p) {                                  // p = (u*A, v)
  vec2 v = bandFlow(p);
  for (int i = 0; i < N_VORT; i++) v += vortexFlow(p, VORT[i], VORT_W[i]);
  for (int k = 0; k < N_STAR; k++) v += haloFlow(p, STAR[k]);
  v += haloFlow(p, vec4(MOON.xy, MOON.z, MOON.w));
  return mix(hillFlow(p), v, skyMask(p));
}

// Arm law shared by generator, shader and camera (equals the streamlines of vortexFlow):
//   r(sigma) = r0 * pow(rmax/r0, sigma)
//   theta(sigma) = thetaArm - sign(gamma) * log(r/r0) / beta     (beta = VORT_W.y)
//   d(sigma) = dThroat * pow(r/r0, expo)
```

**TS mirror** (`src/shared/flowField.ts`). It is a line-for-line port using the same constants imported from `contracts.ts`:

```ts
export function flowField(x: number, y: number, out: Float64Array | number[]): void;   // writes out[0], out[1]
export function ridgeV(u: number, k: number): number;
export function skyMask(x: number, y: number): number;
export function armPoint(vi: number, arm: 0 | 1, sigma: number, acrossJitter: number):
  { u: number; v: number; d: number; tu: number; tv: number; dlnd: number };   // tangent in h-units, per unit sigma
export function streamline(x0: number, y0: number, steps: number, h: number): Float32Array;  // RK2, debug/jet only
```

**Unit test:** the TS `flowField` at 16 fixed points must match the hand-evaluated GLSL formulas to 1e-6. A debug overlay draws 200 CPU streamlines over the dust from E.

**Storm field** (GLSL only; cheap, divergence-free, periodic in the 96 s loop):

```glsl
// curl of A = (sin(ay*y+p1)+sin(bz*z+p4), sin(az*z+p2)+sin(bx*x+p5), sin(ax*x+p3)+sin(by*y+p6))
vec3 stormField(vec3 q, float t) {                 // q dimensionless; t = uTime
  float w = 6.2831853 * t / 24.0;                  // period 24 s
  const float a = 1.7, b = 1.1;
  vec3 c1 = vec3(b*cos(b*q.y + 2.1 + w) - a*cos(a*q.z + 0.7 - w),
                 b*cos(b*q.z + 4.4 - w) - a*cos(a*q.x + 1.9 + w),
                 b*cos(b*q.x + 0.3 + w) - a*cos(a*q.y + 5.2 - w));
  vec3 r = vec3(0.8*q.y + 0.6*q.z, 0.8*q.z - 0.6*q.x, 0.8*q.x + 0.6*q.y) * 2.3;   // 2nd octave, rotated
  vec3 c2 = vec3(cos(r.y + 1.3 - w) - cos(r.z + 2.8 + w),
                 cos(r.z + 0.4 + w) - cos(r.x + 3.6 - w),
                 cos(r.x + 5.0 - w) - cos(r.y + 0.9 + w));
  return (c1 + 0.45 * c2) * 0.42;                   // |result| ~ 1
}
```

---

## 4. Modules

### 4.0 Overview

The lead writes `src/contracts.ts` from §2–§4 **before** fan-out. Every module imports only `contracts.ts` and `src/shared/*`, except M10/M11, which orchestrate the 30-world system. GLSL lives in TS template strings (`export const strokeVert = /* glsl */\`...\``), so no loader config is needed.

| # | Module | Owner | Files |
|---|---|---|---|
| M1 | Engine bootstrap, quality tiers, dynamic resolution | A1 | `src/engine/*` |
| M2 | Palette, canvas space, flow field, GLSL header and chunks, uniforms, RNG | A2 | `src/shared/*` |
| M3 | Stroke system: buffer, chunking, ribbon, material, impasto shaders, underlay material | A3 | `src/strokes/*` |
| M4 | Sky: underpainting, decks, funnels, eddies, wind jet, multi-era backdrop, dust, 3D portal vortex | A4 | `src/sky/*` |
| M5 | Stars, Venus, moon | A5 | `src/celestial/*` |
| M6 | Cypress | A5 | `src/earth/cypressGen.ts` |
| M7 | Terrain, hills, village, church, steeple, windows, groves, fields | A6 | `src/earth/{terrain,hillsGen,villageGen}.ts` |
| M8 | Camera director, shots, paths, free mode, touch flight pad, hand-back, UI & World Graph Atlas | A7 | `src/camera/*` |
| M9 | Post-processing | A8 | `src/post/*` |
| M10 | Composition and integration, storm/snap logic, self-test, debug overlay, main | A8 + lead | `src/app/*`, `src/main.ts` |
| M11 | 5-Chapter, 30-World generators, `WORLD_GRAPH`, 6 Motif Transition Grammars, `compilePathTrack` | Lead | `src/chapters/*` |
| M12 | 30-World procedural Web Audio soundscape & 6 Motif harmonic bridges | Lead | `src/audio/soundscape.ts` |

### 4.1 `contracts.ts` (lead): exact contents

```ts
export const LOOP_SECONDS = 96;
export const CANVAS_ASPECT = 1.2497, VFOV_DEG = 36, T_HALF = 0.3249197, AT = 0.4060487;
export const EYE_POS: readonly [number, number, number] = [0, 50, 0];
export const EYE_PITCH_DEG = 10;
export const CAMERA_NEAR = 0.1, CAMERA_FAR = 600_000;

export enum StrokeClass { UNDERPAINT=0, SKY_BAND=1, SWIRL=2, EDDY=3, STAR_CORE=4, STAR_RING=5, MOON=6,
  MOON_RING=7, WIND_JET=8, HILL=9, GROUND=10, GROVE=11, HOUSE=12, WINDOW=13, CHURCH=14, CYPRESS=15 }
export const CLASS_COUNT = 16;
export const FLAG_STRIDE = 32;
export enum StrokeFlag { NONE=0, UNDERLAYER=1, OUTLINE=2 }
export enum AnimKind { STATIC=0, VORTEX=1, RING=2, BAND=3, CYPRESS=4, JET=5, FLICKER=6 }
export interface ClassInfo { anim: AnimKind; solid: boolean; outline: number; sky: boolean;
  tierFraction: { high: number; medium: number; low: number }; budgetHigh: number; dRange: [number, number]; }
export const CLASS_INFO: Record<StrokeClass, ClassInfo>;   // values from the §4.3 table and §7

// Instance record: 16 float32 = 64 bytes, four vec4 attributes a0..a3
//  a0 = (u, v, d, cls + FLAG_STRIDE*flags)
//  a1 = (du, dv, dlnd, W)    du,dv in h-units (stroke spans centre ± ½(du/A, dv)); dlnd = ln(dEnd/dStart)
//                            VORTEX/RING/JET kinds: a1 = (L, 0, 0, W) - direction recomputed in shader (when abs(a1.y) <= 1e-7)
//  a2 = (colA, colB, emissive, seed)   colA/colB = packed sRGB 0xRRGGBB as float (exact < 2^24); seed in [0,1)
//  a3 = (kappa, q1, q2, q3)  solid classes: (kappa, nx, ny, nz) world face normal
//                            VORTEX: (kappa, vortexIdx*2+arm, sigma0, across[-1,1])
//                            RING:   (kappa, starIdx (moon = 11), ringK, radialJitter)
//                            BAND:   (kappa, slideAmp, periodIdx 0..3 -> {8,12,16,24}s, phase)
//                            CYPRESS:(kappa, tongueIdx, phi, 0)
//                            JET:    (kappa, sigma0, filamentOffset (h-units), depthJitter)
//                            FLICKER:(kappa, nx, ny, nz) + emissive animated by seed
export const FLOATS_PER_STROKE = 16;
export interface StrokeRecord { u: number; v: number; d: number; cls: StrokeClass; flags: number;
  du: number; dv: number; dlnd: number; w: number; colA: number; colB: number; emissive: number;
  seed: number; kappa: number; q1: number; q2: number; q3: number; }
export interface StrokeSink { push(r: StrokeRecord): void; readonly count: number; }
export interface Rng { next(): number; range(a: number, b: number): number; int(n: number): number; normal(): number; }

export interface StarDef { name: string; u: number; v: number; dCore: number; rhoCore: number; rings: number; }
export const STARS: readonly StarDef[];          // §2.4, index 0 = Venus
export const MOON_DEF: { u: number; v: number; d: number; rCrescent: number; rings: number; }
export interface VortexDef { u: number; v: number; gamma: number; rc: number; sigma: number; beta: number;
  r0: number; rmax: number; dThroat: number; expo: number; arms: number; }
export const VORTICES: readonly VortexDef[];     // §3 header values, 0 = c1, 1 = c2, 2..5 = eddies
export const HILL_WALL_D: readonly number[] = [3000, 4200, 5600];
export const JET_CTRL: readonly [number, number][] = [[0.17,1.02],[0.24,0.92],[0.29,0.80],[0.30,0.735]];
export const JET_D0 = 220, JET_D1 = 12000;
export const CYPRESS_SIL: readonly [number, number, number][];   // [v, uL, uR] (§2.3)
export const CYPRESS_AXIS_D = 192;
export const CHURCH = { u: 0.55, vBase: 0.11, base: [27, 0, -678], shaftTop: 75, spireTop: 145 };
export const PALETTE = { ultramarine: 0x1b2f6e, prussian: 0x0b1a3a, cobalt: 0x2a52be, cerulean: 0x5e8fb0,
  blueGreen: 0x8fb8a8, zincWhite: 0xe8edf0, chrome: 0xf2c230, lemon: 0xf5e27a, ochre: 0xd98a1e,
  cypressDark: 0x1d2b1f, cypressGreen: 0x2f3d26, roof: 0x4a5a73, outline: 0x142454, voidDeep: 0x050a18,
  varnish: 0xf4e9cf, grove: 0x2e4a3a, groveLight: 0x3d5c4a } as const;

export type Tier = 'high' | 'medium' | 'low';
export interface QualitySettings { tier: Tier; msaa: 0 | 2 | 4; ribbonSegments: 3 | 4 | 5; dustCount: number;
  bloomScale: number; lensIsophote: boolean; lensOklab: boolean; lensChroma: boolean; smearTaps: 4 | 8;
  backdropLayers: 1 | 2; specular: boolean; velocityStretch: boolean; renderScaleInit: number;
  renderScaleMin: number; renderScaleMax: number; targetFrameMs: number; maxPixelRatio: number; }

export interface ShotEnvelope { bloom: number; exposure: number; matte: number; smear: number; storm: number;
  galleryLightDeg: number; impastoGain: number; fade: number; }
export type DirectorMode = 'cinematic' | 'free' | 'rejoin' | 'returning';
export interface DirectorFrame { mode: DirectorMode; loopTime: number; shot: number; shotT: number;
  firstBoot: boolean; bootSeconds: number; cut: boolean; camVelocity: [number, number, number];
  env: ShotEnvelope; stir: [number, number, number, number] | null; warpK: number;
  stormToggled: boolean; calm: boolean; hud: boolean; }
export interface SharedUniforms { [k: string]: { value: any } }   // names fixed in §4.2
```

### 4.2 M2: Palette, canvas space, flow field, shared GLSL, uniforms

**Files:**
- `src/shared/palette.ts`
- `src/shared/canvasSpace.ts`
- `src/shared/flowField.ts`
- `src/shared/rng.ts`
- `src/shared/uniforms.ts`
- `src/shared/glsl/header.ts`
- `src/shared/glsl/common.glsl.ts`
- `src/shared/glsl/flow.glsl.ts`

**Responsibility.** The single source of truth for:
- the mapping, palette (sRGB→linear), flow field and region map
- the GLSL header, noise/hash/IGN, colour unpack and canvasToWorld chunk
- the shared uniform objects

**API:**
```ts
// palette.ts
export function srgbHexToLinear(hex: number): [number, number, number];
export function packSrgb(hex: number): number;                 // returns hex as float
export const PAL_LINEAR: Record<keyof typeof PALETTE, [number, number, number]>;
// canvasSpace.ts
export const EYE: Vector3; export const EYE_BASIS: Matrix3; export const FORWARD: Vector3;
export function canvasToWorld(u: number, v: number, d: number, out?: Vector3): Vector3;
export function worldToCanvas(p: Vector3): { u: number; v: number; d: number };
export function groundHitDepth(u: number, v: number): number;  // vs groundHeight (iterative 4 steps); Infinity above horizon
export function canvasPoseFovDeg(aspect: number): number;      // 36, or wider for aspect < 1.2497
export function jetPoint(sigma: number, filamentOffset?: number): { u: number; v: number; d: number };
export function cypressSilhouette(v: number): [number, number]; // interpolated CYPRESS_SIL
export enum Region { SKY, HILL, VILLAGE, FIELD, CYPRESS }
export function regionAt(u: number, v: number): Region;
// flowField.ts - see §3
// rng.ts
export function mulberry32(seed: number): Rng;
// uniforms.ts
export function createSharedUniforms(): SharedUniforms;
// header.ts
export const GLSL_HEADER: string;      // §3 generated block + PAL_* linear vec3 consts
// common.glsl.ts
export const GLSL_COMMON: string;      // hash11/hash21/vnoise2/vnoise3, ign(vec2), unpackSrgb(float)->linear vec3,
                                       // canvasToWorld(vec2 uv, float d), stormField, spring(float tau, float seed)
```

**Uniform names** (all `{ value }` objects, created once and shared by reference):

| Name | Type | Meaning |
|---|---|---|
| `uTime` | float | loop time in [0, 96) |
| `uEye` | vec3 | E |
| `uEyeBasis` | mat3 | M |
| `uWarpK` | float | depth warp exponent (1 by default) |
| `uOff` | float | `smoothstep(0.5, 40, \|C−E\|)` |
| `uAlign` | float | §6 |
| `uScatter` | float | storm amplitude before the snap |
| `uSnapTime` | float | −1 when no snap |
| `uScatterAtSnap` | float | amplitude frozen at the snap |
| `uLayIn` | float | seconds since boot; −1 disables |
| `uInflate` | float | seconds since wave start; ≥ 10 means inflated |
| `uImpastoGain` | float | impasto multiplier |
| `uGalleryLight` | vec3 | world direction |
| `uMoonPos` | vec3 | |
| `uCamVel` | vec3 | m/s; zero on cut |
| `uPxPerRad` | float | `viewportH / (2·tan(fov/2))` |
| `uViewportH` | float | |
| `uWidthComp` | float[17] | per class |
| `uStir` | vec4 | (u, v, strength, radius) |
| `uSpecular` | float | 0 or 1 |
| `uVelStretch` | float | 0 or 1 |
| `uDustAlpha` | float | |

**Budget.** CPU only, plus header strings.

**Acceptance:**
- `worldToCanvas(canvasToWorld(u, v, d))` round-trips to 1e-9 for 10,000 random inputs.
- `groundHitDepth(0.55, 0.11) = 659 ± 2`.
- Header constants equal `contracts.ts` (generated, never hand-copied).
- Palette linearisation matches the three `Color.setHex(...).convertSRGBToLinear()` reference.

### 4.3 M3: Stroke system (the core)

**Files:**
- `src/strokes/strokeBuffer.ts`
- `src/strokes/ribbonGeometry.ts`
- `src/strokes/strokeMaterial.ts`
- `src/strokes/glsl/stroke.vert.ts`
- `src/strokes/glsl/stroke.frag.ts`
- `src/strokes/underlay.ts`

**Responsibility.** Collect records, then build chunked instanced draws:
- **One** shader source, materials per class group, static buffers.
- Every animation is closed-form in the vertex shader.
- Impasto fragment shading.
- Tier prefixes.
- Bounding spheres.
- An underlay material for meshes.

**API:**
```ts
export class StrokeBuffer implements StrokeSink {
  constructor(capacity: number);
  push(r: StrokeRecord): void;
  readonly count: number;
  classRange(cls: StrokeClass): { dMin: number; dMax: number; n: number };   // for paint-order asserts
}
export interface StrokeChunk { mesh: Mesh; cls: StrokeClass; n: number; baseRadius: number; dMax: number; }
export interface StrokeLayer { group: Group; chunks: StrokeChunk[];
  setQuality(q: QualitySettings): void;          // instanceCount prefixes + ribbon LOD + uWidthComp
  setCullInflation(extraFractionOfD: number): void;  // storm: radius += extra * dMax
  setCullingEnabled(on: boolean): void; }        // false while uWarpK != 1
export function buildStrokeLayer(buf: StrokeBuffer, u: SharedUniforms, q: QualitySettings): StrokeLayer;
export function makeRibbonGeometry(segments: 3 | 4 | 5): BufferGeometry;   // (segments+1)*2 verts, position=(s,w,0)
export function makeUnderlayMaterial(colorHex: number, u: SharedUniforms): ShaderMaterial;  // logdepth, ratio fog,
                                                                            // polygonOffset(1,2), painterly noise
```

**Chunking.**
- Per class, sort strokes by a Morton code of (u, v, log d) and cut into chunks of at most 4,096.
- Exceptions: each vortex (c1, c2, each eddy) is **one** chunk because streaming moves strokes across its whole funnel. Each star's rings form one chunk.
- Within each chunk, Fisher–Yates shuffle with a fixed seed so any prefix is a uniform subsample.
- Each chunk is a `Mesh(InstancedBufferGeometry, material)`:
  - Interleaved `InstancedInterleavedBuffer(Float32Array, 16)` (StaticDrawUsage) with attributes a0–a3.
  - The base ribbon is shared across chunks.
  - `geometry.boundingSphere` is **set by hand** from the CPU world endpoints at t = 0, plus half the stroke world length, plus the animation envelope: BAND 0.35 L, CYPRESS 2 m, SWIRL and RING covered by the per-funnel or per-star chunk.
  - Never let three compute bounds itself.
- Expect about 50–70 draw calls.

**Vertex shader (normative steps).** Base attribute `position.xy = (s ∈ [0,1], w ∈ {−1, +1})`.
1. **Decode.** Read cls and seed. `kind = ANIM_KIND[cls]` (const table in the header).
2. **Animate in canvas space.** Period choices all divide 96 s.
   - **VORTEX:** `sigma = fract(q2 − uTime/24)`. Apply the arm law (§3) with `thetaArm = q1arm·π + 0.37·vi`. Across-arm offset is `q3·0.2·r` along the arm normal. `d *= 1 + 0.02·(seed−0.5)`. Direction is d(point)/dσ. `dlnd = expo·Δln r` over L. Alpha multiplier: `smoothstep(0, 0.06, σ)·smoothstep(1, 0.94, σ)`.
   - **RING:** centre from STAR[q1] or MOON. `ang = atan(v−cy, (u−cx)·A) + (−1)^k·2π·(1 + k mod 3)·uTime/96`. Radius ρ_k(1 + 0.04·q3). Tangent = ang + π/2. `d = d_k`.
   - **BAND:** `uv += 0.5·(du/A, dv)·q1·sin(2π·uTime/T[q2] + 2π·q3)`.
   - **CYPRESS:** `u += 0.004·sin(2π·uTime/6 + 5v + 2π·seed)·clamp(v, 0, 1)`.
   - **JET:** `σ = fract(q1 + uTime/8)`. Position = jetPoint(σ, q2) (same Bézier and depth law as the TS function). Colour ramp by σ. Fade at the ends.
   - **FLICKER:** `emissive *= 0.85 + 0.15·sin(2π·uTime/4 + 6.283·seed)`.
3. **Stir** (sky classes only). Rotate uv and the tangent about `uStir.xy` (h-units) by `1.2·uStir.z·exp(−r²/uStir.w²)`.
4. **Endpoints.**
   - `uvA/B = uv ∓ 0.5·(du/A, dv)`; `dA/B = d·exp(∓0.5·dlnd)`.
   - `PA/PB = canvasToWorld(uvA/B, dA/B)`.
   - For RING, VORTEX and JET, the direction comes from step 2 and the length L from a1.x.
5. **Storm.**
   - `amp = (uSnapTime < 0) ? uScatter : uScatterAtSnap·spring(uTime − uSnapTime − 0.9·|p − pVenus|, seed)`, where `spring(τ) = τ < 0 ? 1 : exp(−6τ)·cos(18τ + 2·seed)` and p is in h-units.
   - Uniform branch: skipped when both amplitudes are 0.
   - `Pc = canvasToWorld(uv, d)`; `D = amp·0.05·d·stormField(Pc/(0.15·d) + 7·seed, uTime)`. Add D to PA and PB.
   - Tumble: `T = normalize(T + 0.8·amp·normalize(D))`.
6. **Frame.**
   - `T = normalize(PB − PA)`, `Lw = |PB − PA|`, `Ww = W·2·T_HALF·d·uWidthComp[cls]`.
   - Solid classes: `B = normalize(cross(N, T))`.
   - Otherwise: `B_img = uEyeBasis·normalize(vec3(−dv, du, 0))` orthogonalised against T. `Bv = cross(T, normalize(cameraPosition − P))`. If `|Bv| < 0.05`, use `B_img`; else `B = normalize(mix(B_img, normalize(Bv), uOff))`.
   - `Nb = cross(B, T)`, flipped to face the camera.
7. **Spine.** `P(s) = mix(PA, PB, s) + Nb·kappa·4s(1−s)·0.25·Lw`. Vertex = `P(s) + B·w·0.5·Ww·(0.85 + 0.15·sin(πs))`.
8. **Velocity stretch** (`uVelStretch`). For s < 0.5, offset by `−normalize(uCamVel)·min(|uCamVel|·(1/60)·1.5, 3·Lw)·(0.5 − s)·2`. Then `alphaMul /= 1 + stretch/Lw`.
9. **Overdraw guards.**
   - `dist = |cameraPosition − P|`, `Lpx = Lw/dist·uPxPerRad`.
   - Cull: if Lpx < 0.35 or the stroke is behind the camera, `gl_Position = vec4(2, 2, 2, 1)`.
   - `alphaMul *= smoothstep(1.5, 4, Lpx)·(1 − smoothstep(180k, 320k, Lpx))·smoothstep(0.8, 2.5, dist/Lw)`, with k = uViewportH/1080.
   - Exempt from the upper fade: UNDERPAINT, and any class while uAlign > 0.5.
10. **Varyings.**
    - vS, vW, colours, emissive, seed, frame vectors T/B/Nb.
    - `vL = normalize(mix(normalize(uMoonPos − P), uGalleryLight, uAlign))`.
    - `vFog = 0.7·(1 − exp(−0.5·max(0, log(dist/max(|E−P|, 1)))))`.
    - Lay-in time `tl = 2.0·clamp(length(p − (0.6374, 0.64))/1.25, 0, 1)`. UNDERPAINT uses tl = −1 (present at t = 0).
    - Impasto factor:
      - `imp = smoothstep(0, 0.12, 0.55·uInflate − length(p − STAR[0].xy))·uImpastoGain`
      - `if (uInflate >= 10.0) imp = uImpastoGain`
11. Then `#include <logdepthbuf_vertex>`.

**Fragment shader (normative):**
```
bristle(w) = 0.5 + 0.5*sin(PI*nb*w + 6.283*seed + 0.7*vnoise2(vec2(3s, 9*seed))),  nb = 9 + 5*seed
wp(s)      = smoothstep(0, 0.1, s) * (1 - 0.4 s) * (1 + 0.1 vnoise2(vec2(18 s, seed)))
mask       = 1 - smoothstep(1 - 1.5*fwidth(vW)/wp, 1, |vW|/wp)
dry brush  : if s > 0.72, mask *= step(0.55*(s-0.72)/0.28, bristle(w))
lay-in     : if uLayIn >= 0 && tl >= 0, mask *= step(s, (uLayIn - tl)/0.4)
h          = (0.3 + exp(-2.2 s)) * (1 - w*w) * (0.62 + 0.38*bristle(w)) * imp
n          = normalize(B*(-1.4*dh/dw) + T*(-1.4*dh/ds) + Nb)        (analytic partials)
diffuse    = mix(0.55 + 0.45*max(dot(n, vL), 0), 0.72 + 0.28*max(dot(n, vL), 0), uAlign)
spec       = uSpecular * 0.16 * pow(max(dot(reflect(-vL, n), V), 0), 28) * imp
col        = mix(cA, cB, 0.45 * smoothstep(0.35, 0.65, bristle(w + 0.37)))
col        = mix(col, PAL_OUTLINE, OUTLINE[cls] * smoothstep(0.7, 1.0, |w|/wp))
col        = col*diffuse + spec + col*emissive
col        = mix(col, fogColor(dist), vFog * (emissive > 0 ? 0.25 : 1))
             fogColor = mix(0.5*ULTRAMARINE, PRUSSIAN, smoothstep(3.0, 5.3, log10(|E-P|)))
alpha      = mask * alphaMul
msaa > 0   : alphaToCoverage = true, output alpha
msaa == 0  : if (alpha < ign(gl_FragCoord.xy)) discard
```
UNDERLAYER strokes are flat: no bristle, W ×3, colour from the class.

**OUTLINE weights:**
- 0.9: CYPRESS (only where |cos φ| > 0.85, i.e. silhouette tubes), HILL crest strokes (flag via kappa sign), HOUSE, CHURCH
- 0.6: swirl arm-edge strokes (|q3| > 0.8)
- 0: everything else

Materials: `transparent: false`, `depthWrite: true`, `side: DoubleSide`, `alphaToCoverage: msaa > 0`.

**Underlay material.** A ShaderMaterial for meshes:
- flat colour × (0.85 + 0.15·vnoise of world position / 6 m)
- the same ratio fog
- moonlight Lambert at 0.35 strength
- logdepth chunks, polygonOffset(1, 2)

**Uniforms consumed:** every M2 uniform except dust.

**Budget (High):** at most 2.4 M vertices per frame, VS ≤ 1.6 ms, FS ≤ 5.0 ms at E (target overdraw ≤ 4). Instance memory about 11 MB.

**Tier behaviour.**
- `instanceCount = ceil(n·fraction)`; width compensation `sqrt(1/fraction)` per class.
- Ribbon segments 5 / 4 / 3.
- No specular on Low. Velocity stretch only on High and Medium.

**Acceptance:**
- A debug generator of 64 random strokes passes the M10 invariance self-test (< 1e-4 canvas error).
- Draw calls ≤ 80.
- No per-frame attribute uploads (spector capture).
- Toggling `uWarpK` from 0 to 1.6 at E changes no pixel beyond A2C noise.
- Low tier compiles with no MSAA and hashed alpha.

### 4.4 M4: Sky

**Files:** `src/sky/skyGen.ts`, `src/sky/backdrop.ts`, `src/sky/dust.ts`

**API:**
```ts
export function generateSky(sink: StrokeSink, rng: Rng): void;   // UNDERPAINT, SKY_BAND, SWIRL, EDDY, WIND_JET, UNDERLAYER(funnel)
export function createBackdrop(u: SharedUniforms, q: QualitySettings): Mesh;  // fullscreen triangle, renderOrder -1000,
                                                                               // depthTest/depthWrite false, no logdepth
export function createDust(u: SharedUniforms, q: QualitySettings, rng: Rng): Points;
```

**Generators** (counts at High):
- **UNDERPAINT, 3,000.** Grid-jittered over the generated canvas. L 0.08, W 0.03, angle from flowField. Colour by `regionAt`: sky #1b2f6e→#0b1a3a; earth #2f3d26/#0b1a3a. Depth 230–250 km.
- **SKY_BAND, 32,000.**
  - Seed positions are rejection-sampled where skyMask > 0.5 and outside the vortex discs (r < 0.7·rmax) and halos.
  - Direction is flowField, stroke from the centre. L 0.025–0.06, W 0.006–0.010, kappa from field curvature (2-sample difference).
  - Colour: `band = fract(7·(v + 0.03·sin(4u·A)))` picks cobalt / cerulean / zinc white (weights 0.45 / 0.35 / 0.20), two-tone pairs.
  - Deck depth per §2.4. BAND anim: q1 0.35, q2 = rng.int(4), q3 = rng.
- **SWIRL, 30,000** (c1 16,000; c2 14,000; 2 arms each).
  - σ0 uniform; across offset q3 ~ N(0, 0.45) clamped to [−1, 1].
  - L = 0.008 + 0.15·r, W = L/5.
  - Colour ramp by r/rmax: #e8edf0 → #8fb8a8 → #5e8fb0 → #2a52be → #1b2f6e. Arm-edge strokes are 15% darker.
- **UNDERLAYER funnel shell, 3,000.** Strokes on the same funnel surface between arms, depth +1%, W ×3, #0b1a3a, using the VORTEX anim with q3 = 0 and half-turn offset arms, so the funnel wall reads as a continuous surface off-axis.
- **EDDY, 6,000.** Same law as the swirl with eddy geometry. Colours cerulean / zinc white.
- **WIND_JET, 2,400.** 32 filaments × 75 strokes. q2 filament offset ~ N(0, 0.006) h-units. L 0.012, W 0.003. Emissive 0 → 1.1 along σ.

**Backdrop.**
- Per pixel: view direction to eye frame `q = Mᵀ·dir`.
- `u_b = 0.5 + atan(q.x, −q.z)/(2·0.38571)`, `v_b = 0.5 + asin(q.y)/(2·0.31416)`, folded into [−0.3, 1.3] by triangle mirroring.
- Up to 2 layers of hashed Voronoi-cell stroke splats (cells 0.03 h, splat aspect 4:1), oriented by `flowField(u_b·A, v_b)`.
- Palette: Prussian–ultramarine with 6% cerulean. Below `ridgeV(u_b, 2)` it is #0b1a3a / #1d2b1f.
- Back hemisphere (q.z > 0) fades to #050a18 with 30% stroke contrast. HDR ≤ 0.6.

**Dust (pigment motes).**
- 30k / 16k / 6k points. d log-uniform in [50 m, 250 km]; canvas position uniform over the generated canvas. Colour = `regionAt`.
- Size 1.5–3 px (`gl_PointSize` × uViewportH/1080). Additive. Alpha `0.25·uOff·uDustAlpha`.
- Drift: `p = p0 + 0.02·normalize(flowField(p0))·sin(2π·uTime/16 + 6.28·seed)`.
- Logdepth chunks. `frustumCulled = false` (one draw).

**Uniforms:** uTime, uOff, uEye, uEyeBasis, uWarpK, uViewportH, uDustAlpha.

**Budget:** backdrop ≤ 0.3 ms at 1080p; dust ≤ 0.2 ms; generation ≤ 70 ms.

**Tiers:** backdrop layers 2 / 2 / 1; dust counts as above; strokes via class fractions (§7).

**Acceptance:**
- From E the sky reads as Van Gogh's swirl: c1 and c2 spirals with the S-crest between them; at least 3× coverage (debug overdraw view shows no backdrop pixels inside u ∈ [−0.21, 1.21]).
- From the §5 profile vantage (t = 48 s) the two funnels read as continuous flaring surfaces, not confetti.
- The wind jet visibly links the cypress tip to Venus from the t = 32 s pose.

### 4.5 M5: Stars, Venus, moon

**Files:** `src/celestial/starsGen.ts`, `src/celestial/moonGen.ts`

**API:**
```ts
export function generateStars(sink: StrokeSink, rng: Rng): void;   // STAR_CORE + STAR_RING (RING anim, q1 = star index)
export function generateMoon(sink: StrokeSink, rng: Rng): void;    // MOON crescent + MOON_RING (RING anim, q1 = 11)
```

**Stars.**
- **Cores, 2,200.** Venus 400, others 180 each.
  - Radial spike strokes from the centre out to ρ_core.
  - Depth d_core·(0.99 − 0.01·hash), so cores sit in front of ring 0.
  - Lemon → zinc white; emissive 6 (Venus 8).
- **Rings, 14,000.** Venus 3,000; others about 1,100 split across their rings.
  - Strokes per ring ∝ circumference. Three radial rows per ring (q3 ∈ {−1, 0, 1} × 0.04).
  - Tangent strokes, L = 1.3 × spacing.
  - Colours cycle chrome yellow / lemon / blue-green by k mod 3. Emissive `2.2 − 0.12k`.
  - Ring axes are **exactly** the ray from E (no precession).

**Moon.**
- **Crescent, 1,800.** Arc strokes following the crescent bands. Emissive 3.5. Unlit disc interior: ochre at 35%, emissive 0.4.
- **Bell rings, 4,200.** Thick chrome strokes, W 0.006.

**Budget:** ≤ 25 ms generation; part of the M3 GPU budget.

**Tiers:** STAR_CORE 1 / 1 / 0.7; STAR_RING 1 / 0.6 / 0.35; MOON 1 / 0.8 / 0.5; MOON_RING 1 / 0.6 / 0.35.

**Acceptance:**
- From E, exactly 11 haloed stars and one crescent at the table positions. Overlay landmarks coincide within 0.005.
- Flying the Venus ray between 12 and 23.5 km, 9 rings pass the lens as a counter-rotating tunnel.
- Under bloom, ring structure stays visible (isophote banding, M9).

### 4.6 M6: Cypress

**Files:** `src/earth/cypressGen.ts`

**API:**
```ts
export function generateCypress(sink: StrokeSink, rng: Rng): void;     // CYPRESS + UNDERLAYER core
export function createCypressCore(u: SharedUniforms): Mesh;            // dark twisted lathe, underlay material #0f1712
```

**Tongues.** Seven tongues, j = 0..6.
- Centreline: `u_j(v) = u0_j + 0.02·sin(7v + φ_j) + lean_j·v`, with u0_j spread over the `cypressSilhouette(v)` interval and lean ∈ [−0.02, 0.02].
- Half-width: `w_j(v) = 0.5·(uR − uL)/2.6·taper(v)`.
- Tube (canvas u, depth): `u = u_j + w_j·cos φ`, `d = 192 + dd_j + Rw_j·sin φ`, with `Rw_j = w_j·2·AT·192` (round tubes), dd_j ∈ [−18, 18] m, and φ += 2.6·v (twist).

**Strokes.**
- 18,000 strokes, oriented along the twisted tube tangent: du, dv and dlnd from the d(tube point)/dv derivative.
- L 0.012–0.035, W 0.004–0.007.
- Colours #1d2b1f / #2f3d26, with 10% olive (#3d5c4a) and 5% ultramarine flecks.
- The outline flag is set where |cos φ| > 0.85.
- Tip strokes (v > 0.95) lean 20° toward the jet start. **UNDERLAYER**: 1,500 inner-tube strokes at 0.45 radius.

**Core mesh.** LatheGeometry following the silhouette at 0.5 × half-width, 48 × 96 segments, placed via canvasToWorld at d = 192.

**Budget:** generation ≤ 20 ms.

**Tiers:** 1 / 0.6 / 0.3 (core mesh always present).

**Acceptance:**
- From E the silhouette matches `CYPRESS_SIL` within 0.01, rises from below the bottom edge past the top edge, and the right edge sits just left of Venus.
- On the t = 20–32 helix climb, tongues read as separate writhing tubes with no see-through holes to the sky inside the trunk.

### 4.7 M7: Terrain, hills, village, steeple

**Files:** `src/earth/terrain.ts`, `src/earth/hillsGen.ts`, `src/earth/villageGen.ts`

**API:**
```ts
export function groundHeight(x: number, z: number): number;            // §2.3
export function generateGround(sink: StrokeSink, rng: Rng): void;     // GROUND (solid, normal +Y) + GROVE clumps
export function generateHills(sink: StrokeSink, rng: Rng): void;      // HILL walls + crest outline + UNDERLAYER 1,500
export interface VillageInfo { steepleBase: Vector3; steepleTip: Vector3; houses: { center: Vector3; size: Vector3; yaw: number }[]; }
export function generateVillage(sink: StrokeSink, rng: Rng): VillageInfo;  // HOUSE, WINDOW, CHURCH (solids)
export function createLandUnderlays(u: SharedUniforms, info: VillageInfo): Group;
  // ground grid 160x160 over x[-3,4]km z[0,-6.5]km (#1d2b1f->#0b1a3a by distance), hill wall backs (#142454),
  // InstancedMesh house cores (#26314a), church/steeple core
```

**Ground: 8,000 field strokes.**
- Generated in world on the ground, then converted with worldToCanvas.
- Wavy horizontal flow (hillFlow) mixed with curling swathes.
- Greens #2f3d26 / #3d5c4a, ochre 15%, ultramarine 15%.
- Canvas L 0.015–0.03.

**Groves: 6,000.** Flame clumps; strokes on the ellipsoid surface, vertical-ish; #2e4a3a / #3d5c4a; outline 0.5.

**Hills: 15,000.**
- Contour strokes on the sloped walls, parallel to ridgeV shifted down. Colours #1b2f6e / #2a52be, with cerulean on the upper third.
- 1,200 crest strokes in #142454 with ±150 m depth thickness.

**Houses: 14,000 strokes on 40 solids.**
- Walls: vertical/horizontal strokes, cerulean–zinc white (dulled ×0.7).
- Gable roofs: slope strokes in #4a5a73.
- Stroke canvas size L 0.006–0.014 (world ∝ d).

**Windows: 400.** Two or three per wall on **all four** walls, so they are visible from the vortex eye. Chrome / orange, emissive 2.5, FLICKER.

**Church and steeple: 3,600.**
- Vertical strokes on the shaft and spire, outlined.
- The spire tip is pinned exactly at (27, 145, −678).

**Budget:** generation ≤ 60 ms. Underlays ≤ 0.3 ms GPU.

**Tiers:**

| Class | High | Medium | Low |
|---|---|---|---|
| GROUND | 1 | 0.55 | 0.25 |
| GROVE | 1 | 0.55 | 0.3 |
| HILL | 1 | 0.55 | 0.3 |
| HOUSE | 1 | 0.6 | 0.35 |
| WINDOW | 1 | 1 | 1 |
| CHURCH | 1 | 0.8 | 0.5 |

**Acceptance:**
- From E: village in x 0.30–0.95, y 0.08–0.30; steeple at u = 0.55 piercing the ridge; three layered ridges between y 0.30 and 0.40.
- From the t = 71 s vortex-eye pose, the village reads as a cluster of lit windows with a steeple and cypress silhouette in blue haze.
- Off-axis (§9, t = 25 s) the houses show solid sides.

### 4.8 M8: Camera director (cinematic, free explore, hand-back, UI)

**Files:**
- `src/camera/director.ts`
- `src/camera/shots.ts` (the §5 tables as data)
- `src/camera/paths.ts`
- `src/camera/freeFly.ts`
- `src/camera/ui.ts`

**API:**
```ts
export class Director {
  constructor(camera: PerspectiveCamera, input: HTMLElement,
              opts: { calm: boolean; startTime?: number; free?: boolean; firstBoot: boolean });
  update(dtSeconds: number): DirectorFrame;     // writes camera.position/quaternion/fov/updateProjectionMatrix
  jumpToShot(index: number): void;              // 0..9, 0.3 s fade through Prussian (env.fade), cut = true
  returnToEye(): void;                          // log-polar flight home + snap; free mode stays active afterwards
  resumeCinematic(): void;
  setCalm(on: boolean): void;
  readonly mode: DirectorMode;
}
// paths.ts
export function hermite(p0: Vector3, m0: Vector3, p1: Vector3, m1: Vector3, s: number, out: Vector3): Vector3;
export function catmullRomCentripetal(pts: Vector3[], s: number, out: Vector3): Vector3;
export function logPolarAboutEye(fromPos: Vector3, toPos: Vector3, s: number, out: Vector3): Vector3; // dist log-lerp, dir slerp
export function vanWijkNuij(c0: Vector3, w0: number, c1: Vector3, w1: number, rho: number):
  { duration: number; at(S01: number): { center: Vector3; width: number } };
export function dollyZoomFov(fov0Deg: number, depth0: number, depthNow: number): number;  // 2 atan(tan(fov0/2) d0/dNow)
export function funnelCameraPoint(vi: number, rCanvas: number, theta: number, inset: number): Vector3;
export class CriticalSpring3 { constructor(omega: number); step(target: Vector3, dt: number): Vector3; }
export const ease: { inOutCubic(t: number): number; inOutSine(t: number): number; smootherstep(t: number): number; outQuint(t: number): number };
```

**Responsibilities:**
- Evaluate the timeline (§5) on the loop clock, plus envelopes.
- First-boot flags: lay-in and inflation on the first pass only; on loop re-entry the impasto "breath".
- Roll and FOV comfort caps, applied after path evaluation: roll ≤ 30°, roll rate ≤ 25°/s, FOV ≤ 80°.
- In calm mode: roll ×0.5, FOV ≤ 70°, smear 0, punch exposure dip halved.
- Velocity estimate, zeroed when `cut`.
- Free mode and hand-back (§5.3).
- The 960-sample rejoin table (pose every 0.1 s), built at init.
- DOM UI:
  - a hint line at the end of the loop ("drag to explore · Space returns to the eye"), shown 90.0–96 s on the first loop only
  - the H HUD (fps, tier, render scale)
  - in free mode only, a small gold ring at E's projection (radius ∝ misalignment, hidden when uAlign > 0.95)

**Budget:** CPU ≤ 0.3 ms/frame; table build ≤ 15 ms.

**Acceptance:**
- Poses at the §5 keyframes match the tables within 0.5 m (or 0.1% of |C − E|) and 0.2°.
- t = 96 equals t = 0 to 1e-3 m and 1e-4 rad.
- No frame-to-frame jump of more than 3× the local speed except on flagged cuts.
- Every input hands off within one frame.

### 4.9 M9: Post-processing

**Files:** `src/post/post.ts`, `src/post/painterlyLens.ts`

**API:**
```ts
export interface PostFrame { bloom: number; exposure: number; matte: number; align: number; smear: number;
  fade: number; time: number; canvasRectPx: [number, number, number, number]; }
export interface PostChain {
  render(scene: Scene, camera: PerspectiveCamera, f: PostFrame): void;   // renders scene into sceneRT, then composer
  setSize(cssW: number, cssH: number, pixelRatio: number): void;
  setQuality(q: QualitySettings): void;
}
export function createPost(renderer: WebGLRenderer, u: SharedUniforms, q: QualitySettings): PostChain;
```

The chain is in §6. Owns the `sceneRT` (HalfFloat, samples = q.msaa, depthBuffer true, no DepthTexture).

**Budget (High):** bloom ≤ 1.0 ms, lens ≤ 0.7 ms, output ≤ 0.2 ms.

**Acceptance:**
- The composer's internal targets are **not** multisampled (verify `composer.renderTarget1.samples === 0`).
- Palette swatch test: a debug quad of the 12 pigments at HDR 0.8 survives tone mapping with hue error < 3° in OKLCh.
- The Venus punch frame (t = 37.6 s) shows ring structure, not a white field.

### 4.10 M10: Composition and integration

**Files:**
- `src/main.ts`
- `src/app/composition.ts`
- `src/app/storm.ts`
- `src/app/selfTest.ts`
- `src/app/debugOverlay.ts`

**API:**
```ts
export async function boot(container: HTMLElement): Promise<void>;
export interface World { scene: Scene; strokes: StrokeLayer; backdrop: Mesh; dust: Points; underlays: Group; village: VillageInfo; }
export function buildWorld(u: SharedUniforms, q: QualitySettings, seed: number): World;   // all generators + assertPaintOrder
export function assertPaintOrder(buf: StrokeBuffer): string[];                              // returns violations
export class StormController { update(f: DirectorFrame, camPos: Vector3, u: SharedUniforms, layer: StrokeLayer): void; }
export function runInvarianceSelfTest(buf: StrokeBuffer, camera: PerspectiveCamera): { maxErr: number; ok: boolean };
```

**Storm logic.**
- `gate = clamp(0.35 + 0.65·log10(|C−E|/360)/log10(30000/360), 0.35, 1)`; `uScatter = env.storm·gate`.
- When storm > 0 and |C−E| first drops below 360 m:
  - `uSnapTime = uTime`, `uScatterAtSnap = uScatter`, and set the internal storm to 0.
  - Clear uSnapTime 3 s later, or at loop wrap.
- While uScatter or the snap is active: `layer.setCullInflation(0.05)`.
- G in free mode re-arms the storm: env.storm ramps to 1 over 2 s.

**Per-frame order:**
1. director.update
2. derived uniforms: uOff, uAlign, uPxPerRad, uCamVel
3. storm
4. layer culling flags (warp)
5. post.render
6. dynamic resolution

**Self-test.** Project 64 random stroke centres from the canvas pose with `Vector3.project`, convert NDC to canvas `u = 0.5 + ndc.x·aspect/(2A)`, `v = 0.5 + ndc.y/2`, and warn if the error exceeds 1e-4.

**Debug URL flags:**
- `?t=<sec>` start time
- `?tier=`
- `?free`
- `?overlay` (canvas grid, landmark crosses, CPU streamlines)
- `?overdraw` (additive 0.1 per fragment)
- `?seed=`

**Budget:** CPU ≤ 0.5 ms/frame; world build ≤ 250 ms total on a mid laptop CPU.

**Acceptance:** see §9.

---

## 5. Camera choreography: 96 s loop, one take

### 5.1 Shot list

Conventions:
- Positions are in metres (world), in the form (x, y, z).
- "Target" is the look-at point. Roll is 0 unless stated.
- FOV is vertical in degrees.
- All position tracks are C1-continuous across boundaries (Hermite blends of 0.5 s are built in, except at t = 6.0 and t = 88.0, which are motion starts from rest).

| # | Shot | Time (s) | Set piece |
|---|---|---|---|
| 1 | **Canvas** | 0.0–6.0 | the painting paints itself and inflates |
| 2 | **Tear** | 6.0–12.0 | the matte slides away; a truck proves the depth |
| 3 | **Inhale** | 12.0–20.0 | dolly-zoom: the cypress swells, the village stays locked |
| 4 | **Black Flame** | 20.0–32.0 | helix climb; burst over the tip, Venus dead ahead |
| 5 | **Venus Gate** | 32.0–42.0 | flame becomes wind; punch through Venus; ring tunnel |
| 6 | **Twin Funnels** | 42.0–52.0 | pull out: the swirl is two 50 km maelstroms |
| 7 | **The Fall** | 52.0–64.0 | swoop into c1's mouth; spiral down the wall |
| 8 | **Eye of the Vortex** | 64.0–73.0 | calm; the village framed in the throat; the storm wakes |
| 9 | **Storm & Return** | 73.0–88.0 | log flight home through the hurricane, backing in |
| 10 | **Homecoming** | 88.0–96.0 | snap ripple from Venus; reverse dolly-zoom; matte closes |

**Shot 1: Canvas (0–6 s)**
- Position: E (0, 50, 0). Target: E + 1000·F = (0, 223.6, −984.8). FOV 36. Static.
- First boot only:
  - lay-in 0.0–2.4 s outward from the swirl (underpainting present from frame 0)
  - inflation wave from Venus 1.2–3.8 s (`uInflate = boot − 1.2`)
- Loop re-entry: uImpastoGain breathes 1 → 1.15 → 1 over 0–2 s (sine).
- Gallery light azimuth −15° → +15° (2–6 s, inOutSine). The light is `M·rotZ(az)·normalize(−0.45, 0.6, 0.66)`.

**Shot 2: Tear (6–12 s)**
- Position (0, 50, 0) → **(−40, 59.5, −19.7)**, inOutCubic.
- Look direction F → rotY(+5°)·F = (−0.0858, 0.1736, −0.9811); target is pos + 1000·dir.
- FOV 36 → 40 (inOutCubic). Matte slides off 6.0–8.0 (inOutCubic).
- The cypress (d ≈ 190) sweeps right by about 12° (≈ 20% of frame width) toward centre, eclipsing Venus's halo edge. Village shift is about 5° and the sky is locked.

**Shot 3: Inhale (12–20 s)**
- Position (−40, 59.5, −19.7) → **(−49, 40, −120)**, linear on inOutSine.
- View direction held at the shot 2 direction until 18.5 s, then slerps up 25° toward the cypress trunk (−50, 110, −192) by 20.0 s.
- Dolly-zoom lock on L = (0, 0, −453) (fields and village front):
  - `fov = 2·atan(tan 20°·D0/D(t))`, with D the distance of L along the view direction (D0 = 411.4 m, D_end = 315.6 m).
  - Result: 40° → **50.8°**, then to 54° during 18.5–20.
- The cypress grows from 170 m to 70 m away (2.4×) while the village holds.

**Shot 4: Black Flame (20–32 s)**
- Front-arc climbing spiral about the leaning trunk axis `(−50, 10, −200) → (−51, 154, −175)` with `τ = smootherstep((t−20)/10)`:
  - `r = 75 − 45τ` (to 30 m); `y = 40 + 118τ` (to 158 m); `θ` swings out to the left flank (`≈ −49°` at 24.3 s, keeping the swirl and stars beside the trunk) and sweeps across the front to `+20°` at `τ = 1` (**BURST0 = (−40.77, 158, −146.11)**, front-right of the flame tip).
- Target: trunk axis 30 m above the camera (soft-clamped at `y = 158 m`), biased 30% toward the **Venus core (−1949, 3823, −11520)** and slerped fully to Venus over `τ ∈ [0.55, 1]`.
- Bank ≤ 10° following orbit rate. FOV 54 → 60.
- **Burst, 30–32 s:** pos `(−40.77, 158, −146.11)` → **(−45, 210, −235)** (outQuint); target Venus; FOV 60 → **78**.
- Bloom rises 0.7 → 0.9. The black flame drops away below-left and the sky opens.

**Shot 5: Venus Gate (32–42 s)**
- **32.0–37.5:** ride the wind jet.
  - `pos = jetPoint(σ)` mapped through canvasToWorld, plus 6·(1−σ) m along U, converging smoothly onto the Venus ray over `σ ∈ [0.7, 1.0]`. σ runs 0.12 → 1.0 with a Hermite ease whose end speed matches the ring-tunnel entry speed.
  - Depth runs 360 m → 12 km (log, by the jet law). Look: path tangent 0.4 s ahead. FOV 78.
  - The jet strokes stream alongside at nearly camera speed.
- **37.5: punch through the core.** Exposure 1.0 → 0.5 (37.30–37.55), held to 37.85, back to 1.0 by 38.6. Bloom 1.6 at 37.5, then 1.3.
- **37.5–42.0:** straight along the Venus ray, `pos = E + d·dir_V` with dir_V = (−0.1588, 0.3075, −0.9384).
  - d = 12,000·2^(outCubic((t−37.5)/4.5)), ending at **(−3898, 7597, −23040)**.
  - Look along dir_V. FOV 78 → 72. Roll 0 → −15° (trapEase, 3.3°/s mean).
  - Nine rings pass about every 0.5 s.

**Shot 6: Twin Funnels (42–52 s)**
- **42–48:** van Wijk–Nuij (ρ = 1.4) from (−3898, 7597, −23040) to **V6 = (−26150, 3033, −46184)** (`canvasToWorld(−0.20, 0.33, 46000)`, below-left of the funnels so both sit broadside against the painted sky decks).
  - Target slerps from the ray ahead to **P_mid = (504, 16173, −60114)** (canvas (0.51, 0.635) at 62 km).
  - FOV 72 → 60. Roll −15 → 0.
- **48–52:** linear push V6 → **V6b = (−18759, 2209, −55468)** (`canvasToWorld(0.08, 0.29, 55000)`). Target P_mid. FOV 60.
- Frame: both funnels flaring broadside from 520 m throats to 7.6 km mouths; eddies; decks as tilted strata behind.

**Shot 7: The Fall (52–64 s)**
- **52.0–55.5 swoop:** Hermite from V6b to the **c1 mouth entry (−5013, 30133, −82975)** (`funnelCameraPoint(0, 0.12, 90°, 0.8)`; table approx `(−5003, 31100, −83883)`).
  - Leaves with the Shot 6b push velocity and arrives along the spiral tangent.
  - Look: carries P_mid smoothly with the camera (`P_mid + x·(P − V6b)`) and slerps (`trapEase(x, 0.3)`) into the spiral entry direction. FOV 60 → 70.
- **55.5–64.0 spiral:** `τ = inOutSine((t−55.5)/8.5)`.
  - r = 0.12·0.25^τ (h-units); θ = 90° − 360°·τ (clockwise).
  - Camera at canvas `c1 + 0.8·r·(cosθ/A, sinθ)` and depth `40 km·(r/0.02)^0.433` (inside the wall).
  - Midpoint ≈ (−3659, 15346, −62661). End ≈ (−2700, 13900, −45800) at 47.7 km.
  - Look: the path point 0.6 rad ahead, blended 30% toward the axis point 6 km nearer E.
  - Roll = clamp(0.6 × yaw rate) (yaw rate is about 42°/s, so roll ≈ 25°), unwinding smoothly to `−20/3°` at 64 s.
  - FOV 70 → 74. Velocity stretch is visible.

**Shot 8: Eye of the Vortex (64–73 s)**
- **64.0–66.5:** glide onto the axis at **A47 = (−2672, 13024, −45437)**. Orientation slerps to look at **E (0, 50, 0)**. Roll winds on to −10°, then drifts at −4°/s (co-rotation), soft-clamped to −30°. FOV 74 → 70.
- **67.0–71.0 telephoto push:** A47 → **A44 = (−2501, 12196, −42537)**. FOV 70 → **26** (inOutCubic). The 520 m throat 4 km ahead fills about 57% of frame height; the lit village and dark steeple needle sit at its centre (≈ 10% of frame height), with foreground dust dipped to 0.25.
- **70.0–73.0:** storm envelope 0 → 1 (smoothstep). The nave walls tear into coherent curl sheets. Bloom 1.0. Exposure 1.1 (lifts the windows).

**Shot 9: Storm & Return (73–88 s)**
- `pos = logPolarAboutEye(A44 → H0, s)`, with H0 = E + 360·F = **(0, 112.5, −354.5)**.
  - Distance from E: 44 km → 360 m, log-lerped with `s = inOutSine((t−73)/15)`.
  - Direction from E slerps from dir(c1) to F.
  - The path passes through the c1 throat at about 74 s and stays above the hills (v ≥ 0.45).
- Orientation:
  - 73–76: look at E (through the hurricane toward Earth)
  - **76.0–82.5:** 180° yaw pirouette (≤ 33°/s) to face F
  - 82.5–88: face F with zero roll, flying **backward** into the painting
- FOV 26 → 60 (73–77), 60 → **70.0** (82.5–88).
- Scatter is gated by distance, so the near world calms progressively.

**Shot 10: Homecoming (88–96 s)**
- Snap at 88.0 (|C−E| crosses 360 m): the ripple travels outward from Venus and settles by 90.0. Bloom pulse +0.4 during 88.6–88.9.
- Position: `E + s(t)·F`, with `s = 360·(1 − inOutCubic((t−88)/7.5))` for 88–95.5, then exact E with a critically damped settle (95.5–96, error < 1e-3 m).
- Orientation: canvas pose (target E + 1000·F).
- Reverse dolly-zoom on the steeple (depth from E along F = 671.5 m): `fov = 2·atan(0.32492·671.5/(671.5 − s))`, so **70.0° → 36.0°**.
- The cypress slides in from the left edge between 91.3 and 92.6 s (a closing curtain).
- Matte closes 93.0–95.5. Gallery light +15° → −15° over 92–96. The loop wraps to t = 0 with an identical state.

### 5.2 Envelopes (evaluated by the director, linear between keys unless noted)

| Time | bloom | exposure | matte | smear | storm | dust | other |
|---|---|---|---|---|---|---|---|
| 0–6 | 0.45 | 1.0 | 1 | 0 | 0 | 0 | lay-in, inflation / breath, light sweep |
| 6–8 → 12 | 0.5 | 1.0 | 1 → 0 | 0 | 0 | → 1 | |
| 12–20 | 0.6 | 1.0 | 0 | 0.2 | 0 | 1 | |
| 20–30 → 32 | 0.7 → 0.9 | 1.0 | 0 | 0.3 → 0.5 | 0 | 1 | |
| 32–37.5 | 0.9 → 1.6 | 1.0 → 0.5 dip | 0 | 0.8 | 0 | 1 | |
| 37.5–42 | 1.3 | 1.0 | 0 | 0.6 | 0 | 1 | |
| 42–52 | 0.9 | 1.0 | 0 | 0.4 → 0 | 0 | 1 | |
| 52–64 | 0.9 | 1.0 | 0 | 0.7 | 0 | 1 | |
| 64–73 | 1.0 | 1.1 | 0 | 0 | 0 → 1 (70–73) | 1 → 0.25 (67–72.5) → 1 | |
| 73–88 | 0.9 | 1.0 | 0 | 0.6 → 0.2 | 1 (gated) | 1 → 0.3 | |
| 88–96 | 0.45 (+0.4 pulse) | 1.0 | 0 → 1 (93–95.5) | 0 | snap | → 0 (uOff) | light sweep back |

`fade` is 0 except on jump cuts (0.3 s up/down). Calm mode applies the caps from §4.8.

### 5.3 Free explore and re-entry

- **Hand-off:** any pointerdown, keydown or wheel event. The current pose, FOV and velocity become the pilot state, with inertia damped at 0.4 s and no blend. The matte follows uAlign in free mode.
- **Look:** drag rotates yaw/pitch (quaternion, no roll, 0.12 s damping). No pointer lock. Touch: one finger looks; a two-finger pinch moves forward/back.
- **Move:** WASD / arrows translate; Q/E down/up.
  - Base speed `v = 0.35·max(|C−E|, 30 m)` per second (scale-aware).
  - The wheel sets a speed multiplier 2^n, n ∈ [−4, 4].
- **Shift + wheel:** depth warp uWarpK ∈ [0, 1.6] in steps of 0.1. Culling is disabled while k ≠ 1. Underlay meshes are hidden while k ≠ 1.
- **Pointer drag with Alt, or right-drag:** stir the sky. The cursor's canvas point is the projection of the far point of the cursor ray through worldToCanvas. uStir.z = 1 and decays as e^(−t/1.5). Radius 0.08 h.
- **Space:** Return to the Eye. A log-polar flight about E to H0 (360 m in front) for 3–6 s depending on log distance, then the shot 10 homecoming (snap included if the storm is armed), then free mode again at E.
- **Number keys:** 1–9 and 0 jump to the start of shots 1–10 (0.3 s fade, cut).
- **Other keys:** C resumes the cinematic now. R restarts at t = 0 (no lay-in). G arms the storm. M toggles calm mode. H toggles the HUD.
- **`prefers-reduced-motion`:** calm mode on by default.
- **Idle hand-back after 12 s:**
  - Pick the timeline sample (of 960) that minimises `2·|log10 max(|C−E|, 10) − log10 max(|S−E|, 10)| + ∠(C−E, S−E)/π + 0.5·∠(viewC, viewS)/π`.
  - Fly there with logPolarAboutEye plus slerp plus FOV lerp over 3–5 s (mode 'rejoin'), then continue the timeline from that sample.
  - If |C−E| < 50 m, resume at t = 0 instead.

---

## 6. Post-processing chain (in order)

1. **Scene render (custom, in M9).**
   - `renderer.setRenderTarget(sceneRT)`, then `renderer.render(scene, camera)`.
   - sceneRT: `HalfFloatType`, `samples = 4 / 2 / 0` by tier, `depthBuffer: true`, linear colour.
   - Renderer settings: `antialias: false`, `toneMapping = NeutralToneMapping`, `outputColorSpace = SRGBColorSpace`, `powerPreference: 'high-performance'`.
2. **`TexturePass(sceneRT.texture)`** into an EffectComposer created with its **own non-multisampled HalfFloat target**.
3. **`UnrealBloomPass`.**
   - Threshold **1.0**, radius **0.6**, strength = `env.bloom`.
   - The stock pass is wrapped: its `setSize` is overridden to call the original with `(w·q.bloomScale·2, h·q.bloomScale·2)`, because the stock pass halves internally. Effective bloom resolution is 0.5 / 0.5 / 0.25. Five mips are kept; no fork.
   - Emissive levels: star cores 6 (Venus 8), moon 3.5, windows 2.5, rings 2.2 → 1.2, moon rings 1.4 → 0.9, jet tail 1.1. Specular capped at 4.
4. **`ShaderPass` Painterly Lens** (one pass; order inside it):
   1. **Isophote halo banding** (High/Medium, needs `lensIsophote`).
      - `Lum = luminance(c)`. If Lum > 0.35: `band = fract(3·log2(Lum))`; `ring = smoothstep(0, 0.12, band)·(1 − smoothstep(0.55, 0.7, band))`.
      - Gradient by central differences at 2 px; tangent t = perp(g)/|g|; noise along t at 1/6 px scale.
      - `c *= 1 + smoothstep(0.35, 1.2, Lum)·(0.18·(ring − 0.5) + 0.1·n)`.
   2. **OKLab pigment pull** (High/Medium). Soft snap toward the nearest of the 12 pigments: `mix(c, c′, 0.25)`, or 0.12 when Lum > 1.
   3. **Radial speed smear.** 8 / 8 / 4 taps toward the screen centre over `0.025·smear` of the screen radius. Chromatic split ≤ 1.5 px × smear (High only).
   4. **Canvas treatment** (gated):
      - Weave with period `canvasHeightPx/280`, over/under checker, amplitude `0.06·align`.
      - Varnish: `c *= mix(1, varnish, 0.08·align)`.
      - Outside the canvas rect: `c *= 1 − 0.35·align`.
   5. **Matte.** Bars move from the screen edges inward to the canvas rect (`canvasRectPx` from M10): inner edge = `canvasEdge + (1 − matte)·(screenEdge − canvasEdge + barWidth)`. Colour #0a0b10. 2 px warm frame line #3a2a18 at `0.6·matte`.
   6. **Vignette** 0.22 radial. **Fade:** `mix(c, prussian·0.3, fade)`.
5. **`OutputPass`** applies **NeutralToneMapping** at `toneMappingExposure = env.exposure` and converts to sRGB. **ACES is forbidden.**

**uAlign** (computed in M10): `(1 − smoothstep(0.05, 3, |C−E|)) · smoothstep(0.999, 0.99995, dot(camF, F)) · (1 − smoothstep(0.2, 2.0, |fov − fovCanvas|))`.

---

## 7. Performance budget and quality tiers

### 7.1 Per-module GPU and CPU budget (High, RTX 5060 Laptop, 1920×1080, render scale 1)

| Item | Budget |
|---|---|
| Stroke VS (≈ 170k strokes × 12 verts = 2.0 M verts) | 1.6 ms |
| Stroke FS (A2C 4×, log depth, overdraw ≤ 4 at E, ≤ 6 in the funnel) | 5.0 ms |
| Underlay meshes | 0.3 ms |
| Backdrop | 0.3 ms |
| Dust (30k points) | 0.2 ms |
| MSAA resolve + TexturePass | 0.3 ms |
| Bloom | 1.0 ms |
| Painterly Lens | 0.7 ms |
| Output | 0.2 ms |
| **GPU total** | **≈ 9.6 ms** |
| CPU: director 0.3, uniforms and storm 0.2, three culling and sorting of ≤ 80 objects 0.3, dynamic resolution 0.05 | ≤ 1.5 ms |
| Init: world generation | ≤ 250 ms |
| Init: GPU upload (≈ 11 MB) | ≤ 60 ms |
| Init: shader compile (≈ 5 programs) | ≤ 300 ms |

### 7.2 Class budgets (High) and tier fractions

| Class | High budget (`CLASS_INFO.budgetHigh`) | Medium | Low | Notes |
|---|---|---|---|---|
| UNDERPAINT | 6,000 | 1 | 1 | 3,000 canvas + up to 3,000 extended sky (`SKY_GEN_U`/`SKY_GEN_V`) |
| SKY_BAND | 44,000 | 0.55 | 0.25 | 32,000 canvas + up to 12,000 extended sky |
| SWIRL | 33,000 | 0.6 | 0.3 | 30,000 spiral arms + 3,000 `StrokeFlag.UNDERLAYER` funnel shells |
| EDDY | 6,000 | 0.5 | 0.25 | 4 small vortices |
| STAR_CORE | 2,200 | 1 | 1 | Venus + 10 stars |
| STAR_RING | 14,000 | 1 | 1 | never thinned (prevents dark backing rings from swallowing halo bands) |
| MOON | 1,800 | 1 | 1 | crescent + unlit disc |
| MOON_RING | 4,200 | 1 | 1 | 10 concentric bell rings |
| WIND_JET | 2,400 | 0.6 | 0.35 | 32 filaments × 75 strokes |
| HILL | 16,500 | 0.55 | 0.3 | 15,000 slope + crest strokes + 1,500 `StrokeFlag.UNDERLAYER` ridge fill |
| GROUND | 8,000 | 0.55 | 0.25 | foreground fields |
| GROVE | 6,000 | 0.55 | 0.3 | olive/cypress groves & near interior solids (`200–7,500 m`) |
| HOUSE | 14,000 | 0.6 | 0.35 | village walls & gable roofs (`450–2,900 m`) |
| WINDOW | 400 | 1 | 1 | lit windows (`AnimKind.FLICKER`) |
| CHURCH | 3,600 | 0.8 | 0.5 | nave, octagonal shaft & spire (`600–760 m`) |
| CYPRESS | 19,500 | 0.6 | 0.3 | 18,000 flame strokes + 1,500 `StrokeFlag.UNDERLAYER` core fill |
| **Total (`starry`)** | **181,600 budget (`~178,000` generated)** | **≈ 118k** | **≈ 72k** | Companion worlds: `52,000–72,000` strokes |

### 7.3 Tier table

| | High | Medium | Low (Intel UHD) |
|---|---|---|---|
| MSAA / AA | 4× + A2C | 2× + A2C | none; IGN hashed alpha |
| Ribbon segments (verts) | 5 (12) | 4 (10) | 3 (8) |
| Dust | 30k | 16k | 6k |
| Bloom resolution | 0.5 | 0.5 | 0.25 |
| Lens | isophote, OKLab, chroma, 8 taps | isophote, OKLab, 8 taps | 4-tap smear, weave, matte, vignette only |
| Backdrop layers | 2 | 2 | 1 |
| Specular / velocity stretch | on / on | on / on | off / off |
| maxPixelRatio | 1.25 | 1.0 | 1.0 |
| Render scale start / min / max | 1.0 / 0.75 / 1.0 | 0.85 / 0.6 / 1.0 | 0.67 / 0.5 / 0.8 |
| Target frame time | 16.7 ms | 16.7 ms | 22 ms (30–60 fps) |

**Tier detection.**
- Read `WEBGL_debug_renderer_info`:
  - /Intel|UHD|Iris|Mesa|SwiftShader|llvmpipe/i → Low
  - /Apple|Adreno|Mali|Radeon(?!.*RX)/i → Medium
  - otherwise High
- Refine with a 90-frame benchmark during shot 1 (frames 30–120, the worst overdraw case, at E): if the median exceeds 1.3 × target, drop one tier.
- A tier switch only changes instanceCount, the ribbon geometry, the sceneRT sample count and pass flags. No regeneration.

**Dynamic resolution.**
- EMA (α = 0.1) of GPU time, using `EXT_disjoint_timer_query_webgl2` when present, else the rAF delta.
- Quantised steps [0.5, 0.6, 0.67, 0.75, 0.85, 1.0], clamped to the tier range. At most one change per 2 s.
- Step down when EMA > 1.1 × target for 30 frames.
- Step up when (timer query) EMA < 0.7 × target for 120 frames, or (rAF only) dt ≤ 17.5 ms for 300 frames. Revert an up-step and ban up-steps for 10 s if it causes a down-step within 2 s.
- If pinned at the tier minimum for 2 s, drop a tier. Never raise a tier automatically.
- Apply via `renderer.setPixelRatio(min(dpr, q.maxPixelRatio)·scale)` plus `post.setSize`.

---

## 8. Risks and mandatory mitigations

1. **Log depth disables early-Z** (gl_FragDepth). Fill-rate risk, especially on UHD.
   - Mitigations: a cheap loop-free FS; the screen-size alpha window; sub-pixel and behind-camera VS culling; per-class fractions; dynamic resolution.
   - Measure the worst frames (t = 3, 60, 75) on Low. The reversed-depth experiment is optional (§2.5).
2. **The anamorphic lock drifts between TS and GLSL.**
   - Constants come only from `header.ts`.
   - The boot self-test must pass (error < 1e-4), and the CI build runs it headless across all 30 worlds (`scripts/verify-worlds.mjs`).
   - Never hand-copy numbers into GLSL.
3. **Off-axis confetti or cardboard.**
   - Every motif is a coherent surface: funnel wall plus underlayer shell, ring horns on the exact E axis, cypress tubes plus core mesh, sloped hill walls plus backs, solid houses plus cores.
   - Camera paths never view the sky decks edge-on.
   - Storm displacement is a smooth curl field at scale 0.15·d with amplitude ≤ 0.05·d.
4. **Coverage holes at E.** The underpainting at 230–250 km plus the backdrop. The `?overdraw` view must show ≥ 3 layers everywhere in the frame and zero backdrop pixels inside u ∈ [−0.21, 1.21].
5. **Culling pops** from animation, storm and warp. Bounds are set by hand per chunk, including the animation envelope. Inflate by 0.05·dMax during the storm or snap; disable culling when warpK ≠ 1. Never let three compute bounds.
6. **EffectComposer MSAA trap.** Never pass a multisampled target to EffectComposer. The scene renders into its own MSAA target and enters through TexturePass.
7. **A2C without MSAA does nothing.** Low tier must use the IGN hashed discard path (compile-time define `HASHED_ALPHA`).
8. **Bloom whiteout** at Venus and during the snap.
   - Exposure dip (§5.2), isophote banding, specular cap 4, Neutral tone mapping.
   - Acceptance: rings legible at t = 37.6.
9. **Motion sickness.**
   - Roll ≤ 30°, roll rate ≤ 25°/s, yaw pirouette ≤ 33°/s, FOV ≤ 80°.
   - Calm mode and reduced-motion support (including zeroed smear/storm in `CompanionTrack.env` and dampened transition scatter/vortex in `composition.ts`).
   - Velocity and smear reset on cuts (`frame.cut`).
10. **Float time drift.** `uTime` is wrapped to [0, 96). Every periodic term has a period that divides 96: 4, 6, 8, 12, 16, 24, 48, 96.
11. **Composition fidelity.**
    - Star, eddy and ridge numbers are by-eye approximations. Tune only with the `?overlay` landmark view.
    - No reference image ships, and no on-screen text presents paint-order-as-chronology as fact.
12. **Init time on weak CPUs.**
    - Analytic generation only: no per-stroke streamline integration, except the 32 jet filaments. Typed arrays; mulberry32.
    - If generation exceeds 250 ms, time-slice by class across frames during the first-boot lay-in, uploading each chunk once when complete (no partial re-uploads).
    - Status (2026-10-18): not met yet. A world build is still one synchronous task. The lookahead pre-warm runs in an idle callback and is held back for the first ~8 s of a track, so it no longer lands in the lay-in; LRU eviction (`MAX_CACHED_WORLDS = 4`) disposes per-world buffers without touching the shared ribbon geometry.
13. **Sandbox and single-file.**
    - No workers, blob URLs, pointer lock, fullscreen requirement, fetches or assets.
    - Storage only via try/catch, and only for the calm/tier preference.
    - Build with `vite-plugin-singlefile`. The bundle is expected under 1 MB; the hard limit is 16 MB. (2026-10-15 deploy: the web bundle's JS is about 0.98 MB; the single-file size is not tracked yet.)
14. **Parallel drift.** `contracts.ts` is frozen before fan-out. Any change goes through the lead and requires a re-run of the self-test and paint-order assertions.

---

## 9. Integration order and acceptance checklist

### 9.1 Order

1. **Lead:** `contracts.ts`. **M2** shared (mapping, header, flow, uniforms) together with **M1** engine (renderer, tiers, dynamic-resolution skeleton). Gate: round-trip tests pass.
2. **M3** stroke system with a 64-stroke debug generator. **M10** self-test wired up. Gate: invariance error < 1e-4; warp slider at E is pixel-stable.
3. In parallel against StrokeSink and the uniforms:
   - **M4** sky
   - **M5** stars and moon
   - **M6** cypress
   - **M7** land
   - **M8** director, developed against a placeholder scene of landmark spheres at the §2 positions
   - **M9** post, developed against a test scene of HDR quads and the 12 pigment swatches
4. **M10** composition: buildWorld, `assertPaintOrder` (must return []), storm and snap controller, envelopes to uniforms, culling flags.
5. Tuning pass at E with `?overlay`: landmarks, star positions, ridge, cypress silhouette.
6. Performance pass: High on the RTX 5060 Laptop; Low on Intel UHD (`?tier=low` plus a real iGPU). Fix the worst frames at t = 3, 37.6, 60, 75.
7. Single-file build, then a smoke test in an Electron pane and a sandboxed iframe (`sandbox="allow-scripts"`).

### 9.2 Screenshot acceptance (loop clock; first boot noted)

**t = 0 s**
- *First boot:* matte closed at 1.2497 inside 16:9; the dark underpainting composition is visible.
  - By t = 1.0 the swirl and nearby stars have painted in.
  - By t = 2.4 the full painting is present.
  - By t = 3.8 the impasto has inflated, with specular glints.
- *Loop re-entry, or `?t=0` without boot:* the complete painting.
  - Cypress at x 0.05–0.30, crossing the top edge.
  - Venus at (0.30, 0.72) just right of the cypress.
  - 11 haloed stars; crescent moon with a big halo at (0.86, 0.85); double swirl at x 0.30–0.70, y 0.55–0.75.
  - Three ridges at y 0.30–0.40; village with lit windows; steeple at x 0.55 piercing the ridge.
  - Canvas weave and varnish visible.
  - No generic starfield, no backdrop gaps, palette hue within 3°.

**t = 10 s**
- The matte is gone; the painting continues past its old edges to the 16:9 frame with no seams.
- The camera is about 34 m left and slightly raised. The cypress has slid toward the centre and partly covers Venus's halo. The village is shifted slightly; the sky is unchanged. FOV ≈ 39°.

**t = 25 s**
- Mid helix, at about (−83, 108, −225), behind-left of the cypress.
- The frame is filled by writhing dark-green flame tubes with ultramarine outlines; the core mesh blocks see-through.
- The swirl and stars are visible through gaps. House solids on the plain below show real side faces. No pops, no near-plane slicing.

**t = 37.6 s (extra check)**
- Inside the Venus punch: concentric chrome-yellow and blue-green rings are legible through the bloom (isophote bands visible). Not a white frame.

**t = 45 s**
- Pulling out from the Venus horn toward V6. Both great-swirl funnels are emerging as flaring conical helices of white, cerulean and cobalt strokes. The 14 sky decks appear as tilted strata behind, with pigment dust parallax.
- At least one icon in frame (the swirl). No visible chunk culling pops.

**t = 71 s (extra check)**
- From the vortex eye, the throat ring frames the tiny lit village (windows as banded pinpoints, steeple and cypress silhouettes in blue haze).
- The storm is beginning to bend the nave walls.

**t = 96 s (end) = t = 0 (loop)**
- The camera is exactly at E (error < 1e-3 m, < 1e-4 rad), FOV 36°, the matte closed.
- Every stroke is back in register: snap residual 0 by t = 90; the self-test re-run at t = 96 passes.
- The frame differs from the t = 0 re-entry frame only in animated strokes: under 2% of pixels with ΔE > 3 after masking the stream/ring/writhe classes.
- The wrap from t = 96 to t = 0 has no visible discontinuity.

### 9.3 Global acceptance

- **Performance:** High holds 60 fps at 1080p through the whole loop (p95 frame time ≤ 16.7 ms). Low on Intel UHD holds ≥ 30 fps p95 with dynamic resolution, and every set piece is still recognisable on Low.
- **Invariance demo:** in free mode at E, a warp sweep 0 → 1.6 changes no pixel beyond A2C dither; one metre to the side, the world visibly refolds.
- **Hand-off:** every input hands off in ≤ 1 frame. Idle for 12 s rejoins smoothly. Space returns to the eye and the snap re-registers the painting.
- **Build:** a single HTML file under 1 MB (hard limit 16 MB) plus the web bundle (`dist/`); no network requests after load; runs in a sandboxed iframe and in an Electron pane.
- **CI verification:** GitHub Actions (`ci-pages.yml`) runs `scripts/verify-worlds.mjs` in headless Chromium (SwiftShader WebGL 2, which the tier regex treats as Low). It fails on page or console errors, a world whose generator threw, a self-test error ≥ 1e-4, a paint-order violation, a camera not registered at $E$, an unclean Odyssey hold (Act I and *The Starry Night* act), or a blank frame. It records, without judging them, off-$E$ frames and a high-tier set. Pixel-level comparison against golden frames at the §9.2 checkpoints is not in place yet, so the art itself still needs a human look at the uploaded `punctum-30-worlds-screenshots`.

---

## 10. The 5-Chapter, 30-World Van Gogh World System (`src/chapters/*`, `src/audio/*`)

### 10.1 Default Opening vs. Multi-Act Odyssey Choreography

- **Default Opening (`/` or `?mode=theme&path=single`):**
  - Boots directly into standalone *The Starry Night* (`painting = 'starry'`, `pathId = 'single'`, `loopSeconds = 96`, 10 shots) with the 4-second radial lay-in (`uLayIn`) and impasto inflation (`uInflate`) enabled.
  - The 30-painting strip is collapsed behind `🎨 30 幅畫作 ▾` so the opening screen stays uncluttered; from `t ≥ 84 s` of the first loop on, the golden invitation pill `✦ 進入梵谷 30 個世界 · 五章三十幕旅程` is offered, but like the rest of the chrome it is hidden while the painting is registered at $E$ (`data-clean-eye="1"`).
- **Multi-Act Odyssey (`?mode=odyssey`, `900 s` = 30 acts × `30 s`) & Thematic Paths (`compilePathTrack`):**
  - Each 30-second act (`ACT_SECONDS = 30`, timings from `makeChapterTracks(..., 30, 1.6, 21.0, 25.0)` and `evalOdysseyMorph`) follows a 5-stage arc. In free mode the act clock holds before 26.8 and never rewinds:
    1. `τ ∈ [0.0, 1.6)`: Canvas lock at $E$ (with the incoming snap ripple settling).
    2. `τ ∈ [1.6, 21.0)`: Flight through the painting's 3D world (in *The Starry Night* act, the deepest waypoint is `d = 38.5 km`, `lookAt = 44 km`, in front of the 40 km vortex throat, about 0.06 canvas units off its axis).
    3. `τ ∈ [21.0, 25.0)`: Log-polar homecoming to exact registration at $E$. Return to the Eye (Space) flies to the act's pose at `τ = 20.5` and plays it to 25.0; during the hold or a dissolve it lands at $E$ of the painting on screen instead of rewinding.
    4. `τ ∈ [25.0, 26.8)`: **1.8-second Clean Reassembled Hold at $E$** (`uAlign = 1`, `primaryScatter = 0`, `primaryFade = 1`). While `uAlign > 0.72` (and the user hasn't moved the pointer within 2.4 s), `.pn-ui[data-clean-eye="1"]` fades out persistent UI chrome, suppresses 3D portal beacons, and fades golden portal vortex particles to `0`.
    5. `τ ∈ [26.8, 30.0)`: **Dual-World 3D Brushstroke Cross-Dissolve** (`evalOdysseyMorph`) governed by the active `WORLD_GRAPH` edge's Motif Transition Grammar (`light`, `road`, `sky`, `flora`, `dwelling`, `gaze`).

### 10.2 Five Grand Chapters & 30 Iconic Worlds (`DEFAULT_ODYSSEY_SEQUENCE`)

| Chapter | Acts | Worlds (`id` · Year) |
|---|---|---|
| **I · Earth (`earth` · 黑土與人, Nuenen & Antwerp)** | `I`–`IV` (4 Worlds) | `I. potato` (1885) · `II. weaver` (1884) · `III. tower` (1885) · `IV. skull` (1886) |
| **II · Color (`color` · 巴黎與覺醒, Paris & Montmartre)** | `V`–`XI` (7 Worlds) | `V. shoes` (1886) · `VI. galette` (1886) · `VII. paris` (1887) · `VIII. seine` (1887) · `IX. plum` (1887) · `X. tanguy` (1887) · `XI. selfportrait` (1887) |
| **III · Sun (`sun` · 亞爾的黃金時代, Arles)** | `XII`–`XIX` (8 Worlds) | `XII. yellowhouse` (1888) · `XIII. sunflowers` (1888) · `XIV. harvest` (1888) · `XV. sower` (1888) · `XVI. cafe` (1888) · `XVII. nightcafe` (1888) · `XVIII. rhone` (1888) · `XIX. bedroom` (1888) |
| **IV · Cosmos (`cosmos` · 聖雷米的內在宇宙, Saint-Rémy)** | `XX`–`XXV` (6 Worlds) | `XX. starry` (1889) · `XXI. irises` (1889) · `XXII. olive` (1889) · `XXIII. wheat` (1889) · `XXIV. roadcypress` (1890) · `XXV. almond` (1890) |
| **V · Road (`road` · 奧維爾的路與風, Auvers-sur-Oise)** | `XXVI`–`XXX` (5 Worlds) | `XXVI. cottages` (1890) · `XXVII. church` (1890) · `XXVIII. gachet` (1890) · `XXIX. daubigny` (1890) · `XXX. crows` (1890) |

### 10.3 Shader & World-Builder Contracts for Companion Worlds

- **Canvas-authored `VORTEX`/`JET` guard (`src/strokes/glsl/stroke.vert.ts`):**
  - *The Starry Night* encodes procedural `VORTEX`/`RING`/`JET` strokes with `a1 = (L, 0, 0, W)` (`a1.y == 0`), whereas companion worlds author explicit canvas endpoints `(du, dv, dlnd, W)` via `emitCanvasStroke` (`abs(a1.y) >= 1e-5`).
  - For `VORTEX` (SWIRL, EDDY) and `JET` (WIND_JET) the vertex shader runs the procedural Starry re-projection only when `abs(a1.y) <= 1e-7`; otherwise it keeps the stroke's authored canvas position `(u, v, d)`, so companion-world clouds, smoke and rain stay where they were drawn.
  - `RING` (STAR_RING, MOON_RING) has no such guard: it is always re-projected onto the Starry star and moon geometry. Companion worlds must not emit those classes (none do; `emitCustomStar` uses STAR_CORE).
  - The guard is a convention on `a1.y`, not a flag; a stroke-flag bit would be sturdier (open work).
- **Linear-space fog (`src/chapters/suite.ts`):**
  - *The Starry Night*'s `fogNearHex` is `shadeHex(PALETTE.ultramarine, 0.5)`: half of ultramarine in linear light (about `#11204f`), the same value as the `createSharedUniforms` default, so the §4.3 near fog is unchanged by the World System. An earlier value halved the sRGB channels instead, which made every frame away from $E$ darker and less blue.
  - Companion worlds carry their own hand-picked `fogNearHex` / `fogFarHex` values.
- **Starry Night invariants the World System must keep:** near and far fog equal to the §4.3 colours; the `uSkyMode == 0` backdrop path unchanged; the 96 s, 10-shot track as the default opening; nothing that is not paint (beacon, portal motes, chrome, invitation pill) drawn while the painting is registered at $E$; no change to Starry strokes, shaders or generators without a frame comparison at the §9.2 checkpoints.
- **Nocturnal vs. Daylight Portals:**
  - `emitCustomStar` halo horns are reserved exclusively for nocturnal/twilight worlds (`starry`, `rhone`, `cafe`, `roadcypress`, plus scene-matched warm `gapHex` halos in `potato`, `sower`, `nightcafe`, `olive`), never in daylight interiors, portraits, or still lifes.