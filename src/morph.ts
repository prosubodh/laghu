// @ts-check
/**
 * laghu morph plugin (opt-in, separate file, own 3kB gzip budget).
 *
 * What it does: updates the DOM in place instead of replacing it.
 * Nodes with the same id or data-bkey are reused and moved, so input
 * focus, caret, scroll, video playback, and component instances survive
 * an HTML swap. Unknown nodes fall back to positional reuse by tag name.
 *
 * When to use it: lists and tables fed by the server where a plain
 * inner swap would lose focus or reset state. For static content the
 * default destructive swap is cheaper and simpler.
 *
 * Rules: give stable rows an id or data-bkey. Mark frozen subtrees
 * with data-morph-skip (children included). The core data-preserve
 * rule still applies on top.
 *
 * Load AFTER laghu.js. Registers window.LaghuMorph. The core picks it
 * up automatically for data-swap="morph:inner" and "morph:outer".
 *
 * @example
 * <script src="laghu.min.js"></script>
 * <script src="morph.min.js"></script>
 * <ul id="list" data-get="/rows" data-target="#list" data-swap="morph:inner">
 *   <li id="r1">one</li>
 * </ul>
 */
export interface LaghuMorphAPI {
  morph(target: Element, html: string, opts?: { mode?: string }): void;
  morphEl(a: Element, b: Element): void;
  version: string;
}

declare global {
  interface Window {
    LaghuMorph?: LaghuMorphAPI;
  }
}

export const LaghuMorph: LaghuMorphAPI = (() => {
  "use strict";
  /**
   * Copy attributes from the new node onto the live node, remove stale
   * ones, and sync form control state without touching focused inputs.
   * A focused input keeps its typed value even if the server HTML
   * carries a different value attribute.
   *
   * @param {Element} a Live node in the document, updated in place.
   * @param {Element} b Fresh node parsed from the response, read only.
   */
  function syncAttrs(a: Element, b: Element) {
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
    rm.forEach(function (n: any) {
      a.removeAttribute(n);
    });
    if (
      a instanceof HTMLInputElement ||
      a instanceof HTMLTextAreaElement ||
      a instanceof HTMLSelectElement
    ) {
      var bv = (b as any).value;
      if (bv !== undefined && (a as any).value !== bv && document.activeElement !== a) {
        (a as any).value = bv;
      }
      if ((b as any).checked !== undefined) (a as any).checked = (b as any).checked;
    }
  }
  /**
   * Stable identity of an element for reuse across morphs.
   * Element id wins ("#r1"), then data-bkey ("k:42"), else null
   * (positional reuse by tag name).
   *
   * @param {Element} el Element to identify.
   * @returns {string|null} Key, or null when the element has none.
   */
  function keyOf(el: Element) {
    if (el.id) return "#" + el.id;
    var k = el.getAttribute && el.getAttribute("data-bkey");
    if (k) return "k:" + k;
    return null;
  }
  /**
   * Reconcile one live element against one fresh element, recursively.
   * Same tag: sync attributes, then match children by key (id or
   * data-bkey), reuse same-tag unkeyed children positionally, create
   * the rest, and remove stale nodes (running their laghu cleanups).
   * Different tag: replace outright. data-morph-skip freezes a subtree.
   *
   * @param {Element} oldEl Live element, updated in place.
   * @param {Element} newEl Fresh element describing the target state.
   */
  function morphEl(oldEl: Element, newEl: Element) {
    if (oldEl instanceof Element && oldEl.hasAttribute && oldEl.hasAttribute("data-morph-skip"))
      return;
    if (oldEl.tagName !== newEl.tagName) {
      oldEl.replaceWith(newEl.cloneNode(true));
      return;
    }
    syncAttrs(oldEl, newEl);
    // reconcile children by key, then positionally
    var oldByKey: Map<string, Element> = new Map();
    Array.prototype.forEach.call(oldEl.children, function (c: Element) {
      var k = keyOf(c);
      if (k && !oldByKey.has(k)) oldByKey.set(k, c);
    });
    var newKids = Array.prototype.slice.call(newEl.childNodes);
    var used = new Set();
    var out: Node[] = [];
    newKids.forEach(function (nk: Node) {
      if (nk.nodeType === 3) {
        if (nk.textContent !== null && nk.textContent.trim() !== "") {
          var t = document.createTextNode(nk.textContent);
          out.push(t);
        }
        return;
      }
      if (!(nk instanceof Element)) {
        out.push((nk as Element).cloneNode(true));
        return;
      }
      var k = keyOf(nk);
      var match = k ? oldByKey.get(k) : null;
      if (match && !used.has(match)) {
        used.add(match);
        if (match.tagName !== nk.tagName) {
          // Different tag under the same key: replace outright and adopt
          // the replacement. Pushing the detached old node here would let
          // the stale pass below delete the freshly inserted clone.
          var rep = /** @type {Element} */ (nk.cloneNode(true));
          match.replaceWith(rep);
          used.add(rep);
          out.push(rep);
        } else {
          morphEl(match, nk);
          out.push(match);
        }
      } else {
        // positional reuse: same tag among unused
        var reuse = null;
        var olds = oldEl.children;
        for (var i = 0; i < olds.length; i++) {
          var oc = olds[i];
          if (!used.has(oc) && oc.tagName === nk.tagName && !keyOf(oc)) {
            reuse = oc;
            break;
          }
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
    Array.prototype.forEach.call(Array.prototype.slice.call(oldEl.childNodes), function (c: Node) {
      if (c instanceof Element) {
        if (!used.has(c) && oldEl.contains(c)) {
          try {
            var B = (window as any).Laghu;
            if (B && B.destroyTree) B.destroyTree(c);
          } catch (e) {}
          oldEl.removeChild(c);
        }
      } else if (c.nodeType === 3) {
        oldEl.removeChild(c);
      }
    });
    out.forEach(function (n: any) {
      oldEl.appendChild(n);
    });
  }
  /**
   * Morph a target from an HTML string. Mode "inner" (default) reconciles
   * children. Mode "outer" reconciles the target element itself against
   * the first element of the response. Whitespace-only text nodes are
   * ignored so server formatting never creates phantom diffs.
   *
   * @example
   * LaghuMorph.morph(document.querySelector('#list'), '<li id="r1">one</li>');
   * LaghuMorph.morph(el, html, { mode: 'outer' });
   *
   * @param {Element} target Element to update in place.
   * @param {string} html Response HTML.
   * @param {{mode?: string}} [opts] Optional mode, "inner" or "outer".
   */
  function morph(target: Element, html: string, opts: any) {
    var mode = (opts && opts.mode) || "inner";
    var tmp = document.createElement("template");
    tmp.innerHTML = html;
    if (mode === "outer") {
      var nn = /** @type {Element} */ (
        tmp.content.firstElementChild || tmp.content.cloneNode(true)
      );
      if (nn instanceof Element && target instanceof Element) morphEl(target, nn);
      else target.replaceWith(tmp.content.cloneNode(true));
      return;
    }
    var wrap = document.createElement(
      target.tagName.toLowerCase() === "ul" || target.tagName === "OL" ? "ul" : "div",
    );
    wrap.appendChild(tmp.content.cloneNode(true));
    // morph target against wrapper: wrap children = new children
    var fake = document.createElement(target.tagName);
    // Inner mode reconciles children only. Mirror the target's own
    // attributes onto the placeholder so syncAttrs does not strip the
    // container's id/class/data-* (which would break later targeting).
    Array.prototype.forEach.call(target.attributes, function (at: Attr) {
      fake.setAttribute(at.name, at.value);
    });
    Array.prototype.forEach.call(wrap.childNodes, function (n: Node) {
      fake.appendChild(n.cloneNode(true));
    });
    morphEl(target, fake);
  }
  var api: LaghuMorphAPI = { morph: morph, morphEl: morphEl, version: "1.0.0" };
  return api;
})();
