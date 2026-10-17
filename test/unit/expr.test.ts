import { describe, it, expect } from 'vite-plus/test';
import { Laghu } from '../../src/laghu';

const scope = {
  count: 6,
  price: 3,
  qty: 4,
  open: false,
  name: 'Ada',
  user: { name: 'Bo' },
  list: [10, 20, 30],
  map: { k: 'v' },
  add(a: number, b: number) { return a + b; },
  reset() { return 'r'; },
};

describe('evalExpr grammar', () => {
  it.each([
    ['count > 5', true],
    ['user.name', 'Bo'],
    ['!open', true],
    ['price * qty', 12],
    ['price * qty + 1', 13],
    ['(price + 1) * qty', 16],
    ['10 - 3 - 2', 5],
    ['20 / 4', 5],
    ['7 % 3', 1],
    ['count > 5 ? "big" : "small"', 'big'],
    ['open ? 1 : 2', 2],
    ['add(2, 3)', 5],
    ['add(price, qty)', 7],
    ['reset()', 'r'],
    ['list[0]', 10],
    ['list[2]', 30],
    ['map["k"]', 'v'],
    ["map['k']", 'v'],
    ['"a" + "b"', 'ab'],
    ['name + "!"', 'Ada!'],
    ['count >= 6 && price < 5', true],
    ['-qty', -4],
    ['!open && count', 6],
  ])('evaluates %s', (expr, want) => {
    expect(Laghu.eval(scope, expr)).toEqual(want);
  });

  it('returns undefined for unknown paths', () => {
    expect(Laghu.eval(scope, 'nope')).toBeUndefined();
    expect(Laghu.eval(scope, 'count++')).toBeUndefined();
  });

  it('blocks prototype gadgets', () => {
    expect(Laghu.eval({}, 'constructor.name')).toBeUndefined();
    expect(Laghu.eval({}, '__proto__.x')).toBeUndefined();
    expect(Laghu.eval({}, 'add(1)')).toBeUndefined();
  });
});

describe('get/set paths', () => {
  it('reads dotted paths and misses', () => {
    expect(Laghu.get({ user: { name: 'x' } }, 'user.name')).toBe('x');
    expect(Laghu.get({}, 'missing.deep')).toBeUndefined();
  });

  it('writes create intermediate objects', () => {
    const s: any = {};
    Laghu.set(s, 'user.name', 'Ada');
    expect(s).toEqual({ user: { name: 'Ada' } });
  });

  it('refuses pollution segments', () => {
    const s: any = {};
    Laghu.set(s, '__proto__.pwned', 1);
    expect(({} as any).pwned).toBeUndefined();
    Laghu.set(s, 'constructor.x', 1);
    expect(s.constructor).toBe(Object);
  });

  it('writes through scope chains to the owner', () => {
    const parent: any = { n: 0 };
    const child = Object.create(parent);
    Laghu.set(child, 'n', 9);
    expect(parent.n).toBe(9);
    expect(Object.prototype.hasOwnProperty.call(child, 'n')).toBe(false);
  });

  it('missed reads subscribe late-added keys', async () => {
    const s = Laghu.reactive({} as any);
    let seen: any = 'empty';
    Laghu.effect(() => { seen = Laghu.get(s, 'future.key') ?? 'empty'; });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBe('empty');
    Laghu.set(s, 'future', { key: 'now' });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBe('now');
  });
});
