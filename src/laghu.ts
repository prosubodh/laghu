/**
 * laghu core - zero-build IIFE micro-framework.
 *
 * What this module provides:
 * - Proxy based reactivity with per-binding effects (no Virtual DOM).
 * - Hydrate-in-place HTML bindings plus template based if/for lists.
 * - Two-way form bindings, declarative fetch with HTML or JSON swaps.
 * - Light-DOM Web Components with attribute to state sync.
 * - Strict CSP compliance: no new Function, no eval, no inline handlers.
 *
 * Consumed without a compiler: the build bundles this module to a
 * plain-JS IIFE (`dist/laghu.js`, minified to `dist/laghu.min.js`)
 * usable from a script tag or `file://`.
 *
 *   <script src="laghu.min.js"></script>
 *   <script>Laghu.define('my-tag', () => ({ state: { n: 0 } }));</script>
 */

export interface SetupResult {
  /** Initial state for one component instance. */
  state?: Record<string, any>;
  /** Methods callable from data-click and data-on. */
  actions?: Record<string, (...args: any[]) => void>;
  /** Attribute names synced into state. Defaults to primitive state keys. */
  observed?: string[];
  /** Runs once after the element is hydrated. */
  onMount?: (this: any) => void;
  /** Runs on disconnect. Reserved pairing for onMount. */
  onUnmount?: (this: any) => void;
}

export interface TriggerSpec {
  on: string;
  delay: number;
  throttle: number;
  once: boolean;
  changed: boolean;
  queue: string;
  from: string;
  every: number;
  load: boolean;
  revealed: boolean;
}

export interface DirectiveContext {
  el: HTMLElement;
  get(): any;
  effect(f: () => void): () => void;
  scope: any;
}

export interface LaghuAPI {
  version: string;
  define(tag: string, setup: () => SetupResult): any;
  reactive<T extends object>(obj: T): T;
  effect(fn: () => void): () => void;
  eval(scope: any, expr: string): any;
  get(scope: any, path: string): any;
  set(scope: any, path: string, val: any): void;
  parseTrigger(spec: string, el: Element): TriggerSpec;
  swap(target: Element, html: string, swap: string, scope: any, actions?: Record<string, Function>): void;
  css: string;
  sanitize(fn: (html: string) => string): void;
  hydrate(root: Element, state?: Record<string, any>, actions?: Record<string, Function>): any;
  destroyTree(root: Element): void;
  store(name: string, init?: any): any;
  computed(fn: () => any): () => any;
  watch(scope: any, expr: string, cb: (next: any, prev: any) => void): () => void;
  persist(name: string, opts?: { key?: string; version?: number; debounce?: number }): any;
  directive(name: string, fn: (ctx: DirectiveContext) => void | (() => void)): void;
  /**
   * Register a display filter for data-bind pipes:
   * data-bind="price | currency". Unknown names warn and pass through.
   */
  filter(name: string, fn: (value: any, arg: string, scope: any) => any): void;
  /**
   * Make a child scope owning vars over a parent. Needed by custom
   * renderers (router templates, hand-rolled lists): plain assignment
   * on a Proxy-prototyped object would write the parent instead.
   */
  scope(parent: any, vars: Record<string, any>): any;
}

declare global {
  interface Window {
    Laghu: LaghuAPI;
    __LAGHU_DEV__?: boolean;
  }
  // Internal bookkeeping fields laghu attaches to DOM nodes.
  // Optional and underscore-prefixed; plugin authors may read
  // _bScope but must never write these directly.
  interface Element {
    _bcu?: Array<Function>;
    _bH?: Record<string, number>;
    _bReq?: any;
    _bReqs?: Set<any>;
    _bN?: number;
    _bScope?: any;
    _bActions?: Record<string, Function>;
    _bInit?: boolean;
    _bPend?: Record<string, string | null> | null;
    _bOnUnmount?: Function;
  }
  interface HTMLElement {
    _bcu?: Array<Function>;
    _bH?: Record<string, number>;
    _bT?: number;
    _bHide?: boolean;
    _bVal?: boolean;
    _bValForm?: boolean;
    _bTried?: boolean;
    _bTouched?: boolean;
  }
}

export const Laghu: LaghuAPI = (() => {
  'use strict';
  var VERSION = '1.1.0';
  // Opt-in dev noise. Production stays silent unless handlers listen
  // for laghu:error / laghu:request-error, which always dispatch.
  var DEV = typeof window !== 'undefined' && ((window) as any).__LAGHU_DEV__ === true;

  var stores: Map<string, any> = new Map();
  var directives: Map<string, Function> = new Map();
  var targetMap: WeakMap<object, Map<string, Set<Function>>> = new WeakMap();
  /** Proxies created by reactive, so re-wrapping returns the same proxy
   * instead of stacking proxy-on-proxy traps. */
  var proxyCache: WeakMap<object, any> = new WeakMap();
  var proxySet: WeakSet<object> = new WeakSet();
  var activeEffect: Function | null = null;
  var jobQueue: Set<Function> = new Set();
  var flushing = false;
  /** Attributes whose values can navigate or load code: scriptable
   * URLs are refused here (baseline; DOMPurify for untrusted input). */
  var URL_ATTRS: Record<string, number> = { href: 1, src: 1, action: 1, formaction: 1, cite: 1, poster: 1, data: 1, srcset: 1, srcdoc: 1 };
  /** Path segments that must never be read or written: prototype
   * pollution sinks and callable gadgets (constructor, toString).
   * @param {string} seg */
  function badSeg(seg: string) {
    return seg === '__proto__' || seg === 'constructor' || seg === 'prototype';
  }
  /** True for URL values that execute code (checked case-insensitively,
   * whitespace-insensitively, so casing tricks do not slip through).
   * @param {any} v */
  function unsafeUrl(v: any) {
    var s = String(v).replace(/[\s\x00-\x1f]+/g, '').toLowerCase();
    return s.indexOf('javascript:') === 0 || s.indexOf('data:text/html') === 0 || s.indexOf('vbscript:') === 0;
  }
  /**
   * Baseline HTML cleaner used when no sanitizer is installed. Strips
   * scripts, frames, event-handler attributes, and scriptable URLs.
   * This is a floor, not a policy: pair with DOMPurify through
   * Laghu.sanitize for untrusted content.
   * @param {any} html
   * @returns {string}
   */
  function defaultSanitize(html: any) {
    var s = String(html);
    s = s.replace(/<script[\s\S]*?(<\/script\s*>|$)/gi, '');
    s = s.replace(/<\/?(iframe|object|embed|link|meta|base)[^>]*>/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/(href|src|xlink:href|action|formaction|poster|data)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, function (m: any, a: any, q: any, d1: any, d2: any, d3: any) {
      var v = d1 !== undefined ? d1 : (d2 !== undefined ? d2 : d3);
      if (unsafeUrl(v)) return a + '="#"';
      return m;
    });
    return s;
  }
  var sanitize: (html: string) => string = defaultSanitize;

  /**
   * Report a runtime failure. Always dispatches laghu:error on document
   * (so production has signal without console noise); logs only in dev.
   * @param {any} err
   */
  function reportError(err: any) {
    try {
      if (typeof document !== 'undefined' && document.dispatchEvent) {
        document.dispatchEvent(new CustomEvent('laghu:error', {
          detail: { error: String((err && err.message) || err), version: VERSION }
        }));
      }
    } catch (e) {}
    if (DEV && typeof console !== 'undefined') console.error('[laghu]', err);
  }
  function flush() {
    flushing = false;
    var jobs = Array.from(jobQueue);
    jobQueue.clear();
    for (var i = 0; i < jobs.length; i++) {
      try { jobs[i](); } catch (e) { reportError(e); }
    }
  }
  /** @param {Function} fn */
  function schedule(fn: Function) {
    jobQueue.add(fn);
    if (!flushing) { flushing = true; Promise.resolve().then(flush); }
  }
  /** Nesting stack so inner effects never clobber outer dependencies. */
  var effectStack: Array<Function> = [];
  var runDeps: WeakMap<Function, Array<Set<Function>>> = new WeakMap();
  /**
   * Run a function now and re-run it whenever reactive state it read
   * changes. Each DOM binding creates one effect, so updates touch only
   * the exact node that depends on the changed value.
   *
   * Effects are batched in a microtask: many synchronous writes cause
   * one re-run. A throwing run reports laghu:error and keeps the page
   * alive; subscriptions refresh per run so untaken branches release.
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
  function effect(fn: Function) {
    var stopped = false;
    var deps: Array<Set<Function>> = [];
    var run = function () {
      if (stopped) return;
      // Drop last run's subscriptions first: conditional branches
      // (a ? b : c) must not keep firing on the untaken path.
      for (var i = 0; i < deps.length; i++) deps[i].delete(run);
      deps.length = 0;
      effectStack.push(run);
      activeEffect = run;
      runDeps.set(run, deps);
      try { fn(); }
      catch (e) { reportError(e); }
      finally {
        effectStack.pop();
        activeEffect = effectStack.length ? effectStack[effectStack.length - 1] : null;
      }
    };
    run();
    return function () {
      stopped = true;
      for (var i = 0; i < deps.length; i++) deps[i].delete(run);
      deps.length = 0;
    };
  }
  /** @param {object} t @param {string} k */
  function track(t: object, k: string) {
    if (!activeEffect) return;
    var m = targetMap.get(t);
    if (!m) { m = new Map(); targetMap.set(t, m); }
    var s = m.get(k);
    if (!s) { s = new Set(); m.set(k, s); }
    s.add(activeEffect);
    var arr = runDeps.get(activeEffect);
    if (arr) arr.push(s);
  }
  /** @param {object} t @param {string} k */
  function trigger(t: object, k: string) {
    var m = targetMap.get(t);
    if (!m) return;
    var s = m.get(k);
    if (!s) return;
    s.forEach(function (fn: any) { schedule(fn); });
  }
  /** @param {any} v @returns {boolean} */
  function isObj(v: any) { return v !== null && typeof v === 'object'; }
  /**
   * Key presence without narrowing the value. Using `in` directly on
   * an `any` reference makes later property reads fail strict checks.
   */
  function hasKey(o: any, k: string): boolean {
    return !!o && (k in o);
  }
  /**
   * Make a child scope that inherits a parent while owning the given
   * variables. Uses defineProperty because plain assignment on an
   * object whose prototype is a reactive Proxy would route into the
   * proxy set trap and write the parent instead of the child.
   *
   * @example
   * var row = childScope(state, { c: item, i: 0 });
   * row.c; // item, owned by row, parent untouched
   *
   * @param {any} scope Parent scope on the prototype chain.
   * @param {Record<string, any>} vars Variables owned by the child.
   * @returns {any} Child scope.
   */
  function childScope(scope: any, vars: Record<string, any>) {
    var o = Object.create(scope);
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        Object.defineProperty(o, k, {
          value: vars[k],
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return o;
  }
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
  function getPath(scope: any, path: string) {
    if (!path) return undefined;
    var parts = String(path).split('.');
    var head = parts[0].trim();
    if (badSeg(head)) return undefined;
    if (head === '$store') {
      var sn = parts[1];
      var st = stores.get(sn);
      if (!st) return undefined;
      var cur2 = st;
      for (var k = 2; k < parts.length; k++) {
        if (badSeg(parts[k])) return undefined;
        if (!isObj(cur2)) return undefined;
        cur2 = cur2[parts[k]];
      }
      return cur2;
    }
    if (!(head in Object(scope))) {
      // Track the miss so late-added keys (framework $error, user keys
      // declared after first render) still wake this reader up.
      if (typeof head === 'string' && isObj(scope)) track(scope, head);
      return undefined;
    }
    var cur = scope[head];
    for (var i = 1; i < parts.length; i++) {
      if (badSeg(parts[i])) return undefined;
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
  function setPath(scope: any, path: string, val: any) {
    var parts = String(path).split('.');
    for (var g = 0; g < parts.length; g++) {
      if (badSeg(parts[g].trim())) {
        if (DEV && typeof console !== 'undefined') console.warn('[laghu] blocked unsafe path "' + path + '"');
        return;
      }
    }
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
   * Idempotent: passing an already reactive object returns it as is
   * instead of stacking proxy on proxy.
   *
   * @param {object} obj Plain object or array to make reactive.
   * @returns {any} Reactive proxy around the same data.
   */
  function reactive(obj: object) {
    if (!isObj(obj)) return obj;
    if (proxySet.has(obj)) return obj;
    var hit = proxyCache.get(obj);
    if (hit) return hit;
    var proxy = new Proxy(obj, {
      get: function (t: any, p: any, r: any) {
        if (typeof p === 'string') track(t, p);
        var v = Reflect.get(t, p, r);
        return isObj(v) ? reactive(v) : v;
      },
      set: function (t: any, p: any, v: any) {
        var old = t[((p) as string)];
        var ok = Reflect.set(t, p, v);
        if (old !== v && typeof p === 'string') {
          trigger(t, p);
          // Miss-reads subscribe on the proxy itself (the raw target is
          // unreachable from outside), so wake those subscribers too.
          var px = proxyCache.get(t);
          if (px) trigger(px, p);
        }
        return ok;
      },
      deleteProperty: function (t: any, p: any) {
        var ok = Reflect.deleteProperty(t, p);
        if (typeof p === 'string') {
          trigger(t, p);
          var px = proxyCache.get(t);
          if (px) trigger(px, p);
        }
        return ok;
      }
    });
    proxyCache.set(obj, proxy);
    proxySet.add(proxy);
    return proxy;
  }
  /** @param {string} s @param {string} op @returns {string[]} */
  function splitTop(s: string, op: string) {
    var out = []; var depth = 0; var q = null; var cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (depth === 0 && s.slice(i, i + op.length) === op) { out.push(cur); cur = ''; i += op.length - 1; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }
  /**
   * Find the last top-level operator char outside quotes and parens.
   * Position 0 never counts, so leading signs stay unary.
   * @param {string} s @param {string} chars
   * @returns {number} Index, or -1 when absent.
   */
  function lastTopOp(s: string, chars: string) {
    var depth = 0, q = null;
    for (var i = s.length - 1; i > 0; i--) {
      var c = s[i];
      if (q) { if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === ')') depth++;
      if (c === '(') depth--;
      if (depth === 0 && chars.indexOf(c) >= 0) return i;
    }
    return -1;
  }
  /**
   * Split a ternary at its top-level ? and :. Returns null when the
   * string holds no top-level question mark.
   * @param {string} s
   * @returns {Array<string>|null} [cond, yes, no] or null.
   */
  function splitTernary(s: string) {
    var depth = 0, q = null, qi = -1;
    var i;
    for (i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === '?' && depth === 0) { qi = i; break; }
    }
    if (qi < 0) return null;
    depth = 0; q = null;
    for (i = qi + 1; i < s.length; i++) {
      var d = s[i];
      if (q) { if (d === q && s[i - 1] !== '\\') q = null; continue; }
      if (d === '"' || d === "'") { q = d; continue; }
      if (d === '(' || d === '[') depth++;
      if (d === ')' || d === ']') depth--;
      if (d === ':' && depth === 0) return [s.slice(0, qi), s.slice(qi + 1, i), s.slice(i + 1)];
    }
    return null;
  }
  /**
   * Evaluate a small expression against a scope without new Function,
   * so it runs under strict Content Security Policy.
   *
   * Supported: dotted paths, bracket indexes (list[0], map["key"]),
   * string/number/true/false/null literals, not (!), arithmetic
   * (+ - * / %), comparisons, and/or (&&, ||), ternary (a ? b : c),
   * and calls with evaluated arguments such as "total(qty)".
   * A whole string that resolves as a path wins over operators, so
   * kebab-case keys ("t-read", "my-value") read literally whenever
   * they exist; "count-1" still subtracts when no such key exists.
   * Anything else returns undefined. Unknown method names warn in dev.
   *
   * @example
   * Laghu.eval({ count: 6 }, 'count > 5');       // true
   * Laghu.eval({ user: { name: 'Ada' } }, 'user.name'); // 'Ada'
   * Laghu.eval({ open: false }, '!open');         // true
   * Laghu.eval({ price: 3, qty: 4 }, 'price * qty'); // 12
   * Laghu.eval({ t: 1 }, 't > 0 ? "up" : "down"');  // 'up'
   *
   * @param {any} scope Scope to resolve paths and methods against.
   * @param {string} expr Expression text from a data-* attribute.
   * @returns {any} Result of the expression.
   */
  function evalExpr(scope: any, expr: string): any {
    var s = String(expr).trim();
    if (!s) return undefined;
    // A literal path wins over operators: kebab-case keys, store names,
    // and dotted paths resolve whole before any arithmetic is tried.
    // 'count-1' still subtracts when no such key exists.
    var direct = getPath(scope, s);
    if (direct !== undefined) return direct;
    var ter0 = splitTernary(s);
    if (ter0) return evalExpr(scope, ter0[0]) ? evalExpr(scope, ter0[1]) : evalExpr(scope, ter0[2]);
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
      var L: any = evalExpr(scope, m[1]); var R: any = evalExpr(scope, m[3]); var op = m[2];
      if (op === '>') return L > R;
      if (op === '<') return L < R;
      if (op === '>=') return L >= R;
      if (op === '<=') return L <= R;
      if (op === '==') return L == R;
      if (op === '!=') return L != R;
      if (op === '===') return L === R;
      return L !== R;
    }
    var ai = lastTopOp(s, '+-');
    if (ai > 0 && s.slice(0, ai).trim() && s.slice(ai + 1).trim()) {
      var lop = s[ai];
      var la: any = evalExpr(scope, s.slice(0, ai));
      var ra: any = evalExpr(scope, s.slice(ai + 1));
      return lop === '+' ? la + ra : la - ra;
    }
    var mi = lastTopOp(s, '*/%');
    if (mi > 0 && s.slice(0, mi).trim() && s.slice(mi + 1).trim()) {
      var mop = s[mi];
      var lm: any = evalExpr(scope, s.slice(0, mi));
      var rm: any = evalExpr(scope, s.slice(mi + 1));
      if (mop === '*') return lm * rm;
      if (mop === '/') return lm / rm;
      return lm % rm;
    }
    if (s[0] === '!') return !evalExpr(scope, s.slice(1));
    if (s[0] === '-') return -evalExpr(scope, s.slice(1));
    // parenthesized group: (a + b) * c. Only when the first paren
    // matches the final char, so calls fall through below.
    if (s[0] === '(') {
      var gd = 0, gq = null, gm = -1, gi;
      for (gi = 0; gi < s.length; gi++) {
        var gc = s[gi];
        if (gq) { if (gc === gq && s[gi - 1] !== '\\') gq = null; continue; }
        if (gc === '"' || gc === "'") { gq = gc; continue; }
        if (gc === '(') gd++;
        if (gc === ')') { gd--; if (gd === 0) { gm = gi; break; } }
      }
      if (gm === s.length - 1) return evalExpr(scope, s.slice(1, -1));
    }
    if ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'")) return s.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (s === 'undefined') return undefined;
    // calls with evaluated arguments: name(a, b). The name resolves
    // through the blocked-segment guard, so constructor-style gadgets
    // stay unreachable here too.
    if (s.charAt(s.length - 1) === ')') {
      var op2 = s.indexOf('(');
      if (op2 > 0) {
        var depth = 0, qq = null, match = -1, k;
        for (k = op2; k < s.length; k++) {
          var ch = s[k];
          if (qq) { if (ch === qq && s[k - 1] !== '\\') qq = null; continue; }
          if (ch === '"' || ch === "'") { qq = ch; continue; }
          if (ch === '(') depth++;
          if (ch === ')') { depth--; if (depth === 0) { match = k; break; } }
        }
        if (match === s.length - 1) {
          var cname = s.slice(0, op2);
          if (/^[\w.$]+$/.test(cname)) {
            var fn = getPath(scope, cname);
            if (typeof fn === 'function') {
              var raw = s.slice(op2 + 1, match).trim();
              var args = raw ? splitTop(raw, ',').map(function (a: any) { return evalExpr(scope, a); }) : [];
              return fn.apply(scope, args);
            }
            if (DEV && typeof console !== 'undefined') console.warn('[laghu] unknown method "' + s + '"');
            return undefined;
          }
        }
      }
    }
    // bracket index: list[0], map["key"]. Falls back to a plain path.
    var br = s.match(/^(.*)\[(\d+|"(?:[^"]*)"|'(?:[^']*)')\]$/);
    if (br && br[1]) {
      var base = evalExpr(scope, br[1]);
      if (base === null || base === undefined) return undefined;
      var key: any = br[2];
      if (key[0] === '"' || key[0] === "'") key = key.slice(1, -1);
      else key = Number(key);
      if (typeof key === 'string' && badSeg(key)) return undefined;
      return base[key];
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
  function execAction(scope: any, actions: Record<string, Function>, code: string) {
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
    if (/^[A-Za-z_$][\w.$-]*$/.test(s)) {
      // Plain name (kebab-case allowed): an action or state function
      // reference. Never an expression, so hyphens stay literal here
      // even though they mean subtraction inside evalExpr strings.
      unknownAction(s);
      return;
    }
    var v = evalExpr(scope, s);
    if (typeof v === 'function') v.call(scope);
    else if (v === undefined) unknownAction(s);
  }
  /**
   * Loud unknown-action path: dev warning plus a document event every
   * time, so typos fail visibly in any environment.
   * @param {string} s
   */
  function unknownAction(s: string) {
    if (DEV && typeof console !== 'undefined') console.warn('[laghu] unknown action "' + s + '"');
    if (typeof CustomEvent !== 'undefined' && typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('laghu:unknown-action', { detail: { name: s } }));
    }
  }
  /** @param {Element} el @param {Function} fn */
  function onCleanup(el: Element, fn: Function) {
    var list = el._bcu;
    if (!list) { list = []; el._bcu = list; }
    list.push(fn);
  }
  /**
   * Element lists that include the root itself. querySelectorAll only
   * sees descendants, so without these an island or component tag
   * carrying its own data-* attributes (a form with data-post, a root
   * with data-bind) would silently never wire.
   */
  /**
   * @param {Element} root
   * @param {string} sel
   * @param {(node: Element) => void} fn
   */
  function eachEl(root: Element, sel: string, fn: (node: Element) => void) {
    if (root instanceof Element && root.matches) {
      try { if (root.matches(sel)) fn(root); } catch (e) {}
    }
    Array.prototype.forEach.call(root.querySelectorAll(sel), fn);
  }
  function allEls(root: Element) {
    var out: Array<Element> = [];
    if (root instanceof Element) out.push(root);
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (n: Element) { out.push(n); });
    return out;
  }
  /**
   * WAAPI keyframes for a preset, forward (enter) or reversed (leave).
   * Shared by toggles and inserts so presets stay defined once.
   */
  function transFrames(kind: string, out: boolean) {
    var from = kind.indexOf('slide') >= 0 ? 'translateY(-8px)' : (kind.indexOf('scale') >= 0 ? 'scale(.96)' : 'none');
    var a = { opacity: '0', transform: from };
    var b = { opacity: '1', transform: 'none' };
    return out ? [b, a] : [a, b];
  }
  /**
   * Transition duration in ms from data-duration (default 150).
   */
  function transDur(el: Element): number {
    return parseMs(el.getAttribute('data-duration') || '150ms') || 150;
  }
  /**
   * Show or hide with an optional WAAPI transition. data-transition
   * picks a preset (fade, slide, scale), data-duration sets
   * milliseconds (default 150). Instant when no preset, when
   * reduced-motion is requested, or when animate() is missing
   * (jsdom, old browsers): behavior never depends on animation.
   * Overlapping toggles cancel: only the latest intent applies.
   * @param {HTMLElement} el
   * @param {boolean} hide
   */
  function setHidden(el: HTMLElement, hide: boolean) {
    hide = !!hide;
    if (!!el.hidden === hide) return;
    // First application is instant: mounting hidden content must not
    // play a leave, and mounting visible content must not flash in.
    // Only genuine transitions animate after this baseline.
    var seen = (el as any)._bT;
    if (seen === undefined) {
      (el as any)._bT = 0;
      el.hidden = hide;
      return;
    }
    var kind = (el.getAttribute && el.getAttribute('data-transition')) || '';
    var reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!kind || kind === 'none' || reduce || typeof el.animate !== 'function') {
      el.hidden = hide;
      return;
    }
    var dur = transDur(el);
    var tk = (((el) as any)._bT = ((((el) as any)._bT) || 0) + 1);
    ((el) as any)._bHide = hide;
    if (!hide) {
      el.hidden = false;
      try {
        var a = el.animate(transFrames(kind, false), { duration: dur, easing: 'ease-out' });
        if (a && a.finished && a.finished.catch) a.finished.catch(function () {});
      } catch (e) {}
    } else {
      try {
        var a2 = el.animate(transFrames(kind, true), { duration: dur, easing: 'ease-in' });
        var done = function () {
          if (((el) as any)._bT === tk && ((el) as any)._bHide && el.isConnected) el.hidden = true;
        };
        if (a2 && a2.finished && a2.finished.then) a2.finished.then(done, done);
        else setTimeout(done, dur);
      } catch (e) { el.hidden = true; }
    }
  }
  /**
   * Play enter animations for fresh content (template inserts, new
   * list rows). Only nodes carrying data-transition animate, so
   * plain inserts cost nothing. The root itself counts.
   * @param {Element} root
   */
  function playEnter(root: Element) {
    eachEl(root, '[data-transition]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (el.hidden) return;
      var kind = el.getAttribute('data-transition') || '';
      if (!kind || kind === 'none') return;
      if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (typeof el.animate !== 'function') return;
      var dur = transDur(el);
      try {
        var a = el.animate(transFrames(kind, false), { duration: dur, easing: 'ease-out' });
        if (a && a.finished && a.finished.catch) a.finished.catch(function () {});
      } catch (e) {}
    });
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
  function claimed(el: Element, key: string) {
    var host = ((el) as any);
    var map = host._bH || (host._bH = {});
    if (map[key]) return true;
    map[key] = 1;
    return false;
  }
  /** @param {Element} root */
  function destroyTree(root: Element) {
    if (((root) as any)._bcu) {
      ((root) as any)._bcu.forEach(function (fn: Function) { try { fn(); } catch (e) {} });
      ((root) as any)._bcu = [];
    }
    ((root) as any)._bH = undefined;
    var kids = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) {
      var c = ((kids[i]) as any);
      if (c._bcu) { c._bcu.forEach(function (fn: Function) { try { fn(); } catch (e) {} }); c._bcu = []; }
      c._bH = undefined;
      if (c._bReq) { try { c._bReq.abort(); } catch (e) {} c._bReq = null; }
    }
    var self = ((root) as any);
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
  function parseScope(raw: string|null) {
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
  function coerceAttr(raw: string|null|undefined, cur: any) {
    if (raw === null || raw === undefined) return cur;
    if (typeof cur === 'boolean') return raw !== 'false' && raw !== '0';
    if (typeof cur === 'number') { var n = Number(raw); return isNaN(n) ? cur : n; }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw !== '' && !isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw);
    return raw;
  }
  /** @param {string} s @returns {number} */
  function parseMs(s: string) {
    var m = String(s).trim().match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    return m[2] === 's' ? n * 1000 : n;
  }
  /** @param {Element} el @returns {string} */
  function defaultEvent(el: Element) {
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
   * Automatic firings (every, load, revealed) combine with the event
   * listener: data-trigger="load" on a button loads on ready and still
   * reloads on click.
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
  function parseTrigger(spec: string, el: Element) {
    var out: any = { on: '', delay: 0, throttle: 0, once: false, changed: false, queue: 'last', from: '', every: 0, load: false, revealed: false };
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
  function bindTrigger(el: Element, spec: string, fn: (e: Event) => void) {
    var t = parseTrigger(spec, el);
    var state: any = { timer: 0, lastFire: 0, lastVal: null, done: false };
    var fire = function (e: Event) {
      if (state.done) return;
      var input: any = el;
      if (t.changed && (hasKey(input, 'value') || hasKey(input, 'checked'))) {
        var v = (input.type === 'checkbox' || input.type === 'radio') ? String(input.checked) + ':' + String(input.value) : String(input.value);
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
    var cleanups: Array<Function> = [];
    var cleanup = function () {
      for (var ci = 0; ci < cleanups.length; ci++) {
        try { cleanups[ci](); } catch (e) {}
      }
      clearTimeout(state.timer);
    };
    var listenOn = ((el) as any);
    if (t.from === 'document' && typeof document !== 'undefined') listenOn = document;
    else if (t.from === 'body' && typeof document !== 'undefined') listenOn = document.body;
    else if (t.from && typeof document !== 'undefined') {
      var root = document;
      var h = function (e: Event) {
        var tgt = ((e.target) as any);
        if (tgt && tgt.closest && tgt.closest(t.from)) fire(e);
      };
      root.addEventListener(t.on, h);
      cleanups.push(function () { root.removeEventListener(t.on, h); });
      onCleanup(el, cleanup);
      return cleanup;
    }
    // Automatic firings (every, load, revealed) arm independently and
    // combine with the event listener below, so data-trigger="load"
    // on a button loads once on ready and still reloads on click.
    if (t.every) {
      var id = setInterval(function () { fire(new CustomEvent('laghu:poll')); }, t.every);
      cleanups.push(function () { clearInterval(id); });
    }
    if (t.load) {
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        var lh = function () { fire(new CustomEvent('laghu:load')); };
        document.addEventListener('DOMContentLoaded', lh, { once: true });
        cleanups.push(function () { document.removeEventListener('DOMContentLoaded', lh); });
      } else {
        var runNow = function () { fire(new CustomEvent('laghu:load')); };
        if (typeof queueMicrotask !== 'undefined') queueMicrotask(runNow); else setTimeout(runNow, 0);
      }
    }
    if (t.revealed) {
      if (typeof IntersectionObserver !== 'undefined') {
        var io = new IntersectionObserver(function (es: any) {
          es.forEach(function (en: any) { if (en.isIntersecting) { fire(new CustomEvent('laghu:revealed')); if (t.once) io.disconnect(); } });
        });
        io.observe(el);
        cleanups.push(function () { io.disconnect(); });
      } else {
        fire(new CustomEvent('laghu:revealed'));
      }
    }
    listenOn.addEventListener(t.on, fire);
    cleanups.push(function () { listenOn.removeEventListener(t.on, fire); });
    onCleanup(el, cleanup);
    return cleanup;
  }
  /** Display filters: name to (value, arg, scope) => value. */
  var filters: Map<string, Function> = new Map();
  function numArg(a: string): number {
    var n = Number(a);
    return isNaN(n) ? 0 : n;
  }
  function strArg(a: string): string {
    var s = String(a == null ? '' : a);
    if (s.length > 1 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
      return s.slice(1, -1);
    }
    return s;
  }
  [
    ['uppercase', function (v: any) { return String(v ?? '').toUpperCase(); }],
    ['lowercase', function (v: any) { return String(v ?? '').toLowerCase(); }],
    ['json', function (v: any) { try { return JSON.stringify(v); } catch (e) { return String(v); } }],
    ['fixed', function (v: any, a: any) { var n = Number(v); return isNaN(n) ? String(v ?? '') : n.toFixed(numArg(strArg(a))); }],
    ['currency', function (v: any, a: any) { var n = Number(v); var c = strArg(a) || '$'; return isNaN(n) ? String(v ?? '') : c + n.toFixed(2); }],
    ['date', function (v: any, a: any) { var d = new Date(v); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(strArg(a) || undefined); }],
    ['default', function (v: any, a: any) { return (v === null || v === undefined || v === '') ? strArg(a) : v; }],
    ['join', function (v: any, a: any) { return Array.isArray(v) ? v.join(a === '' ? ', ' : strArg(a)) : v; }],
    ['length', function (v: any) { return v == null ? 0 : (v.length === undefined ? 0 : v.length); }]
  ].forEach(function (p: any) { filters.set(p[0], p[1]); });
  /**
   * Split "expr | filter[:arg] | ..." on top-level single pipes.
   * Double pipes (||) stay logical-or; quotes and parens shield pipes.
   * @returns [expression, [[name, arg], ...]]
   */
  function splitFilters(s: string): [string, Array<[string, string]>] {
    var depth = 0, q: string | null = null, cur = '', parts: string[] = [];
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === '|' && depth === 0) {
        if (s[i + 1] === '|') { cur += '||'; i++; continue; }
        parts.push(cur); cur = '';
        continue;
      }
      cur += c;
    }
    parts.push(cur);
    var expr = parts.shift() || '';
    var filtersOut: Array<[string, string]> = parts.map(function (p) {
      var ci = p.indexOf(':');
      if (ci < 0) return [p.trim(), ''];
      return [p.slice(0, ci).trim(), p.slice(ci + 1).trim()];
    });
    return [expr, filtersOut];
  }
  /**
   * Run one display expression through its filter chain.
   * Unknown filters warn in dev and pass the value through.
   */
  function filterValue(scope: any, expr: string, chain: Array<[string, string]>): any {
    var v = evalExpr(scope, expr);
    for (var i = 0; i < chain.length; i++) {
      var fn = filters.get(chain[i][0]);
      if (typeof fn !== 'function') {
        if (DEV && typeof console !== 'undefined') console.warn('[laghu] unknown filter "' + chain[i][0] + '"');
        continue;
      }
      try { v = fn(v, chain[i][1], scope); }
      catch (e) { reportError(e); return v; }
    }
    return v;
  }
  /**
   * Scan a root element once and wire every laghu attribute found inside.
   *
   * Handled attributes: data-bind and data-text (textContent),
   * data-html (innerHTML through the sanitize hook), data-bind:attr,
   * data-class:name, data-style:prop, data-model (two-way form binding),
   * data-show and data-if (hidden toggle on elements, real attach and
   * detach on template tags), template data-for lists with item-relative
   * data-key (rows keyed by item property, stable across reorder),
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
  function hydrate(root: Element, state: Record<string, any>, actions: Record<string, Function>) {
    actions = actions || {};
    var scope = state;
    // Seed the shared fetch-error slot before any binding reads it, so
    // data-bind="$error.status" subscribes on first render instead of
    // staying blind. setPath lands it on the owning scope.
    try {
      if (isObj(scope) && !('$error' in Object(scope))) setPath(scope, '$error', null);
    } catch (e) {}
    if (root instanceof Element && ((root) as any).hasAttribute && ((root) as any).hasAttribute('data-scope') && !((root) as any)._bScope) {
      ((root) as any)._bScope = scope;
    }
    eachEl(root, '[data-bind],[data-text]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (claimed(el, 'bind')) return;
      var path = el.getAttribute('data-bind') || el.getAttribute('data-text') || '';
      var split = splitFilters(path);
      var stop = effect(function () {
        el.textContent = String(filterValue(scope, split[0], split[1]) ?? '');
      });
      onCleanup(el, stop);
    });
    eachEl(root, '[data-html]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (claimed(el, 'html')) return;
      var path = el.getAttribute('data-html') || '';
      var stop = effect(function () { el.innerHTML = sanitize(String(evalExpr(scope, path) ?? '')); });
      onCleanup(el, stop);
    });
    Array.prototype.forEach.call(allEls(root), function (node: any) {
      var el = ((node) as HTMLElement);
      Array.prototype.forEach.call(el.attributes || [], function (a: Attr) {
        var an = a.name;
        if (an.indexOf('data-bind:') === 0) {
          if (claimed(el, 'a:' + an)) return;
          var attr = an.slice('data-bind:'.length);
          var expr = a.value;
          var stop = effect(function () {
            var v = evalExpr(scope, expr);
            if (v === false || v === null || v === undefined) el.removeAttribute(attr);
            else if (URL_ATTRS[attr.toLowerCase()] && unsafeUrl(v)) {
              el.removeAttribute(attr);
              if (DEV && typeof console !== 'undefined') console.warn('[laghu] blocked scriptable URL for "' + attr + '"');
            }
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
            ((el.style) as any)[prop] = v === false || v === null || v === undefined ? '' : String(v);
          });
          onCleanup(el, s3);
        }
      });
    });
    // two-way model: text/number/checkbox/radio/select/textarea
    eachEl(root, '[data-model]', function (node: any) {
      var el = ((node) as any);
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
          Array.prototype.forEach.call(el.options || [], function (o: any) { o.selected = arr.indexOf(String(o.value)) >= 0; });
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
          var out: any[] = [];
          Array.prototype.forEach.call(el.selectedOptions || [], function (o: any) { out.push(o.value); });
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
    eachEl(root, '[data-show]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (claimed(el, 'show')) return;
      var expr = el.getAttribute('data-show') || '';
      var stop = effect(function () { setHidden(el, !evalExpr(scope, expr)); });
      onCleanup(el, stop);
    });
    eachEl(root, '[data-if]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (el.tagName === 'TEMPLATE') return;
      if (claimed(el, 'if')) return;
      var expr = el.getAttribute('data-if') || '';
      var stop = effect(function () { setHidden(el, !evalExpr(scope, expr)); });
      onCleanup(el, stop);
    });
    eachEl(root, 'template[data-if]', function (node: any) {
      var tpl = ((node) as HTMLTemplateElement);
      var expr = tpl.getAttribute('data-if') || '';
      if (claimed(tpl, 'tif')) return;
      var anchor = document.createComment('b-if');
      if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
      var frag: any = null;
      var stop = effect(function () {
        var on = !!evalExpr(scope, expr);
        if (on && !frag) {
          frag = /** @type {DocumentFragment} */ (tpl.content.cloneNode(true));
          if (anchor.parentNode) anchor.parentNode.insertBefore(frag, anchor.nextSibling);
          if (anchor.parentNode && anchor.parentNode instanceof Element) {
            hydrate(anchor.parentNode, scope, actions);
            var nn = anchor.nextSibling;
            while (nn && nn !== tpl) {
              var nx2 = nn.nextSibling;
              if (nn instanceof Element) playEnter(nn);
              nn = nx2;
            }
          }
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
    eachEl(root, 'template[data-for]', function (node: any) {
      var tpl = ((node) as HTMLTemplateElement);
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
          // data-key names a property of the item itself ("id"), with a
          // scope lookup fallback, then the index. Item-relative keys
          // keep rows stable across reorder; index keys only append.
          var key: any = i;
          if (keyExpr) {
            var ki = evalExpr(item, keyExpr);
            if (ki === undefined || ki === null) {
              var tmpVars: Record<string, any> = {};
              tmpVars[itemVar] = item;
              ki = evalExpr(childScope(scope, tmpVars), keyExpr);
            }
            if (ki !== undefined && ki !== null) key = ki;
          }
          seen.add(key);
          order.push(key);
          var row = rows.get(key);
          if (!row) {
            var rsVars: Record<string, any> = {};
            rsVars[itemVar] = item;
            if (idxVar) rsVars[idxVar] = i;
            var rs = childScope(scope, rsVars);
            var f = /** @type {DocumentFragment} */ (tpl.content.cloneNode(true));
            var holder = document.createElement('span');
            holder.style.display = 'contents';
            holder.setAttribute('data-bkey', String(key));
            holder.appendChild(f);
            parent.insertBefore(holder, anchor);
            hydrate(holder, rs, actions);
            playEnter(holder);
            rows.set(key, { nodes: [holder], scope: rs });
          } else {
            // Same key, possibly new identity (replaced array) or new
            // index (reorder). Same refs update nothing: fine-grained
            // bindings already show the mutation. New identity rebinds
            // the row so effects read the new objects; reorder alone
            // only moves nodes and keeps focus.
            var prevItem = row.scope[itemVar];
            var prevIdx = idxVar ? row.scope[idxVar] : -1;
            row.scope[itemVar] = item;
            if (idxVar) row.scope[idxVar] = i;
            if (prevItem !== item || (idxVar && prevIdx !== i)) {
              var h0 = row.nodes[0];
              if (h0 instanceof Element) { destroyTree(h0); hydrate(h0, row.scope, actions); }
            }
          }
        }
        // Move holders only when DOM order differs from desired order.
        // Spurious moves report as remove+add to MutationObserver, which
        // would strip the moved rows' bindings, so never move blindly.
        var seq = [];
        var chn = parent.childNodes;
        for (var q = 0; q < chn.length; q++) {
          var hn = chn[q];
          if (hn.nodeType === 1 && ((hn) as Element).hasAttribute('data-bkey')) {
            seq.push(((hn) as Element).getAttribute('data-bkey'));
          }
        }
        var sameOrder = seq.length === order.length;
        if (sameOrder) {
          for (var q2 = 0; q2 < order.length; q2++) {
            if (seq[q2] !== String(order[q2])) { sameOrder = false; break; }
          }
        }
        if (!sameOrder) {
          for (var k = 0; k < order.length; k++) {
            var r2 = rows.get(order[k]);
            if (r2) parent.insertBefore(((r2.nodes[0]) as HTMLElement), anchor);
          }
        }
        rows.forEach(function (row2: any, kk: any) {
          if (!seen.has(kk)) {
            row2.nodes.forEach(function (nn: any) {
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
    eachEl(root, '[data-click]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (claimed(el, 'click')) return;
      var code = el.getAttribute('data-click') || '';
      var spec = el.getAttribute('data-trigger') || 'click';
      bindTrigger(el, spec, function () { execAction(scope, actions || {}, code); });
    });
    Array.prototype.forEach.call(allEls(root), function (node: any) {
      var el = ((node) as HTMLElement);
      Array.prototype.forEach.call(el.attributes || [], function (a: Attr) {
        if (a.name.indexOf('data-on:') === 0) {
          if (claimed(el, 'on:' + a.name)) return;
          var raw = a.name.slice('data-on:'.length);
          var parts = raw.split('.');
          var ev = parts[0];
          var mods = parts.slice(1);
          var code = a.value;
          var spec = el.getAttribute('data-trigger') || ev;
          bindTrigger(el, spec, function (e: Event) {
            if (mods.indexOf('prevent') >= 0) e.preventDefault();
            if (mods.indexOf('stop') >= 0) e.stopPropagation();
            var s2 = childScope(scope, { $event: e });
            execAction(s2, actions || {}, code);
            if (mods.indexOf('once') >= 0) { try { ((el) as any).removeAttribute(a.name); } catch (err) {} }
          });
        }
      });
    });
    // data-init runs once as action
    eachEl(root, '[data-init]', function (node: any) {
      var el = ((node) as HTMLElement);
      if (claimed(el, 'init')) return;
      var code = el.getAttribute('data-init') || '';
      try { execAction(scope, actions || {}, code); } catch (e) { reportError(e); }
    });
    directives.forEach(function (fn: any, name: any) {
      eachEl(root, '[data-' + name + ']', function (node: any) {
        var el = ((node) as HTMLElement);
        if (claimed(el, 'dir:' + name)) return;
        try {
          var out = fn({ el: el, get: function () { return evalExpr(scope, el.getAttribute('data-' + name) || ''); }, effect: effect, scope: scope });
          if (typeof out === 'function') onCleanup(el, out);
        } catch (e) { reportError(e); }
      });
    });
    // fetch triggers: data-get/post/put/patch/delete
    Array.prototype.forEach.call(allEls(root), function (node: any) {
      var el = ((node) as HTMLElement);
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
      setupFetch(el, scope, method, url, actions);
    });
  }
  /**
   * @param {HTMLElement} el @param {any} scope @param {string} method @param {string} url @param {Record<string, Function>} [actions]
   */
  function setupFetch(el: HTMLElement, scope: any, method: string, url: string, actions: Record<string, Function>) {
    var targetSel = el.getAttribute('data-target') || '';
    var swap = el.getAttribute('data-swap') || 'inner';
    var triggerSpec = el.getAttribute('data-trigger') || defaultEvent(el);
    ((el) as any)._bActions = actions || {};
    // Seed the shared error slot so bindings like data-bind="$error.status"
    // subscribe before the first request ever runs. Writes land on the
    // owning scope through setPath, never as a child shadow.
    var hasErr = false;
    try { hasErr = ('$error' in Object(scope)); } catch (e) {}
    if (!hasErr) setPath(scope, '$error', null);
    var fire = function (e: Event) {
      // A declarative fetch owns its form: stop the native submit so
      // the page never reloads under a data-post form.
      if (el instanceof HTMLFormElement && e && e.type === 'submit' && e.cancelable) e.preventDefault();
      doFetch(el, scope, method, url, targetSel, swap);
    };
    bindTrigger(el, triggerSpec, fire);
  }
  /** @param {string} s @returns {any} */
  function tryJSON(s: string) {
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
  function doFetch(el: HTMLElement, scope: any, method: string, url: string, targetSel: string, swap: string) {
    var m = parseTrigger(el.getAttribute('data-trigger') || defaultEvent(el), el);
    var self = ((el) as any);
    if (!self._bReqs) self._bReqs = new Set();
    if (self._bN > 0 && (m.queue === 'first' || m.queue === 'none')) return;
    if (m.queue === 'last') {
      self._bReqs.forEach(function (c: any) { try { c.abort(); } catch (e) {} });
      self._bReqs.clear();
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) self._bReqs.add(ctrl);
    self._bN = (self._bN || 0) + 1;
    var timedOut = false;
    var timeoutMs = parseMs(el.getAttribute('data-timeout') || '');
    var timer: any = 0;
    if (timeoutMs > 0 && ctrl) {
      timer = /** @type {any} */ (setTimeout(function () {
        timedOut = true;
        try { if (ctrl) ctrl.abort(); } catch (e) {}
      }, timeoutMs));
    }
    var actions = self._bActions || {};
    var setBusy = function (on: boolean) {
      var indSel = el.getAttribute('data-indicator');
      var ind = indSel ? document.querySelector(indSel) : null;
      if (ind && ind instanceof HTMLElement) ind.hidden = !on ? true : false;
      if (el instanceof HTMLElement) {
        if (on) { el.setAttribute('data-request', ''); el.setAttribute('data-pending', ''); }
        else { el.removeAttribute('data-request'); el.removeAttribute('data-pending'); }
        if (el.hasAttribute('data-disable')) el.toggleAttribute('disabled', on);
      }
    };
    setBusy(true);
    var before = new CustomEvent('laghu:before-request', { bubbles: true, cancelable: true, detail: { url: url, method: method } });
    if (!el.dispatchEvent(before)) { finish(); return; }
    var opts: any = { method: method, headers: { Accept: 'application/json, text/html' }, signal: ctrl ? ctrl.signal : undefined };
    var valsRaw = el.getAttribute('data-vals');
    var body = null;
    if (valsRaw) {
      var wantForm = valsRaw.trim() === 'form';
      var hostForm = el instanceof HTMLFormElement ? el : (el.closest ? el.closest('form') : null);
      var v = wantForm ? (hostForm ? serializeForm(hostForm) : {}) : (tryJSON(valsRaw) || {});
      // merge enclosing form for explicit JSON vals too
      if (hostForm && !wantForm) {
        var fv = serializeForm(((hostForm) as HTMLFormElement));
        for (var k in fv) v[k] = fv[k];
      }
      if (method === 'GET') {
        var parts = [];
        for (var qk in v) {
          if (Array.isArray(v[qk])) {
            for (var qi = 0; qi < v[qk].length; qi++) {
              parts.push(encodeURIComponent(qk) + '=' + encodeURIComponent(String(v[qk][qi])));
            }
          } else {
            parts.push(encodeURIComponent(qk) + '=' + encodeURIComponent(String(v[qk])));
          }
        }
        if (parts.length) url += (url.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
      } else {
        opts.headers['Content-Type'] = 'application/json';
        body = JSON.stringify(v);
        opts.body = body;
      }
    } else if (method !== 'GET') {
      var f2 = el instanceof HTMLFormElement ? el : (el.closest ? el.closest('form') : null);
      if (f2) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(serializeForm(((f2) as HTMLFormElement)));
      }
    }
    var hRaw = el.getAttribute('data-headers');
    if (hRaw) {
      var hh = tryJSON(hRaw) || {};
      for (var hk in hh) opts.headers[hk] = hh[hk];
    }
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (ctrl) self._bReqs.delete(ctrl);
      self._bN = Math.max(0, (self._bN || 1) - 1);
      setBusy(false);
    }
    fetch(url, opts).then(function (res: any) {
      finish();
      el.dispatchEvent(new CustomEvent('laghu:after-request', { bubbles: true, detail: { status: res.status, url: url } }));
      if (!res.ok) {
        setPath(scope, '$error', { status: res.status, url: url });
        el.dispatchEvent(new CustomEvent('laghu:request-error', { bubbles: true, detail: { status: res.status, url: url } }));
        return;
      }
      var ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.indexOf('json') >= 0) return res.json().then(function (data: any) {
        setPath(scope, '$error', null);
        if (data && typeof data === 'object' && !Array.isArray(data)) Object.assign(scope, data);
        else setPath(scope, 'result', data);
      });
      return res.text().then(function (html: any) {
        var sel = el.getAttribute('data-select');
        if (sel) {
          var tmp = document.createElement('template');
          tmp.innerHTML = sanitize(html);
          var picked = tmp.content.querySelector(sel);
          html = picked ? picked.outerHTML : '';
        }
        var target = targetSel ? document.querySelector(targetSel) : el;
        if (!target) return;
        swapHtml(((target) as Element), html, swap, scope, actions);
      });
    }).catch(function (err: any) {
      finish();
      if (err && err.name === 'AbortError' && !timedOut) return;
      setPath(scope, '$error', { message: String((err && err.message) || err), timeout: timedOut });
      el.dispatchEvent(new CustomEvent('laghu:request-error', { bubbles: true, detail: { error: err, timeout: timedOut } }));
      reportError(err);
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
  function serializeForm(form: HTMLFormElement) {
    var out: Record<string, any> = {};
    var fd = new FormData(form);
    fd.forEach(function (v: any, k: any) {
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
   * @param {Record<string, Function>} [actions] Named actions for handlers
   *   in the new content. Fetch swaps reuse the requesting element's
   *   actions automatically; without them swapped-in data-click goes
   *   quiet with an unknown-action warning.
   */
  function swapHtml(target: Element, html: string, swap: string, scope: any, actions: Record<string, Function>) {
    actions = actions || {};
    var s = String(swap || 'inner').toLowerCase();
    var s = String(swap || 'inner').toLowerCase();
    if (s === 'none') { target.dispatchEvent(new CustomEvent('laghu:after-swap', { bubbles: true, detail: { swap: s } })); return; }
    var focusId = document.activeElement && ((document.activeElement) as any).id ? ((document.activeElement) as any).id : null;
    var ae = ((document.activeElement) as any);
    var selStart = ae && typeof ae.selectionStart === 'number' ? ae.selectionStart : -1;
    var selEnd = ae && typeof ae.selectionEnd === 'number' ? ae.selectionEnd : -1;
    target.dispatchEvent(new CustomEvent('laghu:before-swap', { bubbles: true, cancelable: false, detail: { swap: s } }));
    var isMorph = s.indexOf('morph') === 0;
    var M: any = typeof window !== 'undefined' ? ((window) as any).LaghuMorph : null;
    if (isMorph) {
      if (M && M.morph) {
        M.morph(target, sanitize(html), { mode: s === 'morph:outer' ? 'outer' : 'inner' });
        hydrate(target, scope, actions);
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
    var kept: Map<string, Element> = new Map();
    target.querySelectorAll('[data-preserve][id]').forEach(function (n: any) { kept.set(n.id, ((n) as Element)); });
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
    kept.forEach(function (node: any, id: any) {
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
    hydrate(root, scope, actions);
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
  function restoreFocus(id: string|null, a: number, b: number) {
    if (!id) return;
    var f = document.getElementById(id);
    if (f && f instanceof HTMLElement) {
      try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) {} }
      try {
        if (a >= 0 && ((f) as any).setSelectionRange) ((f) as any).setSelectionRange(a, b);
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
  function define(tag: string, setup: () => SetupResult) {
    if (!tag || tag.indexOf('-') < 0) throw new Error('[laghu] tag must contain hyphen: ' + tag);
    var probe = setup() || {};
    var obs = probe.observed || Object.keys(probe.state || {}).filter(function (k: any) {
      var v = ((probe.state) as any)[k];
      return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
    });
    var Klass: any = (class extends HTMLElement {
      connectedCallback() {
        if (((this) as any)._bInit) return;
        ((this) as any)._bInit = true;
        var r = setup() || {};
        var initial = r.state || {};
        // upgrade pre-defined props (set before define)
        for (var k in initial) {
          if (Object.prototype.hasOwnProperty.call(this, k)) {
            try { initial[k] = ((this) as any)[k]; delete ((this) as any)[k]; } catch (e) {}
          }
        }
        // pending attrs set before connect
        var pend = ((this) as any)._bPend;
        if (pend) {
          for (var pk in pend) {
            if (pk in initial) initial[pk] = coerceAttr(pend[pk], initial[pk]);
            else initial[pk] = pend[pk];
          }
          ((this) as any)._bPend = null;
        } else {
          for (var i = 0; i < obs.length; i++) {
            var an = obs[i];
            if (this.hasAttribute && this.hasAttribute(an) && (an in initial)) {
              initial[an] = coerceAttr(this.getAttribute(an), initial[an]);
            }
          }
        }
        var state = reactive(initial);
        ((this) as any).state = state;
        ((this) as any).actions = r.actions || {};
        if (typeof r.onUnmount === 'function') ((this) as any)._bOnUnmount = r.onUnmount;
        hydrate(this, state, r.actions || {});
        try { if (typeof r.onMount === 'function') r.onMount.call(state); } catch (e) { reportError(e); }
        this.classList.add('is-defined');
        this.dispatchEvent(new CustomEvent('laghu:mount'));
      }
      disconnectedCallback() {
        try {
          var st = ((this) as any).state;
          var un = ((this) as any)._bOnUnmount;
          if (typeof un === 'function' && st) un.call(st);
        } catch (e) { reportError(e); }
        destroyTree(this);
        this.dispatchEvent(new CustomEvent('laghu:unmount'));
        ((this) as any)._bInit = false;
      }
      connectedMoveCallback() { /* preserve state on moveBefore */ }
      attributeChangedCallback(name: string, old: string | null, val: string | null) {
        if (old === val) return;
        var st = ((this) as any).state;
        if (st && (name in st)) st[name] = coerceAttr(val, st[name]);
        else {
          var p = ((this) as any)._bPend || {};
          p[name] = val;
          ((this) as any)._bPend = p;
        }
      }
    });
    Klass.observedAttributes = obs;
    customElements.define(tag, Klass);
    return Klass;
  }
  var observer: any = null;
  function autoObserve() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (muts: any) {
      // Nodes moved within one batch appear in both added and removed.
      // Moving must preserve bindings, so only truly removed nodes die.
      var added = new Set();
      muts.forEach(function (m: any) {
        m.addedNodes.forEach(function (n: any) { if (n instanceof Element) added.add(n); });
      });
      muts.forEach(function (m: any) {
        m.addedNodes.forEach(function (n: any) {
          if (n instanceof Element) {
            if (n.hasAttribute && n.hasAttribute('data-scope') && !((n) as any)._bScope) {
              try {
                var api2 = ((window) as any).Laghu;
                if (api2) api2.hydrate(n, parseScope(n.getAttribute('data-scope')), {});
              } catch (e) { reportError(e); }
            }
          }
        });
        m.removedNodes.forEach(function (n: any) { if (n instanceof Element && !added.has(n)) destroyTree(n); });
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
  var api = {    version: VERSION,
    define: define,
    reactive: reactive,
    effect: effect,
    eval: evalExpr,
    get: getPath,
    set: setPath,
    parseTrigger: parseTrigger,
    swap: swapHtml,
    css: 'laghu:not(:defined),[data-laghu]:not(:defined){visibility:hidden}laghu.is-defined,[data-laghu].is-defined{visibility:visible}',
    sanitize: function (fn: (html: string) => string) { if (typeof fn === 'function') sanitize = fn; },
    hydrate: function (root: Element, state: Record<string, any>, actions: Record<string, Function>) {
      var s = reactive(state || parseScope(root.getAttribute('data-scope')));
      ((root) as any)._bScope = s;
      hydrate(root, s, actions || {});
      return s;
    },
    destroyTree: destroyTree,
    store: function (name: string, init: any) {
      if (init !== undefined) { var s = reactive(init); stores.set(name, s); return s; }
      return stores.get(name);
    },
    /**
     * Derived value kept fresh by an effect. Call the getter inside
     * bindings or other effects to subscribe; eager recompute keeps
     * it simple and predictable at this scale.
     * @example
     * var doubled = Laghu.computed(function () { return state.count * 2; });
     * Laghu.effect(function () { el.textContent = doubled(); });
     */
    computed: function (fn: Function) {
      var box = reactive({ v: undefined });
      effect(function () { box.v = fn(); });
      return function () { return box.v; };
    },
    /**
     * Call back with (next, prev) whenever an expression's value
     * changes. Reads without subscribing the caller's own effect.
     * @example
     * Laghu.watch(state, 'user.name', function (n, o) { console.log(o, 'becomes', n); });
     */
    watch: function (scope: any, expr: string, cb: Function) {
      var started = false;
      var prev: any;
      return effect(function () {
        var next = evalExpr(scope, expr);
        if (!started) { started = true; prev = next; return; }
        if (next !== prev) {
          var o = prev;
          prev = next;
          cb(next, o);
        }
      });
    },
    /**
     * Persist a named store to localStorage (debounced) and restore it
     * on next boot. Version mismatch reseeds from init. No-op without
     * localStorage (file:// included where available).
     * @example
     * Laghu.store('cart', { n: 0 });
     * Laghu.persist('cart', { key: 'cart:v1', version: 1 });
     */
    persist: function (name: string, opts: {key?: string, version?: number, debounce?: number}) {
      opts = opts || {};
      var key = opts.key || ('laghu:' + name);
      var ver = opts.version === undefined ? 1 : opts.version;
      var wait = opts.debounce === undefined ? 300 : opts.debounce;
      var st = stores.get(name);
      if (!st) return null;
      try {
        var raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        if (raw) {
          var saved = JSON.parse(raw);
          if (saved && saved.v === ver && saved.state && typeof saved.state === 'object') {
            Object.assign(st, saved.state);
          }
        }
      } catch (e) { reportError(e); }
      var timer: any = 0;
      effect(function () {
        JSON.stringify(st);
        if (typeof localStorage === 'undefined') return;
        if (timer) clearTimeout(timer);
        timer = /** @type {any} */ (setTimeout(function () {
          try { localStorage.setItem(key, JSON.stringify({ v: ver, state: st })); }
          catch (e) { reportError(e); }
        }, wait));
      });
      return st;
    },
    directive: function (name: string, fn: Function) { directives.set(name, fn); },
    filter: function (name: string, fn: Function) { filters.set(name, fn); },
    scope: function (parent: any, vars: Record<string, any>) { return childScope(parent, vars || {}); }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      autoObserve();
      document.querySelectorAll('[data-scope]').forEach(function (n: any) {
        var el = ((n) as Element);
        if (((el) as any)._bScope) return;
        api.hydrate(el, parseScope(el.getAttribute('data-scope')), {});
      });
    });
  }
  return api;
})();
