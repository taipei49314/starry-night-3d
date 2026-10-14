# PUNCTUM: The Starry Night, 250 km Deep

A real-time 3D piece built from Van Gogh's *The Starry Night* (1889). About 180,000 procedural brushstrokes sit up to 250 km deep in a 3D world. From one viewpoint (the painter's eye E) they line up exactly into the painting. Anywhere else the painting tears open into a world of paint. A 96-second one-take camera loop goes through it: the canvas paints itself in, the camera climbs the black-flame cypress, rides the wind into Venus's halo tunnel, sees the great swirl as two 50 km maelstroms, falls down one of them, looks back at the village from the eye of the vortex, and returns through a storm until the strokes snap back into the painting.

TypeScript, Vite and three.js r186 (WebGL 2). Everything is procedural: no textures, models or network requests.

## Live Demo

- **Interactive Showcase (GitHub Pages):** <https://taipei49314.github.io/starry-night-3d/>
- **Single-File Bundle (`single.html`):** <https://taipei49314.github.io/starry-night-3d/single.html>

### Eight-Act Van Gogh Odyssey (1888–1890)

The engine weaves eight iconic Van Gogh masterpieces (spanning Arles, Saint-Rémy, and Auvers-sur-Oise) into a continuous 240-second one-take 3D animation (`ODYSSEY_TRACK`) through shared 3D anamorphic impasto math, **Diegetic Spatial Portal** camera choreography, and **Dual-World 3D Brushstroke Cross-Dissolve** transitions:

1. **Act I — *Café Terrace at Night* (Arles, Sept 1888):** [`?painting=cafe`](https://taipei49314.github.io/starry-night-3d/?painting=cafe) — golden gaslit awning, cobblestone corridor, and cobalt star canyon (`aspect 0.81`). *Portal: fly down the street-end star canyon toward the Rhône embankment.*
2. **Act II — *Starry Night Over the Rhône* (Arles, Sept 1888):** [`?painting=rhone`](https://taipei49314.github.io/starry-night-3d/?painting=rhone) — the seven stars of Ursa Major, Arles embankment gas lamps, shimmering golden water reflection pillars, moored boats, and lovers on the shore (`aspect 1.28`). *Portal: glide across the water reflections into the warm embankment window light.*
3. **Act III — *The Bedroom in Arles* (Arles, Oct 1888):** [`?painting=bedroom`](https://taipei49314.github.io/starry-night-3d/?painting=bedroom) — perspective floorboards, lavender-blue plaster walls, scarlet-blanketed oak bed, yellow cane chairs, washstand pitcher, and half-open green window shutters (`aspect 1.26`). *Portal: push through the half-open green shutters into the Saint-Rémy night sky.*
4. **Act IV — *The Starry Night* (Saint-Rémy, June 1889):** [`?painting=starry`](https://taipei49314.github.io/starry-night-3d/?painting=starry) — the canonical 250 km deep nocturnal vortex, black-flame cypress, and glowing village (`aspect 1.2497`). *Portal: ascend into the blazing orange crescent moon as night turns into Provençal day.*
5. **Act V — *Wheat Field with Cypresses* (Saint-Rémy, July 1889):** [`?painting=wheat`](https://taipei49314.github.io/starry-night-3d/?painting=wheat) — sunlit turquoise sky, rolling zinc-white cumulus vortex funnels, blue-violet Alpilles ridges, twin dark-emerald cypresses, and wind-swept golden wheat (`aspect 1.27`). *Portal: rise into the white cumulus cloud vortex toward the spring blossom sky.*
6. **Act VI — *Almond Blossom* (Saint-Rémy, Feb 1890):** [`?painting=almond`](https://taipei49314.github.io/starry-night-3d/?painting=almond) — turquoise spring sky, 3D gnarled almond branches, 175 five-petal pearl-white and blush-rose blossom clusters, and drifting petals (`aspect 1.26`). *Portal: weave through the uppermost blooming boughs into the northern sky.*
7. **Act VII — *The Church at Auvers* (Auvers-sur-Oise, June 1890):** [`?painting=church`](https://taipei49314.github.io/starry-night-3d/?painting=church) — brooding ultramarine cobalt sky, forking golden-ochre sandy paths, writhing Gothic apse & buttresses, lancet stained-glass windows, and soaring bell-tower spire (`aspect 0.78`). *Portal: climb past the spire cross into the gathering storm clouds.*
8. **Act VIII — *Wheatfield with Crows* (Auvers-sur-Oise, July 1890):** [`?painting=crows`](https://taipei49314.github.io/starry-night-3d/?painting=crows) — tempestuous midnight-Prussian storm sky, three diverging crimson-sienna & emerald paths through 26,000 wind-lashed golden wheat stalks, and 52 flapping 3D black crows (`aspect 1.98`). *Portal: rise with the flock of crows into the midnight horizon, returning to the warm lantern of Café Terrace.*

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5199
npm run build:single # one self-contained dist-single/index.html (~780 kB)
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
| `[` / `]` or `PageUp` / `PageDown` | switch between the 8 paintings via 3D Brushstroke Cross-Dissolve |
| `O` | toggle 8-Act Continuous Odyssey (`∞ 八幕連貫史詩`) vs. single-painting loop (`單幅循環模式`) |
| `V` | toggle 8-Act Procedural Soundscape (`♪ 聲景：開 / 靜音`) |
| Scrubber Timeline (bottom) | drag or click anywhere along the 240 s 8-Act Odyssey timeline |
| 1-9, 0 | jump to shot 1-10 |
| C / R | resume the cinematic / restart |
| G | storm |
| M | calm mode (less roll and FOV; the default with reduced motion) |
| H | HUD |

URL flags: `?painting=cafe|rhone|bedroom|starry|wheat|almond|church|crows`, `?odyssey=1|0`, `?t=<sec>`, `?free`, `?tier=high|medium|low`, `?calm`, `?hud`, `?overlay` (canvas grid, landmarks, streamlines), `?seed=`, `?freeze` (hold the clock), `?boot=<sec>&freeze` (first-boot sequence at a given second).

## Layout

| Path | Module |
|---|---|
| `src/contracts.ts` | frozen shared types and constants |
| `src/shared/` | canvas-to-world mapping, flow field, palette, RNG, shared uniforms, GLSL prelude (TS and GLSL agree to 1e-6) |
| `src/engine/` | renderer, quality tiers, dynamic resolution |
| `src/strokes/` | instanced stroke buffer, ribbon shader (animation, storm, impasto, layer cross-dissolve), underlay material |
| `src/sky/`, `src/celestial/`, `src/earth/` | generators: sky, swirls, wind jet, backdrop, dust; stars and moon; cypress, hills, village |
| `src/chapters/` | 8-Act Van Gogh Odyssey registry, aspect-invariant stroke emitters, procedural 3D generators & Diegetic Spatial Portal camera choreography |
| `src/audio/` | 100% procedural Web Audio soundscape engine (8-Act harmonic drones, stereo reverb, river waves, wheat surf, bronze church bells, crow wings, flight wind & sky-stirring chimes) |
| `src/camera/` | shot timeline, Odyssey track, free flight, rejoin, 8-Act Suite Bar, interactive timeline scrubber & museum title card UI |
| `src/post/` | bloom, painterly lens (isophote halo banding, pigment pull, smear, canvas weave, matte) |
| `src/app/` | world assembly, frame loop, dual-world 3D brushstroke cross-dissolve, smart lookahead pre-warming + LRU cache, self-tests, debug overlay |

`docs/SPEC.md` is the build spec. `docs/*.json` are the module build and fix reports.

## Verification

- `harness/*.html`: per-module test pages. `harness/shared.html` checks the TS/GLSL parity of the mapping and flow field.
- `node tools/shot.mjs "index.html?t=45&freeze&tier=high" --dgpu --out shots/x.png` renders a frame in headless Chrome and prints console errors. `--dgpu` asks for the discrete GPU.
- `python tools/sheet.py out.png <cols> <width> img label ...` builds a contact sheet.

Measured on an RTX 5060 Laptop GPU at 1080p, High tier: about 5.6 ms GPU per frame on the heaviest shots. Intel UHD (auto Low tier): 45-90 fps.
