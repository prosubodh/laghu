import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, 'src', 'laghu.js'), 'utf8');
const morphSrc = fs.readFileSync(path.join(root, 'src', 'morph.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra); }
}
async function tick(ms = 15) { await new Promise((r) => setTimeout(r, ms)); }
function btn(text) {
  const all = [...document.querySelectorAll('button')];
  const b = all.find((x) => x.textContent.includes(text));
  if (!b) throw new Error('button not found: ' + text);
  return b;
}

// Load one example file exactly as shipped: full HTML, real sources,
// real inline scripts. Stubs fetch only where the test needs it.
function boot(file, { morph = false, fetch = null } = {}) {
  const html = fs.readFileSync(path.join(root, 'examples', file), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement;
  global.HTMLSelectElement = window.HTMLSelectElement;
  global.HTMLFormElement = window.HTMLFormElement;
  global.customElements = window.customElements;
  global.MutationObserver = window.MutationObserver;
  global.CustomEvent = window.CustomEvent;
  global.Event = window.Event;
  global.FormData = window.FormData;
  global.IntersectionObserver = class { observe() {} disconnect() {} };
  global.AbortController = window.AbortController || AbortController;
  if (fetch) { global.fetch = fetch; window.fetch = fetch; }
  else { delete global.fetch; try { delete window.fetch; } catch (e) {} }
  window.__LAGHU_DEV__ = false;
  window.eval(src);
  if (morph) window.eval(morphSrc);
  window.document.querySelectorAll('script:not([src])').forEach((s) => {
    window.eval(s.textContent);
  });
  return window.Laghu;
}

// --- counter.html ---
{
  boot('counter.html');
  await tick();
  const strong = document.querySelector('strong');
  ok('counter: starts at 0', strong.textContent === '0');
  document.querySelector('button').click();
  await tick();
  ok('counter: increments', strong.textContent === '1', strong.textContent);
}

// --- todo.html ---
{
  boot('todo.html');
  await tick();
  ok('todo: one row seeded', document.querySelectorAll('li').length === 1);
  const input = document.querySelector('input[data-model]');
  input.value = 'bread';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  btn('Add').click();
  await tick(30);
  ok('todo: added row', document.querySelectorAll('li').length === 2);
  ok('todo: input cleared', input.value === '');
}

// --- model.html ---
{
  boot('model.html');
  await tick();
  const s = window.s;
  const q = document.querySelector('input[data-model="form.q"]');
  q.value = 'hi';
  q.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('model: text to state', s.form.q === 'hi');
  const qty = document.querySelector('input[data-model="form.qty"]');
  qty.value = '4';
  qty.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('model: number coerced', s.form.qty === 4, String(s.form.qty));
  const boxes = [...document.querySelectorAll('input[data-model="form.tags"]')];
  boxes[0].checked = true;
  boxes[0].dispatchEvent(new window.Event('change', { bubbles: true }));
  boxes[1].checked = true;
  boxes[1].dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('model: checkbox group array', JSON.stringify(s.form.tags) === '["a","b"]', JSON.stringify(s.form.tags));
  const radios = [...document.querySelectorAll('input[data-model="form.color"]')];
  radios[1].checked = true;
  radios[1].dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('model: radio to state', s.form.color === 'g');
  await tick();
  ok('model: radio mirrors to select', document.querySelector('select[data-model="form.color"]').value === 'g');
  s.form.bio = 'hello bio';
  await tick();
  ok('model: state to textarea', document.querySelector('textarea').value === 'hello bio');
  btn('Reset').click();
  await tick();
  ok('model: reset restores', s.form.q === '' && s.form.qty === 1 && s.form.tags.length === 0);
}

// --- triggers.html ---
{
  boot('triggers.html');
  await tick(30);
  const s = window.s;
  ok('triggers: init ran on load', s.loaded === 'yes', String(s.loaded));
  btn('once only').click();
  btn('once only').click();
  btn('once only').click();
  await tick();
  ok('triggers: once fires a single time', s.single === 1, String(s.single));
  btn('throttled').click();
  btn('throttled').click();
  btn('throttled').click();
  await tick();
  ok('triggers: throttle collapses bursts', s.slow === 1, String(s.slow));
  await tick(1200);
  btn('throttled').click();
  await tick();
  ok('triggers: throttle reopens window', s.slow === 2, String(s.slow));
  const sel = document.querySelector('select[data-model]');
  sel.value = 'g';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  await tick();
  ok('triggers: change writes through scope', s.echo === 'g', String(s.echo));
  const form = document.querySelector('form');
  const ev = new window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  ok('triggers: submit prevented', ev.defaultPrevented === true);
  await tick(2400);
  ok('triggers: every ticked', s.auto >= 2, String(s.auto));
}

// --- swaps.html ---
{
  boot('swaps.html', { morph: true });
  await tick();
  btn('append').click();
  btn('prepend').click();
  await tick(30);
  ok('swaps: append and prepend', document.querySelectorAll('#list li').length === 3);
  btn('as text').click();
  await tick();
  ok('swaps: text makes no elements', document.querySelectorAll('#list li').length === 0);
  ok('swaps: text keeps raw words', (document.querySelector('#list').textContent || '').includes('not a tag'));
  btn('none').click();
  await tick();
  const log = document.querySelector('#log').textContent || '';
  ok('swaps: none still dispatches event', log.includes('swapped: none'), log);
  btn('outer').click();
  await tick();
  ok('swaps: outer replaces element', document.querySelector('#list').tagName === 'OL');
  btn('delete').click();
  await tick();
  ok('swaps: delete removes target', document.querySelector('#list') === null);
  btn('bring back').click();
  await tick();
  ok('swaps: bring back restores', document.querySelectorAll('#list li').length === 1);
  btn('reset').click();
  await tick();
  const keepBefore = document.querySelector('#keep');
  const typed = document.querySelector('#typed');
  typed.value = 'typed by user';
  typed.focus();
  btn('morph box').click();
  await tick(30);
  ok('swaps: preserve keeps node identity', document.querySelector('#keep') === keepBefore);
  ok('swaps: morph keeps typed value', document.querySelector('#typed').value === 'typed by user');
  ok('swaps: morph keeps focus', document.activeElement && document.activeElement.id === 'typed');
}

// --- components.html ---
{
  boot('components.html');
  await tick(30);
  const cards = [...document.querySelectorAll('user-card')];
  ok('components: two instances', cards.length === 2);
  cards[0].querySelector('button').click();
  await tick();
  ok('components: independent state', cards[0].state.likes === 1 && cards[1].state.likes === 0);
  btn('rename first card').click();
  await tick();
  ok('components: attribute syncs to state', cards[0].state.name === 'Hopper' && cards[0].querySelector('strong').textContent === 'Hopper');
  const log0 = document.querySelector('#mountlog').textContent || '';
  ok('components: mounted twice', (log0.match(/mounted:/g) || []).length === 2, log0);
  btn('remove first card').click();
  await tick();
  ok('components: removal cleans up', document.querySelectorAll('user-card').length === 1);
  const log1 = document.querySelector('#mountlog').textContent || '';
  ok('components: unmount observed', log1.includes('unmounted') && log1.includes('unmount-event'), log1);
  btn('restore first card').click();
  await tick(30);
  ok('components: restore reconnects fresh', document.querySelectorAll('user-card').length === 2);
}

// --- store.html ---
{
  boot('store.html');
  await tick();
  const spans = [...document.querySelectorAll('#a span, #b span')].filter((el) => el.textContent === '0');
  ok('store: both islands read zero', spans.length >= 2);
  [...document.querySelectorAll('#a button')].find((b) => b.textContent === 'add').click();
  await tick();
  const vals = [...document.querySelectorAll('p')].map((p) => p.textContent).join('|');
  ok('store: shared increment visible twice', (vals.match(/1/g) || []).length >= 2, vals);
  const name = document.querySelector('#b input');
  name.value = 'Bo';
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick();
  ok('store: shared model both ways', document.querySelector('#b p:last-child') && [...document.querySelectorAll('#b p')].some((p) => p.textContent.includes('Bo')));
}

// --- directives.html ---
{
  boot('directives.html');
  await tick(30);
  const clocks = [...document.querySelectorAll('[data-ticker]')];
  ok('directives: two tickers running', clocks.length === 2 && clocks.every((c) => (c.textContent || '').length > 0));
  ok('directives: autofocus applied', document.activeElement && document.activeElement.tagName === 'INPUT');
  btn('toggle extra clock').click();
  await tick(30);
  ok('directives: template removal destroys ticker', document.querySelectorAll('[data-ticker]').length === 1);
  btn('toggle extra clock').click();
  await tick(30);
  ok('directives: reinsert restarts ticker', document.querySelectorAll('[data-ticker]').length === 2);
  btn('flip').click();
  await tick();
  ok('directives: class binding toggles', document.querySelector('p.wide') !== null);
}

// --- fetch.html (stubbed network) ---
{
  const calls = [];
  const stub = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/api/user')) {
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ user: { name: 'Zed' } }) };
    }
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<li id="a">A2</li><li id="b">B</li>' };
  };
  const B = boot('fetch.html', { morph: true, fetch: stub });
  const r = document.querySelector('[data-scope]');
  B.hydrate(r, JSON.parse(r.getAttribute('data-scope')), {});
  await tick();
  const aBefore = document.querySelector('#a');
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Load JSON')).click();
  await tick(30);
  ok('fetch: json merges to state', document.querySelector('#out').textContent.includes('Zed'), document.querySelector('#out').textContent);
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Morph')).click();
  await tick(30);
  ok('fetch: morph adds server row', document.querySelector('#b') !== null);
  ok('fetch: morph reuses matching row node', document.querySelector('#a') === aBefore);
  ok('fetch: morph updates reused text', (document.querySelector('#a') || {}).textContent === 'A2');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
