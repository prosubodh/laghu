// biscuit.js + morph plugin type definitions (hand-written, mirrors JSDoc)
export interface SetupResult {
  state?: Record<string, any>;
  actions?: Record<string, (...args: any[]) => void>;
  observed?: string[];
  onMount?: (this: any) => void;
  onUnmount?: (this: any) => void;
}
export interface BiscuitAPI {
  version: string;
  define(tag: string, setup: () => SetupResult): any;
  reactive<T extends object>(obj: T): T;
  effect(fn: () => void): () => void;
  eval(scope: any, expr: string): any;
  get(scope: any, path: string): any;
  set(scope: any, path: string, val: any): void;
  parseTrigger(spec: string, el: Element): any;
  swap(target: Element, html: string, swap: string, scope: any): void;
  css: string;
  sanitize(fn: (html: string) => string): void;
  hydrate(root: Element, state?: Record<string, any>, actions?: Record<string, Function>): any;
  destroyTree(root: Element): void;
  store(name: string, init?: any): any;
  directive(name: string, fn: (ctx: { el: HTMLElement; get(): any; effect(f: () => void): () => void; scope: any }) => void | (() => void)): void;
}
declare global {
  interface Window {
    Biscuit: BiscuitAPI;
    BiscuitMorph?: { morph(target: Element, html: string, opts?: { mode?: string }): void; morphEl(a: Element, b: Element): void; version: string };
    __BISCUIT_DEV__?: boolean;
  }
}
