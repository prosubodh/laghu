import { describe, it, expect } from 'vite-plus/test';
import { LaghuValidate } from '../../src/validate';
import { tick } from '../setup';

function form() {
  const root = document.createElement('div');
  root.innerHTML = `<form id="join" data-form>
    <input name="email" data-validate="required|email"><span data-errors-for="email"></span>
    <input name="age" data-validate="required|number|minv:13|maxv:120"><span data-errors-for="age"></span>
    <input name="pw" type="password" data-validate="required|min:8"><span data-errors-for="pw"></span>
    <input name="pw2" type="password" data-validate="required|match:pw"><span data-errors-for="pw2"></span>
    <button>Join</button>
  </form>`;
  document.body.appendChild(root);
  LaghuValidate.scan(document);
  return document.querySelector('#join') as HTMLFormElement;
}

function slot(name: string) {
  return document.querySelector(`[data-errors-for="${name}"]`)!;
}

function field(name: string) {
  return document.querySelector(`[name="${name}"]`) as HTMLInputElement;
}

describe('LaghuValidate', () => {
  it('exposes a versioned api and parses rules', () => {
    expect(LaghuValidate.version).toBe('1.2.0');
    expect(LaghuValidate.parseRules('required|min:3|match:pw')).toEqual([
      { name: 'required', arg: '' },
      { name: 'min', arg: '3' },
      { name: 'match', arg: 'pw' },
    ]);
  });

  it('stays quiet until touch, then reports and clears', async () => {
    form();
    const email = field('email');
    email.value = 'not-an-email';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    expect(slot('email').textContent).toBe('');
    email.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(slot('email').textContent).toContain('email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.hasAttribute('data-invalid')).toBe(true);
    email.value = 'a@b.co';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    expect(slot('email').textContent).toBe('');
    expect(email.getAttribute('aria-invalid')).toBe('false');
  });

  it('blocks invalid submits and passes valid ones', async () => {
    const f = form();
    field('pw').value = 'secret12';
    field('pw2').value = 'other';
    const ev = new Event('submit', { bubbles: true, cancelable: true });
    f.dispatchEvent(ev);
    await tick();
    expect(ev.defaultPrevented).toBe(true);
    expect(slot('pw2').textContent).toContain('match');
    field('email').value = 'a@b.co';
    field('age').value = '30';
    field('pw2').value = 'secret12';
    const ev2 = new Event('submit', { bubbles: true, cancelable: true });
    f.dispatchEvent(ev2);
    await tick();
    expect(ev2.defaultPrevented).toBe(true); // actionless forms stay local
    expect(LaghuValidate.validateForm(f)).toBe(true);
  });

  it('enforces numeric ranges', () => {
    form();
    const age = field('age');
    age.value = '9';
    age.dispatchEvent(new Event('change', { bubbles: true }));
    expect(slot('age').textContent).toContain('13');
  });
});
