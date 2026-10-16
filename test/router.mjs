import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, 'src', 'laghu.js'), 'utf8');
const routerSrc = fs.readFileSync(path.join(root, 'src', 'router.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra); }
}
async function tick(ms = 10) { await new Promise((r) => setTimeout(r, ms)); }

const dom = new JSDOM('<div id="view"></div>', { runScripts: 'outside-only', url: 'http://localhost/' });
const { window } = dom;
global.window = window; global.document = window.document;
global.HTMLElement = window.HTMLElement; global.Element = window.Element;
global.Node = window.Node;
global.customElements = window.customElements;
global.MutationObserver = window.MutationObserver; global.CustomEvent = window.CustomEvent;
global.Event = window.Event;
global.IntersectionObserver = class { observe() {} disconnect() {} };
window.eval(src);
window.eval(routerSrc);
const Laghu = window.Laghu;
const R = window.LaghuRouter;

ok('router exposes api', !!R && R.version === '1.1.0');
ok('compile static', JSON.stringify(R.compile('/a')( '/a')) === '{}');
ok('compile params', JSON.stringify(R.compile('/u/:id')('/u/42')) === JSON.stringify({ id: '42' }));
ok('compile miss', R.compile('/u/:id')('/x/42') === null);

const seen = [];
const state = Laghu.reactive({ n: 0 });
const stop = R.route({
  target: '#view',
  scope: state,
  actions: { inc() { this.n++; } },
  routes: [
    { path: '/', render: () => '<h1>home</h1>' },
    { path: '/u/:id', render: (p) => '<h1>user ' + p.id + '</h1><button data-click="inc">go</button>' }
  ],
  notfound: () => '<h1>lost</h1>',
  beforeEach: (to) => { seen.push(to.path); return true; },
  afterEach: () => {}
});
await tick(20);
ok('initial route renders', document.querySelector('#view').textContent.includes('home'));
window.location.hash = '#/u/42';
await tick(30);
ok('param route renders', document.querySelector('#view').textContent.includes('user 42'));
ok('guard saw paths', seen.join(',').includes('/u/42'), seen.join(','));
document.querySelector('#view button').click();
await tick();
ok('routed actions wired', state.n === 1, String(state.n));
ok('current tracks', R.current().params.id === '42');
window.location.hash = '#/nope';
await tick(30);
ok('notfound renders', document.querySelector('#view').textContent.includes('lost'));

// guard blocks
const seen2 = [];
const stop2 = R.route({
  target: '#view',
  scope: {},
  routes: [{ path: '/x', render: () => 'x' }],
  notfound: () => 'lost2',
  beforeEach: (to) => { seen2.push(to.path); return false; }
});
const beforeGuard = document.querySelector('#view').textContent;
window.location.hash = '#/x';
await tick(30);
ok('guard cancels render', document.querySelector('#view').textContent === beforeGuard);
stop2();
stop();
R.navigate('/u/7');
await tick(30);
ok('navigate sets hash', window.location.hash === '#/u/7');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
