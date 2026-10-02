// Headless render check: starts a Vite dev server, opens a page in headless Chrome over CDP,
// prints console errors/warnings and uncaught exceptions, optionally evaluates an expression,
// and saves a screenshot.
//
//   node tools/shot.mjs <page-path-with-query> [--out shots/x.png] [--wait 4000] [--w 1280] [--h 720]
//                       [--eval "JSON.stringify(window.__report)"] [--gpu] [--dgpu] [--quiet]
//   --dgpu asks Chrome for the discrete GPU (--force_high_performance_gpu).
//
// The page may set `window.__ready = true` to end the wait early (polled every 200 ms).
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes(`--${name}`);
const pagePath = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--'))) ?? '/';
const out = opt('out', null);
const waitMs = Number(opt('wait', '4000'));
const width = Number(opt('w', '1280'));
const height = Number(opt('h', '720'));
const evalExpr = opt('eval', null);
const quiet = flag('quiet');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('no Chrome/Edge found');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await createServer({
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
});
await server.listen();
const addr = server.httpServer.address();
const base = `http://127.0.0.1:${addr.port}`;

const userDir = mkdtempSync(join(tmpdir(), 'starry-shot-'));
const debugPort = 9300 + Math.floor(Math.random() * 600);
const chromeArgs = [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDir}`,
  `--window-size=${width},${height}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--mute-audio',
  '--ignore-gpu-blocklist',
  flag('gpu') ? '--use-angle=d3d11' : '--enable-unsafe-swiftshader',
  ...(flag('dgpu') ? ['--force_high_performance_gpu'] : []),
  'about:blank',
];
const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' });

let exitCode = 0;
const errors = [];
try {
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    await sleep(100);
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch { /* not up yet */ }
  }
  if (!wsUrl) throw new Error('Chrome DevTools endpoint did not come up');

  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let nextId = 1;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((r, j) => {
    const id = nextId++;
    pending.set(id, { r, j });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const fmtArg = (a) => (a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : (a.description ?? a.type));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.j(new Error(m.error.message)) : p.r(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const { type, args: a } = m.params;
      const text = a.map(fmtArg).join(' ');
      if (type === 'error' || type === 'warning' || type === 'assert') {
        errors.push(`[console.${type}] ${text}`);
        console.log(`[console.${type}] ${text}`);
      } else if (!quiet) {
        console.log(`[console.${type}] ${text}`);
      }
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      const text = `[exception] ${d.exception?.description ?? d.text} @${d.url ?? ''}:${d.lineNumber}`;
      errors.push(text);
      console.log(text);
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      if (e.level === 'error' || e.level === 'warning') {
        const text = `[log.${e.level}] ${e.text} ${e.url ?? ''}`;
        if (!/favicon/.test(text)) { errors.push(text); console.log(text); }
      }
    }
  };
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const url = base + (pagePath.startsWith('/') ? pagePath : `/${pagePath}`);
  console.log(`[shot] ${url} (${CHROME.includes('chrome') ? 'chrome' : 'edge'}, ${flag('gpu') ? 'gpu' : 'swiftshader'})`);
  await send('Page.navigate', { url });
  const t0 = Date.now();
  while (Date.now() - t0 < waitMs) {
    await sleep(200);
    try {
      const r = await send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true });
      if (r.result?.value === true) break;
    } catch { /* navigating */ }
  }
  const info = await send('Runtime.evaluate', {
    expression: `(() => { const c = document.querySelector('canvas'); let gl = null;
      try { const cv = document.createElement('canvas'); const g = cv.getContext('webgl2'); const ext = g && g.getExtension('WEBGL_debug_renderer_info');
        gl = g ? (ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'webgl2') : 'NO WEBGL2'; } catch (e) { gl = String(e); }
      return { canvas: c ? [c.width, c.height] : null, gl, elapsed: performance.now() | 0 }; })()`,
    returnByValue: true,
  });
  console.log(`[shot] page info ${JSON.stringify(info.result?.value)}`);
  if (evalExpr) {
    const r = await send('Runtime.evaluate', { expression: evalExpr, returnByValue: true, awaitPromise: true });
    console.log(`[eval] ${r.exceptionDetails ? 'EXCEPTION ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) : (typeof r.result?.value === 'string' ? r.result.value : JSON.stringify(r.result?.value))}`);
  }
  if (out) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = resolve(root, out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`[shot] saved ${outPath}`);
  }
  ws.close();
  console.log(`[shot] ${errors.length} error/warning line(s)`);
  exitCode = errors.some((e) => !e.startsWith('[console.warning]') && !e.startsWith('[log.warning]')) ? 1 : 0;
} catch (e) {
  console.error(`[shot] FAILED: ${e.message}`);
  exitCode = 2;
} finally {
  chrome.kill();
  await server.close();
  await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch { /* chrome may still hold files */ }
  process.exit(exitCode);
}
