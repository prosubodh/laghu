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
    persist(name: string, opts?: {
        key?: string;
        version?: number;
        debounce?: number;
    }): any;
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
export declare const Laghu: LaghuAPI;
