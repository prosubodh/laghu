// laghu.js type definitions (hand-written, mirrors the JSDoc in src).
// Import in TypeScript projects for autocomplete and checking:
//   import type { LaghuAPI } from './laghu.d.ts';

/** Return value of the setup factory passed to Laghu.define. */
export interface SetupResult {
  /** Fresh state per component instance. Primitives sync from attributes. */
  state?: Record<string, any>;
  /** Named methods callable from data-click and data-on. Run with state as this. */
  actions?: Record<string, (...args: any[]) => void>;
  /** Attribute names synced into state. Defaults to primitive state keys. */
  observed?: string[];
  /** Runs once after the element hydrates. `this` is the state. */
  onMount?: (this: any) => void;
  /** Reserved for pairing with onMount in user code. */
  onUnmount?: (this: any) => void;
}

/** Parsed form of a data-trigger string. See parseTrigger docs in src. */
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

/** Context object passed to custom directive functions. */
export interface DirectiveContext {
  /** Element carrying the data-name attribute. */
  el: HTMLElement;
  /** Read the attribute expression against the current scope. */
  get(): any;
  /** Create a reactive effect. Return its stop function for cleanup. */
  effect(f: () => void): () => void;
  /** Reactive state of the enclosing scope. */
  scope: any;
}

/** Full public surface available as window.Laghu. */
export interface LaghuAPI {
  /** Release string, for example "1.1.0". */
  version: string;
  /**
   * Register a Light-DOM custom element.
   * @param tag Element name, must contain a hyphen.
   * @param setup Factory returning fresh state, actions, and options.
   */
  define(tag: string, setup: () => SetupResult): any;
  /** Make a plain object or array reactive. Primitives pass through. Re-wraps return the same proxy. */
  reactive<T extends object>(obj: T): T;
  /**
   * Run fn now and again on dependency change. Subscriptions refresh
   * per run; stop() unsubscribes fully. Never throws out.
   * @returns Stop function that unsubscribes the effect.
   */
  effect(fn: () => void): () => void;
  /** Evaluate a CSP-safe expression: paths, indexes, literals, arithmetic, comparisons, ternary, calls. */
  eval(scope: any, expr: string): any;
  /** Read a dotted path (or $store.name.key) without throwing. Prototype segments blocked. */
  get(scope: any, path: string): any;
  /** Write a dotted path, creating intermediate objects. Prototype segments refused. */
  set(scope: any, path: string, val: any): void;
  /** Parse data-trigger text into a TriggerSpec. */
  parseTrigger(spec: string, el: Element): TriggerSpec;
  /**
   * Swap HTML into target, hydrate the result, preserve focus.
   * @param swap One of inner, outer, text, append, prepend, beforebegin,
   * afterend, delete, none, morph:inner, morph:outer.
   * @param actions Named actions for handlers in the new content.
   */
  swap(target: Element, html: string, swap: string, scope: any, actions?: Record<string, Function>): void;
  /** FOUC guard CSS string. Inject it or copy the rule. */
  css: string;
  /** Replace the HTML pass-through used by data-html and swaps. Defaults to a baseline sanitizer. */
  sanitize(fn: (html: string) => string): void;
  /**
   * Scan root, wire all bindings, return the reactive state.
   * Runs automatically for [data-scope] islands on page load.
   */
  hydrate(root: Element, state?: Record<string, any>, actions?: Record<string, Function>): any;
  /** Stop all bindings under root: effects, listeners, timers, fetches. */
  destroyTree(root: Element): void;
  /** Create (with init) or fetch (without) a named global reactive store. */
  store(name: string, init?: any): any;
  /** Derived value kept fresh; call the getter inside bindings or effects to subscribe. */
  computed(fn: () => any): () => any;
  /** Call back with (next, prev) when an expression's value changes. Returns the stop function. */
  watch(scope: any, expr: string, cb: (next: any, prev: any) => void): () => void;
  /** Persist a named store to localStorage (debounced) with versioned restore. */
  persist(name: string, opts?: { key?: string; version?: number; debounce?: number }): any;
  /**
   * Register a data-name directive. Return a cleanup function optionally.
   * @example
   * Laghu.directive('focus', function (ctx) {
   *   return ctx.effect(function () { if (ctx.get()) ctx.el.focus(); });
   * });
   */
  directive(name: string, fn: (ctx: DirectiveContext) => void | (() => void)): void;
}

declare global {
  interface Window {
    Laghu: LaghuAPI;
    LaghuMorph?: {
      morph(target: Element, html: string, opts?: { mode?: string }): void;
      morphEl(a: Element, b: Element): void;
      version: string;
    };
    LaghuRouter?: {
      route(opts: {
        target?: string;
        scope?: any;
        actions?: Record<string, Function>;
        routes?: Array<{ path: string; render: (params: Record<string, string>, to: any) => string }>;
        notfound?: (to: any) => string;
        beforeEach?: (to: any, from: any) => boolean | void;
        afterEach?: (to: any, from: any) => void;
      }): () => void;
      compile(pattern: string): (path: string) => Record<string, string> | null;
      current(): { path: string; params: Record<string, string> };
      navigate(path: string): void;
      afterEach(fn: (to: any, from: any) => void): void;
      version: string;
    };
    __LAGHU_DEV__?: boolean;
  }
}
