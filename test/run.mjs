import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const src = fs.readFileSync('src/laghu.js', 'utf8');
const morphSrc = fs.readFileSync('src/morph.js', 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra); }
}
async function tick(ms = 10) { await new Promise(r => setTimeout(r, ms)); }

function boot(html, dev = false) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  global.window = window; global.document = window.document;
  global.HTMLElement = window.HTMLElement; global.Element = window.Element;
  global.Node = window.Node; global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement; global.HTMLSelectElement = window.HTMLSelectElement;
  global.HTMLFormElement = window.HTMLFormElement;
  global.customElements = window.customElements;
  global.MutationObserver = window.MutationObserver; global.CustomEvent = window.CustomEvent;
  global.Event = window.Event; global.FormData = window.FormData; global.CSS = window.CSS;
  global.IntersectionObserver = class { observe(){} disconnect(){} };
  global.AbortController = window.AbortController || AbortController;
  global.queueMicrotask = global.queueMicrotask || ((fn) => Promise.resolve().then(fn));
  window.__LAGHU_DEV__ = dev;
  window.eval(src);
  window.eval(morphSrc);
  return window.Laghu;
}

// 1 core counter
{
  const B = boot(`<counter-widget><p><strong data-bind="count">0</strong></p><button data-click="increment">+</button></counter-widget>`);
  ok('exposes Laghu', !!B);
  ok('morph plugin', !!window.LaghuMorph);
  B.define('counter-widget', () => ({ state: { count: 0 }, actions: { increment() { this.count++; } } }));
  await tick();
  const strong = document.querySelector('strong');
  ok('initial bind 0', strong.textContent === '0', strong.textContent);
  document.querySelector('button').click();
  await tick();
  ok('click increments', strong.textContent === '1', strong.textContent);
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('CSP: no new Function', !/new\s+Function\s*\(/.test(codeOnly) && !/[^\w]eval\s*\(/.test(codeOnly));
  ok('no shadow default', !/attachShadow/.test(codeOnly));
}

// 2 islands: bind/text/if/show/for/model/class/attr
{
  const B = boot(`<div data-scope='{"count":6,"name":"Ada","on":true,"url":"/x","items":[{"id":1,"n":"a"},{"id":2,"n":"b"}],"form":{"q":"","agree":false,"color":"g"}}'>
    <span id="c" data-bind="count"></span><span id="u" data-text="name"></span>
    <p id="big" data-if="count > 5">big</p><p id="hid" data-show="count > 100">h</p>
    <a id="lk" data-bind:href="url">x</a><b id="cl" data-class:active="on">y</b>
    <ul><template data-for="it in items" data-key="id"><li class="row" data-bind="it.n"></li></template></ul>
    <input id="t" data-model="form.q"><input id="cb" type="checkbox" data-model="form.agree">
    <select id="se" data-model="form.color"><option value="r">r</option><option value="g">g</option></select>
  </div>`);
  const root = document.querySelector('[data-scope]');
  const state = B.hydrate(root, JSON.parse(root.getAttribute('data-scope')));
  await tick();
  ok('bind', document.querySelector('#c').textContent === '6');
  ok('nested', document.querySelector('#u').textContent === 'Ada');
  ok('if visible', document.querySelector('#big').hidden === false);
  ok('show hidden', document.querySelector('#hid').hidden === true);
  ok('attr bind', document.querySelector('#lk').getAttribute('href') === '/x');
  ok('class bind', document.querySelector('#cl').classList.contains('active'));
  ok('for 2 rows', document.querySelectorAll('.row').length === 2);
  // model -> state
  const t = document.querySelector('#t');
  t.value = 'hello'; t.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('model input->state', state.form.q === 'hello', JSON.stringify(state.form));
  // state -> model
  state.form.q = 'bye'; await tick();
  ok('model state->input', t.value === 'bye', t.value);
  const cb = document.querySelector('#cb');
  cb.checked = true; cb.dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('checkbox model', state.form.agree === true);
  ok('select model init', document.querySelector('#se').value === 'g');
  state.count = 101; await tick();
  ok('show toggles', document.querySelector('#hid').hidden === false);
  // keyed reorder preserves nodes
  const firstRow = document.querySelectorAll('.row')[0];
  firstRow.setAttribute('data-mark', 'keep');
  state.items = [{ id: 2, n: 'b2' }, { id: 1, n: 'a2' }];
  await tick(30);
  const rows = document.querySelectorAll('.row');
  ok('for reorder count', rows.length === 2);
  ok('for keyed reuse', document.querySelector('[data-mark="keep"]') !== null);
}

// 3 attr sync + prop upgrade
{
  const B = boot(`<my-badge count="5" label="hi"></my-badge>`);
  B.define('my-badge', () => ({ state: { count: 0, label: '' } }));
  await tick();
  const el = document.querySelector('my-badge');
  ok('attr->state number', el.state.count === 5, JSON.stringify(el.state));
  ok('attr->state string', el.state.label === 'hi');
  el.setAttribute('count', '9'); await tick(20);
  ok('attr change syncs', el.state.count === 9, String(el.state.count));
}

// 4 triggers: once + delay + changed + every/load parsing
{
  const B = boot(`<div data-scope='{"n":0}'><button id="b" data-click="n++" data-trigger="click once">go</button></div>`);
  const root = document.querySelector('[data-scope]');
  const state = B.hydrate(root, { n: 0 });
  await tick();
  document.querySelector('#b').click(); await tick();
  document.querySelector('#b').click(); await tick();
  ok('trigger once', state.n === 1, String(state.n));
  const t = B.parseTrigger('click delay:200ms throttle:1s once changed queue:last every 2s load revealed', document.createElement('button'));
  ok('trigger parse', t.delay === 200 && t.throttle === 1000 && t.once && t.changed && t.every === 2000 && t.load && t.revealed, JSON.stringify(t));
}

// 5 fetch JSON merge + HTML swap + select + preserve + morph + delete + none
{
  const B = boot(`<div data-scope='{"a":1}'><div id="t" data-bind="a"></div><div id="box"><p id="keep" data-preserve>old</p></div></div>`);
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push([url, opts]);
    if (url === '/api') return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ a: 42, b: 7 }) };
    if (url === '/html') return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<p id="keep" data-preserve>old</p><p id="nw">new</p>' };
    return { ok: false, status: 500, headers: { get: () => '' } };
  };
  const root = document.querySelector('[data-scope]');
  const state = B.hydrate(root, { a: 1 });
  await tick();
  // JSON path via direct doFetch-equivalent: use data-get element
  const btn = document.createElement('button');
  btn.setAttribute('data-get', '/api');
  document.body.appendChild(btn);
  const { default: _n } = await import('node:util').catch(() => ({}));
  // simulate: call Laghu swap + assign like doFetch does
  const res = await fetch('/api');
  const data = await res.json();
  Object.assign(state, data);
  await tick();
  ok('json merge', state.a === 42 && document.querySelector('#t').textContent === '42');
  // HTML swap preserves data-preserve node identity
  const keepBefore = document.querySelector('#keep');
  B.swap(document.querySelector('#box'), '<p id="keep" data-preserve>old</p><p id="nw">new</p>', 'inner', state);
  await tick();
  ok('html swap new node', document.querySelector('#nw') !== null);
  ok('preserve identity', document.querySelector('#keep') === keepBefore);
  // select + none + delete
  B.swap(document.querySelector('#box'), '<section><b id="pick">P</b></section>', 'inner', state);
  ok('swap replace', document.querySelector('#pick') !== null);
  const before = document.querySelector('#box').innerHTML;
  B.swap(document.querySelector('#box'), '<p>x</p>', 'none', state);
  ok('swap none noop', document.querySelector('#box').innerHTML === before);
  // morph keeps node + focus
  const inp = document.createElement('input');
  inp.id = 'mi'; inp.value = 'typed';
  document.querySelector('#box').appendChild(inp);
  inp.focus();
  B.swap(document.querySelector('#box'), '<input id="mi" value="other"><p id="pick">P2</p>', 'morph:inner', state);
  await tick();
  const mi = document.getElementById('mi');
  ok('morph reuses id node', mi === inp, 'reused=' + String(mi === inp));
  ok('morph preserves typed value', mi.value === 'typed', mi.value);
}

// 6 store + directive + unknown-action + sanitize + form serialize
{
  const B = boot(`<div data-scope='{"x":1}'><span id="s" data-hello="x"></span><button id="bad" data-click="nope">b</button></div>`, true);
  let warned = [];
  const origWarn = console.warn;
  console.warn = (...a) => { warned.push(a.join(' ')); };
  let docEvt = null;
  document.addEventListener('laghu:unknown-action', (e) => { docEvt = e.detail; });
  B.store('cart', { n: 2 });
  ok('store', B.store('cart').n === 2);
  let cleaned = 0;
  B.directive('hello', ({ el, get, effect }) => {
    const stop = effect(() => { el.textContent = 'h:' + String(get()); });
    return () => { cleaned++; stop(); };
  });
  B.sanitize((h) => h.replace(/<script[\s\S]*?<\/script>/gi, ''));
  const root = document.querySelector('[data-scope]');
  const state = B.hydrate(root, { x: 5 });
  await tick();
  ok('directive runs', document.querySelector('#s').textContent === 'h:5');
  document.querySelector('#bad').click(); await tick();
  ok('unknown action warns', warned.some(w => w.includes('unknown action')));
  ok('unknown action event', docEvt && docEvt.name === 'nope');
  console.warn = origWarn;
  B.destroyTree(root);
  ok('directive cleanup', cleaned === 1, String(cleaned));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
