// @ts-check
/**
 * laghu.js v1.0.0 full spec — zero-build IIFE, Light-DOM, CSP-safe.
 * Core: Proxy reactivity, hydrate-in-place, template if/for, model, triggers,
 * fetch JSON-into-state + HTML swap (+opt morph hook), attr sync, store, directives.
 * @typedef {Object} SetupResult
 * @property {Record<string, any>} [state]
 * @property {Record<string, Function>} [actions]
 * @property {string[]} [observed]
 * @property {(() => void)} [onMount]
 * @property {(() => void)} [onUnmount]
 */
(function () {
  'use strict';
  var VERSION = '1.0.0';
  var DEV = typeof window !== 'undefined' && /** @type {any} */ (window).__LAGHU_DEV__ !== false;

  /** @type {Map<string, any>} */
  var stores = new Map();
  /** @type {Map<string, Function>} */
  var directives = new Map();
  /** @type {WeakMap<object, Map<string, Set<Function>>>} */
  var targetMap = new WeakMap();
  /** @type {Function | null} */
  var activeEffect = null;
  /** @type {Set<Function>} */
  var jobQueue = new Set();
  var flushing = false;
  /** @type {(html: string) => string} */
  var sanitize = function (h) { return h; };

  function flush() {
    flushing = false;
    var jobs = Array.from(jobQueue);
    jobQueue.clear();
    for (var i = 0; i < jobs.length; i++) {
      try { jobs[i](); } catch (e) { if (DEV && typeof console !== 'undefined') console.error('[laghu]', e); }
    }
  }
  /** @param {Function} fn */
  function schedule(fn) {
    jobQueue.add(fn);
    if (!flushing) { flushing = true; Promise.resolve().then(flush); }
  }
  /** @param {Function} fn @returns {Function} */
  function effect(fn) {
    var stopped = false;
    var run = function () {
      if (stopped) return;
      activeEffect = run;
      try { fn(); } finally { activeEffect = null; }
    };
    run();
    return function () { stopped = true; };
  }
  /** @param {object} t @param {string} k */
  function track(t, k) {
    if (!activeEffect) return;
    var m = targetMap.get(t);
    if (!m) { m = new Map(); targetMap.set(t, m); }
    var s = m.get(k);
    if (!s) { s = new Set(); m.set(k, s); }
    s.add(activeEffect);
  }
  /** @param {object} t @param {string} k */
  function trigger(t, k) {
    var m = targetMap.get(t);
    if (!m) return;
    var s = m.get(k);
    if (!s) return;
    s.forEach(function (fn) { schedule(fn); });
  }
  /** @param {any} v @returns {boolean} */
  function isObj(v) { return v !== null && typeof v === 'object'; }
  /**
   * @param {any} scope @param {string} path
   * @returns {any}
   */
  function getPath(scope, path) {
    if (!path) return undefined;
    var parts = String(path).split('.');
    var head = parts[0].trim();
    if (head === '$store') {
      var sn = parts[1];
      var st = stores.get(sn);
      if (!st) return undefined;
      var cur2 = st;
      for (var k = 2; k < parts.length; k++) {
        if (!isObj(cur2)) return undefined;
        cur2 = cur2[parts[k]];
      }
      return cur2;
    }
    if (!(head in Object(scope))) return undefined;
    var cur = scope[head];
    for (var i = 1; i < parts.length; i++) {
      if (!isObj(cur) && typeof cur !== 'function') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  /** @param {any} scope @param {string} path @param {any} val */
  function setPath(scope, path, val) {
    var parts = String(path).split('.');
    if (parts[0].trim() === '$store') {
      var st = stores.get(parts[1]);
      if (!st) return;
      var c2 = st;
      for (var k = 2; k < parts.length - 1; k++) {
        if (!isObj(c2[parts[k]])) c2[parts[k]] = {};
        c2 = c2[parts[k]];
      }
      c2[parts[parts.length - 1]] = val;
      return;
    }
    var cur = scope;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (!isObj(cur[key])) cur[key] = {};
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = val;
  }
  /** @param {object} obj @returns {any} */
  function reactive(obj) {
    if (!isObj(obj)) return obj;
    return new Proxy(obj, {
      get: function (t, p, r) {
        if (typeof p === 'string') track(t, p);
        var v = Reflect.get(t, p, r);
        return isObj(v) ? reactive(v) : v;
      },
      set: function (/** @type {any} */ t, p, v) {
        var old = t[/** @type {string} */ (p)];
        var ok = Reflect.set(t, p, v);
        if (old !== v && typeof p === 'string') trigger(t, p);
        return ok;
      },
      deleteProperty: function (t, p) {
        var ok = Reflect.deleteProperty(t, p);
        if (typeof p === 'string') trigger(t, p);
        return ok;
      }
    });
  }
  /** @param {string} s @param {string} op @returns {string[]} */
  function splitTop(s, op) {
    var out = []; var depth = 0; var q = null; var cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (depth === 0 && s.slice(i, i + op.length) === op) { out.push(cur); cur = ''; i += op.length - 1; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }
  /** @param {any} scope @param {string} expr @returns {any} */
  function evalExpr(scope, expr) {
    var s = String(expr).trim();
    if (!s) return undefined;
    var or = splitTop(s, '||');
    if (or.length > 1) {
      var r;
      for (var i = 0; i < or.length; i++) { r = evalExpr(scope, or[i]); if (r) return r; }
      return r;
    }
    var and = splitTop(s, '&&');
    if (and.length > 1) {
      var rr;
      for (var j = 0; j < and.length; j++) { rr = evalExpr(scope, and[j]); if (!rr) return rr; }
      return rr;
    }
    var m = s.match(/^(.*?)(===|!==|>=|<=|==|!=|>|<)(.*)$/);
    if (m) {
      /** @type {any} */ var L = evalExpr(scope, m[1]); /** @type {any} */ var R = evalExpr(scope, m[3]); var op = m[2];
      if (op === '>') return L > R;
      if (op === '<') return L < R;
      if (op === '>=') return L >= R;
      if (op === '<=') return L <= R;
      if (op === '==') return L == R;
      if (op === '!=') return L != R;
      if (op === '===') return L === R;
      return L !== R;
    }
    if (s[0] === '!') return !evalExpr(scope, s.slice(1));
    if ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'")) return s.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (s === 'undefined') return undefined;
    var call = s.match(/^([\w.$]+)\(\)$/);
    if (call) {
      var fn = getPath(scope, call[1]);
      if (typeof fn === 'function') return fn.call(scope);
      if (DEV && typeof console !== 'undefined') console.warn('[laghu] unknown method "' + s + '"');
      return undefined;
    }
    return getPath(scope, s);
  }
  /** @param {any} scope @param {Record<string, Function>} actions @param {string} code */
  function execAction(scope, actions, code) {
    var s = String(code).trim();
    if (!s) return;
    var inc = s.match(/^([\w.$]+)\+\+$/);
    if (inc) { setPath(scope, inc[1], Number(evalExpr(scope, inc[1]) || 0) + 1); return; }
    var dec = s.match(/^([\w.$]+)--$/);
    if (dec) { setPath(scope, dec[1], Number(evalExpr(scope, dec[1]) || 0) - 1); return; }
    var asg = s.match(/^([\w.$]+)\s*=\s*(.+)$/);
    if (asg && !/^(==|===|!=|!==|>=|<=)/.test(s.slice(asg[1].length))) {
      setPath(scope, asg[1], evalExpr(scope, asg[2]));
      return;
    }
    var name = s.replace(/\(\)$/, '');
    var fn = actions[name] || getPath(scope, name);
    if (typeof fn === 'function') { fn.call(scope); return; }
    var v = evalExpr(scope, s);
    if (typeof v === 'function') v.call(scope);
    else if (v === undefined) {
      if (DEV && typeof console !== 'undefined') console.warn('[laghu] unknown action "' + s + '"');
      if (typeof CustomEvent !== 'undefined' && typeof document !== 'undefined' && document.dispatchEvent) {
        document.dispatchEvent(new CustomEvent('laghu:unknown-action', { detail: { name: s } }));
      }
    }
  }
  /** @param {Element} el @param {Function} fn */
  function onCleanup(el, fn) {
    var list = /** @type {any} */ (el)._bcu;
    if (!list) { list = []; /** @type {any} */ (el)._bcu = list; }
    list.push(fn);
  }
  /** @param {Element} root */
  function destroyTree(root) {
    if (/** @type {any} */ (root)._bcu) {
      /** @type {any} */ (root)._bcu.forEach(function (/** @type {Function} */ fn) { try { fn(); } catch (e) {} });
      /** @type {any} */ (root)._bcu = [];
    }
    var kids = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) {
      var c = /** @type {any} */ (kids[i]);
      if (c._bcu) { c._bcu.forEach(function (/** @type {Function} */ fn) { try { fn(); } catch (e) {} }); c._bcu = []; }
      if (c._bReq) { try { c._bReq.abort(); } catch (e) {} c._bReq = null; }
    }
    var self = /** @type {any} */ (root);
    if (self._bReq) { try { self._bReq.abort(); } catch (e) {} self._bReq = null; }
  }
  /** @param {string|null} raw @returns {Record<string, any>} */
  function parseScope(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) {
      if (DEV && typeof console !== 'undefined') console.warn('[laghu] data-scope must be JSON. Got: ' + raw);
      return {};
    }
  }
  /** @param {string|null|undefined} raw @param {any} cur @returns {any} */
  function coerceAttr(raw, cur) {
    if (raw === null || raw === undefined) return cur;
    if (typeof cur === 'boolean') return raw !== 'false' && raw !== '0';
    if (typeof cur === 'number') { var n = Number(raw); return isNaN(n) ? cur : n; }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw !== '' && !isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw);
    return raw;
  }
  /** @param {string} s @returns {number} */
  function parseMs(s) {
    var m = String(s).trim().match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    return m[2] === 's' ? n * 1000 : n;
  }
  /** @param {Element} el @returns {string} */
  function defaultEvent(el) {
    var t = el.tagName;
    if (t === 'FORM') return 'submit';
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return 'change';
    return 'click';
  }
  /**
   * Full trigger spec: "click delay:500ms throttle:1s once changed queue:last from:document every 2s load revealed"
   * @param {string} spec @param {Element} el
   */
  function parseTrigger(spec, el) {
    /** @type {any} */
    var out = { on: '', delay: 0, throttle: 0, once: false, changed: false, queue: 'last', from: '', every: 0, load: false, revealed: false };
    var s = String(spec || '').trim();
    if (!s) { out.on = defaultEvent(el); return out; }
    var m;
    m = s.match(/every\s+(\d+(?:\.\d+)?(?:ms|s)?)/);
    if (m) { out.every = parseMs(m[1]); s = s.replace(m[0], ' '); }
    m = s.match(/delay:(\S+)/);
    if (m) { out.delay = parseMs(m[1]); s = s.replace(m[0], ' '); }
    m = s.match(/throttle:(\S+)/);
    if (m) { out.throttle = parseMs(m[1]); s = s.replace(m[0], ' '); }
    m = s.match(/queue:(first|last|all|none)/);
    if (m) { out.queue = m[1]; s = s.replace(m[0], ' '); }
    m = s.match(/from:(\S+)/);
    if (m) { out.from = m[1]; s = s.replace(m[0], ' '); }
    if (/\bonce\b/.test(s)) { out.once = true; s = s.replace(/\bonce\b/, ' '); }
    if (/\bchanged\b/.test(s)) { out.changed = true; s = s.replace(/\bchanged\b/, ' '); }
    if (/\bload\b/.test(s)) { out.load = true; s = s.replace(/\bload\b/, ' '); }
    if (/\brevealed\b/.test(s)) { out.revealed = true; s = s.replace(/\brevealed\b/, ' '); }
    var ev = s.trim().split(/\s+/).filter(Boolean)[0] || '';
    out.on = ev || defaultEvent(el);
    return out;
  }
  /**
   * Bind event + modifiers (delay/throttle/once/changed/from). Returns cleanup.
   * @param {Element} el @param {string} spec @param {(e: Event) => void} fn @returns {Function}
   */
  function bindTrigger(el, spec, fn) {
    var t = parseTrigger(spec, el);
    /** @type {any} */ var state = { timer: 0, lastFire: 0, lastVal: null, done: false };
    var fire = function (/** @type {Event} */ e) {
      if (state.done) return;
      var input = /** @type {any} */ (el);
      if (t.changed && ('value' in input || 'checked' in input)) {
        var v = ('type' in input && (input.type === 'checkbox' || input.type === 'radio')) ? String(input.checked) + ':' + String(input.value) : String(input.value);
        if (v === state.lastVal) return;
        state.lastVal = v;
      }
      var now = Date.now();
      if (t.throttle && now - state.lastFire < t.throttle) return;
      var run = function () {
        state.lastFire = Date.now();
        fn(e);
        if (t.once) { state.done = true; cleanup(); }
      };
      if (t.delay) {
        clearTimeout(state.timer);
        state.timer = /** @type {any} */ (setTimeout(run, t.delay));
      } else run();
    };
    var cleanup = function () {};
    var listenOn = /** @type {any} */ (el);
    if (t.from === 'document' && typeof document !== 'undefined') listenOn = document;
    else if (t.from === 'body' && typeof document !== 'undefined') listenOn = document.body;
    else if (t.from && typeof document !== 'undefined') {
      var root = document;
      var h = function (/** @type {Event} */ e) {
        var tgt = /** @type {any} */ (e.target);
        if (tgt && tgt.closest && tgt.closest(t.from)) fire(e);
      };
      root.addEventListener(t.on, h);
      cleanup = function () { root.removeEventListener(t.on, h); clearTimeout(state.timer); };
      onCleanup(el, cleanup);
      return cleanup;
    }
    if (t.every) {
      var id = setInterval(function () { fn(new CustomEvent('laghu:poll')); }, t.every);
      cleanup = function () { clearInterval(id); clearTimeout(state.timer); };
      onCleanup(el, cleanup);
      return cleanup;
    }
    if (t.load) {
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        var lh = function () { fire(new CustomEvent('laghu:load')); };
        document.addEventListener('DOMContentLoaded', lh, { once: true });
        cleanup = function () { document.removeEventListener('DOMContentLoaded', lh); };
      } else {
        var runNow = function () { fire(new CustomEvent('laghu:load')); };
        if (typeof queueMicrotask !== 'undefined') queueMicrotask(runNow); else setTimeout(runNow, 0);
        cleanup = function () {};
      }
      onCleanup(el, cleanup);
      return cleanup;
    }
    if (t.revealed) {
      if (typeof IntersectionObserver !== 'undefined') {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (en) { if (en.isIntersecting) { fire(new CustomEvent('laghu:revealed')); if (t.once) io.disconnect(); } });
        });
        io.observe(el);
        cleanup = function () { io.disconnect(); clearTimeout(state.timer); };
      } else {
        fire(new CustomEvent('laghu:revealed'));
        cleanup = function () {};
      }
      onCleanup(el, cleanup);
      return cleanup;
    }
    listenOn.addEventListener(t.on, fire);
    cleanup = function () { listenOn.removeEventListener(t.on, fire); clearTimeout(state.timer); };
    onCleanup(el, cleanup);
    return cleanup;
  }
  /**
   * @param {Element} root @param {Record<string, any>} state @param {Record<string, Function>} [actions]
   */
  function hydrate(root, state, actions) {
    actions = actions || {};
    var scope = state;
    if (root instanceof Element && /** @type {any} */ (root).hasAttribute && /** @type {any} */ (root).hasAttribute('data-scope') && !/** @type {any} */ (root)._bScope) {
      /** @type {any} */ (root)._bScope = scope;
    }
    root.querySelectorAll('[data-bind],[data-text]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      var path = el.getAttribute('data-bind') || el.getAttribute('data-text') || '';
      var stop = effect(function () { el.textContent = String(evalExpr(scope, path) ?? ''); });
      onCleanup(el, stop);
    });
    root.querySelectorAll('[data-html]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      var path = el.getAttribute('data-html') || '';
      var stop = effect(function () { el.innerHTML = sanitize(String(evalExpr(scope, path) ?? '')); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      Array.prototype.forEach.call(el.attributes || [], function (/** @type {Attr} */ a) {
        var an = a.name;
        if (an.indexOf('data-bind:') === 0) {
          var attr = an.slice('data-bind:'.length);
          var expr = a.value;
          var stop = effect(function () {
            var v = evalExpr(scope, expr);
            if (v === false || v === null || v === undefined) el.removeAttribute(attr);
            else el.setAttribute(attr, String(v));
          });
          onCleanup(el, stop);
        } else if (an.indexOf('data-class:') === 0) {
          var cls = an.slice('data-class:'.length);
          var e2 = a.value;
          var s2 = effect(function () { el.classList.toggle(cls, !!evalExpr(scope, e2)); });
          onCleanup(el, s2);
        } else if (an.indexOf('data-style:') === 0) {
          var prop = an.slice('data-style:'.length);
          var e3 = a.value;
          var s3 = effect(function () {
            var v = evalExpr(scope, e3);
            /** @type {any} */ (el.style)[prop] = v === false || v === null || v === undefined ? '' : String(v);
          });
          onCleanup(el, s3);
        }
      });
    });
    // two-way model: text/number/checkbox/radio/select/textarea
    root.querySelectorAll('[data-model]').forEach(function (node) {
      var el = /** @type {any} */ (node);
      var path = el.getAttribute('data-model') || '';
      var isCheck = el.type === 'checkbox';
      var isRadio = el.type === 'radio';
      var isSelect = el.tagName === 'SELECT' && el.multiple;
      var stop = effect(function () {
        var v = evalExpr(scope, path);
        if (document.activeElement === el && !isCheck && !isRadio && el.type !== 'checkbox') {
          // keep caret: skip text overwrite while focused unless really different source
          if (el.value === String(v ?? '')) return;
        }
        if (isCheck) {
          if (Array.isArray(v)) el.checked = v.indexOf(el.value) >= 0;
          else el.checked = !!v;
        } else if (isRadio) {
          el.checked = String(v ?? '') === String(el.value);
        } else if (isSelect) {
          var arr = Array.isArray(v) ? v.map(String) : [];
          Array.prototype.forEach.call(el.options || [], function (/** @type {any} */ o) { o.selected = arr.indexOf(String(o.value)) >= 0; });
        } else if (el.tagName === 'SELECT' || el.value !== undefined) {
          el.value = v === undefined || v === null ? '' : String(v);
        }
      });
      onCleanup(el, stop);
      var evt = isCheck || isRadio || el.tagName === 'SELECT' ? 'change' : 'input';
      var h = function () {
        if (isCheck) {
          var cur = evalExpr(scope, path);
          if (Array.isArray(cur)) {
            var arr = cur.slice();
            var ix = arr.indexOf(el.value);
            if (el.checked && ix < 0) arr.push(el.value);
            if (!el.checked && ix >= 0) arr.splice(ix, 1);
            setPath(scope, path, arr);
          } else setPath(scope, path, el.checked);
        } else if (isSelect) {
          /** @type {any[]} */ var out = [];
          Array.prototype.forEach.call(el.selectedOptions || [], function (/** @type {any} */ o) { out.push(o.value); });
          setPath(scope, path, out);
        } else if (el.type === 'number' || el.getAttribute('data-type') === 'number') {
          setPath(scope, path, el.value === '' ? null : Number(el.value));
        } else {
          setPath(scope, path, el.value);
        }
      };
      el.addEventListener(evt, h);
      onCleanup(el, function () { el.removeEventListener(evt, h); });
    });
    root.querySelectorAll('[data-show]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      var expr = el.getAttribute('data-show') || '';
      var stop = effect(function () { el.hidden = !evalExpr(scope, expr); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-if]'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      if (el.tagName === 'TEMPLATE') return;
      var expr = el.getAttribute('data-if') || '';
      var stop = effect(function () { el.hidden = !evalExpr(scope, expr); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('template[data-if]'), function (node) {
      var tpl = /** @type {HTMLTemplateElement} */ (node);
      var expr = tpl.getAttribute('data-if') || '';
      var anchor = document.createComment('b-if');
      if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
      /** @type {any} */ var frag = null;
      var stop = effect(function () {
        var on = !!evalExpr(scope, expr);
        if (on && !frag) {
          frag = /** @type {DocumentFragment} */ (tpl.content.cloneNode(true));
          if (anchor.parentNode) anchor.parentNode.insertBefore(frag, anchor.nextSibling);
          if (anchor.parentNode && anchor.parentNode instanceof Element) hydrate(anchor.parentNode, scope, actions);
        } else if (!on && frag) {
          var n = anchor.nextSibling;
          while (n && n !== tpl) {
            var nx = n.nextSibling;
            if (n instanceof Element) destroyTree(n);
            if (n.parentNode) n.parentNode.removeChild(n);
            if (frag && n === frag.lastChild) break;
            n = nx;
          }
          frag = null;
        }
      });
      onCleanup(tpl, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('template[data-for]'), function (node) {
      var tpl = /** @type {HTMLTemplateElement} */ (node);
      var spec = tpl.getAttribute('data-for') || '';
      var mm = spec.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(.+)\s*$/);
      if (!mm) { if (DEV && typeof console !== 'undefined') console.warn('[laghu] bad data-for "' + spec + '"'); return; }
      var itemVar = mm[1]; var idxVar = mm[2]; var listExpr = mm[3];
      var keyExpr = tpl.getAttribute('data-key') || '';
      var anchor = document.createComment('b-for');
      if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
      /** @type {Map<any, {nodes: Node[], scope: any}>} */
      var rows = new Map();
      var render = function () {
        var list = evalExpr(scope, listExpr) || [];
        if (!Array.isArray(list)) { if (DEV && typeof console !== 'undefined') console.warn('[laghu] data-for not array: ' + listExpr); list = []; }
        var parent = anchor.parentNode;
        if (!parent) return;
        var seen = new Set();
        var order = [];
        for (var i = 0; i < list.length; i++) {
          var item = list[i];
          var tmpScope = Object.assign(Object.create(scope), {});
          tmpScope[itemVar] = item;
          var key = keyExpr ? evalExpr(tmpScope, keyExpr) : i;
          if (key === undefined || key === null) key = i;
          seen.add(key);
          order.push(key);
          var row = rows.get(key);
          if (!row) {
            var rs = Object.create(scope);
            rs[itemVar] = item;
            if (idxVar) rs[idxVar] = i;
            var f = /** @type {DocumentFragment} */ (tpl.content.cloneNode(true));
            var holder = document.createElement('span');
            holder.style.display = 'contents';
            if (keyExpr) holder.setAttribute('data-bkey', String(key));
            holder.appendChild(f);
            parent.insertBefore(holder, anchor);
            hydrate(holder, rs, actions);
            rows.set(key, { nodes: [holder], scope: rs });
          } else {
            row.scope[itemVar] = item;
            if (idxVar) row.scope[idxVar] = i;
          }
        }
        // reorder without destroy (preserves focus/input): iterate desired order
        for (var k = 0; k < order.length; k++) {
          var r2 = rows.get(order[k]);
          if (r2) {
            var h2 = /** @type {HTMLElement} */ (r2.nodes[0]);
            var want = anchor;
            // find reference: next desired sibling already placed? simplest: insert each in order before anchor sequentially = stable
            if (h2.nextSibling !== want || true) parent.insertBefore(h2, want);
          }
        }
        // fix order: above loop appends in order before anchor only if we go in order — but insertBefore same anchor in order works
        rows.forEach(function (row2, kk) {
          if (!seen.has(kk)) {
            row2.nodes.forEach(function (nn) {
              if (nn instanceof Element) destroyTree(nn);
              if (nn.parentNode) nn.parentNode.removeChild(nn);
            });
            rows.delete(kk);
          }
        });
      };
      var stop = effect(render);
      onCleanup(tpl, stop);
    });
    // actions: data-click + data-on:event(.prevent.stop.once)
    root.querySelectorAll('[data-click]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      var code = el.getAttribute('data-click') || '';
      var spec = el.getAttribute('data-trigger') || 'click';
      bindTrigger(el, spec, function () { execAction(scope, actions || {}, code); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      Array.prototype.forEach.call(el.attributes || [], function (/** @type {Attr} */ a) {
        if (a.name.indexOf('data-on:') === 0) {
          var raw = a.name.slice('data-on:'.length);
          var parts = raw.split('.');
          var ev = parts[0];
          var mods = parts.slice(1);
          var code = a.value;
          var spec = el.getAttribute('data-trigger') || ev;
          bindTrigger(el, spec, function (/** @type {Event} */ e) {
            if (mods.indexOf('prevent') >= 0) e.preventDefault();
            if (mods.indexOf('stop') >= 0) e.stopPropagation();
            var s2 = Object.create(scope); s2.$event = e;
            execAction(s2, actions || {}, code);
            if (mods.indexOf('once') >= 0) { try { /** @type {any} */ (el).removeAttribute(a.name); } catch (err) {} }
          });
        }
      });
    });
    // data-init runs once as action
    root.querySelectorAll('[data-init]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      var code = el.getAttribute('data-init') || '';
      try { execAction(scope, actions || {}, code); } catch (e) {}
    });
    directives.forEach(function (fn, name) {
      root.querySelectorAll('[data-' + name + ']').forEach(function (node) {
        var el = /** @type {HTMLElement} */ (node);
        try {
          var out = fn({ el: el, get: function () { return evalExpr(scope, el.getAttribute('data-' + name) || ''); }, effect: effect, scope: scope });
          if (typeof out === 'function') onCleanup(el, out);
        } catch (e) { if (DEV && typeof console !== 'undefined') console.error('[laghu] directive ' + name, e); }
      });
    });
    // fetch triggers: data-get/post/put/patch/delete
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      var method = '';
      var url = '';
      if (el.hasAttribute('data-get')) { method = 'GET'; url = el.getAttribute('data-get') || ''; }
      else if (el.hasAttribute('data-post')) { method = 'POST'; url = el.getAttribute('data-post') || ''; }
      else if (el.hasAttribute('data-put')) { method = 'PUT'; url = el.getAttribute('data-put') || ''; }
      else if (el.hasAttribute('data-patch')) { method = 'PATCH'; url = el.getAttribute('data-patch') || ''; }
      else if (el.hasAttribute('data-delete')) { method = 'DELETE'; url = el.getAttribute('data-delete') || ''; }
      if (!url && !el.hasAttribute('data-get') && !el.hasAttribute('data-post') && !el.hasAttribute('data-put') && !el.hasAttribute('data-patch') && !el.hasAttribute('data-delete')) return;
      if (el.hasAttribute('data-method')) method = String(el.getAttribute('data-method') || method).toUpperCase();
      if (!method) method = 'GET';
      setupFetch(el, scope, method, url);
    });
  }
  /**
   * @param {HTMLElement} el @param {any} scope @param {string} method @param {string} url
   */
  function setupFetch(el, scope, method, url) {
    var targetSel = el.getAttribute('data-target') || '';
    var swap = el.getAttribute('data-swap') || 'inner';
    var triggerSpec = el.getAttribute('data-trigger') || defaultEvent(el);
    var fire = function () { doFetch(el, scope, method, url, targetSel, swap); };
    bindTrigger(el, triggerSpec, fire);
  }
  /** @param {string} s @returns {any} */
  function tryJSON(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }
  /**
   * @param {HTMLElement} el @param {any} scope @param {string} method @param {string} url @param {string} targetSel @param {string} swap
   */
  function doFetch(el, scope, method, url, targetSel, swap) {
    var m = parseTrigger(el.getAttribute('data-trigger') || defaultEvent(el), el);
    var self = /** @type {any} */ (el);
    if (self._bInflight && (m.queue === 'first' || m.queue === 'none')) return;
    if (m.queue === 'last' && self._bReq) { try { self._bReq.abort(); } catch (e) {} }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) self._bReq = ctrl;
    self._bInflight = true;
    var setBusy = function (/** @type {boolean} */ on) {
      var indSel = el.getAttribute('data-indicator');
      var ind = indSel ? document.querySelector(indSel) : null;
      if (ind && ind instanceof HTMLElement) ind.hidden = !on ? true : false;
      if (el instanceof HTMLElement) {
        if (on) el.setAttribute('data-request', '');
        else el.removeAttribute('data-request');
        if (el.hasAttribute('data-disable')) el.toggleAttribute('disabled', on);
      }
    };
    setBusy(true);
    var before = new CustomEvent('laghu:before-request', { cancelable: true, detail: { url: url, method: method } });
    if (!el.dispatchEvent(before)) { self._bInflight = false; setBusy(false); return; }
    /** @type {any} */
    var opts = { method: method, headers: { Accept: 'application/json, text/html' }, signal: ctrl ? ctrl.signal : undefined };
    var valsRaw = el.getAttribute('data-vals');
    var body = null;
    if (valsRaw) {
      var v = valsRaw.trim() === 'form' && el instanceof HTMLFormElement ? serializeForm(el) : (tryJSON(valsRaw) || {});
      // merge form if inside one
      var form = el instanceof HTMLFormElement ? el : (el.closest ? el.closest('form') : null);
      if (form && valsRaw.trim() !== 'form') {
        var fv = serializeForm(/** @type {HTMLFormElement} */ (form));
        for (var k in fv) v[k] = fv[k];
      }
      if (method === 'GET') {
        var qs = new URLSearchParams(v).toString();
        if (qs) url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        body = JSON.stringify(v);
        opts.body = body;
      }
    } else if (method !== 'GET') {
      var f2 = el instanceof HTMLFormElement ? el : (el.closest ? el.closest('form') : null);
      if (f2) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(serializeForm(/** @type {HTMLFormElement} */ (f2)));
      }
    }
    var hRaw = el.getAttribute('data-headers');
    if (hRaw) {
      var hh = tryJSON(hRaw) || {};
      for (var hk in hh) opts.headers[hk] = hh[hk];
    }
    var done = function () { self._bInflight = false; if (self._bReq === ctrl) self._bReq = null; setBusy(false); };
    fetch(url, opts).then(function (res) {
      done();
      el.dispatchEvent(new CustomEvent('laghu:after-request', { detail: { status: res.status, url: url } }));
      if (!res.ok) {
        el.dispatchEvent(new CustomEvent('laghu:request-error', { detail: { status: res.status, url: url } }));
        return;
      }
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') >= 0) return res.json().then(function (data) {
        if (data && typeof data === 'object' && !Array.isArray(data)) Object.assign(scope, data);
        else setPath(scope, 'result', data);
      });
      return res.text().then(function (html) {
        var sel = el.getAttribute('data-select');
        if (sel) {
          var tmp = document.createElement('template');
          tmp.innerHTML = sanitize(html);
          var picked = tmp.content.querySelector(sel);
          html = picked ? picked.outerHTML : '';
        }
        var target = targetSel ? document.querySelector(targetSel) : el;
        if (!target) return;
        swapHtml(/** @type {Element} */ (target), html, swap, scope);
      });
    }).catch(function (err) {
      done();
      if (err && err.name === 'AbortError') return;
      el.dispatchEvent(new CustomEvent('laghu:request-error', { detail: { error: err } }));
      if (DEV && typeof console !== 'undefined') console.error('[laghu] fetch', err);
    });
  }
  /** @param {HTMLFormElement} form @returns {Record<string, any>} */
  function serializeForm(form) {
    /** @type {Record<string, any>} */
    var out = {};
    var fd = new FormData(form);
    fd.forEach(function (v, k) {
      if (k in out) {
        if (!Array.isArray(out[k])) out[k] = [out[k]];
        out[k].push(typeof v === 'string' ? v : String(v));
      } else out[k] = typeof v === 'string' ? v : String(v);
    });
    return out;
  }
  /**
   * @param {Element} target @param {string} html @param {string} swap @param {any} scope
   */
  function swapHtml(target, html, swap, scope) {
    var s = String(swap || 'inner').toLowerCase();
    if (s === 'none') { target.dispatchEvent(new CustomEvent('laghu:after-swap', { detail: { swap: s } })); return; }
    var focusId = document.activeElement && /** @type {any} */ (document.activeElement).id ? /** @type {any} */ (document.activeElement).id : null;
    var ae = /** @type {any} */ (document.activeElement);
    var selStart = ae && typeof ae.selectionStart === 'number' ? ae.selectionStart : -1;
    var selEnd = ae && typeof ae.selectionEnd === 'number' ? ae.selectionEnd : -1;
    target.dispatchEvent(new CustomEvent('laghu:before-swap', { cancelable: false, detail: { swap: s } }));
    var isMorph = s.indexOf('morph') === 0;
    /** @type {any} */ var M = typeof window !== 'undefined' ? /** @type {any} */ (window).LaghuMorph : null;
    if (isMorph) {
      if (M && M.morph) {
        M.morph(target, sanitize(html), {});
        hydrate(target, scope, {});
        target.dispatchEvent(new CustomEvent('laghu:after-swap', { detail: { swap: s } }));
        restoreFocus(focusId, selStart, selEnd);
        return;
      }
      if (DEV && typeof console !== 'undefined') console.warn('[laghu] data-swap="morph" needs morph.js (window.LaghuMorph). Falling back to inner.');
      s = 'inner';
    }
    if (s === 'delete') {
      destroyTree(target);
      if (target.parentNode) target.parentNode.removeChild(target);
      return;
    }
    var tmp = document.createElement('template');
    tmp.innerHTML = sanitize(html);
    var frag = tmp.content;
    // preserve [data-preserve] nodes with same id: stash + restore
    /** @type {Map<string, Element>} */
    var kept = new Map();
    target.querySelectorAll('[data-preserve][id]').forEach(function (n) { kept.set(n.id, /** @type {Element} */ (n)); });
    destroyTree(target);
    if (s === 'inner') { target.innerHTML = ''; target.appendChild(frag); }
    else if (s === 'text') { target.textContent = tmp.content.textContent; }
    else if (s === 'outer') { target.replaceWith(frag); }
    else if (s === 'append' || s === 'beforeend') { target.appendChild(frag); }
    else if (s === 'prepend' || s === 'afterbegin') { target.insertBefore(frag, target.firstChild); }
    else if (s === 'beforebegin') { if (target.parentNode) target.parentNode.insertBefore(frag, target); }
    else if (s === 'afterend') { if (target.parentNode) target.parentNode.insertBefore(frag, target.nextSibling); }
    else { target.innerHTML = ''; target.appendChild(frag); }
    // restore preserved
    kept.forEach(function (node, id) {
      var sel = '#';
      try {
        var CE = (typeof CSS !== 'undefined' && CSS && CSS.escape) ? CSS.escape(id) : String(id).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
        sel = '#' + CE;
      } catch (e) { sel = '[id="' + String(id).replace(/"/g, '') + '"]'; }
      var fresh = target.querySelector ? target.querySelector(sel) : null;
      if (!fresh) {
        // target itself may be parent; try document only if still connected
        fresh = document.getElementById(id);
      }
      if (fresh && fresh !== node && node.parentNode !== fresh) {
        fresh.replaceWith(node);
      }
    });
    var root = s === 'outer' ? (target.parentNode instanceof Element ? target.parentNode : document.body) : target;
    hydrate(root, scope, {});
    target.dispatchEvent(new CustomEvent('laghu:after-swap', { detail: { swap: s } }));
    restoreFocus(focusId, selStart, selEnd);
  }
  /** @param {string|null} id @param {number} a @param {number} b */
  function restoreFocus(id, a, b) {
    if (!id) return;
    var f = document.getElementById(id);
    if (f && f instanceof HTMLElement) {
      try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) {} }
      try {
        if (a >= 0 && /** @type {any} */ (f).setSelectionRange) /** @type {any} */ (f).setSelectionRange(a, b);
      } catch (e) {}
    }
  }
  /**
   * @param {string} tag
   * @param {() => SetupResult} setup
   */
  function define(tag, setup) {
    if (!tag || tag.indexOf('-') < 0) throw new Error('[laghu] tag must contain hyphen: ' + tag);
    var probe = setup() || {};
    var obs = probe.observed || Object.keys(probe.state || {}).filter(function (k) {
      var v = /** @type {any} */ (probe.state)[k];
      return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
    });
    var Klass = /** @type {any} */ (class extends HTMLElement {
      connectedCallback() {
        if (/** @type {any} */ (this)._bInit) return;
        /** @type {any} */ (this)._bInit = true;
        var r = setup() || {};
        var initial = r.state || {};
        // upgrade pre-defined props (set before define)
        for (var k in initial) {
          if (Object.prototype.hasOwnProperty.call(this, k)) {
            try { initial[k] = /** @type {any} */ (this)[k]; delete /** @type {any} */ (this)[k]; } catch (e) {}
          }
        }
        // pending attrs set before connect
        var pend = /** @type {any} */ (this)._bPend;
        if (pend) {
          for (var pk in pend) {
            if (pk in initial) initial[pk] = coerceAttr(pend[pk], initial[pk]);
            else initial[pk] = pend[pk];
          }
          /** @type {any} */ (this)._bPend = null;
        } else {
          for (var i = 0; i < obs.length; i++) {
            var an = obs[i];
            if (this.hasAttribute && this.hasAttribute(an) && (an in initial)) {
              initial[an] = coerceAttr(this.getAttribute(an), initial[an]);
            }
          }
        }
        var state = reactive(initial);
        /** @type {any} */ (this).state = state;
        /** @type {any} */ (this).actions = r.actions || {};
        hydrate(this, state, r.actions || {});
        try { if (typeof r.onMount === 'function') r.onMount.call(state); } catch (e) {}
        this.classList.add('is-defined');
        this.dispatchEvent(new CustomEvent('laghu:mount'));
      }
      disconnectedCallback() {
        try {
          var st = /** @type {any} */ (this).state;
          var r2 = null;
          void r2; void st;
        } catch (e) {}
        destroyTree(this);
        this.dispatchEvent(new CustomEvent('laghu:unmount'));
        /** @type {any} */ (this)._bInit = false;
      }
      connectedMoveCallback() { /* preserve state on moveBefore */ }
      attributeChangedCallback(/** @type {string} */ name, /** @type {string|null} */ old, /** @type {string|null} */ val) {
        if (old === val) return;
        var st = /** @type {any} */ (this).state;
        if (st && (name in st)) st[name] = coerceAttr(val, st[name]);
        else {
          var p = /** @type {any} */ (this)._bPend || {};
          p[name] = val;
          /** @type {any} */ (this)._bPend = p;
        }
      }
    });
    Klass.observedAttributes = obs;
    customElements.define(tag, Klass);
    return Klass;
  }
  /** @type {any} */ var observer = null;
  function autoObserve() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n instanceof Element) {
            if (n.hasAttribute && n.hasAttribute('data-scope') && !/** @type {any} */ (n)._bScope) {
              try {
                var api2 = /** @type {any} */ (window).Laghu;
                if (api2) api2.hydrate(n, parseScope(n.getAttribute('data-scope')), {});
              } catch (e) {}
            }
          }
        });
        m.removedNodes.forEach(function (n) { if (n instanceof Element) destroyTree(n); });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  var api = {
    version: VERSION,
    define: define,
    reactive: reactive,
    effect: effect,
    eval: evalExpr,
    get: getPath,
    set: setPath,
    parseTrigger: parseTrigger,
    swap: swapHtml,
    css: 'laghu:not(:defined),[data-laghu]:not(:defined){visibility:hidden}laghu.is-defined,[data-laghu].is-defined{visibility:visible}',
    sanitize: function (/** @type {(html: string) => string} */ fn) { if (typeof fn === 'function') sanitize = fn; },
    hydrate: function (/** @type {Element} */ root, /** @type {Record<string, any>} */ state, /** @type {Record<string, Function>} */ actions) {
      var s = reactive(state || parseScope(root.getAttribute('data-scope')));
      /** @type {any} */ (root)._bScope = s;
      hydrate(root, s, actions || {});
      return s;
    },
    destroyTree: destroyTree,
    store: function (/** @type {string} */ name, /** @type {any} */ init) {
      if (init !== undefined) { var s = reactive(init); stores.set(name, s); return s; }
      return stores.get(name);
    },
    directive: function (/** @type {string} */ name, /** @type {Function} */ fn) { directives.set(name, fn); }
  };
  // @ts-ignore
  window.Laghu = api;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      autoObserve();
      document.querySelectorAll('[data-scope]').forEach(function (n) {
        var el = /** @type {Element} */ (n);
        if (/** @type {any} */ (el)._bScope) return;
        api.hydrate(el, parseScope(el.getAttribute('data-scope')), {});
      });
    });
  }
})();
