# PUNCTUM: The Van Gogh World System, 250 km Deep

A real-time 3D procedural painting universe built from Vincent van Gogh's masterpieces (1885–1890). Up to 180,000 procedural brushstrokes per painting sit up to 250 km deep in a 3D world. From one viewpoint (the painter's eye $E$) they line up into the painting; anywhere else the painting tears open into a living world of impasto paint, spatial portals, and procedural Web Audio soundscapes.

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

### Level 3 — Five Grand Chapters (1885–1890, 10 Worlds)

| Chapter | Era & Theme | Worlds |
|---|---|---|
| **Chapter I · Earth (`earth`)** | **黑土與人** · Nuenen (1883–1885)<br>Peat-umber chiaroscuro, heavy palette-knife strokes, single oil lamp warmth | **I. *The Potato Eaters* (`?painting=potato`)** — Low timber cottage rafters, hanging oil-lamp portal, steaming potatoes, and five peasant figures (`aspect 1.38`). |
| **Chapter II · Color (`color`)** | **巴黎與覺醒** · Paris (1886–1888)<br>Divisionist pointillist strokes, complementary color vibration, open boulevard | **II. *Boulevard de Clichy* (`?painting=paris`)** — Sunlit pastel-blue & coral-peach divisionist avenue, Haussmann facades, spring trees, and strollers (`aspect 1.29`). |
| **Chapter III · Sun (`sun`)** | **亞爾的黃金時代** · Arles (1888–1889)<br>High-chroma yellow vs. cobalt night, gaslight halos, intimate sanctuary | **III. *Café Terrace at Night* (`?painting=cafe`)** — Golden gaslit awning, cobblestone street, and star canyon (`aspect 0.81`).<br>**IV. *Starry Night Over the Rhône* (`?painting=rhone`)** — Ursa Major, embankment gas lamps, shimmering water reflections, and lovers (`aspect 1.28`).<br>**V. *The Bedroom in Arles* (`?painting=bedroom`)** — Lavender walls, scarlet bed, yellow chairs, and half-open green window shutters (`aspect 1.26`). |
| **Chapter IV · Cosmos (`cosmos`)** | **聖雷米的內在宇宙** · Saint-Rémy (1889–1890)<br>250 km twin-swirl flow fields, flame cypresses, blossoming boughs | **VI. *The Starry Night* (`?painting=starry`)** — The canonical 250 km nocturnal vortex, black-flame cypress, and village (`aspect 1.25`).<br>**VII. *Wheat Field with Cypresses* (`?painting=wheat`)** — Turquoise sky, white cumulus vortex, Alpilles hills, and golden wheat (`aspect 1.27`).<br>**VIII. *Almond Blossom* (`?painting=almond`)** — 3D gnarled branches, 175 five-petal pearl blossom clusters, and drifting petals (`aspect 1.26`). |
| **Chapter V · Road (`road`)** | **奧維爾的路與風** · Auvers-sur-Oise (1890)<br>Forking paths, low tempestuous horizons, 2:1 widescreen wind tension | **IX. *The Church at Auvers* (`?painting=church`)** — Ultramarine sky, forking sandy roads, writhing Gothic apse, and bell tower (`aspect 0.78`).<br>**X. *Wheatfield with Crows* (`?painting=crows`)** — Storm sky, three diverging paths through 26,000 wheat stalks, and 52 flapping crows returning to the dark earth of Nuenen (`aspect 1.98`). |

### Six Motif Backbones (`MOTIF_SPECS`)
1. **✦ Light (`light`)** — Oil lamp, gas lamp, star halos, crescent moon, Provençal sun, stained glass.
2. **⟁ Road (`road`)** — Parisian boulevard, cobblestone alley, Rhône embankment, church fork, three wheat paths.
3. **◎ Sky (`sky`)** — Pointillist morning sky, twin nocturnal maelstroms, cumulus vortices, turquoise spring sky, storm clouds.
4. **❀ Flora (`flora`)** — Potatoes of the earth, budding boulevard trees, flame cypresses, golden wheat, almond blossoms.
5. **⌂ Dwelling (`dwelling`)** — Peasant cottage table, street-corner café, Arles bedroom, Gothic church at Auvers.
6. **❖ Gaze (`gaze`)** — Half-open window shutters, paintings-within-paintings, street vanishing points, distant horizons.

### Three Viewing Modes (`ViewMode`)
- **Mode A — Odyssey Mode (`?mode=odyssey`)**: Complete 5-Chapter, 10-Act continuous feature film (`300 s`).
- **Mode B — Atlas Mode (`?mode=atlas` or shortcut `U`)**: Interactive **Van Gogh World Graph Atlas** displaying the 5 Grand Chapters, 6 Motif filters, portal inspectors, and clickable **Connected Neighbor Portals**.
- **Mode C — Theme Path Mode (`?mode=theme&path=nights|roads|dwellings|flora|single`)**: Curated thematic journeys across the World Graph:
  - `✦ 光與夜之路 (Nights & Lamps)`: `potato → cafe → rhone → starry → crows`
  - `⟁ 道路與遠方 (Roads & Horizons)`: `paris → cafe → rhone → church → crows`
  - `⌂ 居所與視線 (Rooms & Sanctuaries)`: `potato → cafe → bedroom → church`
  - `❀ 黑土繁花與風 (Earth to Blossoms)`: `potato → paris → wheat → almond → crows`
  - `◎ 單幅沉浸循環 (Single World Loop)`: Continuous standalone loop of the active painting.

---

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5199
npm run build:single # one self-contained dist-single/index.html (~820 kB)
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
| `[` / `]` or `PageUp` / `PageDown` | switch to previous / next painting in the active sequence via 3D Brushstroke Cross-Dissolve |
| `O` | toggle 5-Chapter 10-Act Odyssey (`∞ 五章史詩`) vs. single-painting loop (`◎ 單幅沉浸循環`) |
| `U` | toggle the interactive **Van Gogh World Graph Atlas (`🌌 宇宙星圖`)** |
| `V` | toggle 10-World Procedural Soundscape (`♪ 聲景：開 / 靜音`) |
| Scrubber Timeline (bottom) | drag or click anywhere along the active Odyssey / Theme Path timeline |
| 1-9, 0 | jump to shot 1-10 |
| C / R | resume the cinematic / restart |
| G | storm |
| M | calm mode (less roll and FOV; the default with reduced motion) |
| H | HUD |

URL flags: `?painting=potato|paris|cafe|rhone|bedroom|starry|wheat|almond|church|crows`, `?mode=odyssey|theme|atlas`, `?path=odyssey|nights|roads|dwellings|flora|single`, `?odyssey=1|0`, `?t=<sec>`, `?free`, `?tier=high|medium|low`, `?calm`, `?hud`, `?overlay`, `?seed=`, `?freeze`, `?boot=<sec>&freeze`.
