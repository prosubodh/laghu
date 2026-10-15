// @ts-check
/**
 * laghu morph plugin (opt-in, ~3kB budget).
 * Id/key-based DOM morph: reuses nodes with same `id` or `data-bkey`,
 * preserves input focus/values, Web Component instances, scroll.
 * Usage: <div data-get="/row" data-target="#list" data-swap="morph:inner">
 * Load AFTER laghu.js. Registers window.LaghuMorph + Laghu.swap hook.
 */
(function () {
  'use strict';
  /**
   * @param {Element} a @param {Element} b
   */
  function syncAttrs(a, b) {
    var bn = b.attributes;
    var an = a.attributes;
    var keep = new Set();
    for (var i = 0; i < bn.length; i++) {
      var at = bn[i];
      keep.add(at.name);
      if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    }
    var rm = [];
    for (var j = 0; j < an.length; j++) {
      if (!keep.has(an[j].name)) rm.push(an[j].name);
    }
    rm.forEach(function (n) { a.removeAttribute(n); });
    if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement) {
      var bv = /** @type {any} */ (b).value;
      if (bv !== undefined && /** @type {any} */ (a).value !== bv && document.activeElement !== a) {
        /** @type {any} */ (a).value = bv;
      }
      if (/** @type {any} */ (b).checked !== undefined) /** @type {any} */ (a).checked = /** @type {any} */ (b).checked;
    }
  }
  /** @param {Element} el @returns {string|null} */
  function keyOf(el) {
    if (el.id) return '#' + el.id;
    var k = el.getAttribute && el.getAttribute('data-bkey');
    if (k) return 'k:' + k;
    return null;
  }
  /**
   * @param {Element} oldEl @param {Element} newEl
   */
  function morphEl(oldEl, newEl) {
    if (oldEl instanceof Element && oldEl.hasAttribute && oldEl.hasAttribute('data-morph-skip')) return;
    if (oldEl.tagName !== newEl.tagName) {
      oldEl.replaceWith(newEl.cloneNode(true));
      return;
    }
    syncAttrs(oldEl, newEl);
    // reconcile children by key, then positionally
    /** @type {Map<string, Element>} */
    var oldByKey = new Map();
    Array.prototype.forEach.call(oldEl.children, function (/** @type {Element} */ c) {
      var k = keyOf(c);
      if (k && !oldByKey.has(k)) oldByKey.set(k, c);
    });
    var newKids = Array.prototype.slice.call(newEl.childNodes);
    var used = new Set();
    /** @type {Node[]} */
    var out = [];
    newKids.forEach(function (/** @type {Node} */ nk) {
      if (nk.nodeType === 3) {
        if (nk.textContent !== null && nk.textContent.trim() !== '') {
          var t = document.createTextNode(nk.textContent);
          out.push(t);
        }
        return;
      }
      if (!(nk instanceof Element)) {
        out.push(/** @type {Element} */ (nk).cloneNode(true));
        return;
      }
      var k = keyOf(nk);
      var match = k ? oldByKey.get(k) : null;
      if (match && !used.has(match)) {
        used.add(match);
        morphEl(match, nk);
        out.push(match);
      } else {
        // positional reuse: same tag among unused
        var reuse = null;
        var olds = oldEl.children;
        for (var i = 0; i < olds.length; i++) {
          var oc = olds[i];
          if (!used.has(oc) && oc.tagName === nk.tagName && !keyOf(oc)) { reuse = oc; break; }
        }
        if (reuse) {
          used.add(reuse);
          morphEl(reuse, nk);
          out.push(reuse);
        } else {
          out.push(nk.cloneNode(true));
        }
      }
    });
    // remove stale (except data-preserve handled by core)
    Array.prototype.forEach.call(Array.prototype.slice.call(oldEl.childNodes), function (/** @type {Node} */ c) {
      if (c instanceof Element) {
        if (!used.has(c) && oldEl.contains(c)) {
          try {
            var B = /** @type {any} */ (window).Laghu;
            if (B && B.destroyTree) B.destroyTree(c);
          } catch (e) {}
          oldEl.removeChild(c);
        }
      } else if (c.nodeType === 3) {
        oldEl.removeChild(c);
      }
    });
    out.forEach(function (n) { oldEl.appendChild(n); });
  }
  /**
   * @param {Element} target @param {string} html @param {{mode?: string}} [opts]
   */
  function morph(target, html, opts) {
    var mode = (opts && opts.mode) || 'inner';
    var tmp = document.createElement('template');
    tmp.innerHTML = html;
    if (mode === 'outer') {
      var nn = /** @type {Element} */ (tmp.content.firstElementChild || tmp.content.cloneNode(true));
      if (nn instanceof Element && target instanceof Element) morphEl(target, nn);
      else target.replaceWith(tmp.content.cloneNode(true));
      return;
    }
    var wrap = document.createElement(target.tagName.toLowerCase() === 'ul' || target.tagName === 'OL' ? 'ul' : 'div');
    wrap.appendChild(tmp.content.cloneNode(true));
    // morph target against wrapper: wrap children = new children
    var fake = document.createElement(target.tagName);
    Array.prototype.forEach.call(wrap.childNodes, function (/** @type {Node} */ n) { fake.appendChild(n.cloneNode(true)); });
    morphEl(target, fake);
  }
  var api = { morph: morph, morphEl: morphEl, version: '1.0.0' };
  // @ts-ignore
  window.LaghuMorph = api;
})();
