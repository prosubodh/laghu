"use strict";
(() => {
  // src/morph.ts
  var LaghuMorph = (() => {
    "use strict";
    function syncAttrs(a, b) {
      var bn = b.attributes;
      var an = a.attributes;
      var keep = /* @__PURE__ */ new Set();
      for (var i = 0; i < bn.length; i++) {
        var at = bn[i];
        keep.add(at.name);
        if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
      }
      var rm = [];
      for (var j = 0; j < an.length; j++) {
        if (!keep.has(an[j].name)) rm.push(an[j].name);
      }
      rm.forEach(function(n) {
        a.removeAttribute(n);
      });
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement) {
        var bv = b.value;
        if (bv !== void 0 && a.value !== bv && document.activeElement !== a) {
          a.value = bv;
        }
        if (b.checked !== void 0) a.checked = b.checked;
      }
    }
    function keyOf(el) {
      if (el.id) return "#" + el.id;
      var k = el.getAttribute && el.getAttribute("data-bkey");
      if (k) return "k:" + k;
      return null;
    }
    function morphEl(oldEl, newEl) {
      if (oldEl instanceof Element && oldEl.hasAttribute && oldEl.hasAttribute("data-morph-skip")) return;
      if (oldEl.tagName !== newEl.tagName) {
        oldEl.replaceWith(newEl.cloneNode(true));
        return;
      }
      syncAttrs(oldEl, newEl);
      var oldByKey = /* @__PURE__ */ new Map();
      Array.prototype.forEach.call(oldEl.children, function(c) {
        var k = keyOf(c);
        if (k && !oldByKey.has(k)) oldByKey.set(k, c);
      });
      var newKids = Array.prototype.slice.call(newEl.childNodes);
      var used = /* @__PURE__ */ new Set();
      var out = [];
      newKids.forEach(function(nk) {
        if (nk.nodeType === 3) {
          if (nk.textContent !== null && nk.textContent.trim() !== "") {
            var t = document.createTextNode(nk.textContent);
            out.push(t);
          }
          return;
        }
        if (!(nk instanceof Element)) {
          out.push(nk.cloneNode(true));
          return;
        }
        var k = keyOf(nk);
        var match = k ? oldByKey.get(k) : null;
        if (match && !used.has(match)) {
          used.add(match);
          morphEl(match, nk);
          out.push(match);
        } else {
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
      Array.prototype.forEach.call(Array.prototype.slice.call(oldEl.childNodes), function(c) {
        if (c instanceof Element) {
          if (!used.has(c) && oldEl.contains(c)) {
            try {
              var B = window.Laghu;
              if (B && B.destroyTree) B.destroyTree(c);
            } catch (e) {
            }
            oldEl.removeChild(c);
          }
        } else if (c.nodeType === 3) {
          oldEl.removeChild(c);
        }
      });
      out.forEach(function(n) {
        oldEl.appendChild(n);
      });
    }
    function morph(target, html, opts) {
      var mode = opts && opts.mode || "inner";
      var tmp = document.createElement("template");
      tmp.innerHTML = html;
      if (mode === "outer") {
        var nn = (
          /** @type {Element} */
          tmp.content.firstElementChild || tmp.content.cloneNode(true)
        );
        if (nn instanceof Element && target instanceof Element) morphEl(target, nn);
        else target.replaceWith(tmp.content.cloneNode(true));
        return;
      }
      var wrap = document.createElement(target.tagName.toLowerCase() === "ul" || target.tagName === "OL" ? "ul" : "div");
      wrap.appendChild(tmp.content.cloneNode(true));
      var fake = document.createElement(target.tagName);
      Array.prototype.forEach.call(wrap.childNodes, function(n) {
        fake.appendChild(n.cloneNode(true));
      });
      morphEl(target, fake);
    }
    var api = { morph, morphEl, version: "1.0.0" };
    return api;
  })();

  // src/morph.global.ts
  window.LaghuMorph = LaghuMorph;
})();
