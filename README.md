# PUNCTUM: The Van Gogh World System, 250 km Deep

A real-time 3D procedural painting universe built from 15 of Vincent van Gogh's iconic masterpieces (1885–1890). Up to 180,000 procedural brushstrokes per painting sit up to 250 km deep in a 3D world. From one viewpoint (the painter's eye $E$) they line up into the painting; anywhere else the painting tears open into a living world of impasto paint, spatial portals, and procedural Web Audio soundscapes.

TypeScript, Vite and three.js r186 (WebGL 2). Everything—3D brushstrokes, camera paths, and spatial audio—is 100% procedural: zero textures, external models, or audio files.

## Live Demo

- **Interactive Showcase (GitHub Pages):** <https://taipei49314.github.io/starry-night-3d/>
- **Single-File Bundle (`single.html`):** <https://taipei49314.github.io/starry-night-3d/single.html>

---

## Architecture: The 4-Level Van Gogh World System

### Level 1 — Single Painting = An Enterable 3D World
Every painting is an independent 3D space with its own canvas aspect ratio, brushwork DNA, atmospheric fog, lighting, procedural Web Audio soundscape, and **Diegetic Spatial Portals** (`portalIn` / `portalOut`).

### Level 2 — Multi-Painting = Dynamic Thematic Paths (`compilePathTrack`)
Instead of a single rigid sequence, paintings are connected in a directed **Van Gogh World Graph (`WORLD_GRAPH`)**. The dynamic path compiler `compilePathTrack(sequence)` weaves any sequence of paintings into a continuous one-take 3D camera trajectory with **Dual-World 3D Brushstroke Cross-Dissolve** transitions.

### Level 3 — Five Grand Chapters (1885–1890, 15 Worlds)

| Chapter | Era & Theme | Worlds |
|---|---|---|
| **Chapter I · Earth (`earth`)** | **黑土與人** · Nuenen (1883–1886)<br>Peat-umber chiaroscuro, heavy palette-knife strokes, oil lamp & earthen studio | **I. *The Potato Eaters* (`?painting=potato`)** — Low timber cottage rafters, hanging oil-lamp portal, steaming potatoes, and five peasant figures (`aspect 1.38`).<br>**II. *A Pair of Shoes* (`?painting=shoes`)** — Mud-caked, deeply creased peasant leather work boots, hobnailed copper sole, and untied laces snaking toward a golden doorway portal (`aspect 1.25`). |
| **Chapter II · Color (`color`)** | **巴黎與覺醒** · Paris (1886–1888)<br>Divisionist pointillist strokes, radial self-portrait aura, complementary color vibration | **III. *Boulevard de Clichy* (`?painting=paris`)** — Sunlit pastel-blue & coral-peach divisionist avenue, Haussmann facades, spring trees, and strollers (`aspect 1.29`).<br>**IV. *Self-Portrait with Straw Hat* (`?painting=selfportrait`)** — Radial swirling cobalt-turquoise aura, woven golden straw hat, fiery ginger beard, and piercing emerald-viridian gaze portal (`aspect 0.81`). |
| **Chapter III · Sun (`sun`)** | **亞爾的黃金時代** · Arles (1888–1889)<br>High-chroma yellow vs. cobalt night, solar blooms, gaslight halos, intimate sanctuary | **V. *Sunflowers* (`?painting=sunflowers`)** — Sulfur-yellow basket-weave wall, *Vincent*-signed two-tone vase, and 15 sculptural golden-chrome & mahogany-seeded sunflowers (`aspect 0.79`).<br>**VI. *Café Terrace at Night* (`?painting=cafe`)** — Golden gaslit awning, cobblestone street, and star canyon (`aspect 0.81`).<br>**VII. *Starry Night Over the Rhône* (`?painting=rhone`)** — Ursa Major, embankment gas lamps, shimmering water reflections, and lovers (`aspect 1.28`).<br>**VIII. *The Bedroom in Arles* (`?painting=bedroom`)** — Lavender walls, scarlet bed, yellow chairs, and half-open green window shutters (`aspect 1.26`). |
| **Chapter IV · Cosmos (`cosmos`)** | **聖雷米的內在宇宙** · Saint-Rémy (1889–1890)<br>250 km twin-swirl flow fields, asylum garden irises, flame cypresses, blossoming boughs | **IX. *The Starry Night* (`?painting=starry`)** — The canonical 250 km nocturnal vortex, black-flame cypress, and village (`aspect 1.25`).<br>**X. *Irises* (`?painting=irises`)** — Terracotta garden soil, arching sage-emerald sword leaves, 32 violet bearded irises, and the solitary Pearl-White Iris portal (`aspect 1.27`).<br>**XI. *Wheat Field with Cypresses* (`?painting=wheat`)** — Turquoise sky, white cumulus vortex, Alpilles hills, and golden wheat (`aspect 1.27`).<br>**XII. *Almond Blossom* (`?painting=almond`)** — 3D gnarled branches, 175 five-petal pearl blossom clusters, and drifting petals (`aspect 1.26`). |
| **Chapter V · Road (`road`)** | **奧維爾的路與風** · Auvers-sur-Oise (1890)<br>Forking paths, melancholic portraits, 2:1 widescreen storm tension | **XIII. *The Church at Auvers* (`?painting=church`)** — Ultramarine sky, forking sandy roads, writhing Gothic apse, and bell tower (`aspect 0.78`).<br>**XIV. *Portrait of Dr. Gachet* (`?painting=gachet`)** — Undulating two-toned blue backdrop, tilted vermilion table, two yellow novels, purple Foxglove sprig, and Dr. Gachet's melancholic gaze (`aspect 0.81`).<br>**XV. *Wheatfield with Crows* (`?painting=crows`)** — Storm sky, three diverging paths through 26,000 wheat stalks, and 52 flapping crows returning to the dark earth of Nuenen (`aspect 1.98`). |

### Six Motif Backbones & Transition Grammars (`MOTIF_SPECS` & `MOTIF_TRANSITION_GRAMMARS`)
Every edge in `WORLD_GRAPH` carries one of six motifs, each driving its own **3D Brushstroke Transition Grammar** (modulating scatter amplitude, radial speed smear, bloom surge, pigment dust drift, depth-warp folding `uWarpK`, portal sky-stirring `uStir`, and portal-centered snap condensation waves):
1. **✦ Light (`light` · 光暈綻放轉場 *Radiant Halo Dissolve*)** — Oil lamp, golden sunflowers, gas lamp, star halos, crescent moon, Provençal sun, stained glass.
2. **⟁ Road (`road` · 長路推進轉場 *Perspective Glide*)** — Worn peasant boots, Parisian boulevard, cobblestone alley, Rhône embankment, church fork, three wheat paths.
3. **◎ Sky (`sky` · 天空渦流轉場 *Celestial Vortex Unbind*)** — Pointillist morning sky, twin nocturnal maelstroms, cumulus vortices, turquoise spring sky, storm clouds.
4. **❀ Flora (`flora` · 繁花隨風轉場 *Botanical Wind Drift*)** — Potatoes of the earth, sunflowers, violet & white irises, flame cypresses, golden wheat, almond blossoms, foxglove.
5. **⌂ Dwelling (`dwelling` · 門廊框景轉場 *Threshold Frame Fold*)** — Peasant cottage table, street-corner café, Arles bedroom, Gothic church at Auvers.
6. **❖ Gaze (`gaze` · 瞳孔凝視轉場 *Ocular Iris Tunnel*)** — Self-portrait emerald eyes, Dr. Gachet's melancholic gaze, half-open window shutters, street vanishing points.

### Universe Coherence Systems
- **Multi-Era 360° Sphere Backdrop (`src/sky/backdrop.ts`)**: The full-sphere directional splat pass at infinity dynamically harmonizes its sky bands, underpainting, and earth strokes with each painting's era palette (`uFogNear` / `uFogFar`), while keeping *The Starry Night* (`uSkyMode == 0`) 100% identical to its calibrated reference.
- **In-Scene 3D Spatial Portal Beacon (`projectPortalBeacon`)**: Projects the active painting's 3D portal coordinate (`spec.moonUVD`) onto screen space during Free mode or the Portal Approach window, allowing viewers to click the glowing 3D portal (or press `Enter`) to leap directly into the connected painting.
- **Dynamic World Graph Path Weaver (`weaveGraphPath`)**: Starting from any painting and optional motif filter, weaves a custom 6-Act continuous journey along valid `WORLD_GRAPH` neighbor edges (`✨ 智能編織 (6幕)`).

### Three Viewing Modes (`ViewMode`)
- **Mode A — Odyssey Mode (`?mode=odyssey`)**: Complete 5-Chapter, 15-Act continuous feature film (`450 s`).
- **Mode B — Atlas Mode (`?mode=atlas` or shortcut `U`)**: Interactive **Van Gogh World Graph Atlas** displaying the 5 Grand Chapters, 6 Motif filters, portal inspectors, clickable **Connected Neighbor Portals**, and one-click **Dynamic 6-Act Graph Weaving**.
- **Mode C — Theme Path Mode (`?mode=theme&path=nights|roads|dwellings|flora|gaze|woven|single`)**: Curated and dynamically woven journeys across the World Graph:
  - `✦ 光與夜之路 (Nights, Lamps & Suns)`: `potato → sunflowers → cafe → rhone → starry → crows`
  - `⟁ 道路與遠方 (Shoes, Roads & Horizons)`: `shoes → paris → cafe → rhone → church → crows`
  - `⌂ 居所與聖殿 (Rooms & Sanctuaries)`: `potato → sunflowers → cafe → bedroom → church`
  - `❀ 黑土、繁花與風 (Earth, Blossoms & Wind)`: `potato → sunflowers → irises → wheat → almond → crows`
  - `❖ 凝視與靈魂 (Gaze, Portraits & Mirrors)`: `potato → selfportrait → bedroom → gachet → starry`
  - `✨ 智能編織 (Dynamic Woven 6-Act Path)`: Dynamically woven 6-Act journey along `WORLD_GRAPH` edges from the current painting.
  - `◎ 單幅沉浸循環 (Single World Loop)`: Continuous standalone loop of the active painting.

---

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5199
npm run build:single # one self-contained dist-single/index.html (~860 kB)
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
| `Enter` or click 3D Portal Beacon | leap through the active painting's 3D Spatial Portal when the beacon is visible |
| `[` / `]` or `PageUp` / `PageDown` | switch to previous / next painting in the active sequence via 6-Motif 3D Brushstroke Cross-Dissolve |
| `O` | toggle 5-Chapter 15-Act Odyssey (`∞ 五章十五幕`) vs. single-painting loop (`◎ 單幅沉浸循環`) |
| `U` | toggle the interactive **Van Gogh World Graph Atlas (`🌌 宇宙星圖`)** |
| `V` | toggle 15-World Procedural Soundscape (`♪ 聲景：開 / 靜音`) |
| Scrubber Timeline (bottom) | drag or click anywhere along the active Odyssey / Theme Path timeline |
| 1-9, 0 | jump to shot 1-10 |
| C / R | resume the cinematic / restart |
| G | storm |
| M | calm mode (less roll and FOV; the default with reduced motion) |
| H | HUD |

URL flags: `?painting=potato|shoes|paris|selfportrait|sunflowers|cafe|rhone|bedroom|starry|irises|wheat|almond|church|gachet|crows`, `?mode=odyssey|theme|atlas`, `?path=odyssey|nights|roads|dwellings|flora|gaze|woven|single`, `?odyssey=1|0`, `?t=<sec>`, `?free`, `?tier=high|medium|low`, `?calm`, `?hud`, `?overlay`, `?seed=`, `?freeze`, `?boot=<sec>&freeze`.
