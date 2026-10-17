// @ts-check
/**
 * laghu validation plugin (opt-in, separate file, own 2kB gzip budget).
 *
 * Declarative rules on inputs, errors next to fields, submit guards
 * on forms. No schemas, no build: rules are attribute text, messages
 * are plain strings, and everything stays CSP-safe.
 *
 * Rules (pipe separated): required, email, number, min:N (length),
 * max:N (length), minv:N (value), maxv:N (value), match:otherName.
 *
 * Wiring: inputs carry data-validate, error slots carry
 * data-errors-for="fieldname", forms carry data-form to block
 * invalid submits and focus the first offender. Live validation
 * starts after first touch (change) or submit; aria-invalid and
 * data-invalid reflect state for styling and assistive tech.
 *
 * @example
 * <form data-form>
 *   <input name="email" data-validate="required|email">
 *   <span data-errors-for="email"></span>
 *   <input name="pw" type="password" data-validate="required|min:8">
 *   <span data-errors-for="pw"></span>
 *   <input name="pw2" type="password" data-validate="required|match:pw">
 *   <span data-errors-for="pw2"></span>
 *   <button>Join</button>
 * </form>
 */
export interface LaghuValidateAPI {
  version: string;
  validateField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null;
  validateForm(form: HTMLFormElement): boolean;
  parseRules(spec: string): Array<{ name: string; arg: string }>;
  scan(root: Element | Document): void;
}

declare global {
  interface Window {
    LaghuValidate?: LaghuValidateAPI;
  }
}

export const LaghuValidate: LaghuValidateAPI = (() => {
  'use strict';
  var EMAIL: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Split "required|min:3|match:pw" into [{name, arg}].
   * @param {string} spec
   * @returns {Array<{name: string, arg: string}>}
   */
  function parseRules(spec: string) {
    return String(spec || '').split('|').map(function (p: any) { return p.trim(); }).filter(Boolean).map(function (p: any) {
      var i = p.indexOf(':');
      if (i < 0) return { name: p, arg: '' };
      return { name: p.slice(0, i).trim(), arg: p.slice(i + 1).trim() };
    });
  }

  /**
   * Owning form of an input, or null outside forms.
   * @param {Element} el
   * @returns {HTMLFormElement|null}
   */
  function ownerForm(el: Element) {
    if (el instanceof HTMLFormElement) return el;
    if (el.closest) {
      var f = el.closest('form');
      if (f instanceof HTMLFormElement) return f;
    }
    return null;
  }

  /**
   * Error slot for a field: data-errors-for="name" inside the same
   * form first, then the whole document.
   * @param {Element} el
   * @param {string} name
   * @returns {Element|null}
   */
  function errorSlot(el: Element, name: string) {
    var form = ownerForm(el);
    var sel = '[data-errors-for="' + name.replace(/"/g, '') + '"]';
    var found = form ? form.querySelector(sel) : null;
    if (found) return found;
    return typeof document !== 'undefined' ? document.querySelector(sel) : null;
  }

  /**
   * Validate one input against its data-validate rules. Writes the
   * first message into the error slot, toggles aria-invalid and
   * data-invalid, and returns the message (null when valid).
   * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} el
   * @returns {string|null}
   */
  function validateField(el: HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement) {
    var spec = el.getAttribute('data-validate') || '';
    var rules = parseRules(spec);
    var name = el.getAttribute('name') || el.id || 'field';
    var val = 'value' in el ? String(((el) as any).value) : '';
    var msg = null;
    for (var i = 0; i < rules.length && !msg; i++) {
      var r = rules[i];
      if (r.name === 'required' && !val.trim()) msg = name + ' is required';
      else if (val !== '') {
        if (r.name === 'email' && !EMAIL.test(val)) msg = name + ' must be an email';
        else if (r.name === 'number' && isNaN(Number(val))) msg = name + ' must be a number';
        else if (r.name === 'min' && val.length < Number(r.arg)) msg = name + ' needs at least ' + r.arg + ' characters';
        else if (r.name === 'max' && val.length > Number(r.arg)) msg = name + ' needs at most ' + r.arg + ' characters';
        else if (r.name === 'minv' && Number(val) < Number(r.arg)) msg = name + ' must be at least ' + r.arg;
        else if (r.name === 'maxv' && Number(val) > Number(r.arg)) msg = name + ' must be at most ' + r.arg;
        else if (r.name === 'match') {
          var form = ownerForm(el);
          var other = form ? form.querySelector('[name="' + r.arg.replace(/"/g, '') + '"]') : null;
          var ov = other && 'value' in ((other) as any) ? String(((other) as any).value) : '';
          if (val !== ov) msg = name + ' must match ' + r.arg;
        }
      }
    }
    var custom = el.getAttribute('data-message');
    if (msg && custom) msg = custom;
    var slot = errorSlot(el, el.getAttribute('name') || '');
    if (slot) slot.textContent = msg || '';
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) el.setAttribute('data-invalid', '');
    else el.removeAttribute('data-invalid');
    return msg;
  }

  /**
   * Validate every data-validate control in a form. Marks all touched,
   * focuses the first offender, returns true when clean.
   * @param {HTMLFormElement} form
   * @returns {boolean}
   */
  function validateForm(form: HTMLFormElement) {
    var bad: any = null;
    Array.prototype.forEach.call(form.querySelectorAll('[data-validate]'), function (node: any) {
      var el = ((node) as any);
      el._bTouched = true;
      if (validateField(el) && !bad) bad = el;
    });
    if (bad) {
      try { bad.focus(); } catch (e) {}
      return false;
    }
    return true;
  }

  function wireInput(el: any) {
    if (el._bVal) return;
    el._bVal = true;
    el.addEventListener('input', function () {
      if (el._bTouched || (el.form && el.form._bTried)) validateField(el);
    });
    el.addEventListener('change', function () {
      el._bTouched = true;
      validateField(el);
    });
  }

  function wireForm(form: any) {
    if (form._bValForm) return;
    form._bValForm = true;
    Array.prototype.forEach.call(form.querySelectorAll('[data-validate]'), wireInput);
    form.addEventListener('submit', function (e: Event) {
      form._bTried = true;
      if (!validateForm(form)) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      // Valid forms with a server action submit natively (progressive
      // enhancement). Actionless forms stay on the page for app code.
      if (!form.getAttribute('action') && e.cancelable) e.preventDefault();
    });
  }

  function scan(root: Element|Document) {
    if (!root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-validate]'), wireInput);
    Array.prototype.forEach.call(root.querySelectorAll('form[data-form]'), wireForm);
  }

  var api: LaghuValidateAPI = {
    version: '1.2.0',
    validateField: validateField,
    validateForm: validateForm,
    parseRules: parseRules,
    scan: scan
  };
  function watch() {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    if (!document.documentElement) return;
    var mo = new MutationObserver(function (muts: any) {
      muts.forEach(function (m: any) {
        m.addedNodes.forEach(function (n: any) {
          if (!(n instanceof Element)) return;
          if (n.hasAttribute('data-validate')) wireInput(((n) as any));
          if (n.tagName === 'FORM' && n.hasAttribute('data-form')) wireForm(((n) as any));
          if (n.querySelectorAll) {
            Array.prototype.forEach.call(n.querySelectorAll('[data-validate]'), wireInput);
            Array.prototype.forEach.call(n.querySelectorAll('form[data-form]'), wireForm);
          }
        });
      });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () { scan(document); watch(); });
    if (document.readyState !== 'loading') { scan(document); watch(); }
  }
  return api;
})();
