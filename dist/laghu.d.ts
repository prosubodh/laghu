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
  /** Release string, for example "1.0.0". */
  version: string;
  /**
   * Register a Light-DOM custom element.
   * @param tag Element name, must contain a hyphen.
   * @param setup Factory returning fresh state, actions, and options.
   */
  define(tag: string, setup: () => SetupResult): any;
  /** Make a plain object or array reactive. Primitives pass through. */
  reactive<T extends object>(obj: T): T;
  /**
   * Run fn now and again on dependency change.
   * @returns Stop function that unsubscribes the effect.
   */
  effect(fn: () => void): () => void;
  /** Evaluate a small CSP-safe expression against a scope. */
  eval(scope: any, expr: string): any;
  /** Read a dotted path (or $store.name.key) without throwing. */
  get(scope: any, path: string): any;
  /** Write a dotted path, creating intermediate objects. */
  set(scope: any, path: string, val: any): void;
  /** Parse data-trigger text into a TriggerSpec. */
  parseTrigger(spec: string, el: Element): TriggerSpec;
  /**
   * Swap HTML into target, hydrate the result, preserve focus.
   * @param swap One of inner, outer, text, append, prepend, beforebegin,
   * afterend, delete, none, morph:inner, morph:outer.
   */
  swap(target: Element, html: string, swap: string, scope: any): void;
  /** FOUC guard CSS string. Inject it or copy the rule. */
  css: string;
  /** Replace the HTML pass-through used by data-html and swaps. */
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
    __LAGHU_DEV__?: boolean;
  }
}
