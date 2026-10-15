import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.map': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (p.endsWith('/')) p += 'index.html';
        const f = path.join(root, ...p.split('/').filter(Boolean));
        if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
          res.writeHead(404); res.end('nope');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        fs.createReadStream(f).pipe(res);
      } catch (e) { res.writeHead(500); res.end('err'); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Executable JS shipped for one play of this game. File lists keep it
// honest: the laghu app loads laghu.min.js only, never morph.min.js.
function appBytes(app) {
  let raw = 0, gz = 0;
  const add = (b) => {
    raw += b.length;
    gz += zlib.gzipSync(b, { level: 9 }).length;
  };
  if (app.jsFiles) {
    for (const f of app.jsFiles) add(fs.readFileSync(path.join(root, f)));
  } else {
    for (const e of fs.readdirSync(path.join(root, app.jsDir), { recursive: true, withFileTypes: true })) {
      if (!e.isDirectory() && e.name.endsWith('.js')) {
        add(fs.readFileSync(path.join(e.parentPath || e.path, e.name)));
      }
    }
  }
  return { raw, gz };
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

// Same scripted game everywhere: X0 O3 X1 O4 X2, X wins the top row.
const MOVES = [0, 3, 1, 4, 2];
const MARKS = ['X', 'O', 'X', 'O', 'X'];

const APPS = [
  { name: 'vanilla', url: '/bench/vanilla-ttt/', jsFiles: ['bench/vanilla-ttt/app.js'] },
  { name: 'laghu', url: '/apps/tictactoe/', jsFiles: ['dist/laghu.min.js'] },
  { name: 'react', url: '/bench/react-ttt/dist/', jsDir: 'bench/react-ttt/dist/assets' },
  { name: 'vue', url: '/bench/vue-ttt/dist/', jsDir: 'bench/vue-ttt/dist/assets' },
  { name: 'angular', url: '/bench/angular-ttt/dist/angular-ttt/browser/', jsDir: 'bench/angular-ttt/dist/angular-ttt/browser' },
];

async function measure(browser, base, app, runs = 5) {
  const loads = [], clicks = [], heaps = [];
  for (let r = 0; r < runs; r++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const t0 = Date.now();
    await page.goto(base + app.url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.cell').length === 9, null, { timeout: 15000, polling: 5 });
    await page.waitForFunction(() => (document.querySelector('#status') || {}).textContent !== '', null, { timeout: 15000, polling: 5 });
    loads.push(Date.now() - t0);
    for (let m = 0; m < MOVES.length; m++) {
      // One evaluate per click: synchronous dispatch, MutationObserver
      // timestamp. No Playwright actionability or rAF polling overhead.
      const dt = await page.evaluate(([idx, mark]) => new Promise((res) => {
        const el = document.querySelectorAll('.cell')[idx];
        const t1 = performance.now();
        const done = () => res(performance.now() - t1);
        if (el.textContent === mark) { done(); return; }
        const mo = new MutationObserver(() => {
          if (el.textContent === mark) { mo.disconnect(); done(); }
        });
        mo.observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
        el.click();
        if (el.textContent === mark) { mo.disconnect(); done(); }
      }), [MOVES[m], MARKS[m]]);
      clicks.push(dt);
    }
    const status = await page.locator('#status').textContent();
    if (!/Winner: X/.test(status || '')) throw new Error(app.name + ' game did not end X-wins, got: ' + status);
    const metrics = await cdp.send('Performance.getMetrics');
    const heap = metrics.metrics.find((x) => x.name === 'JSHeapUsedSize');
    if (heap) heaps.push(heap.value);
    await ctx.close();
  }
  const { raw, gz } = appBytes(app);
  return {
    name: app.name,
    jsRaw: raw,
    jsGzip: gz,
    loadMs: Math.round(median(loads)),
    clickMs: Math.round(median(clicks) * 100) / 100,
    heapKB: heaps.length ? Math.round(median(heaps) / 1024) : -1,
  };
}

const srv = await serve();
const port = srv.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const out = [];
for (const app of APPS) {
  process.stdout.write('measuring ' + app.name + '...\n');
  out.push(await measure(browser, base, app));
}
await browser.close();
srv.close();

const rows = [
  '| app | exec JS raw | exec JS gzip | load (DCL) ms | click latency ms | heap KB |',
  '| --- | --- | --- | --- | --- | --- |',
  ...out.map((r) => `| ${r.name} | ${r.jsRaw} | ${r.jsGzip} | ${r.loadMs} | ${r.clickMs} | ${r.heapKB < 0 ? 'n/a' : r.heapKB} |`),
];
const md = ['# TicTacToe benchmark', '', 'Same game, same moves (X0 O3 X1 O4 X2), production builds, headless Chromium, median of 5 loads and 25 clicks.', '', ...rows, ''].join('\n');
fs.writeFileSync(path.join(root, 'bench', 'RESULTS.md'), md);
fs.writeFileSync(path.join(root, 'bench', 'results.json'), JSON.stringify(out, null, 2));
console.log(md);
