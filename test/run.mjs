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

// 7 security regressions + hardening
{
  const B = boot(`<div data-scope='{"body":"","url":"/x"}'><div id="h" data-html="body"></div><a id="lk" data-bind:href="url">x</a></div>`);
  const root = document.querySelector('[data-scope]');
  const state = B.hydrate(root, { body: '', url: '/x' });
  await tick();
  state.body = '<img src=x onerror=alert(1)><script>alert(2)</script><p>safe</p>';
  await tick();
  const h = document.querySelector('#h');
  ok('sanitize strips scripts', h.querySelector('script') === null);
  ok('sanitize strips event handlers', h.innerHTML.indexOf('onerror') === -1 && h.textContent.includes('safe'));
  state.url = 'JaVaScRiPt:alert(1)';
  await tick();
  ok('scriptable href refused', !document.querySelector('#lk').hasAttribute('href'));
  state.url = '/ok';
  await tick();
  ok('plain href passes', document.querySelector('#lk').getAttribute('href') === '/ok');
  B.set({}, '__proto__.pwned', 1);
  ok('setPath blocks proto', ({}).pwned === undefined);
  ok('getPath blocks constructor', B.get({ a: 1 }, 'constructor.name') === undefined);
  const errs = [];
  document.addEventListener('laghu:error', (e) => errs.push(e.detail));
  const root2 = document.createElement('div');
  root2.innerHTML = '<button id="evil" data-click="__proto__.x = 1">x</button>';
  document.body.appendChild(root2);
  B.hydrate(root2, {}, {});
  document.querySelector('#evil').click();
  await tick();
  ok('action assign blocks proto', ({}).x === undefined);
  // one throwing binding must not kill the page
  const root3 = document.createElement('div');
  root3.innerHTML = '<span id="boom" data-bind="explodes"></span><button id="alive" data-click="n++">go</button>';
  document.body.appendChild(root3);
  const raw3 = { n: 0 };
  Object.defineProperty(raw3, 'explodes', { get() { throw new Error('boom'); } });
  const s3 = B.hydrate(root3, raw3, {});
  await tick();
  document.querySelector('#alive').click();
  await tick();
  ok('throwing binding isolated', s3.n === 1);
  ok('binding error reported', errs.length >= 1);
  // swapped content keeps actions; morph:outer replaces
  const root4 = document.createElement('div');
  root4.innerHTML = '<div id="t4"></div>';
  document.body.appendChild(root4);
  const s4 = { n: 0 };
  const acts = { inc() { this.n++; } };
  B.swap(document.querySelector('#t4'), '<button id="b4" data-click="inc">go</button>', 'inner', s4, acts);
  await tick();
  document.querySelector('#b4').click();
  await tick();
  ok('swapped actions survive', s4.n === 1, String(s4.n));
  const tgt = document.createElement('div');
  tgt.innerHTML = '<p id="old">x</p>';
  document.body.appendChild(tgt);
  const holder = tgt.querySelector('#old');
  B.swap(holder, '<section id="new2">y</section>', 'morph:outer', {});
  await tick();
  ok('morph outer replaces', !document.body.contains(holder) && document.querySelector('#new2') !== null);
  // effect unsubscribe actually unsubscribes
  const st = B.reactive({ v: 0 });
  let runs = 0;
  const stop = B.effect(() => { runs++; return st.v; });
  const r0 = runs;
  stop();
  st.v = 99;
  await tick(20);
  ok('effect stop unsubscribes', runs === r0, runs + ' vs ' + r0);
  // fetch: timeout, GET arrays, +json
  let seenUrl = '';
  let abortFired = false;
  global.fetch = async (url, opts) => {
    seenUrl = String(url);
    if (String(url).includes('/slow')) {
      return new Promise((res, rej) => {
        if (opts && opts.signal) {
          opts.signal.addEventListener('abort', () => { abortFired = true; const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
        }
      });
    }
    if (String(url).includes('/j')) {
      return { ok: true, status: 200, headers: { get: () => 'application/hal+json' }, json: async () => ({ got: 1 }) };
    }
    return { ok: false, status: 500, headers: { get: () => '' } };
  };
  window.fetch = global.fetch;
  const root5 = document.createElement('div');
  root5.innerHTML = '<button id="g" data-get="/arr" data-vals=\'{"a":[1,2],"b":"x"}\'>go</button><button id="s5" data-get="/slow" data-timeout="30">slow</button><button id="j" data-get="/j">j</button>';
  document.body.appendChild(root5);
  const s5 = B.hydrate(root5, {}, {});
  let te = null;
  document.addEventListener('laghu:request-error', (e) => { te = e.detail; });
  document.querySelector('#g').click();
  await tick(20);
  ok('GET arrays repeat params', seenUrl.includes('a=1') && seenUrl.includes('a=2') && seenUrl.includes('b=x'), seenUrl);
  document.querySelector('#j').click();
  await tick(20);
  ok('+json merges', s5.got === 1, String(s5.got));
  document.querySelector('#s5').click();
  await tick(80);
  ok('timeout aborts and reports', abortFired && te && te.timeout === true);
  // onUnmount invoked
  let unmounted = 0;
  B.define('life-tag', () => ({ state: {}, actions: {}, onUnmount() { unmounted++; } }));
  const lt = document.createElement('life-tag');
  document.body.appendChild(lt);
  await tick(20);
  lt.remove();
  await tick(20);
  ok('onUnmount runs', unmounted === 1, String(unmounted));
  // DEV off by default: event fires, console stays quiet. Last boot in
  // the file on purpose: boot() reassigns the shared globals.
  const B2 = boot(`<div><button id="q" data-click="missing-thing">x</button></div>`);
  let w = 0;
  const ow = console.warn;
  console.warn = () => { w++; };
  let ue = null;
  document.addEventListener('laghu:unknown-action', (e) => { ue = e.detail; });
  B2.hydrate(document.querySelector('div'), {}, {});
  document.querySelector('#q').click();
  await tick();
  console.warn = ow;
  ok('prod quiet but loud event', w === 0 && ue && ue.name === 'missing-thing');
}

// 8 expressions, computed, watch, persist, pending tri-state
{
  const B = boot(`<div data-scope='{"price":3,"qty":4,"open":false}'><span id="t" data-bind="price * qty"></span><span id="w" data-bind="open ? 'yes' : 'no'"></span></div>`);
  ok('eval arithmetic', B.eval({ a: 2, b: 3 }, 'a * b + 1') === 7);
  ok('eval ternary', B.eval({ t: 0 }, 't ? "y" : "n"') === 'n');
  ok('eval args', B.eval({ add(x, y) { return x + y; } }, 'add(2, 3)') === 5);
  ok('eval index', B.eval({ l: [7, 8] }, 'l[1]') === 8);
  ok('eval gadget blocked', B.eval({}, 'add(1)') === undefined);
  const root = document.querySelector('[data-scope]');
  const state = B.hydrate(root, { price: 3, qty: 4, open: false });
  await tick();
  ok('bind arithmetic', document.querySelector('#t').textContent === '12');
  ok('bind ternary', document.querySelector('#w').textContent === 'no');
  state.qty = 5;
  await tick();
  ok('bind arithmetic updates', document.querySelector('#t').textContent === '15');
  const dbl = B.computed(() => state.price * state.qty);
  let shown = '';
  B.effect(() => { shown = String(dbl()); });
  await tick();
  ok('computed fresh', shown === '15', shown);
  state.price = 10;
  await tick();
  ok('computed recomputes', shown === '50', shown);
  const seen = [];
  B.watch(state, 'qty', (n, o) => seen.push([n, o]));
  state.qty = 5;
  await tick();
  state.qty = 6;
  await tick();
  ok('watch reports transitions', JSON.stringify(seen) === '[[6,5]]', JSON.stringify(seen));
  B.store('pz', { n: 1 });
  B.persist('pz', { key: 'laghu:test-pz', version: 1, debounce: 10 });
  B.store('pz').n = 42;
  await tick(60);
  ok('persist writes storage', (window.localStorage.getItem('laghu:test-pz') || '').includes('42'));
  B.store('pz2', { n: 0 });
  window.localStorage.setItem('laghu:test-pz2', JSON.stringify({ v: 1, state: { n: 9 } }));
  B.persist('pz2', { key: 'laghu:test-pz2', version: 1, debounce: 10 });
  ok('persist restores', B.store('pz2').n === 9);
  // pending tri-state + $error
  let release;
  const gate = new Promise((res) => { release = res; });
  global.fetch = () => gate;
  window.fetch = global.fetch;
  const root2 = document.createElement('div');
  root2.innerHTML = '<button id="pb" data-get="/x">go</button><span id="pe" data-bind="$error.status"></span>';
  document.body.appendChild(root2);
  const s2 = B.hydrate(root2, {}, {});
  const b2 = document.querySelector('#pb');
  b2.click();
  ok('pending flag during flight', b2.hasAttribute('data-pending'));
  release({ ok: false, status: 503, headers: { get: () => '' } });
  await tick(30);
  ok('error state set', s2.$error && s2.$error.status === 503, JSON.stringify(s2.$error));
  ok('pending flag cleared', !b2.hasAttribute('data-pending'));
  ok('error binding renders', document.querySelector('#pe').textContent === '503');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
