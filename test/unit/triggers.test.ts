import { describe, it, expect } from 'vite-plus/test';
import { Laghu } from '../../src/laghu';
import { tick } from '../setup';

describe('parseTrigger', () => {
  it('defaults by tag', () => {
    const btn = document.createElement('button');
    expect(Laghu.parseTrigger('', btn).on).toBe('click');
    const form = document.createElement('form');
    expect(Laghu.parseTrigger('', form).on).toBe('submit');
    const input = document.createElement('input');
    expect(Laghu.parseTrigger('', input).on).toBe('change');
  });

  it('parses every modifier', () => {
    const t = Laghu.parseTrigger(
      'click delay:200ms throttle:1s once changed queue:last every 2s load revealed',
      document.createElement('button'),
    );
    expect(t).toMatchObject({
      on: 'click', delay: 200, throttle: 1000, once: true,
      changed: true, queue: 'last', every: 2000, load: true, revealed: true,
    });
  });

  it('parses seconds and queues', () => {
    const el = document.createElement('button');
    expect(Laghu.parseTrigger('every 5s', el).every).toBe(5000);
    expect(Laghu.parseTrigger('click queue:first', el).queue).toBe('first');
    expect(Laghu.parseTrigger('click from:document', el).from).toBe('document');
  });
});

describe('store and persist', () => {
  it('creates and fetches named stores', () => {
    Laghu.store('t-cart', { n: 2 });
    expect(Laghu.store('t-cart').n).toBe(2);
  });

  it('reads stores in expressions', () => {
    Laghu.store('t-read', { n: 7 });
    expect(Laghu.eval({}, '$store.t-read.n')).toBe(7);
  });

  it('persists and restores versioned state', async () => {
    Laghu.store('t-pz', { n: 1 });
    Laghu.persist('t-pz', { key: 'laghu:test-pz', version: 1, debounce: 10 });
    Laghu.store('t-pz').n = 42;
    await tick(60);
    expect(window.localStorage.getItem('laghu:test-pz') || '').toContain('42');
    Laghu.store('t-pz2', { n: 0 });
    window.localStorage.setItem('laghu:test-pz2', JSON.stringify({ v: 1, state: { n: 9 } }));
    Laghu.persist('t-pz2', { key: 'laghu:test-pz2', version: 1, debounce: 10 });
    expect(Laghu.store('t-pz2').n).toBe(9);
  });

  it('reseeds on version mismatch', () => {
    Laghu.store('t-pz3', { n: 1 });
    window.localStorage.setItem('laghu:test-pz3', JSON.stringify({ v: 999, state: { n: 5 } }));
    Laghu.persist('t-pz3', { key: 'laghu:test-pz3', version: 1, debounce: 10 });
    expect(Laghu.store('t-pz3').n).toBe(1);
  });
});
