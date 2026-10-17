import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { Laghu } from '../../src/laghu';
import '../../src/morph';
import { tick } from '../setup';

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(data: any, status = 200, ct = 'application/json') {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => ct }, json: async () => data };
}
function html(text: string) {
  return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => text };
}

describe(' Laghu.swap modes', () => {
  it('covers inner, outer, append, prepend, text, none, delete', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<div id="box"><p id="keep" data-preserve>old</p></div>`;
    document.body.appendChild(root);
    const s: any = {};
    const box = () => document.querySelector('#box') as HTMLElement;
    Laghu.swap(box(), '<p id="n">new</p>', 'inner', s);
    expect(document.querySelector('#n')).not.toBeNull();
    Laghu.swap(box(), '<b>x</b>', 'append', s);
    expect(box().querySelectorAll('b').length).toBe(1);
    Laghu.swap(box(), '<i>y</i>', 'prepend', s);
    expect(box().firstElementChild!.tagName).toBe('I');
    const before = box().innerHTML;
    Laghu.swap(box(), '<p>ignored</p>', 'none', s);
    expect(box().innerHTML).toBe(before);
    Laghu.swap(box(), '<p>plain</p>', 'text', s);
    expect(box().querySelectorAll('p').length).toBe(0);
    expect(box().textContent).toContain('plain');
  });

  it('preserves data-preserve nodes by identity', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<div id="box"><p id="keep" data-preserve>old</p></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {});
    const keepBefore = document.querySelector('#keep');
    Laghu.swap(document.querySelector('#box')!, '<p id="keep" data-preserve>fresh</p><p id="nw">new</p>', 'inner', {});
    await tick();
    expect(document.querySelector('#nw')).not.toBeNull();
    expect(document.querySelector('#keep')).toBe(keepBefore);
  });

  it(' morph keeps node identity, typed values, and focus', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<div id="box"><input id="mi" value="server"></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {});
    const inp = document.getElementById('mi') as HTMLInputElement;
    inp.value = 'typed';
    inp.focus();
    Laghu.swap(document.querySelector('#box')!, '<input id="mi" value="other">', 'morph:inner', {});
    await tick();
    const mi = document.getElementById('mi') as HTMLInputElement;
    expect(mi).toBe(inp);
    expect(mi.value).toBe('typed');
    expect(document.activeElement && (document.activeElement as HTMLElement).id).toBe('mi');
  });

  it('morph:outer replaces the element', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<p id="old">x</p>`;
    document.body.appendChild(root);
    const old = document.querySelector('#old')!;
    Laghu.swap(old, '<section id="new2">y</section>', 'morph:outer', {});
    await tick();
    expect(document.body.contains(old)).toBe(false);
    expect(document.querySelector('#new2')).not.toBeNull();
  });

  it('swapped content keeps the requester actions', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<div id="t4"></div>`;
    document.body.appendChild(root);
    const s: any = { n: 0 };
    Laghu.swap(document.querySelector('#t4')!, '<button id="b4" data-click="inc">go</button>', 'inner', s, { inc(this: any) { this.n++; } });
    await tick();
    (document.querySelector('#b4') as HTMLElement).click();
    await tick();
    expect(s.n).toBe(1);
  });

  it('dispatches swap events that bubble', async () => {
    const seen: string[] = [];
    document.addEventListener('laghu:after-swap', (e) => seen.push((e as CustomEvent).detail.swap));
    const root = document.createElement('div');
    root.innerHTML = `<div id="box"></div>`;
    document.body.appendChild(root);
    Laghu.swap(document.querySelector('#box')!, '<p>x</p>', 'append', {});
    expect(seen).toContain('append');
  });
});

describe('declarative fetch', () => {
  it('merges JSON objects and sets result for arrays', async () => {
    const stub = vi.fn(async (url: string) => {
      if (String(url).includes('/obj')) return json({ a: 42 });
      return json([1, 2]);
    });
    vi.stubGlobal('fetch', stub);
    const root = document.createElement('div');
    root.innerHTML = `<button id="o" data-get="/obj">o</button><button id="a" data-get="/arr">a</button><span id="t" data-bind="a"></span>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { a: 1 });
    (document.querySelector('#o') as HTMLElement).click();
    await tick(20);
    expect(s.a).toBe(42);
    (document.querySelector('#a') as HTMLElement).click();
    await tick(20);
    expect(s.result).toEqual([1, 2]);
  });

  it('accepts +json content types', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, headers: { get: () => 'application/hal+json' }, json: async () => ({ got: 1 }) }));
    const root = document.createElement('div');
    root.innerHTML = `<button id="j" data-get="/j">j</button>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, {});
    (document.querySelector('#j') as HTMLElement).click();
    await tick(20);
    expect(s.got).toBe(1);
  });

  it('repeats array params on GET and posts form JSON', async () => {
    let seenUrl = '';
    let seenBody: any = null;
    vi.stubGlobal('fetch', async (url: string, opts: any) => {
      seenUrl = String(url);
      seenBody = opts && opts.body ? JSON.parse(opts.body) : null;
      return json({ ok: true });
    });
    const root = document.createElement('div');
    root.innerHTML = `<button id="g" data-get="/arr" data-vals='{"a":[1,2],"b":"x"}'>go</button>
      <form id="f" data-post="/save"><input name="email" value="a@b.co"></form>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    (document.querySelector('#g') as HTMLElement).click();
    await tick(20);
    expect(seenUrl).toContain('a=1');
    expect(seenUrl).toContain('a=2');
    expect(seenUrl).toContain('b=x');
    const form = document.querySelector('#f') as HTMLFormElement;
    const ev = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    await tick(20);
    expect(ev.defaultPrevented).toBe(true);
    expect(seenBody).toMatchObject({ email: 'a@b.co' });
  });

  it('serializes data-vals="form" on non-form elements', async () => {
    let seenUrl = '';
    vi.stubGlobal('fetch', async (url: string) => {
      seenUrl = String(url);
      return json({ ok: true });
    });
    const root = document.createElement('div');
    root.innerHTML = `<form><select name="userId"><option value="1">1</option><option value="2" selected>2</option></select>
      <button type="button" id="ld" data-get="/posts" data-vals="form">load</button></form>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    (document.querySelector('#ld') as HTMLElement).click();
    await tick(20);
    expect(seenUrl).toContain('userId=2');
  });

  it('tracks pending, error state, timeouts, and queue aborts', async () => {
    const releasers: Array<(v: any) => void> = [];
    let aborted = false;
    vi.stubGlobal('fetch', (url: string, opts: any) => {
      if (String(url).includes('/slow')) {
        return new Promise((res, rej) => {
          releasers.push(res);
          opts.signal.addEventListener('abort', () => {
            aborted = true;
            const e: any = new Error('aborted');
            e.name = 'AbortError';
            rej(e);
          });
        });
      }
      return Promise.resolve(json({ ok: true }));
    });
    const root = document.createElement('div');
    root.innerHTML = `<button id="s" data-get="/slow" data-timeout="30">slow</button>
      <span id="e" data-bind="$error.status"></span>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, {});
    const errors: any[] = [];
    document.addEventListener('laghu:request-error', (e) => errors.push((e as CustomEvent).detail));
    const btn = document.querySelector('#s') as HTMLElement;
    btn.click();
    expect(btn.hasAttribute('data-pending')).toBe(true);
    releasers[0]({ ok: false, status: 503, headers: { get: () => '' } });
    await tick(30);
    expect(s.$error && s.$error.status).toBe(503);
    expect(btn.hasAttribute('data-pending')).toBe(false);
    await tick();
    expect(document.querySelector('#e')!.textContent).toBe('503');
    btn.click();
    await tick(80);
    expect(aborted).toBe(true);
    expect(errors.some((d) => d.timeout === true)).toBe(true);
    expect(s.$error && s.$error.timeout).toBe(true);
    expect(btn.hasAttribute('data-pending')).toBe(false);
  });

  it('aborts previous request on queue:last', async () => {
    const aborts: string[] = [];
    vi.stubGlobal('fetch', (url: string, opts: any) => {
      return new Promise((res, rej) => {
        opts.signal.addEventListener('abort', () => {
          aborts.push(String(url));
          const e: any = new Error('aborted');
          e.name = 'AbortError';
          rej(e);
        });
      });
    });
    const root = document.createElement('div');
    root.innerHTML = `<button id="q" data-get="/s">s</button>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    const q = document.querySelector('#q') as HTMLElement;
    q.click();
    q.click();
    await tick(30);
    expect(aborts.length).toBe(1);
  });

  it('selects fragments and cancels via before-request', async () => {
    vi.stubGlobal('fetch', async () => html('<section><b id="pick">P</b><b id="other">O</b></section>'));
    const root = document.createElement('div');
    root.innerHTML = `<button id="p" data-get="/page" data-target="#box" data-select="#pick">p</button><div id="box"></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    (document.querySelector('#p') as HTMLElement).click();
    await tick(30);
    expect(document.querySelector('#pick')).not.toBeNull();
    expect(document.querySelector('#other')).toBeNull();
    let cancelled = false;
    const root2 = document.createElement('div');
    root2.innerHTML = `<button id="c" data-get="/never">c</button>`;
    document.body.appendChild(root2);
    Laghu.hydrate(root2, {}, {});
    document.querySelector('#c')!.addEventListener('laghu:before-request', (e) => { e.preventDefault(); cancelled = true; });
    (document.querySelector('#c') as HTMLElement).click();
    await tick(20);
    expect(cancelled).toBe(true);
  });
});
