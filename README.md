# PUNCTUM: The Starry Night, 250 km Deep

A real-time 3D piece built from Van Gogh's *The Starry Night* (1889). About 180,000 procedural brushstrokes sit up to 250 km deep in a 3D world. From one viewpoint (the painter's eye E) they line up exactly into the painting. Anywhere else the painting tears open into a world of paint. A 96-second one-take camera loop goes through it: the canvas paints itself in, the camera climbs the black-flame cypress, rides the wind into Venus's halo tunnel, sees the great swirl as two 50 km maelstroms, falls down one of them, looks back at the village from the eye of the vortex, and returns through a storm until the strokes snap back into the painting.

TypeScript, Vite and three.js r186 (WebGL 2). Everything is procedural: no textures, models or network requests.

## Live Demo

- **Interactive Showcase (GitHub Pages):** <https://taipei49314.github.io/starry-night-3d/>
- **Single-File Bundle (`single.html`):** <https://taipei49314.github.io/starry-night-3d/single.html>

### Provençal Van Gogh Suite (1888–1889)

The engine strings four iconic Provençal masterpieces together through shared 3D anamorphic impasto math, custom camera choreography, and **Storm-Snap Morph** transitions (with automatic **Odyssey Auto-Chaining** enabled by default):

1. **Act I — *Café Terrace at Night* (Arles, Sept 1888):** [`?painting=cafe`](https://taipei49314.github.io/starry-night-3d/?painting=cafe) — golden gaslit awning, cobblestone corridor, and cobalt star canyon (`aspect 0.81`).
2. **Act II — *Starry Night Over the Rhône* (Arles, Sept 1888):** [`?painting=rhone`](https://taipei49314.github.io/starry-night-3d/?painting=rhone) — the seven stars of Ursa Major, Arles embankment gas lamps, shimmering golden water reflection pillars, moored boats, and lovers on the shore (`aspect 1.28`).
3. **Act III — *The Starry Night* (Saint-Rémy, June 1889):** [`?painting=starry`](https://taipei49314.github.io/starry-night-3d/?painting=starry) — the 96-second canonical 250 km deep one-take journey (`aspect 1.2497`).
4. **Act IV — *Wheat Field with Cypresses* (Saint-Rémy, July 1889):** [`?painting=wheat`](https://taipei49314.github.io/starry-night-3d/?painting=wheat) — sunlit turquoise sky, rolling zinc-white cumulus vortex funnels, blue-violet Alpilles ridges, twin dark-emerald cypresses, and wind-swept golden wheat (`aspect 1.27`).

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5199
npm run build:single # one self-contained dist-single/index.html (~740 kB)
```

## Controls

Any input hands control to you; after 12 s idle the camera rejoins the loop.

| Input | Action |
|---|---|
| drag | look |
| W A S D, arrow keys, Q / E | fly (speed scales with distance from E); the wheel sets the speed |
| Alt-drag or right-drag | stir the sky |
| Shift + wheel | depth warp: at E the image does not change; step aside and the world refolds |
| Space | fly back to the painter's eye and re-register the painting |
| `[` / `]` or `PageUp` / `PageDown` | switch between the 4 Provençal paintings via Storm-Snap Morph |
| `O` | toggle Odyssey Auto-Chaining (`∞ 四畫連映`) |
| 1-9, 0 | jump to shot 1-10 |
| C / R | resume the cinematic / restart |
| G | storm |
| M | calm mode (less roll and FOV; the default with reduced motion) |
| H | HUD |

URL flags: `?painting=cafe|rhone|starry|wheat`, `?odyssey=1|0`, `?t=<sec>`, `?free`, `?tier=high|medium|low`, `?calm`, `?hud`, `?overlay` (canvas grid, landmarks, streamlines), `?seed=`, `?freeze` (hold the clock), `?boot=<sec>&freeze` (first-boot sequence at a given second).

## Layout

| Path | Module |
|---|---|
| `src/contracts.ts` | frozen shared types and constants |
| `src/shared/` | canvas-to-world mapping, flow field, palette, RNG, shared uniforms, GLSL prelude (TS and GLSL agree to 1e-6) |
| `src/engine/` | renderer, quality tiers, dynamic resolution |
| `src/strokes/` | instanced stroke buffer, ribbon shader (animation, storm, impasto), underlay material |
| `src/sky/`, `src/celestial/`, `src/earth/` | generators: sky, swirls, wind jet, backdrop, dust; stars and moon; cypress, hills, village |
| `src/chapters/` | multi-painting Provençal suite registry, aspect-invariant stroke emitters, procedural generators & camera tracks for *Café Terrace*, *Rhône*, and *Wheat Field with Cypresses* |
| `src/camera/` | 96 s shot timeline, companion tracks, free flight, rejoin, Provençal Suite Bar & museum title card UI |
| `src/post/` | bloom, painterly lens (isophote halo banding, pigment pull, smear, canvas weave, matte) |
| `src/app/` | world assembly, frame loop, storm and snap, multi-painting Odyssey transitions, self-tests, debug overlay |

`docs/SPEC.md` is the build spec. `docs/*.json` are the module build and fix reports.

## Verification

- `harness/*.html`: per-module test pages. `harness/shared.html` checks the TS/GLSL parity of the mapping and flow field.
- `node tools/shot.mjs "index.html?t=45&freeze&tier=high" --dgpu --out shots/x.png` renders a frame in headless Chrome and prints console errors. `--dgpu` asks for the discrete GPU.
- `python tools/sheet.py out.png <cols> <width> img label ...` builds a contact sheet.

Measured on an RTX 5060 Laptop GPU at 1080p, High tier: about 5.6 ms GPU per frame on the heaviest shots. Intel UHD (auto Low tier): 45-90 fps.
