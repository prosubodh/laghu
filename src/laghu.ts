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
  swap(
    target: Element,
    html: string,
    swap?: string,
    scope?: any,
    actions?: Record<string, Function>,
  ): void;
  css: string;
  sanitize(fn?: (html: string) => string): void;
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
  /**
   * Run initial DOM hydration and observer setup (SSR / lifecycle hook).
   */
  init?: () => void;
}

export const Laghu: LaghuAPI = (() => {
  "use strict";
  const VERSION = "1.2.2";

  // Opt-in dev noise. Production stays silent unless handlers listen
  // for laghu:error / laghu:request-error, which always dispatch.
  function isDev(): boolean {
    return typeof window !== "undefined" && (window as any).__LAGHU_DEV__ === true;
  }

  function warnDev(msg: string): void {
    if (isDev() && typeof console !== "undefined") console.warn(msg);
  }

  function errorDev(err: any): void {
    if (isDev() && typeof console !== "undefined") console.error("[laghu]", err);
  }

  const stores: Map<string, any> = new Map();
  const directives: Map<string, Function> = new Map();
  const filters: Map<string, Function> = new Map();
  const targetMap: WeakMap<object, Map<string, Set<Function>>> = new WeakMap();

  /** Proxies created by reactive, so re-wrapping returns the same proxy
   * instead of stacking proxy-on-proxy traps. */
  const proxyCache: WeakMap<object, any> = new WeakMap();
  const proxySet: WeakSet<object> = new WeakSet();
  let activeEffect: Function | null = null;
  const jobQueue: Set<Function> = new Set();
  let flushing = false;

  /** Attributes whose values can navigate or load code: scriptable
   * URLs are refused here (baseline; DOMPurify for untrusted input). */
  const URL_ATTRS: Record<string, number> = {
    href: 1,
    src: 1,
    action: 1,
    formaction: 1,
    cite: 1,
    poster: 1,
    data: 1,
    srcset: 1,
    srcdoc: 1,
  };

  /** Path segments that must never be read or written: prototype
   * pollution sinks and callable gadgets (constructor, toString). */
  function badSeg(seg: string): boolean {
    return seg === "__proto__" || seg === "constructor" || seg === "prototype";
  }

  /** True for URL values that execute code (checked case-insensitively,
   * whitespace-insensitively, so casing tricks do not slip through). */
  function unsafeUrl(value: any): boolean {
    const s = String(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\s\x00-\x1f]+/g, "")
      .toLowerCase();
    return (
      s.indexOf("javascript:") === 0 ||
      s.indexOf("data:text/html") === 0 ||
      s.indexOf("vbscript:") === 0
    );
  }

  /**
   * Baseline HTML cleaner used when no sanitizer is installed. Strips
   * scripts, frames, event-handler attributes, and scriptable URLs.
   * This is a floor, not a policy: pair with DOMPurify through
   * Laghu.sanitize for untrusted content.
   */
  function defaultSanitize(html: any): string {
    let s = String(html);
    s = s.replace(/<script[\s\S]*?(<\/script\s*>|$)/gi, "");
    s = s.replace(/<\/?(iframe|object|embed|link|meta|base)[^>]*>/gi, "");
    s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    s = s.replace(
      /(href|src|xlink:href|action|formaction|poster|data)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (match: string, attr: string, _q: any, d1: any, d2: any, d3: any) => {
        const v = d1 !== undefined ? d1 : d2 !== undefined ? d2 : d3;
        if (unsafeUrl(v)) return attr + '="#"';
        return match;
      },
    );
    return s;
  }

  let sanitize: (html: string) => string = defaultSanitize;

  /**
   * Report a runtime failure. Always dispatches laghu:error on document
   * (so production has signal without console noise); logs only in dev.
   */
  function reportError(err: any): void {
    try {
      if (typeof document !== "undefined" && document.dispatchEvent) {
        document.dispatchEvent(
          new CustomEvent("laghu:error", {
            detail: { error: String((err && err.message) || err), version: VERSION },
          }),
        );
      }
    } catch (e) {}
    errorDev(err);
  }

  function flush(): void {
    flushing = false;
    const jobs = Array.from(jobQueue);
    jobQueue.clear();
    for (let i = 0; i < jobs.length; i++) {
      jobs[i]();
    }
  }

  function schedule(fn: Function): void {
    jobQueue.add(fn);
    if (!flushing) {
      flushing = true;
      void Promise.resolve().then(flush);
    }
  }

  /** Nesting stack so inner effects never clobber outer dependencies. */
  const effectStack: Array<Function> = [];
  const runDeps: WeakMap<Function, Array<Set<Function>>> = new WeakMap();

  /**
   * Run a function now and re-run it whenever reactive state it read
   * changes. Each DOM binding creates one effect, so updates touch only
   * the exact node that depends on the changed value.
   *
   * Effects are batched in a microtask: many synchronous writes cause
   * one re-run. A throwing run reports laghu:error and keeps the page
   * alive; subscriptions refresh per run so untaken branches release.
   */
  function effect(fn: Function): () => void {
    let stopped = false;
    const deps: Array<Set<Function>> = [];
    const run = function () {
      if (stopped) return;
      // Drop last run's subscriptions first: conditional branches
      // (a ? b : c) must not keep firing on the untaken path.
      for (let i = 0; i < deps.length; i++) deps[i].delete(run);
      deps.length = 0;
      effectStack.push(run);
      activeEffect = run;
      runDeps.set(run, deps);
      try {
        fn();
      } catch (e) {
        reportError(e);
      } finally {
        effectStack.pop();
        activeEffect = effectStack.length ? effectStack[effectStack.length - 1] : null;
      }
    };
    run();
    return function () {
      stopped = true;
      for (let i = 0; i < deps.length; i++) deps[i].delete(run);
      deps.length = 0;
    };
  }

  function track(target: object, key: string): void {
    if (!activeEffect) return;
    let propMap = targetMap.get(target);
    if (!propMap) {
      propMap = new Map();
      targetMap.set(target, propMap);
    }
    let effectSet = propMap.get(key);
    if (!effectSet) {
      effectSet = new Set();
      propMap.set(key, effectSet);
    }
    effectSet.add(activeEffect);
    runDeps.get(activeEffect)!.push(effectSet);
  }

  function trigger(target: object, key: string): void {
    const propMap = targetMap.get(target);
    if (!propMap) return;
    const effectSet = propMap.get(key);
    if (!effectSet) return;
    effectSet.forEach((fn: Function) => {
      schedule(fn);
    });
  }

  function isObj(value: any): boolean {
    return value !== null && typeof value === "object";
  }

  /**
   * Key presence without narrowing the value. Using `in` directly on
   * an `any` reference makes later property reads fail strict checks.
   */
  function hasKey(obj: any, key: string): boolean {
    return !!obj && key in obj;
  }

  /**
   * Make a child scope that inherits a parent while owning the given
   * variables. Uses defineProperty because plain assignment on an
   * object whose prototype is a reactive Proxy would route into the
   * proxy set trap and write the parent instead of the child.
   */
  function childScope(parentScope: any, variables: Record<string, any>): any {
    const scopeObj = Object.create(parentScope);
    for (const key of Object.keys(variables)) {
      Object.defineProperty(scopeObj, key, {
        value: variables[key],
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return scopeObj;
  }

  function trackScopeChain(scope: any, head: string): void {
    if (typeof head === "string" && isObj(scope)) {
      track(scope, head);
      let node = Object.getPrototypeOf(scope);
      while (node && node !== Object.prototype) {
        if (proxySet.has(node)) track(node, head);
        node = Object.getPrototypeOf(node);
      }
    }
  }

  function getStorePath(parts: string[]): any {
    const storeObj = stores.get(parts[1]);
    if (!storeObj) return undefined;
    let current = storeObj;
    for (let k = 2; k < parts.length; k++) {
      if (badSeg(parts[k])) return undefined;
      if (!isObj(current)) return undefined;
      current = current[parts[k]];
    }
    return current;
  }

  /**
   * Read a dotted path from a scope, walking the prototype chain for the
   * first segment (so child scopes inherit parent values). Returns
   * undefined for missing paths instead of throwing.
   */
  function getPath(scope: any, path: string): any {
    if (!path) return undefined;
    const parts = String(path).split(".");
    const head = parts[0].trim();
    if (badSeg(head)) return undefined;
    if (head === "$store") return getStorePath(parts);

    if (!(head in Object(scope))) {
      trackScopeChain(scope, head);
      return undefined;
    }

    let current = scope[head];
    for (let i = 1; i < parts.length; i++) {
      if (badSeg(parts[i])) return undefined;
      if (!isObj(current) && typeof current !== "function") return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  function setStorePath(parts: string[], val: any): void {
    const storeObj = stores.get(parts[1]);
    if (!storeObj) return;
    let current = storeObj;
    for (let k = 2; k < parts.length - 1; k++) {
      if (!isObj(current[parts[k]])) current[parts[k]] = {};
      current = current[parts[k]];
    }
    current[parts[parts.length - 1]] = val;
  }

  /**
   * Write a dotted path into a scope, creating intermediate objects.
   * Supports $store paths the same way getPath reads them.
   */
  function setPath(scope: any, path: string, val: any): void {
    const parts = String(path).split(".");
    for (let g = 0; g < parts.length; g++) {
      if (badSeg(parts[g].trim())) {
        warnDev('[laghu] blocked unsafe path "' + path + '"');
        return;
      }
    }
    if (parts[0].trim() === "$store") {
      setStorePath(parts, val);
      return;
    }

    let base = scope;
    let node = scope;
    while (node && node !== Object.prototype) {
      if (Object.prototype.hasOwnProperty.call(node, parts[0])) {
        base = node;
        break;
      }
      node = Object.getPrototypeOf(node);
    }
    let current = base;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!isObj(current[key])) current[key] = {};
      current = current[key];
    }
    current[parts[parts.length - 1]] = val;
  }

  /**
   * Wrap a plain object so reads track effects and writes trigger them.
   * Only plain objects and arrays are wrapped. Primitives pass through.
   */
  function reactive(obj: object): any {
    if (!isObj(obj)) return obj;
    if (proxySet.has(obj)) return obj;
    const hit = proxyCache.get(obj);
    if (hit) return hit;

    const proxy = new Proxy(obj, {
      get(target: any, prop: any, receiver: any) {
        if (typeof prop === "string") track(target, prop);
        const val = Reflect.get(target, prop, receiver);
        return isObj(val) ? reactive(val) : val;
      },
      set(target: any, prop: any, val: any) {
        const oldVal = target[prop as string];
        const ok = Reflect.set(target, prop, val);
        if (oldVal !== val && typeof prop === "string") {
          trigger(target, prop);
          trigger(proxyCache.get(target)!, prop);
        }
        return ok;
      },
      deleteProperty(target: any, prop: any) {
        const ok = Reflect.deleteProperty(target, prop);
        if (typeof prop === "string") {
          trigger(target, prop);
          trigger(proxyCache.get(target)!, prop);
        }
        return ok;
      },
    });

    proxyCache.set(obj, proxy);
    proxySet.add(proxy);
    return proxy;
  }

  function splitTop(sourceText: string, op: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let quoteChar: string | null = null;
    let current = "";
    for (let i = 0; i < sourceText.length; i++) {
      const ch = sourceText[i];
      if (quoteChar) {
        current += ch;
        if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        current += ch;
        continue;
      }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (depth === 0 && sourceText.slice(i, i + op.length) === op) {
        out.push(current);
        current = "";
        i += op.length - 1;
        continue;
      }
      current += ch;
    }
    out.push(current);
    return out;
  }

  function lastTopOp(sourceText: string, chars: string): number {
    let depth = 0;
    let quoteChar: string | null = null;
    for (let i = sourceText.length - 1; i > 0; i--) {
      const ch = sourceText[i];
      if (quoteChar) {
        if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        continue;
      }
      if (ch === ")" || ch === "]") depth++;
      if (ch === "(" || ch === "[") depth--;
      if (depth === 0 && chars.indexOf(ch) >= 0) return i;
    }
    return -1;
  }

  function splitTernary(sourceText: string): [string, string, string] | null {
    let depth = 0;
    let quoteChar: string | null = null;
    let questionIdx = -1;
    let i: number;
    for (i = 0; i < sourceText.length; i++) {
      const ch = sourceText[i];
      if (quoteChar) {
        if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        continue;
      }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "?" && depth === 0) {
        questionIdx = i;
        break;
      }
    }
    if (questionIdx < 0) return null;
    depth = 0;
    quoteChar = null;
    for (i = questionIdx + 1; i < sourceText.length; i++) {
      const ch = sourceText[i];
      if (quoteChar) {
        if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        continue;
      }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === ":" && depth === 0) {
        return [
          sourceText.slice(0, questionIdx),
          sourceText.slice(questionIdx + 1, i),
          sourceText.slice(i + 1),
        ];
      }
    }
    return null;
  }

  function evalLogical(scope: any, expr: string): { matched: boolean; result: any } {
    const orParts = splitTop(expr, "||");
    if (orParts.length > 1) {
      let r: any;
      for (let i = 0; i < orParts.length; i++) {
        r = evalExpr(scope, orParts[i]);
        if (r) return { matched: true, result: r };
      }
      return { matched: true, result: r };
    }
    const andParts = splitTop(expr, "&&");
    if (andParts.length > 1) {
      let rr: any;
      for (let j = 0; j < andParts.length; j++) {
        rr = evalExpr(scope, andParts[j]);
        if (!rr) return { matched: true, result: rr };
      }
      return { matched: true, result: rr };
    }
    return { matched: false, result: undefined };
  }

  function evalComparison(scope: any, expr: string): { matched: boolean; result: any } {
    const match = expr.match(/^(.*?)(===|!==|>=|<=|==|!=|>|<)(.*)$/);
    if (!match) return { matched: false, result: undefined };
    const leftVal: any = evalExpr(scope, match[1]);
    const rightVal: any = evalExpr(scope, match[3]);
    const op = match[2];
    if (op === ">") return { matched: true, result: leftVal > rightVal };
    if (op === "<") return { matched: true, result: leftVal < rightVal };
    if (op === ">=") return { matched: true, result: leftVal >= rightVal };
    if (op === "<=") return { matched: true, result: leftVal <= rightVal };
    if (op === "==") return { matched: true, result: leftVal == rightVal };
    if (op === "!=") return { matched: true, result: leftVal != rightVal };
    if (op === "===") return { matched: true, result: leftVal === rightVal };
    return { matched: true, result: leftVal !== rightVal };
  }

  function evalArithmetic(scope: any, expr: string): { matched: boolean; result: any } {
    const addSubIdx = lastTopOp(expr, "+-");
    if (addSubIdx > 0 && expr.slice(0, addSubIdx).trim() && expr.slice(addSubIdx + 1).trim()) {
      const leftVal: any = evalExpr(scope, expr.slice(0, addSubIdx));
      const rightVal: any = evalExpr(scope, expr.slice(addSubIdx + 1));
      return {
        matched: true,
        result: expr[addSubIdx] === "+" ? leftVal + rightVal : leftVal - rightVal,
      };
    }
    const mulDivIdx = lastTopOp(expr, "*/%");
    if (mulDivIdx > 0 && expr.slice(0, mulDivIdx).trim() && expr.slice(mulDivIdx + 1).trim()) {
      const leftVal: any = evalExpr(scope, expr.slice(0, mulDivIdx));
      const rightVal: any = evalExpr(scope, expr.slice(mulDivIdx + 1));
      const op = expr[mulDivIdx];
      if (op === "*") return { matched: true, result: leftVal * rightVal };
      if (op === "/") return { matched: true, result: leftVal / rightVal };
      return { matched: true, result: leftVal % rightVal };
    }
    return { matched: false, result: undefined };
  }

  function evalParenthesized(expr: string): string | null {
    if (expr[0] !== "(") return null;
    let depth = 0;
    let quoteChar: string | null = null;
    let matchIdx = -1;
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (quoteChar) {
        if (ch === quoteChar && expr[i - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        continue;
      }
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth === 0) {
          matchIdx = i;
          break;
        }
      }
    }
    return matchIdx === expr.length - 1 ? expr.slice(1, -1) : null;
  }

  function evalMethodCall(scope: any, expr: string): { matched: boolean; result: any } {
    if (expr.charAt(expr.length - 1) !== ")") return { matched: false, result: undefined };
    const parenIdx = expr.indexOf("(");
    if (parenIdx <= 0) return { matched: false, result: undefined };

    let depth = 0;
    let quoteChar: string | null = null;
    let closeIdx = -1;
    for (let k = parenIdx; k < expr.length; k++) {
      const ch = expr[k];
      if (quoteChar) {
        if (ch === quoteChar && expr[k - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        continue;
      }
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth === 0) {
          closeIdx = k;
          break;
        }
      }
    }

    if (closeIdx !== expr.length - 1) return { matched: false, result: undefined };
    const methodName = expr.slice(0, parenIdx);
    if (!/^[\w.$]+$/.test(methodName)) return { matched: false, result: undefined };

    const fn = getPath(scope, methodName);
    if (typeof fn === "function") {
      const rawArgs = expr.slice(parenIdx + 1, closeIdx).trim();
      const evaluatedArgs = rawArgs
        ? splitTop(rawArgs, ",").map((arg) => evalExpr(scope, arg))
        : [];
      return { matched: true, result: fn.apply(scope, evaluatedArgs) };
    }
    warnDev('[laghu] unknown method "' + expr + '"');
    return { matched: true, result: undefined };
  }

  function evalLiteral(expr: string): { matched: boolean; result: any } {
    if (
      (expr[0] === '"' && expr[expr.length - 1] === '"') ||
      (expr[0] === "'" && expr[expr.length - 1] === "'")
    ) {
      return { matched: true, result: expr.slice(1, -1) };
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) return { matched: true, result: Number(expr) };
    if (expr === "true") return { matched: true, result: true };
    if (expr === "false") return { matched: true, result: false };
    if (expr === "null") return { matched: true, result: null };
    if (expr === "undefined") return { matched: true, result: undefined };
    return { matched: false, result: undefined };
  }

  /**
   * Evaluate a small expression against a scope without new Function,
   * so it runs under strict Content Security Policy.
   */
  function evalExpr(scope: any, expr: string): any {
    const s = String(expr).trim();
    if (!s) return undefined;

    const direct = getPath(scope, s);
    if (direct !== undefined) return direct;

    const ternary = splitTernary(s);
    if (ternary) {
      return evalExpr(scope, ternary[0]) ? evalExpr(scope, ternary[1]) : evalExpr(scope, ternary[2]);
    }

    const logical = evalLogical(scope, s);
    if (logical.matched) return logical.result;

    const comparison = evalComparison(scope, s);
    if (comparison.matched) return comparison.result;

    const arithmetic = evalArithmetic(scope, s);
    if (arithmetic.matched) return arithmetic.result;

    if (s[0] === "!") return !evalExpr(scope, s.slice(1));
    if (s[0] === "-") return -evalExpr(scope, s.slice(1));

    const parenInner = evalParenthesized(s);
    if (parenInner !== null) return evalExpr(scope, parenInner);

    const literal = evalLiteral(s);
    if (literal.matched) return literal.result;

    const callResult = evalMethodCall(scope, s);
    if (callResult.matched) return callResult.result;

    const bracketMatch = s.match(/^(.*)\[(\d+|"(?:[^"]*)"|'(?:[^']*)')\]$/);
    if (bracketMatch && bracketMatch[1]) {
      const baseObj = evalExpr(scope, bracketMatch[1]);
      if (baseObj === null || baseObj === undefined) return undefined;
      let keyVal: any = bracketMatch[2];
      if (keyVal[0] === '"' || keyVal[0] === "'") keyVal = keyVal.slice(1, -1);
      else keyVal = Number(keyVal);
      if (typeof keyVal === "string" && badSeg(keyVal)) return undefined;
      return baseObj[keyVal];
    }

    return getPath(scope, s);
  }

  function unknownAction(name: string): void {
    warnDev('[laghu] unknown action "' + name + '"');
    if (
      typeof CustomEvent !== "undefined" &&
      typeof document !== "undefined" &&
      document.dispatchEvent
    ) {
      document.dispatchEvent(new CustomEvent("laghu:unknown-action", { detail: { name: name } }));
    }
  }

  /**
   * Run one action string from data-click or data-on.
   */
  function execAction(scope: any, actions: Record<string, Function>, code: string): void {
    const s = String(code).trim();
    if (!s) return;

    const incMatch = s.match(/^([\w.$]+)\+\+$/);
    if (incMatch) {
      setPath(scope, incMatch[1], Number(evalExpr(scope, incMatch[1]) || 0) + 1);
      return;
    }
    const decMatch = s.match(/^([\w.$]+)--$/);
    if (decMatch) {
      setPath(scope, decMatch[1], Number(evalExpr(scope, decMatch[1]) || 0) - 1);
      return;
    }
    const asgMatch = s.match(/^([\w.$]+)\s*=\s*(.+)$/);
    if (asgMatch && !/^(==|===|!=|!==|>=|<=)/.test(s.slice(asgMatch[1].length))) {
      setPath(scope, asgMatch[1], evalExpr(scope, asgMatch[2]));
      return;
    }

    const bareName = s.replace(/\(\)$/, "");
    const fn = actions[bareName] || getPath(scope, bareName);
    if (typeof fn === "function") {
      fn.call(scope);
      return;
    }

    const callMatch = s.match(/^([\w.$]+)\s*\(([\s\S]*)\)$/);
    if (callMatch && typeof actions[callMatch[1]] === "function") {
      const inner = callMatch[2].trim();
      const callArgs = splitTop(inner, ",").map((arg) => evalExpr(scope, arg));
      (actions[callMatch[1]] as Function).apply(scope, callArgs);
      return;
    }

    if (/^[A-Za-z_$][\w.$-]*$/.test(s)) {
      unknownAction(s);
      return;
    }

    const resultVal = evalExpr(scope, s);
    if (typeof resultVal === "function") resultVal.call(scope);
    else if (resultVal === undefined) unknownAction(s);
  }

  function onCleanup(el: Element, fn: Function): void {
    const list = (el as any)._bcu || ((el as any)._bcu = []);
    list.push(fn);
  }

  function eachEl(root: Element, selector: string, fn: (node: Element) => void): void {
    if (root instanceof Element && root.matches) {
      try {
        if (root.matches(selector)) fn(root);
      } catch (e) {}
    }
    Array.prototype.forEach.call(root.querySelectorAll(selector), fn);
  }

  function allEls(root: Element): Element[] {
    const out: Element[] = [];
    if (root instanceof Element) out.push(root);
    Array.prototype.forEach.call(root.querySelectorAll("*"), (node: Element) => {
      out.push(node);
    });
    return out;
  }

  function transFrames(kind: string, out: boolean): Array<Record<string, string>> {
    const from =
      kind.indexOf("slide") >= 0
        ? "translateY(-8px)"
        : kind.indexOf("scale") >= 0
          ? "scale(.96)"
          : "none";
    const a = { opacity: "0", transform: from };
    const b = { opacity: "1", transform: "none" };
    return out ? [b, a] : [a, b];
  }

  function transDur(el: Element): number {
    return parseMs(el.getAttribute("data-duration") || "150ms") || 150;
  }

  function setHidden(el: HTMLElement, hide: boolean): void {
    hide = !!hide;
    if (!!el.hidden === hide) return;

    const seen = (el as any)._bT;
    if (seen === undefined) {
      (el as any)._bT = 0;
      el.hidden = hide;
      return;
    }

    const kind = (el.getAttribute && el.getAttribute("data-transition")) || "";
    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!kind || kind === "none" || reduce || typeof el.animate !== "function") {
      el.hidden = hide;
      return;
    }

    const dur = transDur(el);
    const tk = ((el as any)._bT = ((el as any)._bT || 0) + 1);
    (el as any)._bHide = hide;
    if (!hide) {
      el.hidden = false;
      try {
        const anim = el.animate(transFrames(kind, false), { duration: dur, easing: "ease-out" });
        if (anim && anim.finished && anim.finished.catch) anim.finished.catch(() => {});
      } catch (e) {}
    } else {
      try {
        const anim = el.animate(transFrames(kind, true), { duration: dur, easing: "ease-in" });
        const onDone = function () {
          if ((el as any)._bT === tk && (el as any)._bHide && el.isConnected) el.hidden = true;
        };
        if (anim && anim.finished && anim.finished.then) anim.finished.then(onDone, onDone);
        else setTimeout(onDone, dur);
      } catch (e) {
        el.hidden = true;
      }
    }
  }

  function playEnter(root: Element): void {
    eachEl(root, "[data-transition]", (node: Element) => {
      const el = node as HTMLElement;
      if (el.hidden) return;
      const kind = el.getAttribute("data-transition") || "";
      if (!kind || kind === "none") return;
      if (
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      if (typeof el.animate !== "function") return;
      const dur = transDur(el);
      try {
        const anim = el.animate(transFrames(kind, false), { duration: dur, easing: "ease-out" });
        if (anim && anim.finished && anim.finished.catch) anim.finished.catch(() => {});
      } catch (e) {}
    });
  }

  function claimed(el: Element, key: string): boolean {
    const host = el as any;
    const map = host._bH || (host._bH = {});
    if (map[key]) return true;
    map[key] = 1;
    return false;
  }

  function cleanupNode(node: any): void {
    if (node._bcu) {
      for (let i = 0; i < node._bcu.length; i++) {
        try {
          node._bcu[i]();
        } catch (e) {}
      }
      node._bcu = [];
    }
    node._bH = undefined;
    if (node._bReq) {
      try {
        node._bReq.abort();
      } catch (e) {}
      node._bReq = null;
    }
  }

  function destroyTree(root: Element): void {
    cleanupNode(root);
    const descendants = root.querySelectorAll("*");
    for (let i = 0; i < descendants.length; i++) {
      cleanupNode(descendants[i]);
    }
  }

  function parseScope(raw: string | null): Record<string, any> {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      warnDev("[laghu] data-scope must be JSON. Got: " + raw);
      return {};
    }
  }

  function coerceAttr(raw: string | null | undefined, cur: any): any {
    if (raw === null || raw === undefined) return cur;
    if (typeof cur === "boolean") return raw !== "false" && raw !== "0";
    if (typeof cur === "number") {
      const n = Number(raw);
      return isNaN(n) ? cur : n;
    }
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw !== "" && !isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
      return Number(raw);
    }
    return raw;
  }

  function parseMs(s: string): number {
    const m = String(s)
      .trim()
      .match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    return m[2] === "s" ? n * 1000 : n;
  }

  function defaultEvent(el: Element): string {
    const t = el.tagName;
    if (t === "FORM") return "submit";
    if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return "change";
    return "click";
  }

  function parseTrigger(spec: string, el: Element): TriggerSpec {
    const out: TriggerSpec = {
      on: "",
      delay: 0,
      throttle: 0,
      once: false,
      changed: false,
      queue: "last",
      from: "",
      every: 0,
      load: false,
      revealed: false,
    };
    let s = String(spec || "").trim();
    if (!s) {
      out.on = defaultEvent(el);
      return out;
    }

    const everyMatch = s.match(/every\s+(\d+(?:\.\d+)?(?:ms|s)?)/);
    if (everyMatch) {
      out.every = parseMs(everyMatch[1]);
      s = s.replace(everyMatch[0], " ");
    }
    const delayMatch = s.match(/delay:(\S+)/);
    if (delayMatch) {
      out.delay = parseMs(delayMatch[1]);
      s = s.replace(delayMatch[0], " ");
    }
    const throttleMatch = s.match(/throttle:(\S+)/);
    if (throttleMatch) {
      out.throttle = parseMs(throttleMatch[1]);
      s = s.replace(throttleMatch[0], " ");
    }
    const queueMatch = s.match(/queue:(first|last|all|none)/);
    if (queueMatch) {
      out.queue = queueMatch[1];
      s = s.replace(queueMatch[0], " ");
    }
    const fromMatch = s.match(/from:(\S+)/);
    if (fromMatch) {
      out.from = fromMatch[1];
      s = s.replace(fromMatch[0], " ");
    }
    if (/\bonce\b/.test(s)) {
      out.once = true;
      s = s.replace(/\bonce\b/, " ");
    }
    if (/\bchanged\b/.test(s)) {
      out.changed = true;
      s = s.replace(/\bchanged\b/, " ");
    }
    if (/\bload\b/.test(s)) {
      out.load = true;
      s = s.replace(/\bload\b/, " ");
    }
    if (/\brevealed\b/.test(s)) {
      out.revealed = true;
      s = s.replace(/\brevealed\b/, " ");
    }

    const eventName = s.trim().split(/\s+/).filter(Boolean)[0] || "";
    out.on = eventName || defaultEvent(el);
    return out;
  }

  function bindTrigger(el: Element, spec: string, fn: (e: Event) => void): () => void {
    const triggerInfo = parseTrigger(spec, el);
    const triggerState: any = { timer: 0, lastFire: 0, lastVal: null };

    const fire = function (e: Event) {
      const input: any = el;
      if (triggerInfo.changed && (hasKey(input, "value") || hasKey(input, "checked"))) {
        const valStr =
          input.type === "checkbox" || input.type === "radio"
            ? String(input.checked) + ":" + String(input.value)
            : String(input.value);
        if (valStr === triggerState.lastVal) return;
        triggerState.lastVal = valStr;
      }

      const now = Date.now();
      if (triggerInfo.throttle && now - triggerState.lastFire < triggerInfo.throttle) return;

      const run = function () {
        triggerState.lastFire = Date.now();
        fn(e);
        if (triggerInfo.once) cleanup();
      };

      if (triggerInfo.delay) {
        clearTimeout(triggerState.timer);
        triggerState.timer = setTimeout(run, triggerInfo.delay);
      } else {
        run();
      }
    };

    const cleanups: Array<Function> = [];
    const cleanup = function () {
      for (let ci = 0; ci < cleanups.length; ci++) {
        try {
          cleanups[ci]();
        } catch (e) {}
      }
      clearTimeout(triggerState.timer);
    };

    let listenTarget = el as any;
    if (triggerInfo.from === "document" && typeof document !== "undefined") {
      listenTarget = document;
    } else if (triggerInfo.from === "body" && typeof document !== "undefined") {
      listenTarget = document.body;
    } else if (triggerInfo.from && typeof document !== "undefined") {
      const docRoot = document;
      const delegator = function (ev: Event) {
        const tgt = ev.target as any;
        if (tgt && tgt.closest && tgt.closest(triggerInfo.from)) fire(ev);
      };
      docRoot.addEventListener(triggerInfo.on, delegator);
      cleanups.push(() => docRoot.removeEventListener(triggerInfo.on, delegator));
      onCleanup(el, cleanup);
      return cleanup;
    }

    if (triggerInfo.every) {
      const intervalId = setInterval(() => {
        fire(new CustomEvent("laghu:poll"));
      }, triggerInfo.every);
      cleanups.push(() => clearInterval(intervalId));
    }

    if (triggerInfo.load) {
      if (typeof document !== "undefined" && document.readyState === "loading") {
        const onLoad = () => fire(new CustomEvent("laghu:load"));
        document.addEventListener("DOMContentLoaded", onLoad, { once: true });
        cleanups.push(() => document.removeEventListener("DOMContentLoaded", onLoad));
      } else {
        const runNow = () => fire(new CustomEvent("laghu:load"));
        if (typeof queueMicrotask !== "undefined") queueMicrotask(runNow);
        else setTimeout(runNow, 0);
      }
    }

    if (triggerInfo.revealed) {
      if (typeof IntersectionObserver !== "undefined") {
        const observerInstance = new IntersectionObserver((entries) => {
          entries.forEach((entry: any) => {
            if (entry.isIntersecting) {
              fire(new CustomEvent("laghu:revealed"));
              if (triggerInfo.once) observerInstance.disconnect();
            }
          });
        });
        observerInstance.observe(el);
        cleanups.push(() => observerInstance.disconnect());
      } else {
        fire(new CustomEvent("laghu:revealed"));
      }
    }

    listenTarget.addEventListener(triggerInfo.on, fire);
    cleanups.push(() => listenTarget.removeEventListener(triggerInfo.on, fire));
    onCleanup(el, cleanup);
    return cleanup;
  }

  function numArg(a: string): number {
    const n = Number(a);
    return isNaN(n) ? 0 : n;
  }

  function strArg(a: string): string {
    if (!a) return "";
    const first = a[0];
    const last = a[a.length - 1];
    if (a.length > 1 && (first === '"' || first === "'") && first === last) {
      return a.slice(1, -1);
    }
    return a;
  }

  // Register built-in display filters
  filters.set("uppercase", (v: any) => String(v ?? "").toUpperCase());
  filters.set("lowercase", (v: any) => String(v ?? "").toLowerCase());
  filters.set("json", (v: any) => {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  });
  filters.set("fixed", (v: any, a: any) => {
    const n = Number(v);
    return isNaN(n) ? String(v ?? "") : n.toFixed(numArg(strArg(a)));
  });
  filters.set("currency", (v: any, a: any) => {
    const n = Number(v);
    const curr = strArg(a) || "$";
    return isNaN(n) ? String(v ?? "") : curr + n.toFixed(2);
  });
  filters.set("date", (v: any, a: any) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(strArg(a) || undefined);
  });
  filters.set("default", (v: any, a: any) => {
    return v === null || v === undefined || v === "" ? strArg(a) : v;
  });
  filters.set("join", (v: any, a: any) => {
    return Array.isArray(v) ? v.join(a === "" ? ", " : strArg(a)) : v;
  });
  filters.set("length", (v: any) => {
    return v == null ? 0 : v.length === undefined ? 0 : v.length;
  });

  function splitFilters(s: string): [string, Array<[string, string]>] {
    let depth = 0;
    let quoteChar: string | null = null;
    let cur = "";
    const parts: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quoteChar) {
        cur += ch;
        if (ch === quoteChar && s[i - 1] !== "\\") quoteChar = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        cur += ch;
        continue;
      }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "|" && depth === 0) {
        if (s[i + 1] === "|") {
          cur += "||";
          i++;
          continue;
        }
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    const expr = parts.shift()!;
    const filtersOut: Array<[string, string]> = parts.map((p) => {
      const colonIdx = p.indexOf(":");
      if (colonIdx < 0) return [p.trim(), ""];
      return [p.slice(0, colonIdx).trim(), p.slice(colonIdx + 1).trim()];
    });
    return [expr, filtersOut];
  }

  function filterValue(scope: any, expr: string, chain: Array<[string, string]>): any {
    let val = evalExpr(scope, expr);
    for (let i = 0; i < chain.length; i++) {
      const filterFn = filters.get(chain[i][0]);
      if (typeof filterFn !== "function") {
        warnDev('[laghu] unknown filter "' + chain[i][0] + '"');
        continue;
      }
      try {
        val = filterFn(val, chain[i][1], scope);
      } catch (e) {
        reportError(e);
        return val;
      }
    }
    return val;
  }

  function bindTextAndHtml(root: Element, scope: any): void {
    eachEl(root, "[data-bind],[data-text]", (node: Element) => {
      const el = node as HTMLElement;
      if (claimed(el, "bind")) return;
      const path = el.getAttribute("data-bind") || el.getAttribute("data-text") || "";
      const [baseExpr, filterChain] = splitFilters(path);
      const stop = effect(() => {
        el.textContent = String(filterValue(scope, baseExpr, filterChain) ?? "");
      });
      onCleanup(el, stop);
    });

    eachEl(root, "[data-html]", (node: Element) => {
      const el = node as HTMLElement;
      if (claimed(el, "html")) return;
      const path = el.getAttribute("data-html") || "";
      const stop = effect(() => {
        el.innerHTML = sanitize(String(evalExpr(scope, path) ?? ""));
      });
      onCleanup(el, stop);
    });
  }

  function bindAttributes(root: Element, scope: any): void {
    Array.prototype.forEach.call(allEls(root), (node: Element) => {
      const el = node as HTMLElement;
      Array.prototype.forEach.call(el.attributes, (attr: Attr) => {
        const attrName = attr.name;
        if (attrName.indexOf("data-bind:") === 0) {
          if (claimed(el, "a:" + attrName)) return;
          const targetAttr = attrName.slice("data-bind:".length);
          const expr = attr.value;
          const stop = effect(() => {
            const v = evalExpr(scope, expr);
            if (v === false || v === null || v === undefined) {
              el.removeAttribute(targetAttr);
            } else if (URL_ATTRS[targetAttr.toLowerCase()] && unsafeUrl(v)) {
              el.removeAttribute(targetAttr);
              warnDev('[laghu] blocked scriptable URL for "' + targetAttr + '"');
            } else {
              el.setAttribute(targetAttr, String(v));
            }
          });
          onCleanup(el, stop);
        } else if (attrName.indexOf("data-class:") === 0) {
          if (claimed(el, "a:" + attrName)) return;
          const className = attrName.slice("data-class:".length);
          const expr = attr.value;
          const stop = effect(() => {
            el.classList.toggle(className, !!evalExpr(scope, expr));
          });
          onCleanup(el, stop);
        } else if (attrName.indexOf("data-style:") === 0) {
          if (claimed(el, "a:" + attrName)) return;
          const styleProp = attrName.slice("data-style:".length);
          const expr = attr.value;
          const stop = effect(() => {
            const v = evalExpr(scope, expr);
            (el.style as any)[styleProp] =
              v === false || v === null || v === undefined ? "" : String(v);
          });
          onCleanup(el, stop);
        }
      });
    });
  }

  function bindModelInput(el: any, scope: any, path: string, isCheck: boolean, isRadio: boolean, isSelect: boolean): void {
    const handler = function () {
      if (isCheck) {
        const cur = evalExpr(scope, path);
        if (Array.isArray(cur)) {
          const arr = cur.slice();
          const ix = arr.indexOf(el.value);
          if (el.checked && ix < 0) arr.push(el.value);
          if (!el.checked && ix >= 0) arr.splice(ix, 1);
          setPath(scope, path, arr);
        } else {
          setPath(scope, path, el.checked);
        }
      } else if (isSelect) {
        const selectedValues: string[] = [];
        Array.prototype.forEach.call(el.options, (opt: any) => {
          if (opt.selected) selectedValues.push(opt.value);
        });
        setPath(scope, path, selectedValues);
      } else if (el.type === "number") {
        setPath(scope, path, el.value === "" ? null : Number(el.value));
      } else {
        setPath(scope, path, el.value);
      }
    };
    const eventName = isCheck || isRadio || el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventName, handler);
    onCleanup(el, () => el.removeEventListener(eventName, handler));
  }

  function bindModel(root: Element, scope: any): void {
    eachEl(root, "[data-model]", (node: Element) => {
      const el = node as any;
      if (claimed(el, "model")) return;
      const path = el.getAttribute("data-model") || "";
      const isCheck = el.type === "checkbox";
      const isRadio = el.type === "radio";
      const isSelect = el.tagName === "SELECT" && el.multiple;

      const stop = effect(() => {
        const v = evalExpr(scope, path);
        if (document.activeElement === el && !isCheck && !isRadio) {
          if (el.value === String(v ?? "")) return;
        }
        if (isCheck) {
          if (Array.isArray(v)) el.checked = v.indexOf(el.value) >= 0;
          else el.checked = !!v;
        } else if (isRadio) {
          el.checked = String(v ?? "") === String(el.value);
        } else if (isSelect) {
          const arr = Array.isArray(v) ? v.map(String) : [];
          Array.prototype.forEach.call(el.options, (opt: any) => {
            opt.selected = arr.indexOf(String(opt.value)) >= 0;
          });
        } else if (el.tagName === "SELECT" || el.value !== undefined) {
          el.value = v === undefined || v === null ? "" : String(v);
        }
      });
      onCleanup(el, stop);
      bindModelInput(el, scope, path, isCheck, isRadio, isSelect);
    });
  }

  function bindConditionals(root: Element, scope: any): void {
    eachEl(root, "[data-show]", (node: Element) => {
      const el = node as HTMLElement;
      if (claimed(el, "show")) return;
      const expr = el.getAttribute("data-show") || "";
      const stop = effect(() => {
        setHidden(el, !evalExpr(scope, expr));
      });
      onCleanup(el, stop);
    });

    eachEl(root, "[data-if]", (node: Element) => {
      const el = node as HTMLElement;
      if (el.tagName === "TEMPLATE") return;
      if (claimed(el, "if")) return;
      const expr = el.getAttribute("data-if") || "";
      const stop = effect(() => {
        setHidden(el, !evalExpr(scope, expr));
      });
      onCleanup(el, stop);
    });
  }

  function bindTemplateIf(root: Element, scope: any, actions: Record<string, Function>): void {
    eachEl(root, "template[data-if]", (node: Element) => {
      const tpl = node as HTMLTemplateElement;
      const expr = tpl.getAttribute("data-if") || "";
      if (claimed(tpl, "tif")) return;
      const anchor = document.createComment("b-if");
      if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
      let frag: DocumentFragment | null = null;

      const stop = effect(() => {
        const on = !!evalExpr(scope, expr);
        if (on && !frag) {
          frag = tpl.content.cloneNode(true) as DocumentFragment;
          if (anchor.parentNode) {
            anchor.parentNode.insertBefore(frag, anchor.nextSibling);
            if (anchor.parentNode instanceof Element) {
              hydrate(anchor.parentNode, scope, actions);
              let nn = anchor.nextSibling;
              while (nn && nn !== tpl) {
                const nx2 = nn.nextSibling;
                if (nn instanceof Element) playEnter(nn);
                nn = nx2;
              }
            }
          }
        } else if (!on && frag) {
          let current = anchor.nextSibling;
          while (current && current !== tpl) {
            const next = current.nextSibling;
            if (current instanceof Element) destroyTree(current);
            if (current.parentNode) current.parentNode.removeChild(current);
            current = next;
          }
          frag = null;
        }
      });
      onCleanup(tpl, stop);
    });
  }

  function renderRows(
    tpl: HTMLTemplateElement,
    anchor: Comment,
    scope: any,
    actions: Record<string, Function>,
    itemVar: string,
    idxVar: string | undefined,
    listExpr: string,
    keyExpr: string,
    rows: Map<any, { nodes: Node[]; scope: any }>,
  ): void {
    let list = evalExpr(scope, listExpr) || [];
    if (!Array.isArray(list)) {
      warnDev("[laghu] data-for not array: " + listExpr);
      list = [];
    }
    const parent = anchor.parentNode;
    if (!parent) return;

    const seen = new Set();
    const order: any[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      let key: any = i;
      if (keyExpr) {
        let ki = evalExpr(item, keyExpr);
        if (ki === undefined || ki === null) {
          const tmpVars: Record<string, any> = { [itemVar]: item };
          ki = evalExpr(childScope(scope, tmpVars), keyExpr);
        }
        if (ki !== undefined && ki !== null) key = ki;
      }
      seen.add(key);
      order.push(key);

      const row = rows.get(key);
      if (!row) {
        const rsVars: Record<string, any> = { [itemVar]: item };
        if (idxVar) rsVars[idxVar] = i;
        const rs = childScope(scope, rsVars);
        const frag = tpl.content.cloneNode(true) as DocumentFragment;
        const holder = document.createElement("span");
        holder.style.display = "contents";
        holder.setAttribute("data-bkey", String(key));
        holder.appendChild(frag);
        parent.insertBefore(holder, anchor);
        hydrate(holder, rs, actions);
        playEnter(holder);
        rows.set(key, { nodes: [holder], scope: rs });
      } else {
        const prevItem = row.scope[itemVar];
        const prevIdx = idxVar ? row.scope[idxVar] : -1;
        row.scope[itemVar] = item;
        if (idxVar) row.scope[idxVar] = i;
        if (prevItem !== item || (idxVar && prevIdx !== i)) {
          const h0 = row.nodes[0] as Element;
          destroyTree(h0);
          hydrate(h0, row.scope, actions);
        }
      }
    }

    const seq: string[] = [];
    const children = parent.childNodes;
    for (let q = 0; q < children.length; q++) {
      const child = children[q];
      if (child.nodeType === 1 && (child as Element).hasAttribute("data-bkey")) {
        seq.push((child as Element).getAttribute("data-bkey") || "");
      }
    }

    let sameOrder = seq.length === order.length;
    if (sameOrder) {
      for (let k = 0; k < order.length; k++) {
        if (seq[k] !== String(order[k])) {
          sameOrder = false;
          break;
        }
      }
    }

    if (!sameOrder) {
      for (let j = 0; j < order.length; j++) {
        const r2 = rows.get(order[j])!;
        parent.insertBefore(r2.nodes[0], anchor);
      }
    }

    rows.forEach((rObj, k) => {
      if (!seen.has(k)) {
        rObj.nodes.forEach((n) => {
          destroyTree(n as Element);
          if (n.parentNode) n.parentNode.removeChild(n);
        });
        rows.delete(k);
      }
    });
  }

  function bindTemplateFor(root: Element, scope: any, actions: Record<string, Function>): void {
    eachEl(root, "template[data-for]", (node: Element) => {
      const tpl = node as HTMLTemplateElement;
      const spec = tpl.getAttribute("data-for") || "";
      if (claimed(tpl, "tfor")) return;
      const match = spec.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(.+)\s*$/);
      if (!match) {
        warnDev('[laghu] bad data-for "' + spec + '"');
        return;
      }
      const itemVar = match[1];
      const idxVar = match[2];
      const listExpr = match[3];
      const keyExpr = tpl.getAttribute("data-key") || "";
      const anchor = document.createComment("b-for");
      if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
      const rows = new Map<any, { nodes: Node[]; scope: any }>();

      const stop = effect(() => {
        renderRows(tpl, anchor, scope, actions, itemVar, idxVar, listExpr, keyExpr, rows);
      });
      onCleanup(tpl, stop);
    });
  }

  function bindEventsAndActions(root: Element, scope: any, actions: Record<string, Function>): void {
    eachEl(root, "[data-click]", (node: Element) => {
      const el = node as HTMLElement;
      if (claimed(el, "click")) return;
      const code = el.getAttribute("data-click") || "";
      const spec = el.getAttribute("data-trigger") || "click";
      bindTrigger(el, spec, () => {
        execAction(scope, actions, code);
      });
    });

    Array.prototype.forEach.call(allEls(root), (node: Element) => {
      const el = node as HTMLElement;
      Array.prototype.forEach.call(el.attributes, (attr: Attr) => {
        if (attr.name.indexOf("data-on:") === 0) {
          if (claimed(el, "on:" + attr.name)) return;
          const raw = attr.name.slice("data-on:".length);
          const parts = raw.split(".");
          const evName = parts[0];
          const mods = parts.slice(1);
          const code = attr.value;
          const spec = el.getAttribute("data-trigger") || evName;
          bindTrigger(el, spec, (e: Event) => {
            if (mods.indexOf("prevent") >= 0) e.preventDefault();
            if (mods.indexOf("stop") >= 0) e.stopPropagation();
            const childSc = childScope(scope, { $event: e });
            execAction(childSc, actions, code);
            if (mods.indexOf("once") >= 0) {
              try {
                (el as any).removeAttribute(attr.name);
              } catch (err) {}
            }
          });
        }
      });
    });

    eachEl(root, "[data-init]", (node: Element) => {
      const el = node as HTMLElement;
      if (claimed(el, "init")) return;
      const code = el.getAttribute("data-init") || "";
      try {
        execAction(scope, actions, code);
      } catch (e) {
        reportError(e);
      }
    });
  }

  function bindCustomDirectives(root: Element, scope: any): void {
    directives.forEach((fn: any, dirName: any) => {
      eachEl(root, "[data-" + dirName + "]", (node: Element) => {
        const el = node as HTMLElement;
        if (claimed(el, "dir:" + dirName)) return;
        try {
          const cleanupFn = fn({
            el: el,
            get: () => evalExpr(scope, el.getAttribute("data-" + dirName) || ""),
            effect: effect,
            scope: scope,
          });
          if (typeof cleanupFn === "function") onCleanup(el, cleanupFn);
        } catch (e) {
          reportError(e);
        }
      });
    });
  }

  function buildFetchOptions(el: HTMLElement, method: string, ctrl: AbortController | null): { opts: any; urlSuffix: string } {
    const opts: any = {
      method: method,
      headers: { Accept: "application/json, text/html" },
      signal: ctrl ? ctrl.signal : undefined,
    };
    let urlSuffix = "";
    const valsRaw = el.getAttribute("data-vals");
    if (valsRaw) {
      const wantForm = valsRaw.trim() === "form";
      const hostForm = el instanceof HTMLFormElement ? el : el.closest("form");
      const values = wantForm ? (hostForm ? serializeForm(hostForm) : {}) : tryJSON(valsRaw) || {};
      if (hostForm && !wantForm) {
        const formVals = serializeForm(hostForm as HTMLFormElement);
        for (const k in formVals) values[k] = formVals[k];
      }
      if (method === "GET") {
        const queryParts: string[] = [];
        for (const qk in values) {
          if (Array.isArray(values[qk])) {
            for (let qi = 0; qi < values[qk].length; qi++) {
              queryParts.push(encodeURIComponent(qk) + "=" + encodeURIComponent(String(values[qk][qi])));
            }
          } else {
            queryParts.push(encodeURIComponent(qk) + "=" + encodeURIComponent(String(values[qk])));
          }
        }
        if (queryParts.length) urlSuffix = queryParts.join("&");
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(values);
      }
    } else if (method !== "GET") {
      const formEl = el instanceof HTMLFormElement ? el : el.closest("form");
      if (formEl) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(serializeForm(formEl as HTMLFormElement));
      }
    }
    const headersRaw = el.getAttribute("data-headers");
    if (headersRaw) {
      const parsedHeaders = tryJSON(headersRaw) || {};
      for (const hk in parsedHeaders) opts.headers[hk] = parsedHeaders[hk];
    }
    return { opts, urlSuffix };
  }

  function handleFetchResponse(
    el: HTMLElement,
    res: any,
    scope: any,
    url: string,
    targetSel: string,
    swap: string,
    actions: Record<string, Function>,
  ): Promise<void> {
    if (!res.ok) {
      setPath(scope, "$error", { status: res.status, url: url });
      el.dispatchEvent(
        new CustomEvent("laghu:request-error", {
          bubbles: true,
          detail: { status: res.status, url: url },
        }),
      );
      return Promise.resolve();
    }
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.indexOf("json") >= 0) {
      return res.json().then((data: any) => {
        setPath(scope, "$error", null);
        if (data && typeof data === "object" && !Array.isArray(data)) {
          Object.assign(scope, data);
        } else {
          setPath(scope, "result", data);
        }
      });
    }
    return res.text().then((textHtml: string) => {
      let finalHtml = textHtml;
      const selectSel = el.getAttribute("data-select");
      if (selectSel) {
        const tmp = document.createElement("template");
        tmp.innerHTML = sanitize(textHtml);
        const picked = tmp.content.querySelector(selectSel);
        finalHtml = picked ? picked.outerHTML : "";
      }
      const target = targetSel ? document.querySelector(targetSel) : el;
      if (!target) return;
      swapHtml(target as Element, finalHtml, swap, scope, actions);
    });
  }

  function doFetch(
    el: HTMLElement,
    scope: any,
    method: string,
    url: string,
    targetSel: string,
    swap: string,
  ): void {
    const triggerData = parseTrigger(el.getAttribute("data-trigger") || defaultEvent(el), el);
    const self = el as any;
    if (!self._bReqs) self._bReqs = new Set();
    if (self._bN > 0 && (triggerData.queue === "first" || triggerData.queue === "none")) return;
    if (triggerData.queue === "last") {
      self._bReqs.forEach((c: any) => {
        try {
          c.abort();
        } catch (e) {}
      });
      self._bReqs.clear();
    }
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctrl) self._bReqs.add(ctrl);
    self._bN = (self._bN || 0) + 1;

    let timedOut = false;
    const timeoutMs = parseMs(el.getAttribute("data-timeout") || "");
    let timer: any = 0;
    if (timeoutMs > 0 && ctrl) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          ctrl.abort();
        } catch (e) {}
      }, timeoutMs);
    }

    const actions = self._bActions;
    const setBusy = (on: boolean) => {
      const indSel = el.getAttribute("data-indicator");
      const ind = indSel ? document.querySelector(indSel) : null;
      if (ind && ind instanceof HTMLElement) ind.hidden = !on;
      if (on) {
        el.setAttribute("data-request", "");
        el.setAttribute("data-pending", "");
      } else {
        el.removeAttribute("data-request");
        el.removeAttribute("data-pending");
      }
      if (el.hasAttribute("data-disable")) el.toggleAttribute("disabled", on);
    };
    setBusy(true);

    const beforeEvt = new CustomEvent("laghu:before-request", {
      bubbles: true,
      cancelable: true,
      detail: { url: url, method: method },
    });

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (ctrl) self._bReqs.delete(ctrl);
      self._bN = Math.max(0, self._bN - 1);
      setBusy(false);
    }

    if (!el.dispatchEvent(beforeEvt)) {
      finish();
      return;
    }

    const { opts, urlSuffix } = buildFetchOptions(el, method, ctrl);
    let requestUrl = url;
    if (urlSuffix) {
      requestUrl += (requestUrl.indexOf("?") >= 0 ? "&" : "?") + urlSuffix;
    }

    fetch(requestUrl, opts)
      .then((res: any) => {
        finish();
        el.dispatchEvent(
          new CustomEvent("laghu:after-request", {
            bubbles: true,
            detail: { status: res.status, url: requestUrl },
          }),
        );
        return handleFetchResponse(el, res, scope, requestUrl, targetSel, swap, actions);
      })
      .catch((err: any) => {
        finish();
        if (err && err.name === "AbortError" && !timedOut) return;
        setPath(scope, "$error", {
          message: String((err && err.message) || err),
          timeout: timedOut,
        });
        el.dispatchEvent(
          new CustomEvent("laghu:request-error", {
            bubbles: true,
            detail: { error: err, timeout: timedOut },
          }),
        );
        reportError(err);
      });
  }

  function setupFetch(
    el: HTMLElement,
    scope: any,
    method: string,
    url: string,
    actions: Record<string, Function>,
  ): void {
    const targetSel = el.getAttribute("data-target") || "";
    const swap = el.getAttribute("data-swap") || "inner";
    const triggerSpec = el.getAttribute("data-trigger") || defaultEvent(el);
    (el as any)._bActions = actions;

    const fire = function (e: Event) {
      if (el instanceof HTMLFormElement && e && e.type === "submit" && e.cancelable) {
        e.preventDefault();
      }
      doFetch(el, scope, method, url, targetSel, swap);
    };
    bindTrigger(el, triggerSpec, fire);
  }

  function bindDeclarativeFetch(root: Element, scope: any, actions: Record<string, Function>): void {
    Array.prototype.forEach.call(allEls(root), (node: any) => {
      const el = node as HTMLElement;
      let method = "";
      let url = "";
      if (el.hasAttribute("data-get")) {
        method = "GET";
        url = el.getAttribute("data-get") || "";
      } else if (el.hasAttribute("data-post")) {
        method = "POST";
        url = el.getAttribute("data-post") || "";
      } else if (el.hasAttribute("data-put")) {
        method = "PUT";
        url = el.getAttribute("data-put") || "";
      } else if (el.hasAttribute("data-patch")) {
        method = "PATCH";
        url = el.getAttribute("data-patch") || "";
      } else if (el.hasAttribute("data-delete")) {
        method = "DELETE";
        url = el.getAttribute("data-delete") || "";
      }
      if (
        !url &&
        !el.hasAttribute("data-get") &&
        !el.hasAttribute("data-post") &&
        !el.hasAttribute("data-put") &&
        !el.hasAttribute("data-patch") &&
        !el.hasAttribute("data-delete")
      ) {
        return;
      }
      method = (el.getAttribute("data-method") || method).toUpperCase();
      if (claimed(el, "fetch")) return;
      setupFetch(el, scope, method, url, actions);
    });
  }

  function tryJSON(s: string): any {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  function serializeForm(form: HTMLFormElement): Record<string, any> {
    const out: Record<string, any> = {};
    const fd = new FormData(form);
    fd.forEach((v: any, k: any) => {
      const strVal = typeof v === "string" ? v : String(v);
      if (k in out) {
        if (!Array.isArray(out[k])) out[k] = [out[k]];
        out[k].push(strVal);
      } else {
        out[k] = strVal;
      }
    });
    return out;
  }

  function executeSwap(target: Element, frag: DocumentFragment, mode: string, text: string): void {
    if (mode === "inner") {
      target.innerHTML = "";
      target.appendChild(frag);
    } else if (mode === "text") {
      target.textContent = text;
    } else if (mode === "outer") {
      target.replaceWith(frag);
    } else if (mode === "append" || mode === "beforeend") {
      target.appendChild(frag);
    } else if (mode === "prepend" || mode === "afterbegin") {
      target.insertBefore(frag, target.firstChild);
    } else if (mode === "beforebegin") {
      if (target.parentNode) target.parentNode.insertBefore(frag, target);
    } else if (mode === "afterend") {
      if (target.parentNode) target.parentNode.insertBefore(frag, target.nextSibling);
    } else {
      target.innerHTML = "";
      target.appendChild(frag);
    }
  }

  function restorePreserved(target: Element, kept: Map<string, Element>): void {
    kept.forEach((node: Element, id: string) => {
      let sel = "#";
      try {
        const escaped =
          typeof CSS !== "undefined" && CSS && CSS.escape
            ? CSS.escape(id)
            : String(id).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
        sel = "#" + escaped;
      } catch (e) {
        sel = '[id="' + String(id).replace(/"/g, "") + '"]';
      }
      let fresh = target.querySelector(sel);
      if (!fresh) fresh = document.getElementById(id);
      if (fresh && fresh !== node && node.parentNode !== fresh) {
        fresh.replaceWith(node);
      }
    });
  }

  function restoreFocus(id: string | null, selStart: number, selEnd: number): void {
    if (!id) return;
    const focusedEl = document.getElementById(id);
    if (focusedEl && focusedEl instanceof HTMLElement) {
      try {
        focusedEl.focus({ preventScroll: true });
      } catch (e) {
        try {
          focusedEl.focus();
        } catch (e2) {}
      }
      try {
        if (selStart >= 0 && (focusedEl as any).setSelectionRange) {
          (focusedEl as any).setSelectionRange(selStart, selEnd);
        }
      } catch (e) {}
    }
  }

  /**
   * Swap HTML into the page and re-hydrate bindings in the new content.
   */
  function swapHtml(
    target: Element,
    html: string,
    swap: string = "inner",
    scope: any = {},
    actions: Record<string, Function> = {},
  ): void {
    let mode = String(swap || "inner").toLowerCase();
    if (mode === "none") {
      target.dispatchEvent(
        new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: mode } }),
      );
      return;
    }

    const activeEl = document.activeElement as any;
    const focusId = activeEl && activeEl.id ? activeEl.id : null;
    const selStart = activeEl && typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : -1;
    const selEnd = activeEl && typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : -1;

    target.dispatchEvent(
      new CustomEvent("laghu:before-swap", {
        bubbles: true,
        cancelable: false,
        detail: { swap: mode },
      }),
    );

    const isMorph = mode.indexOf("morph") === 0;
    const morphPlugin: any = (window as any).LaghuMorph;
    if (isMorph) {
      if (morphPlugin && morphPlugin.morph) {
        morphPlugin.morph(target, sanitize(html), { mode: mode === "morph:outer" ? "outer" : "inner" });
        hydrate(target, scope, actions);
        target.dispatchEvent(
          new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: mode } }),
        );
        restoreFocus(focusId, selStart, selEnd);
        return;
      }
      warnDev('[laghu] data-swap="morph" needs morph.js (window.LaghuMorph). Falling back to inner.');
      mode = "inner";
    }

    if (mode === "delete") {
      destroyTree(target);
      if (target.parentNode) target.parentNode.removeChild(target);
      return;
    }

    const tmp = document.createElement("template");
    tmp.innerHTML = sanitize(html);
    const frag = tmp.content;

    const kept: Map<string, Element> = new Map();
    target.querySelectorAll("[data-preserve][id]").forEach((node: any) => {
      kept.set(node.id, node as Element);
    });

    destroyTree(target);
    executeSwap(target, frag, mode, tmp.content.textContent || "");
    restorePreserved(target, kept);

    hydrate(target, scope, actions);
    playEnter(target);
    target.dispatchEvent(
      new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: mode } }),
    );
    restoreFocus(focusId, selStart, selEnd);
  }

  function upgradePredefinedProps(element: any, initial: Record<string, any>): void {
    for (const key in initial) {
      if (Object.prototype.hasOwnProperty.call(element, key)) {
        try {
          initial[key] = element[key];
          delete element[key];
        } catch (e) {}
      }
    }
  }

  function syncAttributesOnConnect(element: any, initial: Record<string, any>, observed: string[]): void {
    const pend = element._bPend;
    if (pend) {
      for (const pk in pend) {
        if (pk in initial) initial[pk] = coerceAttr(pend[pk], initial[pk]);
        else initial[pk] = pend[pk];
      }
      element._bPend = null;
    } else {
      for (let i = 0; i < observed.length; i++) {
        const attrName = observed[i];
        if (element.hasAttribute && element.hasAttribute(attrName) && attrName in initial) {
          initial[attrName] = coerceAttr(element.getAttribute(attrName), initial[attrName]);
        }
      }
    }
  }

  /**
   * Register a Light-DOM Web Component.
   */
  function define(tag: string, setup: () => SetupResult): any {
    if (!tag || tag.indexOf("-") < 0) {
      throw new Error("[laghu] tag must contain hyphen: " + tag);
    }
    const probe = setup() || {};
    const observedAttrs =
      probe.observed ||
      Object.keys(probe.state || {}).filter((k: string) => {
        const val = (probe.state as any)[k];
        return typeof val === "string" || typeof val === "number" || typeof val === "boolean";
      });

    const ComponentClass: any = class extends HTMLElement {
      connectedCallback() {
        if ((this as any)._bInit) return;
        (this as any)._bInit = true;
        const config = setup() || {};
        const initial = config.state || {};
        upgradePredefinedProps(this, initial);
        syncAttributesOnConnect(this, initial, observedAttrs);

        const state = reactive(initial);
        (this as any).state = state;
        (this as any).actions = config.actions || {};
        if (typeof config.onUnmount === "function") (this as any)._bOnUnmount = config.onUnmount;

        hydrate(this, state, config.actions || {});
        try {
          if (typeof config.onMount === "function") config.onMount.call(state);
        } catch (e) {
          reportError(e);
        }
        this.classList.add("is-defined");
        this.dispatchEvent(new CustomEvent("laghu:mount"));
      }

      disconnectedCallback() {
        try {
          const st = (this as any).state;
          const un = (this as any)._bOnUnmount;
          if (typeof un === "function" && st) un.call(st);
        } catch (e) {
          reportError(e);
        }
        destroyTree(this);
        this.dispatchEvent(new CustomEvent("laghu:unmount"));
        (this as any)._bInit = false;
      }

      connectedMoveCallback() {
        /* preserve state on moveBefore */
      }

      attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        if (oldVal === newVal) return;
        const st = (this as any).state;
        if (st && name in st) {
          st[name] = coerceAttr(newVal, st[name]);
        } else {
          const p = (this as any)._bPend || {};
          p[name] = newVal;
          (this as any)._bPend = p;
        }
      }
    };

    ComponentClass.observedAttributes = observedAttrs;
    customElements.define(tag, ComponentClass);
    return ComponentClass;
  }

  let mutationObserver: MutationObserver | null = null;
  function autoObserve(): void {
    if (mutationObserver || typeof MutationObserver === "undefined") return;
    mutationObserver = new MutationObserver((mutations) => {
      const added = new Set<Element>();
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) added.add(n);
        });
      });
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element && n.hasAttribute && n.hasAttribute("data-scope") && !(n as any)._bScope) {
            try {
              const apiInstance = (window as any).Laghu;
              if (apiInstance) {
                apiInstance.hydrate(n, parseScope(n.getAttribute("data-scope")), {});
              }
            } catch (e) {
              reportError(e);
            }
          }
        });
        m.removedNodes.forEach((n) => {
          if (n instanceof Element && !added.has(n)) destroyTree(n);
        });
      });
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function seedErrorSlot(scope: any): void {
    try {
      if (isObj(scope) && !("$error" in Object(scope))) setPath(scope, "$error", null);
    } catch {}
  }

  /**
   * Scan a root element once and wire every laghu attribute found inside.
   */
  function hydrate(root: Element, state: Record<string, any>, actions: Record<string, Function> = {}): void {
    const scope = state;
    seedErrorSlot(scope);

    bindTextAndHtml(root, scope);
    bindAttributes(root, scope);
    bindModel(root, scope);
    bindConditionals(root, scope);
    bindTemplateIf(root, scope, actions);
    bindTemplateFor(root, scope, actions);
    bindEventsAndActions(root, scope, actions);
    bindCustomDirectives(root, scope);
    bindDeclarativeFetch(root, scope, actions);
  }

  const api: LaghuAPI = {
    version: VERSION,
    define: define,
    reactive: reactive,
    effect: effect,
    eval: evalExpr,
    get: getPath,
    set: setPath,
    parseTrigger: parseTrigger,
    swap: swapHtml,
    css: "laghu:not(:defined),[data-laghu]:not(:defined){visibility:hidden}laghu.is-defined,[data-laghu].is-defined{visibility:visible}",
    sanitize(fn?: (html: string) => string): void {
      if (typeof fn === "function") sanitize = fn;
      else sanitize = defaultSanitize;
    },
    hydrate(root: Element, state?: Record<string, any>, actions?: Record<string, Function>): any {
      const s = reactive(state || parseScope(root.getAttribute("data-scope")));
      (root as any)._bScope = s;
      hydrate(root, s, actions || {});
      return s;
    },
    destroyTree: destroyTree,
    store(name: string, init?: any): any {
      if (init !== undefined) {
        const s = reactive(init);
        stores.set(name, s);
        return s;
      }
      return stores.get(name);
    },
    computed(fn: () => any): () => any {
      const box = reactive({ v: undefined });
      effect(() => {
        box.v = fn();
      });
      return () => box.v;
    },
    watch(scope: any, expr: string, cb: (next: any, prev: any) => void): () => void {
      let started = false;
      let prev: any;
      return effect(() => {
        const next = evalExpr(scope, expr);
        if (!started) {
          started = true;
          prev = next;
          return;
        }
        if (next !== prev) {
          const oldVal = prev;
          prev = next;
          cb(next, oldVal);
        }
      });
    },
    persist(name: string, opts?: { key?: string; version?: number; debounce?: number }): any {
      const options = opts || {};
      const key = options.key || "laghu:" + name;
      const ver = options.version === undefined ? 1 : options.version;
      const wait = options.debounce === undefined ? 300 : options.debounce;
      const st = stores.get(name);
      if (!st) return null;
      try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.v === ver && saved.state && typeof saved.state === "object") {
            Object.assign(st, saved.state);
          }
        }
      } catch (e) {
        reportError(e);
      }
      let timer: any = 0;
      effect(() => {
        JSON.stringify(st);
        if (typeof localStorage === "undefined") return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            localStorage.setItem(key, JSON.stringify({ v: ver, state: st }));
          } catch (e) {
            reportError(e);
          }
        }, wait);
      });
      return st;
    },
    directive(name: string, fn: (ctx: DirectiveContext) => void | (() => void)): void {
      directives.set(name, fn);
    },
    filter(name: string, fn: (value: any, arg: string, scope: any) => any): void {
      filters.set(name, fn);
    },
    scope(parent: any, vars: Record<string, any>): any {
      return childScope(parent, vars || {});
    },
    init(): void {
      if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
          autoObserve();
          document.querySelectorAll("[data-scope]").forEach((node: any) => {
            const el = node as Element;
            if ((el as any)._bScope) return;
            api.hydrate(el, parseScope(el.getAttribute("data-scope")), {});
          });
        });
      }
    },
  };

  api.init!();

  return api;
})();
