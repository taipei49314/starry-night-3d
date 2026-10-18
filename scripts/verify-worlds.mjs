// Headless Chromium verification & screenshot harness for all 30 Van Gogh worlds.
// Runs in GitHub Actions (ubuntu-latest with SwiftShader WebGL2) so zero load is placed on developer machines.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const OUT_DIR = path.resolve(__dirname, '..', 'artifacts', 'screenshots');

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
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
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

    // 1. Verify Default Opening Experience (standalone 96s, 10-shot Starry Night with lay-in)
    console.log('[verify-worlds] 1/3 Checking default opening experience (/)...');
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
    await page.screenshot({ path: path.join(OUT_DIR, '00-default-opening-starry.png') });

    // 2. Verify Multi-Act Odyssey clean hold at E (tau=25.2s inside [25.0, 26.8) hold window)
    console.log('[verify-worlds] 2/3 Verifying Odyssey clean hold at E (tau=25.2s)...');
    const odysseyHold = await page.evaluate(async () => {
      const p = window.__punctum;
      p.selectModeAndPath('odyssey', 'odyssey');
      p.director.seekTo(25.2);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        loopSeconds: p.director.activeTrack.loopSeconds,
        align: p.uniforms.uAlign.value,
        scatter: p.world.layerUniforms.uScatter.value,
        layerFade: p.world.layerUniforms.uLayerFade.value,
        cleanEyeAttr: document.querySelector('.pn-ui')?.getAttribute('data-clean-eye'),
      };
    });
    console.log('[verify-worlds] Odyssey hold at tau=25.2s:', odysseyHold);
    if (odysseyHold.loopSeconds !== 900) {
      throw new Error(`Expected 30-act Odyssey loopSeconds=900, got ${odysseyHold.loopSeconds}`);
    }
    if (odysseyHold.align < 0.99 || odysseyHold.scatter > 1e-4 || odysseyHold.layerFade < 0.99) {
      throw new Error(`Expected clean reassembled hold at E at tau=25.2s, got align=${odysseyHold.align}, scatter=${odysseyHold.scatter}, fade=${odysseyHold.layerFade}`);
    }
    if (odysseyHold.cleanEyeAttr !== '1') {
      throw new Error(`Expected .pn-ui[data-clean-eye="1"] during clean hold at E, got ${odysseyHold.cleanEyeAttr}`);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '32-odyssey-clean-hold-25_2s.png') });

    // 3. Verify all 30 worlds at E (t=0, freeze) and save screenshots
    console.log('[verify-worlds] 3/3 Rendering and verifying all 30 worlds at E...');
    await page.goto(`${baseUrl}/?t=0&freeze`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });

    const suiteIds = await page.evaluate(() => window.__punctum.suite.map((s) => s.id));
    const worldReports = [];

    for (let i = 0; i < suiteIds.length; i++) {
      const id = suiteIds[i];
      const info = await page.evaluate(async (paintId) => {
        const res = window.__punctum.pinPainting(paintId, 0);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return {
          ...res,
          align: window.__punctum.uniforms.uAlign.value,
        };
      }, id);

      const fileName = `${String(i + 1).padStart(2, '0')}-${id}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, fileName) });
      console.log(`[verify-worlds]   [${String(i + 1).padStart(2, '0')}/30] ${info.roman} ${id} (${info.titleZh}): ${info.strokes} strokes, selfTest=${info.selfTestMaxErr.toExponential(2)}, align=${info.align.toFixed(3)}`);

      if (!info.selfTestOk) {
        throw new Error(`Invariance self-test failed for ${id}: maxErr=${info.selfTestMaxErr}`);
      }
      if (info.paintOrderViolations > 0) {
        throw new Error(`Paint order violations in ${id}: ${info.paintOrderViolations}`);
      }
      if (info.strokes < 30_000) {
        throw new Error(`Unexpectedly low stroke count for ${id}: ${info.strokes}`);
      }
      if (info.align < 0.99) {
        throw new Error(`Camera not registered at E for ${id} at t=0: uAlign=${info.align}`);
      }
      worldReports.push({ index: i + 1, fileName, ...info });
    }

    // Also capture Starry Night deep inside the 40km Great Vortex (t=66s)
    await page.evaluate(async () => {
      window.__punctum.pinPainting('starry', 66);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await page.screenshot({ path: path.join(OUT_DIR, '31-starry-vortex-eye-66s.png') });

    if (errors.length > 0) {
      throw new Error(`Encountered ${errors.length} console/page error(s):\n${errors.join('\n')}`);
    }

    const summary = {
      timestamp: new Date().toISOString(),
      openingState,
      odysseyHold,
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
