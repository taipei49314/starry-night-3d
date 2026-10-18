# PUNCTUM: The Van Gogh World System, 250 km Deep (5 Chapters · 30 Iconic Worlds)

A real-time 3D procedural painting universe built from **30 of Vincent van Gogh's iconic masterpieces (1884–1890)**. About **181,000** procedural brushstrokes in *The Starry Night* and roughly 47,000–130,000 in each companion world (each CI run's `verification-report.json` lists the exact count per world) sit up to 250 km deep in a 3D world. From one viewpoint (the painter's eye $E$) they line up into the painting; anywhere else the painting tears open into a living world of impasto paint, spatial portals, 3D vortex particles, and procedural Web Audio soundscapes.

Opening the app launches directly into the signature **96-second, 10-shot standalone *The Starry Night*** (`?mode=theme&path=single`) with its 4-second radial lay-in and impasto inflation opener, then invites you at the end of the loop (`✦ 進入梵谷 30 個世界 · 五章三十幕旅程`) into the 30-World Odyssey.

TypeScript, Vite and three.js r186 (WebGL 2). Everything—3D brushstrokes, camera paths, and spatial audio—is 100% procedural: zero textures, external models, or audio files.

## Live Demo

- **Interactive Showcase (GitHub Pages):** <https://taipei49314.github.io/starry-night-3d/>
- **Single-File Bundle (`single.html`):** <https://taipei49314.github.io/starry-night-3d/single.html>

---

## Architecture: The 4-Level Van Gogh World System

### Level 1 — Single Painting = An Enterable 3D World
Every painting is an independent 3D space with its own canvas aspect ratio, brushwork DNA, atmospheric fog, lighting, procedural Web Audio soundscape, and **Diegetic Spatial Portals** (`portalIn` / `portalOut`).

### Level 2 — Multi-Painting = Dynamic Thematic Paths (`compilePathTrack`)
Instead of a single rigid sequence, all 30 paintings are connected in a directed **Van Gogh World Graph (`WORLD_GRAPH`)**. The dynamic path compiler `compilePathTrack(sequence)` weaves any sequence of paintings into a continuous one-take 3D camera trajectory (`30 s` per act). Each act flies deep into the painting's 3D world (including the 40 km Great Vortex in *The Starry Night*), returns to exact registration at the painter's eye $E$ at `25.0 s`, **holds the reassembled painting cleanly at $E$ for `1.8 s` (`25.0–26.8 s`)** with all floating portal labels, golden vortex particles, and UI chrome suppressed, and then performs a **Dual-World 3D Brushstroke Cross-Dissolve** (`26.8–30.0 s`) into the next painting.

### Level 3 — Five Grand Chapters (1884–1890, 30 Worlds `I`–`XXX`)

| Chapter | Era & Theme | 30 Iconic Worlds (`?painting=<id>`) |
|---|---|---|
| **Chapter I · Earth (`earth`)** | **黑土與人** · Nuenen & Antwerp (1884–1886, 4 Worlds)<br>Peat-umber chiaroscuro, heavy palette-knife strokes, loom timbers, church tower & academy skeleton | **I. *The Potato Eaters* (`potato`, 1885)** · **II. *The Weaver* (`weaver`, 1884)** · **III. *The Old Church Tower at Nuenen* (`tower`, 1885)** · **IV. *Skull of a Skeleton with Burning Cigarette* (`skull`, 1886)** |
| **Chapter II · Color (`color`)** | **巴黎與覺醒** · Paris & Montmartre (1886–1888, 7 Worlds)<br>Parisian studio boots, divisionist pointillist strokes, Seine reflections & steam train, Japonaiserie rain, radial self-portrait aura | **V. *A Pair of Shoes* (`shoes`, 1886)** · **VI. *Le Moulin de la Galette* (`galette`, 1886)** · **VII. *Boulevard de Clichy* (`paris`, 1887)** · **VIII. *Bridges across the Seine at Asnières* (`seine`, 1887)** · **IX. *Bridge in the Rain (after Hiroshige)* (`plum`, 1887)** · **X. *Portrait of Père Tanguy* (`tanguy`, 1887)** · **XI. *Self-Portrait with Straw Hat* (`selfportrait`, 1887)** |
| **Chapter III · Sun (`sun`)** | **亞爾的黃金時代** · Arles (1888–1889, 8 Worlds)<br>High-chroma yellow vs. cobalt night, solar blooms, harvest plains, gaslight halos, intimate sanctuary | **XII. *The Yellow House* (`yellowhouse`, 1888)** · **XIII. *Sunflowers* (`sunflowers`, 1888)** · **XIV. *The Harvest at La Crau* (`harvest`, 1888)** · **XV. *The Sower at Sunset* (`sower`, 1888)** · **XVI. *Café Terrace at Night* (`cafe`, 1888)** · **XVII. *The Night Café* (`nightcafe`, 1888)** · **XVIII. *Starry Night Over the Rhône* (`rhone`, 1888)** · **XIX. *The Bedroom in Arles* (`bedroom`, 1888)** |
| **Chapter IV · Cosmos (`cosmos`)** | **聖雷米的內在宇宙** · Saint-Rémy (1889–1890, 6 Worlds)<br>250 km twin-swirl flow fields, asylum garden irises, writhing olive groves, flame cypresses, blossoming boughs | **XX. *The Starry Night* (`starry`, 1889)** · **XXI. *Irises* (`irises`, 1889)** · **XXII. *Olive Trees with Yellow Sky and Sun* (`olive`, 1889)** · **XXIII. *Wheat Field with Cypresses* (`wheat`, 1889)** · **XXIV. *Road with Cypress and Star* (`roadcypress`, 1890)** · **XXV. *Almond Blossom* (`almond`, 1890)** |
| **Chapter V · Road (`road`)** | **奧維爾的路與風** · Auvers-sur-Oise (1890, 5 Worlds)<br>Thatch cottages, Gothic apse, melancholic portraits, garden sanctuary, 2:1 widescreen storm tension | **XXVI. *Thatched Cottages at Cordeville* (`cottages`, 1890)** · **XXVII. *The Church at Auvers* (`church`, 1890)** · **XXVIII. *Portrait of Dr. Gachet* (`gachet`, 1890)** · **XXIX. *Daubigny's Garden* (`daubigny`, 1890)** · **XXX. *Wheatfield with Crows* (`crows`, 1890)** |

### Six Motif Backbones & Transition Grammars (`MOTIF_SPECS` & `MOTIF_TRANSITION_GRAMMARS`)
Every edge in `WORLD_GRAPH` carries one of six motifs, each driving its own **3D Brushstroke Transition Grammar** (modulating scatter amplitude, radial speed smear, bloom surge, pigment dust drift, depth-warp folding `uWarpK`, portal sky-stirring `uStir`, 3D Portal Vortex trajectories, and Web Audio musical bridges):
1. **✦ Light (`light` · 光暈綻放轉場 *Radiant Halo Dissolve*)** — Oil lamp, cigarette ember, golden sunflowers, Provençal sun, gas lamp, billiard lamp, star halos, crescent moon.
2. **⟁ Road (`road` · 長路推進轉場 *Perspective Glide*)** — Worn peasant boots, Montmartre slope, Parisian boulevard, Asnières riverbanks, La Crau plains, cypress road, church fork, three wheat paths.
3. **◎ Sky (`sky` · 天空渦流轉場 *Celestial Vortex Unbind*)** — Pointillist morning sky, twin nocturnal maelstroms, amber olive-grove sky, cumulus vortices, turquoise spring sky, storm clouds.
4. **❀ Flora (`flora` · 繁花隨風轉場 *Botanical Wind Drift*)** — Potatoes of the earth, plum blossoms in rain, sunflowers, violet & white irises, gnarled olive trees, flame cypresses, golden wheat, almond blossoms, foxglove, Daubigny's roses.
5. **⌂ Dwelling (`dwelling` · 門廊框景轉場 *Threshold Frame Fold*)** — Peasant cottage table, oak loom, church tower, Moulin de la Galette, Yellow House, street-corner café, Night Café, Arles bedroom, Cordeville thatched cottages, Gothic church at Auvers.
6. **❖ Gaze (`gaze` · 瞳孔凝視轉場 *Ocular Iris Tunnel*)** — Skeleton skull sockets, Père Tanguy's gentle gaze, self-portrait emerald eyes, half-open window shutters, Dr. Gachet's melancholic gaze.

### Universe Coherence & Performance Systems
- **Multi-Era 360° Sphere Backdrop (`src/sky/backdrop.ts`)**: Full-sphere directional splat pass at infinity dynamically harmonizes with each painting's era palette (`uFogNear` / `uFogFar`), while keeping *The Starry Night* (`uSkyMode == 0`) 100% identical to its calibrated reference.
- **3D Spatial Portal Motif Vortex (`src/sky/portalVortex.ts`)**: GPU-driven 3D vortex particle system anchored at `uMoonPos` that shapes its orbital trajectory and color palette to the active transition edge's motif (`light`, `road`, `sky`, `flora`, `dwelling`, `gaze`), while staying 100% invisible at the painter's eye $E$.
- **6 Motif Transition Musical Bridges (`src/audio/soundscape.ts`)**: Synthesizes motif-specific harmonic bridges and continuous next-world drone pre-echoes across all 30 worlds, with automatic background-tab suspension and gesture-gated Web Audio unlock.
- **Zero-Allocation Hot Paths, Idle Pre-Warming & Bounded 30-World VRAM Cache**:
  - Reusable `StrokeRecord` Scratch (`emitCanvasStroke` / `emitSurfaceStroke`) eliminates ~1.95M temporary heap allocations across the 30 worlds.
  - Right-sized `StrokeBuffer` initial capacity (`182,000` for *The Starry Night*, `76,000` for companion worlds); worlds that outgrow it (several companion worlds do) grow the buffer once.
  - Lookahead world pre-warming in an idle callback (`requestIdleCallback`), only on multi-act tracks and only after the first ~8 s of a track, so it never lands in the lay-in; the single loop builds the next world when the visitor asks for it. A world build is still one synchronous task, so that moment still hitches (time-slicing is open work). O(1) `PAINTING_SPEC_MAP` & `SUITE_ITEM_MAP` lookups, memoized `compilePathTrack`, pre-parsed linear RGB atmosphere cache (`_atmoCache`), and safe GPU geometry/material disposal on LRU world eviction (`MAX_CACHED_WORLDS = 4`).

### Three Viewing Modes (`ViewMode`)
- **Default Opening (`/` or `?mode=theme&path=single`)**: 96-second, 10-shot standalone *The Starry Night* (`starry`) with its 4-second radial lay-in and impasto inflation opener, collapsible 30-world drawer, and end-of-loop invitation to the 30-World Odyssey.
- **Mode A — Odyssey Mode (`?mode=odyssey`)**: Complete 5-Chapter, 30-Act continuous feature film (`900 s` = 30 acts × `30 s`).
- **Mode B — Atlas Mode (`?mode=atlas` or shortcut `U`)**: Interactive **Van Gogh World Graph Atlas** displaying all 30 worlds across the 5 Grand Chapters, 6 Motif filters, portal inspectors, clickable **Connected Neighbor Portals**, and one-click **Dynamic 6-Act Graph Weaving** (automatically closes the modal upon selection).
- **Mode C — Theme Path Mode (`?mode=theme&path=nights|roads|dwellings|flora|gaze|woven|single`)**: Curated and dynamically woven journeys across the 30-World Graph:
  - `✦ 光與夜之路 (Nights, Lamps & Suns, 10 Acts, 300 s)`: `potato → skull → sower → cafe → nightcafe → rhone → starry → olive → roadcypress → crows`
  - `⟁ 道路與橋樑 (Shoes, Bridges & Horizons, 10 Acts, 300 s)`: `shoes → galette → paris → seine → plum → cafe → rhone → roadcypress → church → crows`
  - `⌂ 居所與聖殿 (Looms, Rooms & Sanctuaries, 10 Acts, 300 s)`: `potato → weaver → tower → yellowhouse → sunflowers → cafe → nightcafe → bedroom → cottages → church`
  - `❀ 黑土、繁花與麥浪 (Earth, Blossoms & Wheat, 10 Acts, 300 s)`: `potato → sunflowers → harvest → sower → irises → olive → wheat → almond → daubigny → crows`
  - `❖ 凝視與靈魂 (Gaze, Portraits & Mirrors, 8 Acts, 240 s)`: `potato → skull → tanguy → selfportrait → nightcafe → bedroom → gachet → starry`
  - `✨ 智能編織 (Dynamic Woven 6-Act Path, 180 s)`: Dynamically woven 6-Act journey along `WORLD_GRAPH` edges from the current painting.
  - `◎ 單幅沉浸循環 (Single World Loop)`: Continuous standalone loop of the active painting (`96 s` for *The Starry Night*, `48 s` for companion worlds).

---

## Run & Verify

```bash
npm install
npm run dev                 # http://127.0.0.1:5199
npm run build               # typecheck + production bundle in dist/
npm run build:single        # one self-contained dist-single/index.html
```

`scripts/verify-worlds.mjs` runs in CI on a GitHub-hosted runner after the build (it needs `dist/` and Playwright's Chromium). It fails the job on page or console errors, a world whose generator threw, a failed self-test or paint-order check, a camera not registered at E, an unclean Odyssey hold (Act I and *The Starry Night* act, each checked to show the right painting), or a blank frame among the 30 worlds at E and the holds (after one retry). Off-E frames and a high-tier set are recorded for people to look at, with their size and renderer state, but never fail the job. Every run uploads the screenshots as the `punctum-30-worlds-screenshots` artifact; `verification-report.json` is written on passing runs.

## Controls

Any input hands control to you; after 12 s idle the camera rejoins the current act's timeline.

| Input | Action |
|---|---|
| drag | look |
| W A S D, arrow keys, Q / E | fly (speed scales with distance from E); the wheel sets the speed |
| Touch Flight Pad (`▲ 前進` / `▼ 後退` / `◎ 歸位`) | on-screen touch flight & return-to-$E$ controls on mobile/tablet |
| Alt-drag or right-drag | stir the sky |
| Shift + wheel | depth warp: at E the image does not change; step aside and the world refolds |
| Space | fly back to the painter's eye $E$ in the current act and re-register the painting |
| `P` or `⏸ 暫停` button | pause / resume the camera timeline and its automatic flights (return-to-eye, idle rejoin); you can still fly yourself, and the brushstrokes keep their gentle motion |
| `Enter` or click 3D Portal Beacon | leap through the active painting's 3D Spatial Portal when the beacon is visible |
| `[` / `]` or `PageUp` / `PageDown` | switch to previous / next painting in the active sequence via 6-Motif 3D Brushstroke Cross-Dissolve |
| `O` | toggle 5-Chapter 30-Act Odyssey (`∞ 五章三十幕`) vs. single-painting loop (`◎ 單幅沉浸循環`) |
| `U` | toggle the interactive **Van Gogh World Graph Atlas (`🌌 宇宙星圖`)** |
| `V` | toggle 30-World Procedural Soundscape (`♪ 聲景：開 / 靜音`) |
| Scrubber Timeline (bottom) | drag or click anywhere along the active Odyssey / Theme Path / Single-World shot timeline |
| 1-9, 0 | jump to shot 1-10 within the active painting |
| C / R | resume the cinematic / restart the current painting act |
| G | storm |
| M | calm mode (less roll, FOV, scatter, and particle drift; the default with `prefers-reduced-motion`) |
| H | HUD |

URL flags: `?painting=potato|weaver|tower|skull|shoes|galette|paris|seine|plum|tanguy|selfportrait|yellowhouse|sunflowers|harvest|sower|cafe|nightcafe|rhone|bedroom|starry|irises|olive|wheat|roadcypress|almond|cottages|church|gachet|daubigny|crows`, `?mode=odyssey|theme|atlas`, `?path=odyssey|nights|roads|dwellings|flora|gaze|woven|single`, `?odyssey=1|0`, `?t=<sec>`, `?free`, `?tier=high|medium|low`, `?calm`, `?hud`, `?overlay`, `?seed=`, `?freeze`, `?boot=<sec>&freeze`.


