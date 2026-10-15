// @ts-check
/**
 * laghu.js v1.0.0 - zero-build IIFE micro-framework.
 *
 * What this file provides:
 * - Proxy based reactivity with per-binding effects (no Virtual DOM).
 * - Hydrate-in-place HTML bindings plus template based if/for lists.
 * - Two-way form bindings, declarative fetch with HTML or JSON swaps.
 * - Light-DOM Web Components with attribute to state sync.
 * - Strict CSP compliance: no new Function, no eval, no inline handlers.
 *
 * How to load it (no build step, works from file://):
 *   <script src="laghu.min.js"></script>
 *   <script>Laghu.define('my-tag', () => ({ state: { n: 0 } }));</script>
 *
 * @typedef {Object} SetupResult
 * @property {Record<string, any>} [state] Initial state for one component instance.
 * @property {Record<string, Function>} [actions] Methods callable from data-click and data-on.
 * @property {string[]} [observed] Attribute names synced into state. Defaults to
 *   primitive state keys (string, number, boolean).
 * @property {(() => void)} [onMount] Runs once after the element is hydrated.
 * @property {(() => void)} [onUnmount] Reserved for pairing with onMount in user code.
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
  /**
   * Run a function now and re-run it whenever reactive state it read
   * changes. Each DOM binding creates one effect, so updates touch only
   * the exact node that depends on the changed value.
   *
   * Effects are batched in a microtask: many synchronous writes cause
   * one re-run.
   *
   * @example
   * var state = Laghu.reactive({ count: 0 });
   * var stop = Laghu.effect(function () {
   *   document.querySelector('#n').textContent = String(state.count);
   * });
   * state.count = 1; // schedules one re-run, shows "1"
   * stop(); // unsubscribe, effect never runs again
   *
   * @param {Function} fn Work to run and re-run on dependency change.
   * @returns {Function} Call to unsubscribe the effect.
   */
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
   * Read a dotted path from a scope, walking the prototype chain for the
   * first segment (so child scopes inherit parent values). Returns
   * undefined for missing paths instead of throwing.
   *
   * Paths starting with $store read from a named global store:
   * "$store.cart.n" reads store "cart", key "n".
   *
   * @example
   * Laghu.get({ user: { name: 'Ada' } }, 'user.name'); // 'Ada'
   * Laghu.get({}, 'missing.deep');                     // undefined
   *
   * @param {any} scope Object (often with parent scopes on its prototype).
   * @param {string} path Dotted path such as "user.name".
   * @returns {any} Value at the path, or undefined.
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
  /**
   * Write a dotted path into a scope, creating intermediate objects.
   * Supports $store paths the same way getPath reads them.
   * Writes follow the prototype chain: when the head key already
   * exists on an ancestor scope, the ancestor updates instead of the
   * child shadowing it. Fresh keys land directly on the scope.
   *
   * @example
   * var s = {};
   * Laghu.set(s, 'user.name', 'Ada'); // s becomes { user: { name: 'Ada' } }
   *
   * @param {any} scope Object to write into (reactive or plain).
   * @param {string} path Dotted path such as "user.name".
   * @param {any} val Value to store.
   */
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
    // Write through the scope chain: when the head key already lives on
    // an ancestor (child row scopes, $event wrappers), update the owner
    // instead of shadowing it on the child. Fresh keys land on scope.
    var base = scope;
    var node = scope;
    while (node && node !== Object.prototype) {
      if (Object.prototype.hasOwnProperty.call(node, parts[0])) { base = node; break; }
      node = Object.getPrototypeOf(node);
    }
    var cur = base;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (!isObj(cur[key])) cur[key] = {};
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = val;
  }
  /**
   * Wrap a plain object so reads track effects and writes trigger them.
   * Only plain objects and arrays are wrapped. Primitives pass through.
   * Nested objects are wrapped lazily on first read.
   *
   * @example
   * var state = Laghu.reactive({ user: { name: 'Ada' }, tags: [] });
   * state.user.name = 'Grace'; // triggers effects that read user or user.name
   * state.tags.push('x');      // triggers effects that read tags or length
   *
   * @param {object} obj Plain object or array to make reactive.
   * @returns {any} Reactive proxy around the same data.
   */
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
  /**
   * Evaluate a small expression against a scope without new Function,
   * so it runs under strict Content Security Policy.
   *
   * Supported: dotted paths, string/number/true/false/null literals,
   * not (!), comparisons (>, <, >=, <=, ==, !=, ===, !==),
   * and/or (&&, ||), and no-argument calls such as "reset()".
   * Anything else returns undefined. Unknown method names warn in dev.
   *
   * @example
   * Laghu.eval({ count: 6 }, 'count > 5');       // true
   * Laghu.eval({ user: { name: 'Ada' } }, 'user.name'); // 'Ada'
   * Laghu.eval({ open: false }, '!open');         // true
   *
   * @param {any} scope Scope to resolve paths and methods against.
   * @param {string} expr Expression text from a data-* attribute.
   * @returns {any} Result of the expression.
   */
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
  /**
   * Run one action string from data-click or data-on. Handles, in order:
   * "count++" and "count--" (numeric helpers), "path = expr" (assignment),
   * a named action from the component ("increment" or "increment()"),
   * then any expression that resolves to a function.
   *
   * Unknown names warn in dev and dispatch laghu:unknown-action on
   * document, so typos fail loudly instead of silently doing nothing.
   * The function runs with the scope as "this", so actions use this.count.
   *
   * @param {any} scope Reactive state the action runs against.
   * @param {Record<string, Function>} actions Named actions of the component.
   * @param {string} code Raw attribute text, for example "increment".
   */
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
  /**
   * One binding per element per kind. hydrate rescans whole subtrees
   * (template inserts, swaps), so without this guard already wired nodes
   * would collect duplicate effects and listeners. Returns true when
   * this kind was already wired on this element.
   *
   * @param {Element} el Element carrying the attribute.
   * @param {string} key Binding kind, for example "click" or "bind".
   * @returns {boolean} True when already wired, meaning skip.
   */
  function claimed(el, key) {
    var host = /** @type {any} */ (el);
    var map = host._bH || (host._bH = {});
    if (map[key]) return true;
    map[key] = 1;
    return false;
  }
  /** @param {Element} root */
  function destroyTree(root) {
    if (/** @type {any} */ (root)._bcu) {
      /** @type {any} */ (root)._bcu.forEach(function (/** @type {Function} */ fn) { try { fn(); } catch (e) {} });
      /** @type {any} */ (root)._bcu = [];
    }
    /** @type {any} */ (root)._bH = undefined;
    var kids = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) {
      var c = /** @type {any} */ (kids[i]);
      if (c._bcu) { c._bcu.forEach(function (/** @type {Function} */ fn) { try { fn(); } catch (e) {} }); c._bcu = []; }
      c._bH = undefined;
      if (c._bReq) { try { c._bReq.abort(); } catch (e) {} c._bReq = null; }
    }
    var self = /** @type {any} */ (root);
    if (self._bReq) { try { self._bReq.abort(); } catch (e) {} self._bReq = null; }
  }
  /**
   * Parse one data-scope JSON string. data-scope must be valid JSON with
   * double quotes, for example data-scope='{"count": 0}'. Anything else
   * warns in dev and yields an empty object.
   *
   * @param {string|null} raw Raw attribute text.
   * @returns {Record<string, any>} Parsed object, or empty on error.
   */
  function parseScope(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) {
      if (DEV && typeof console !== 'undefined') console.warn('[laghu] data-scope must be JSON. Got: ' + raw);
      return {};
    }
  }
  /**
   * Convert an HTML attribute string into the type of the current state
   * value. Numbers stay numbers, booleans stay booleans, everything else
   * stays a string. Used when syncing observed attributes into state.
   *
   * @example
   * coerceAttr('5', 0);       // 5 (number, because current state is numeric)
   * coerceAttr('false', true); // false (boolean)
   * coerceAttr('hi', '');      // 'hi' (string)
   *
   * @param {string|null|undefined} raw Attribute text from the DOM.
   * @param {any} cur Current state value, used only for its type.
   * @returns {any} Converted value.
   */
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
   * Parse a data-trigger string into a modifier object.
   *
   * Grammar (order free, first bare word is the event name):
   *   "[event] [delay:500ms] [throttle:1s] [once] [changed]
   *    [queue:first|last|all|none] [from:selector|document|body]
   *    [every 2s] [load] [revealed]"
   *
   * Meanings: delay waits before firing (retrigger restarts the wait).
   * throttle ignores repeats inside the window. once fires a single time.
   * changed fires only when an input value differs from last time.
   * queue controls overlapping fetches: last aborts the previous request,
   * first and none skip while one is in flight, all allows parallel.
   * from listens on another root (document, body, or a selector matched
   * against the event target). every polls on an interval. load fires once
   * the document is ready. revealed fires when the element scrolls into view.
   *
   * @example
   * Laghu.parseTrigger('click delay:500ms once', btn);
   * Laghu.parseTrigger('every 5s', el); // { every: 5000, ... }
   *
   * @param {string} spec Raw data-trigger text.
   * @param {Element} el Element used for the default event when spec is empty.
   * @returns {{on: string, delay: number, throttle: number, once: boolean,
   *   changed: boolean, queue: string, from: string, every: number,
   *   load: boolean, revealed: boolean}} Parsed trigger.
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
   * Attach a parsed trigger to an element and return a cleanup function.
   * The cleanup is also registered on the element, so destroyTree and
   * element removal automatically detach listeners, timers, intervals,
   * and observers. No manual bookkeeping needed.
   *
   * @param {Element} el Element to listen on (or whose removal cleans up).
   * @param {string} spec data-trigger text, see parseTrigger.
   * @param {(e: Event) => void} fn Handler to call when the trigger fires.
   * @returns {Function} Call to detach everything this binding created.
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
   * Scan a root element once and wire every laghu attribute found inside.
   *
   * Handled attributes: data-bind and data-text (textContent),
   * data-html (innerHTML through the sanitize hook), data-bind:attr,
   * data-class:name, data-style:prop, data-model (two-way form binding),
   * data-show and data-if (hidden toggle on elements, real attach and
   * detach on template tags), template data-for lists with data-key,
   * data-click, data-on:event with .prevent .stop .once, data-init,
   * custom directives, and data-get/post/put/patch/delete fetch blocks.
   *
   * Every wiring registers its cleanup on the element, so destroyTree
   * or node removal reverses all of it: effects stop, listeners detach,
   * intervals and observers disconnect, in-flight fetches abort.
   *
   * @example
   * var root = document.querySelector('#app');
   * var state = Laghu.hydrate(root, { count: 0 }, {
   *   increment: function () { this.count++; }
   * });
   * state.count = 5; // bound nodes update on the next microtask
   *
   * @param {Element} root Root to scan (bindings inside shadow roots are skipped).
   * @param {Record<string, any>} state State object, made reactive by the caller path.
   * @param {Record<string, Function>} [actions] Named actions for click and event handlers.
   */
  function hydrate(root, state, actions) {
    actions = actions || {};
    var scope = state;
    if (root instanceof Element && /** @type {any} */ (root).hasAttribute && /** @type {any} */ (root).hasAttribute('data-scope') && !/** @type {any} */ (root)._bScope) {
      /** @type {any} */ (root)._bScope = scope;
    }
    root.querySelectorAll('[data-bind],[data-text]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      if (claimed(el, 'bind')) return;
      var path = el.getAttribute('data-bind') || el.getAttribute('data-text') || '';
      var stop = effect(function () { el.textContent = String(evalExpr(scope, path) ?? ''); });
      onCleanup(el, stop);
    });
    root.querySelectorAll('[data-html]').forEach(function (node) {
      var el = /** @type {HTMLElement} */ (node);
      if (claimed(el, 'html')) return;
      var path = el.getAttribute('data-html') || '';
      var stop = effect(function () { el.innerHTML = sanitize(String(evalExpr(scope, path) ?? '')); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      Array.prototype.forEach.call(el.attributes || [], function (/** @type {Attr} */ a) {
        var an = a.name;
        if (an.indexOf('data-bind:') === 0) {
          if (claimed(el, 'a:' + an)) return;
          var attr = an.slice('data-bind:'.length);
          var expr = a.value;
          var stop = effect(function () {
            var v = evalExpr(scope, expr);
            if (v === false || v === null || v === undefined) el.removeAttribute(attr);
            else el.setAttribute(attr, String(v));
          });
          onCleanup(el, stop);
        } else if (an.indexOf('data-class:') === 0) {
          if (claimed(el, 'a:' + an)) return;
          var cls = an.slice('data-class:'.length);
          var e2 = a.value;
          var s2 = effect(function () { el.classList.toggle(cls, !!evalExpr(scope, e2)); });
          onCleanup(el, s2);
        } else if (an.indexOf('data-style:') === 0) {
          if (claimed(el, 'a:' + an)) return;
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
      if (claimed(el, 'model')) return;
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
      if (claimed(el, 'show')) return;
      var expr = el.getAttribute('data-show') || '';
      var stop = effect(function () { el.hidden = !evalExpr(scope, expr); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-if]'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      if (el.tagName === 'TEMPLATE') return;
      if (claimed(el, 'if')) return;
      var expr = el.getAttribute('data-if') || '';
      var stop = effect(function () { el.hidden = !evalExpr(scope, expr); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(root.querySelectorAll('template[data-if]'), function (node) {
      var tpl = /** @type {HTMLTemplateElement} */ (node);
      var expr = tpl.getAttribute('data-if') || '';
      if (claimed(tpl, 'tif')) return;
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
      if (claimed(tpl, 'tfor')) return;
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
        // fix order: the loop inserts each holder before the anchor in sequence
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
      if (claimed(el, 'click')) return;
      var code = el.getAttribute('data-click') || '';
      var spec = el.getAttribute('data-trigger') || 'click';
      bindTrigger(el, spec, function () { execAction(scope, actions || {}, code); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (node) {
      var el = /** @type {HTMLElement} */ (node);
      Array.prototype.forEach.call(el.attributes || [], function (/** @type {Attr} */ a) {
        if (a.name.indexOf('data-on:') === 0) {
          if (claimed(el, 'on:' + a.name)) return;
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
      if (claimed(el, 'init')) return;
      var code = el.getAttribute('data-init') || '';
      try { execAction(scope, actions || {}, code); } catch (e) {}
    });
    directives.forEach(function (fn, name) {
      root.querySelectorAll('[data-' + name + ']').forEach(function (node) {
        var el = /** @type {HTMLElement} */ (node);
        if (claimed(el, 'dir:' + name)) return;
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
      if (claimed(el, 'fetch')) return;
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
   * Fire one declarative request for a data-get/post/put/patch/delete
   * element. JSON responses merge into state with Object.assign (or set
   * state.result for non-objects). HTML or text responses swap into the
   * data-target element (default: the element itself).
   *
   * Request lifecycle: sets data-request on the element, shows
   * data-indicator, disables data-disable elements, dispatches
   * laghu:before-request (cancelable), laghu:after-request, and
   * laghu:request-error. Overlap follows the parsed queue modifier and
   * uses AbortController, so queue:last cancels the previous request.
   *
   * data-vals carries parameters: JSON such as '{"q": "x"}', the word
   * "form" to serialize the enclosing form, or nothing (a surrounding
   * form still serializes for non-GET). GET appends a query string,
   * other methods send a JSON body. data-headers merges extra headers.
   * data-select picks one selector out of an HTML response before swap.
   *
   * @param {HTMLElement} el Element carrying the data-* fetch attributes.
   * @param {any} scope State JSON merges into and swaps hydrate against.
   * @param {string} method Uppercase HTTP method.
   * @param {string} url Request URL (query params appended for GET).
   * @param {string} targetSel data-target selector, empty means the element.
   * @param {string} swap data-swap mode, see swapHtml.
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
    var before = new CustomEvent('laghu:before-request', { bubbles: true, cancelable: true, detail: { url: url, method: method } });
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
      el.dispatchEvent(new CustomEvent('laghu:after-request', { bubbles: true, detail: { status: res.status, url: url } }));
      if (!res.ok) {
        el.dispatchEvent(new CustomEvent('laghu:request-error', { bubbles: true, detail: { status: res.status, url: url } }));
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
      el.dispatchEvent(new CustomEvent('laghu:request-error', { bubbles: true, detail: { error: err } }));
      if (DEV && typeof console !== 'undefined') console.error('[laghu] fetch', err);
    });
  }
  /**
   * Read all successful controls of a form into a plain object.
   * Repeated names (checkbox groups, multi selects) become arrays.
   * File inputs become file names; files themselves are not uploaded
   * (fetch sends JSON, so use a custom handler for uploads).
   *
   * @param {HTMLFormElement} form Form to read.
   * @returns {Record<string, any>} Name to value map.
   */
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
   * Swap HTML into the page and re-hydrate bindings in the new content.
   *
   * Modes: inner (replace children), outer (replace the element itself),
   * text (plain text, no HTML parsing), append and beforeend (add at end),
   * prepend and afterbegin (add at start), beforebegin and afterend
   * (insert as siblings), delete (remove the target), none (skip, event
   * only), morph:inner and morph:outer (reuse matching nodes through the
   * morph plugin instead of replacing them).
   *
   * Safety and comfort behavior, every mode: HTML passes through the
   * sanitize hook first. Nodes marked data-preserve with an id survive
   * the swap by identity. New content hydrates against the given scope.
   * laghu:before-swap and laghu:after-swap dispatch on the target.
   * Focused element id and text caret restore after the swap.
   *
   * morph:* needs morph.js loaded (window.LaghuMorph). Without it, morph
   * warns in dev and falls back to a plain inner swap.
   *
   * @example
   * Laghu.swap(document.querySelector('#list'), '<li>A</li>', 'append', state);
   * Laghu.swap(document.querySelector('#list'), html, 'morph:inner', state);
   *
   * @param {Element} target Element the swap mode applies to.
   * @param {string} html Response HTML (already selected if data-select used).
   * @param {string} swap Mode name, case insensitive.
   * @param {any} scope State the swapped-in content hydrates against.
   */
  function swapHtml(target, html, swap, scope) {
    var s = String(swap || 'inner').toLowerCase();
    if (s === 'none') { target.dispatchEvent(new CustomEvent('laghu:after-swap', { bubbles: true, detail: { swap: s } })); return; }
    var focusId = document.activeElement && /** @type {any} */ (document.activeElement).id ? /** @type {any} */ (document.activeElement).id : null;
    var ae = /** @type {any} */ (document.activeElement);
    var selStart = ae && typeof ae.selectionStart === 'number' ? ae.selectionStart : -1;
    var selEnd = ae && typeof ae.selectionEnd === 'number' ? ae.selectionEnd : -1;
    target.dispatchEvent(new CustomEvent('laghu:before-swap', { bubbles: true, cancelable: false, detail: { swap: s } }));
    var isMorph = s.indexOf('morph') === 0;
    /** @type {any} */ var M = typeof window !== 'undefined' ? /** @type {any} */ (window).LaghuMorph : null;
    if (isMorph) {
      if (M && M.morph) {
        M.morph(target, sanitize(html), {});
        hydrate(target, scope, {});
        target.dispatchEvent(new CustomEvent('laghu:after-swap', { bubbles: true, detail: { swap: s } }));
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
    target.dispatchEvent(new CustomEvent('laghu:after-swap', { bubbles: true, detail: { swap: s } }));
    restoreFocus(focusId, selStart, selEnd);
  }
  /**
   * Refocus an element by id after a swap and restore a text caret.
   * Missing ids are ignored so swaps never throw on focus handling.
   *
   * @param {string|null} id Element id to refocus, or null to skip.
   * @param {number} a Caret start, -1 keeps the default.
   * @param {number} b Caret end, -1 keeps the default.
   */
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
   * Register a Light-DOM Web Component. Renders into the Light DOM
   * (no Shadow DOM), so global CSS, forms, labels, and assistive tech
   * keep working with zero extra code.
   *
   * Per instance lifecycle: setup() runs fresh for every element,
   * properties assigned before registration upgrade into state,
   * observed attributes coerce into state with their state-type,
   * children hydrate against the new reactive state, onMount runs,
   * the is-defined class applies for FOUC styling, and removal
   * destroys all bindings. Moving an element with moveBefore keeps
   * state because connectedMoveCallback is a no-op by design.
   *
   * Attribute sync is one way (attribute into state, never reflected
   * back) to avoid loops. Complex values travel through properties:
   *   document.querySelector('user-card').state.user = {...}
   * or a direct property that upgrades on connect.
   *
   * @example
   * Laghu.define('counter-widget', () => ({
   *   state: { count: 0 },
   *   actions: {
   *     increment: function () { this.count++; }
   *   },
   *   observed: ['count'],
   *   onMount: function () { console.log('ready'); }
   * }));
   * // <counter-widget count="5"> starts at 5, not 0.
   *
   * @param {string} tag Custom element name, must contain a hyphen.
   * @param {() => SetupResult} setup Factory returning fresh state,
   *   actions, observed names, and onMount per instance.
   * @returns {any} The registered custom element class.
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
  /**
   * Public API attached as window.Laghu. Every method is documented on
   * the function that implements it; this table is the map:
   *
   * - version: "1.0.0" string for cache busting and bug reports.
   * - define(tag, setup): register a Light-DOM component, see define.
   * - reactive(obj): make state observable, see reactive.
   * - effect(fn): subscribe to state reads, see effect.
   * - eval(scope, expr): CSP-safe expression reader, see evalExpr.
   * - get(scope, path) and set(scope, path, val): path access, see
   *   getPath and setPath. "$store.name.key" reaches global stores.
   * - parseTrigger(spec, el): parse data-trigger text, see parseTrigger.
   * - swap(target, html, mode, scope): swap and hydrate, see swapHtml.
   * - css: FOUC guard string. Inject it or copy the rule into your CSS:
   *   custom tags hide until registered, then show with is-defined.
   * - sanitize(fn): replace the HTML pass-through. Pass a DOMPurify
   *   style function in production when rendering server HTML:
   *   Laghu.sanitize(function (h) { return DOMPurify.sanitize(h); });
   * - hydrate(root, state, actions): scan and bind, returns the
   *   reactive state. Called automatically for [data-scope] islands
   *   on DOMContentLoaded and for swapped-in content.
   * - destroyTree(root): stop effects, detach listeners, abort fetches
   *   under root. Called automatically on removal and before swaps.
   * - store(name, init?): create or fetch a named global reactive
   *   store. Read it in expressions as $store.name.key.
   * - directive(name, fn): register data-name. fn receives
   *   { el, get, effect, scope } and may return a cleanup function.
   */
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
