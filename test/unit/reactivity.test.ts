import { describe, it, expect } from 'vite-plus/test';
import { Laghu } from '../../src/laghu';
import { tick } from '../setup';

describe('reactive', () => {
  it('tracks reads and triggers writes', async () => {
    const s = Laghu.reactive({ n: 0 });
    let seen = -1;
    Laghu.effect(() => { seen = s.n; });
    expect(seen).toBe(0);
    s.n = 5;
    await tick();
    expect(seen).toBe(5);
  });

  it('batches synchronous writes into one run', async () => {
    const s = Laghu.reactive({ n: 0 });
    let runs = 0;
    Laghu.effect(() => { runs++; return s.n; });
    s.n = 1; s.n = 2; s.n = 3;
    await tick();
    expect(runs).toBe(2); // initial + one batched
  });

  it('wraps nested objects lazily', async () => {
    const s = Laghu.reactive({ user: { name: 'a' } });
    let seen = '';
    Laghu.effect(() => { seen = s.user.name; });
    s.user.name = 'b';
    await tick();
    expect(seen).toBe('b');
  });

  it('returns the same proxy for the same object', () => {
    const raw = { a: 1 };
    expect(Laghu.reactive(raw)).toBe(Laghu.reactive(raw));
  });

  it('passes primitives through', () => {
    expect(Laghu.reactive(5 as any)).toBe(5);
  });

  it('stop() unsubscribes fully', async () => {
    const s = Laghu.reactive({ v: 0 });
    let runs = 0;
    const stop = Laghu.effect(() => { runs++; return s.v; });
    const before = runs;
    stop();
    s.v = 99;
    await tick(20);
    expect(runs).toBe(before);
  });

  it('nested effects compose without clobbering outer deps', async () => {
    const s = Laghu.reactive({ a: 0, b: 0 });
    let outer = -1;
    Laghu.effect(() => {
      Laghu.effect(() => { return s.b; });
      outer = s.a;
    });
    s.a = 7;
    await tick();
    expect(outer).toBe(7);
  });

  it('conditional branches release untaken paths', async () => {
    const s = Laghu.reactive({ on: true, x: 0, y: 0 });
    let runs = 0;
    Laghu.effect(() => { runs++; return s.on ? s.x : s.y; });
    const base = runs;
    s.y = 42; // untaken while on === true
    await tick(20);
    expect(runs).toBe(base);
    s.on = false;
    await tick();
    const afterFlip = runs;
    s.y = 43;
    await tick();
    expect(runs).toBe(afterFlip + 1);
  });
});

describe('computed', () => {
  it('derives and stays fresh', async () => {
    const s = Laghu.reactive({ price: 3, qty: 4 });
    const total = Laghu.computed(() => s.price * s.qty);
    let shown = -1;
    Laghu.effect(() => { shown = total(); });
    await tick();
    expect(shown).toBe(12);
    s.qty = 5;
    await tick();
    expect(shown).toBe(15);
  });
});

describe('watch', () => {
  it('reports transitions, skipping initial value', async () => {
    const s = Laghu.reactive({ qty: 5 });
    const seen: Array<[any, any]> = [];
    Laghu.watch(s, 'qty', (n, o) => seen.push([n, o]));
    s.qty = 5;
    await tick();
    s.qty = 6;
    await tick();
    expect(seen).toEqual([[6, 5]]);
  });
});
