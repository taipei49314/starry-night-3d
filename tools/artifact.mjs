// Turns dist-single/index.html (vite build --mode single) into an Artifact page body:
// the Artifact host supplies <!doctype>/<html>/<head>/<body>, so we keep <title>, <style>, the body markup and the inlined module script.
//   node tools/artifact.mjs [in=dist-single/index.html] [out=dist-single/artifact.html]
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath = 'dist-single/index.html', outPath = 'dist-single/artifact.html'] = process.argv.slice(2);
const html = readFileSync(inPath, 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>The Starry Night, 250 km Deep</title>';
const meta = pick(/<meta name="description"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? [, ''])[1].replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').trim();
const out = [title, ...meta, ...styles, body, ...scripts].join('\n');
writeFileSync(outPath, out);
console.log(`${outPath}: ${(out.length / 1024).toFixed(0)} KiB (${scripts.length} script, ${styles.length} style)`);
