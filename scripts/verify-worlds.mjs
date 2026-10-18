// Headless Chromium verification & screenshot harness for all 30 Van Gogh worlds.
// Runs in GitHub Actions (ubuntu-latest with SwiftShader WebGL2) so zero load is placed on developer machines.
//
// What fails the job: any page error or console.error (this includes three.js shader compile/link errors), a world
// whose generator threw, a failed invariance self-test, a paint-order violation, a camera not registered at E (NaN
// counts as a failure), an unclean Odyssey hold, or a screenshot so small that the frame must be blank or flat.
//
// What it only records for people to look at (never fails on): off-E frames, the vortex eye and a high-tier set. SwiftShader is detected as the Low
// tier, which is also what Intel UHD-class laptops get, so the main set shows what many visitors see.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const OUT_DIR = path.resolve(__dirname, '..', 'artifacts', 'screenshots');

// A painted 1280x720 frame encodes to about 0.5-1 MB of PNG; a blank or single-colour frame to a few KB.
const MIN_PNG_BYTES = 120_000;
const OFF_E_WORLDS = ['potato', 'bedroom', 'church', 'galette', 'roadcypress', 'yellowhouse'];
const HIGH_TIER_WORLDS = ['starry', 'roadcypress', 'tanguy'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const relPath = url.pathname === '/' ? '/index.html' : url.pathname;
        const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.join(rootDir, safePath);
        const data = await fs.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

/** Renderer state for diagnosing a bad frame. */
const renderState = (page) => page.evaluate(() => {
  const e = window.__punctum.engine;
  const gl = e.renderer?.getContext?.();
  return { tier: e.quality?.tier, renderScale: e.renderScale, contextLost: gl ? gl.isContextLost() : null };
});

/** Let the render loop run n more frames (a long synchronous world build can leave the next frame or two stale). */
const settle = (page, n) => page.evaluate((count) => new Promise((resolve) => {
  let k = 0;
  const step = () => (++k >= count ? resolve() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

/**
 * Save a screenshot and fail if it is too small to hold a painted frame. A blank first try is retried once after
 * 20 more frames and logged, so a transient frame (for example while render targets are resized) is told apart
 * from a world that really renders nothing.
 */
const retriedShots = [];
const recordedShots = [];

/** Save a frame for people to look at, with its size and renderer state; never fails the job. */
async function record(page, fileName) {
  const buf = await page.screenshot({ path: path.join(OUT_DIR, fileName) });
  const state = await renderState(page);
  recordedShots.push({ fileName, pngBytes: buf.length, ...state });
  if (buf.length < MIN_PNG_BYTES) console.warn(`[verify-worlds] recorded ${fileName} is small (${buf.length} B)`, state);
  return buf.length;
}

async function shoot(page, fileName) {
  let buf = await page.screenshot({ path: path.join(OUT_DIR, fileName) });
  if (buf.length < MIN_PNG_BYTES) {
    const before = await renderState(page);
    await settle(page, 20);
    buf = await page.screenshot({ path: path.join(OUT_DIR, fileName) });
    const after = await renderState(page);
    retriedShots.push({ fileName, retryBytes: buf.length, before, after });
    console.warn(`[verify-worlds] ${fileName} was blank on the first try; retried after 20 frames: ${buf.length} B`, { before, after });
    if (buf.length < MIN_PNG_BYTES) {
      throw new Error(`${fileName} is ${buf.length} bytes (< ${MIN_PNG_BYTES}) after a retry: the frame looks blank or flat (${JSON.stringify(after)})`);
    }
  }
  return buf.length;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const { server, port } = await startStaticServer(DIST_DIR);
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[verify-worlds] Serving dist/ at ${baseUrl}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--no-sandbox',
    ],
  });

  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (err) => {
      const msg = `[pageerror] ${err.stack || err.message || String(err)}`;
      console.error(msg);
      errors.push(msg);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = `[console.error] ${msg.text()}`;
        console.error(text);
        errors.push(text);
      }
    });
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    watch(page);

    // 1. Default opening: standalone 96 s, 10-shot Starry Night with lay-in
    console.log('[verify-worlds] 1/5 Checking default opening experience (/)...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
    const openingState = await page.evaluate(() => {
      const p = window.__punctum;
      return {
        activeId: p.activeId,
        pathId: p.pathId,
        viewMode: p.viewMode,
        loopSeconds: p.director.activeTrack.loopSeconds,
        shotCount: p.director.activeTrack.shots.length,
        uLayIn: p.uniforms.uLayIn.value,
        suiteCount: p.suite.length,
        act4Id: p.suite[3]?.id,
        act5Id: p.suite[4]?.id,
        overlayGone: !document.getElementById('loading-overlay') || document.getElementById('loading-overlay').getAttribute('data-ready') === '1',
      };
    });
    console.log('[verify-worlds] Default opening state:', openingState);

    if (openingState.activeId !== 'starry' || openingState.pathId !== 'single') {
      throw new Error(`Expected default opening to be standalone 'starry' ('single'), got activeId=${openingState.activeId}, pathId=${openingState.pathId}`);
    }
    if (openingState.loopSeconds !== 96 || openingState.shotCount !== 10) {
      throw new Error(`Expected standalone Starry Night to use 96s 10-shot choreography, got ${openingState.loopSeconds}s / ${openingState.shotCount} shots`);
    }
    if (!(openingState.uLayIn >= 0)) {
      throw new Error(`Expected default opening boot to enable lay-in animation (uLayIn >= 0), got uLayIn=${openingState.uLayIn}`);
    }
    if (openingState.suiteCount !== 30 || openingState.act4Id !== 'skull' || openingState.act5Id !== 'shoes') {
      throw new Error(`Expected 30 worlds with Act IV=skull and Act V=shoes, got count=${openingState.suiteCount}, IV=${openingState.act4Id}, V=${openingState.act5Id}`);
    }
    if (!openingState.overlayGone) {
      throw new Error('Loading overlay still shown after the first frames');
    }
    await shoot(page, '00-default-opening-starry.png');

    // 2. Odyssey clean holds at E (tau = 25.2 s, inside the [25.0, 26.8) hold) for Act I and for The Starry Night
    console.log('[verify-worlds] 2/5 Verifying Odyssey clean holds at E (tau=25.2s)...');
    const holdAt = async (actIndex) => page.evaluate(async (idx) => {
      const p = window.__punctum;
      p.selectModeAndPath('odyssey', 'odyssey');
      p.director.seekTo(idx * 30 + 25.2);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        actIndex: idx,
        activeId: p.activeId,
        loopSeconds: p.director.activeTrack.loopSeconds,
        align: p.uniforms.uAlign.value,
        scatter: p.world.layerUniforms.uScatter.value,
        layerFade: p.world.layerUniforms.uLayerFade.value,
        cleanEyeAttr: document.querySelector('.pn-ui')?.getAttribute('data-clean-eye'),
      };
    }, actIndex);
    const starryAct = await page.evaluate(() => window.__punctum.suite.findIndex((s) => s.id === 'starry'));
    const odysseyHolds = [];
    for (const [actIndex, expectedId, fileName] of [[0, 'potato', '32-odyssey-clean-hold-25_2s.png'], [starryAct, 'starry', '33-odyssey-starry-hold-25_2s.png']]) {
      const hold = await holdAt(actIndex);
      console.log('[verify-worlds] Odyssey hold:', hold);
      if (hold.activeId !== expectedId) {
        throw new Error(`Expected the Odyssey hold in act ${actIndex} to show '${expectedId}', got '${hold.activeId}'`);
      }
      if (hold.loopSeconds !== 900) {
        throw new Error(`Expected 30-act Odyssey loopSeconds=900, got ${hold.loopSeconds}`);
      }
      if (!(hold.align >= 0.99) || !(hold.scatter <= 1e-4) || !(hold.layerFade >= 0.99)) {
        throw new Error(`Expected clean reassembled hold at E in act ${actIndex}, got align=${hold.align}, scatter=${hold.scatter}, fade=${hold.layerFade}`);
      }
      if (hold.cleanEyeAttr !== '1') {
        throw new Error(`Expected .pn-ui[data-clean-eye="1"] during clean hold at E in act ${actIndex}, got ${hold.cleanEyeAttr}`);
      }
      await shoot(page, fileName);
      odysseyHolds.push(hold);
    }

    // Off-E frames of the Starry Night Odyssey act (waypoint near the cypress, then the deep dive): recorded only.
    for (const [tau, fileName] of [[5.0, '40-odyssey-starry-tau05.png'], [12.2, '41-odyssey-starry-tau12.png']]) {
      await page.evaluate(async ([idx, t]) => {
        window.__punctum.director.seekTo(idx * 30 + t);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, [starryAct, tau]);
      await record(page, fileName);
    }

    // 3. All 30 worlds at E (t=0, freeze)
    console.log('[verify-worlds] 3/5 Rendering and verifying all 30 worlds at E...');
    await page.goto(`${baseUrl}/?t=0&freeze`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });

    const suiteIds = await page.evaluate(() => window.__punctum.suite.map((s) => s.id));
    const worldReports = [];

    for (let i = 0; i < suiteIds.length; i++) {
      const id = suiteIds[i];
      const info = await page.evaluate(async (paintId) => {
        const res = window.__punctum.pinPainting(paintId, 0);
        for (let k = 0; k < 4; k++) await new Promise((r) => requestAnimationFrame(r));
        const e = window.__punctum.engine;
        return {
          ...res,
          align: window.__punctum.uniforms.uAlign.value,
          tier: e.quality?.tier,
          renderScale: e.renderScale,
        };
      }, id);

      const fileName = `${String(i + 1).padStart(2, '0')}-${id}.png`;
      const pngBytes = await shoot(page, fileName);
      console.log(`[verify-worlds]   [${String(i + 1).padStart(2, '0')}/30] ${info.roman} ${id} (${info.titleZh}): ${info.strokes} strokes, selfTest=${info.selfTestMaxErr.toExponential(2)}, align=${Number(info.align).toFixed(3)}, png=${pngBytes} B`);

      if (!info.selfTestOk) {
        throw new Error(`Invariance self-test failed for ${id}: maxErr=${info.selfTestMaxErr}`);
      }
      if (!(info.paintOrderViolations === 0)) {
        throw new Error(`Paint order violations in ${id}: ${info.paintOrderViolations}`);
      }
      if (!(info.strokes >= 30_000)) {
        throw new Error(`Unexpectedly low stroke count for ${id}: ${info.strokes}`);
      }
      if (!(info.align >= 0.99)) {
        throw new Error(`Camera not registered at E for ${id} at t=0: uAlign=${info.align}`);
      }
      worldReports.push({ index: i + 1, fileName, pngBytes, ...info });
    }

    // The Starry Night deep inside the 40 km Great Vortex (t=66 s): recorded only.
    await page.evaluate(async () => {
      window.__punctum.pinPainting('starry', 66);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await record(page, '31-starry-vortex-eye-66s.png');

    // 4. Off-E frames of companion worlds (standalone track at t=14 s, mid-flight): recorded only.
    console.log('[verify-worlds] 4/5 Capturing off-E frames...');
    for (const [k, id] of OFF_E_WORLDS.entries()) {
      await page.evaluate(async (paintId) => {
        window.__punctum.pinPainting(paintId, 14);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, id);
      await record(page, `${42 + k}-offE-${id}-t14.png`);
    }

    const brokenWorlds = await page.evaluate(() => window.__punctum.brokenWorlds?.() ?? []);
    if (brokenWorlds.length > 0) {
      throw new Error(`World generator(s) threw: ${brokenWorlds.join(', ')}`);
    }

    // 5. High tier at E for a few worlds (Low is what SwiftShader detects): recorded only. Software rendering at High
    // can be very slow on a CI runner, so a timeout here is logged, not failed; console and shader errors raised on
    // this page still fail the job through `errors` (the High variants of the shaders get compiled here).
    console.log('[verify-worlds] 5/5 Capturing a high-tier set at E...');
    await page.close(); // one rendering page at a time on the runner's CPU
    let highTier = { captured: [], skipped: null };
    const high = await context.newPage();
    high.setDefaultTimeout(180_000);
    watch(high);
    try {
      await high.goto(`${baseUrl}/?t=0&freeze&tier=high`, { waitUntil: 'domcontentloaded' });
      await high.waitForFunction(() => window.__ready === true, null, { timeout: 180_000 });
      for (const [k, id] of HIGH_TIER_WORLDS.entries()) {
        await high.evaluate(async (paintId) => {
          window.__punctum.pinPainting(paintId, 0);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }, id);
        const fileName = `${60 + k}-high-${id}.png`;
        await record(high, fileName); // tier and render scale are in the report: dynamic resolution may have dropped it
        highTier.captured.push(fileName);
      }
    } catch (err) {
      if (err?.name !== 'TimeoutError') throw err;
      const firstLine = String(err.message).split(/\r?\n/)[0];
      highTier = { ...highTier, skipped: `timeout: ${firstLine}` };
      console.warn('[verify-worlds] high-tier capture stopped by a timeout (recorded only, not a failure):', highTier.skipped);
    }
    await high.close();

    if (errors.length > 0) {
      throw new Error(`Encountered ${errors.length} console/page error(s):\n${errors.join('\n')}`);
    }

    const summary = {
      timestamp: new Date().toISOString(),
      openingState,
      odysseyHolds,
      retriedShots,
      recordedShots,
      highTier,
      totalWorldsVerified: worldReports.length,
      worlds: worldReports,
    };
    await fs.writeFile(path.join(OUT_DIR, 'verification-report.json'), JSON.stringify(summary, null, 2), 'utf8');
    console.log('[verify-worlds] SUCCESS: All 30 worlds verified with 0 errors. Screenshots saved to artifacts/screenshots/.');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('[verify-worlds] FAILED:', err);
  process.exit(1);
});
