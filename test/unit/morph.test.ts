import { describe, it, expect } from 'vite-plus/test';
import { Laghu } from '../../src/laghu';
import { LaghuMorph } from '../../src/morph';
import { tick } from '../setup';

function morphEd(oldHtml: string, newHtml: string) {
  (window as any).Laghu = Laghu;
  (window as any).LaghuMorph = LaghuMorph;
  const host = document.createElement('div');
  host.innerHTML = `<div id="t">${oldHtml}</div>`;
  document.body.appendChild(host);
  const target = document.querySelector('#t')!;
  LaghuMorph.morph(target, newHtml, {});
  return target;
}

describe('LaghuMorph', () => {
  it('syncs, adds, and removes attributes', () => {
    const t = morphEd(`<p id="a" class="x" title="old">t</p>`, `<p id="a" class="y">t</p>`);
    const p = t.querySelector('#a')!;
    expect(p.getAttribute('class')).toBe('y');
    expect(p.hasAttribute('title')).toBe(false);
  });

  it('syncs unfocused inputs and checkboxes, preserves focused ones', () => {
    const t = morphEd(
      `<input id="a" value="typed"><input id="c" type="checkbox">`,
      `<input id="a" value="server"><input id="c" type="checkbox" checked>`,
    );
    const a = document.getElementById('a') as HTMLInputElement;
    // not focused in happy-dom by default: takes server value
    expect(a.value).toBe('server');
    expect((document.getElementById('c') as HTMLInputElement).checked).toBe(true);
  });

  it('reuses data-bkey rows across moves', () => {
    const t = morphEd(
      `<li data-bkey="1">one</li><li data-bkey="2">two</li>`,
      `<li data-bkey="2">two!</li><li data-bkey="1">one</li>`,
    );
    const rows = [...t.querySelectorAll('li')];
    expect(rows.map((r) => r.textContent)).toEqual(['two!', 'one']);
  });

  it('replaces on tag mismatch', () => {
    const t = morphEd(`<p id="a">x</p>`, `<section id="a">y</section>`);
    expect(t.querySelector('section#new2, section#a')).not.toBeNull();
    expect(t.querySelector('p#a')).toBeNull();
  });

  it('preserves the target element attributes in inner mode', () => {
    const t = morphEd(`<li id="r1">one</li>`, `<li id="r1">one!</li>`);
    expect(t.id).toBe('t');
    expect(document.querySelector('#t')).toBe(t);
  });

  it('updates text and drops stale children with cleanup', () => {
    let cleaned = 0;
    const host = document.createElement('div');
    host.innerHTML = `<div id="t"><b id="gone">x</b><i id="keep">y</i></div>`;
    document.body.appendChild(host);
    const stale = document.querySelector('#gone')!;
    (stale as any)._bcu = [() => { cleaned++; }];
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    LaghuMorph.morph(document.querySelector('#t')!, `<i id="keep">y2</i>`, {});
    expect(document.querySelector('#gone')).toBeNull();
    expect(cleaned).toBe(1);
    expect(document.querySelector('#keep')!.textContent).toBe('y2');
  });

  it('freezes data-morph-skip subtrees', () => {
    const t = morphEd(
      `<div id="s" data-morph-skip><b>old</b></div>`,
      `<div id="s" data-morph-skip><b>new</b></div>`,
    );
    expect(t.querySelector('#s b')!.textContent).toBe('old');
  });

  it('supports outer mode', () => {
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    const host = document.createElement('div');
    host.innerHTML = `<p id="o">x</p>`;
    document.body.appendChild(host);
    const old = document.querySelector('#o')!;
    LaghuMorph.morph(old, `<section id="o2">y</section>`, { mode: 'outer' });
    expect(document.body.contains(old)).toBe(false);
    expect(document.querySelector('#o2')).not.toBeNull();
  });

  it('keeps pre whitespace intact', () => {
    const t = morphEd(`<pre id="p">a  b</pre>`, `<pre id="p">a  b</pre>`);
    expect(t.querySelector('#p')!.textContent).toBe('a  b');
  });

  it('morphs through Laghu.swap end to end', async () => {
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    const root = document.createElement('div');
    root.innerHTML = `<ul id="l"><li id="r1">one</li></ul>`;
    document.body.appendChild(root);
    const before = document.querySelector('#r1');
    Laghu.swap(document.querySelector('#l')!, `<li id="r1">ONE</li><li id="r2">two</li>`, 'morph:inner', {});
    await tick();
    expect(document.querySelector('#r1')).toBe(before);
    expect(document.querySelector('#r1')!.textContent).toBe('ONE');
    expect(document.querySelector('#r2')).not.toBeNull();
  });
});
