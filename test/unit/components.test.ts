import { describe, it, expect } from 'vite-plus/test';
import { Laghu } from '../../src/laghu';
import { tick } from '../setup';

let tagN = 0;
function tag(base: string) {
  tagN++;
  return `${base}-${tagN}`;
}

describe('define', () => {
  it('hydrates light DOM and wires actions', async () => {
    const t = tag('t-counter');
    document.body.innerHTML = `<${t}><strong data-bind="count">0</strong><button data-click="increment">+</button></${t}>`;
    Laghu.define(t, () => ({ state: { count: 0 }, actions: { increment(this: any) { this.count++; } } }));
    await tick();
    expect(document.querySelector('strong')!.textContent).toBe('0');
    document.querySelector('button')!.click();
    await tick();
    expect(document.querySelector('strong')!.textContent).toBe('1');
  });

  it('syncs primitive attributes into state', async () => {
    const t = tag('t-badge');
    document.body.innerHTML = `<${t} count="5" label="hi"></${t}>`;
    Laghu.define(t, () => ({ state: { count: 0, label: '' } }));
    await tick();
    const el: any = document.querySelector(t);
    expect(el.state.count).toBe(5);
    expect(el.state.label).toBe('hi');
    el.setAttribute('count', '9');
    await tick(20);
    expect(el.state.count).toBe(9);
  });

  it('upgrades pre-defined properties', async () => {
    const t = tag('t-up');
    document.body.innerHTML = `<${t}></${t}>`;
    const el: any = document.querySelector(t);
    el.user = { name: 'Zed' };
    Laghu.define(t, () => ({ state: { user: null as any } }));
    await tick();
    expect(el.state.user).toEqual({ name: 'Zed' });
  });

  it('runs mount and unmount hooks', async () => {
    const t = tag('t-life');
    let mounted = 0, unmounted = 0, events = 0;
    document.body.innerHTML = `<${t}></${t}>`;
    Laghu.define(t, () => ({
      state: {},
      actions: {},
      onMount() { mounted++; },
      onUnmount() { unmounted++; },
    }));
    const el = document.querySelector(t)!;
    el.addEventListener('laghu:unmount', () => { events++; });
    await tick(20);
    expect(mounted).toBe(1);
    el.remove();
    await tick(20);
    expect(unmounted).toBe(1);
    expect(events).toBe(1);
  });

  it('requires hyphenated tags', () => {
    expect(() => Laghu.define('nope', () => ({}))).toThrow();
  });

  it('keeps instances independent', async () => {
    const t = tag('t-card');
    document.body.innerHTML =
      `<${t} name="Grace"><span data-bind="name"></span> <span data-bind="likes"></span> <button data-click="like">l</button></${t}>` +
      `<${t} name="Ada"><span data-bind="name"></span> <span data-bind="likes"></span> <button data-click="like">l</button></${t}>`;
    Laghu.define(t, () => ({
      state: { name: '', likes: 0 },
      actions: { like(this: any) { this.likes++; } },
      observed: ['name'],
    }));
    await tick(20);
    const cards = [...document.querySelectorAll(t)] as any[];
    cards[0].querySelector('button').click();
    await tick();
    expect(cards[0].state.likes).toBe(1);
    expect(cards[1].state.likes).toBe(0);
    cards[0].setAttribute('name', 'Hopper');
    await tick();
    expect(cards[0].querySelector('span').textContent).toBe('Hopper');
  });
});

describe('store sharing across islands', () => {
  it('syncs two islands through $store', async () => {
    Laghu.store('u-cart', { count: 0, name: 'Ada' });
    const actions = {
      inc() { Laghu.store('u-cart').count++; },
      dec() { Laghu.store('u-cart').count--; },
    };
    const a = document.createElement('div');
    a.innerHTML = `<p><span data-bind="$store.u-cart.count"></span></p><button data-click="inc">+</button><button data-click="dec">-</button>`;
    const b = document.createElement('div');
    b.innerHTML = `<p><span data-bind="$store.u-cart.count"></span></p><input data-model="$store.u-cart.name"><span data-bind="$store.u-cart.name"></span>`;
    document.body.append(a, b);
    Laghu.hydrate(a, {}, actions);
    Laghu.hydrate(b, {}, actions);
    await tick();
    a.querySelectorAll('button')[0].click();
    await tick();
    const spans = [...document.querySelectorAll('span')].filter((s) => s.textContent === '1');
    expect(spans.length).toBe(2);
    const input = b.querySelector('input') as HTMLInputElement;
    input.value = 'Bo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(Laghu.store('u-cart').name).toBe('Bo');
  });
});
