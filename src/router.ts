// @ts-check
/**
 * laghu router plugin (opt-in, separate file, own 2.5kB gzip budget).
 *
 * Tiny hash router for pages with a handful of views. Explicitly NOT a
 * full SPA router: no nested outlets, no code splitting, no async
 * resolvers. Past about five guarded routes, use a real router.
 *
 * Routes match hash paths: "#/user/42" hits "/user/:id" with
 * params { id: "42" }. Matched renders swap HTML into the target and
 * hydrate against the given scope. beforeEach guards cancel by
 * returning false. Links are plain anchors (href="#/user/42");
 * no interception needed because hash changes fire hashchange.
 *
 * @example
 * LaghuRouter.route({
 *   target: '#view',
 *   scope: state,
 *   routes: [
 *     { path: '/', render: function () { return '<h1>Home</h1>'; } },
 *     { path: '/user/:id', render: function (p) { return '<h1>User ' + p.id + '</h1>'; } }
 *   ],
 *   notfound: function () { return '<h1>Missing</h1>'; },
 *   beforeEach: function (to) { return true; }
 * });
 *
 * Declarative alternative: put templates inside the target instead
 * of render functions. Params bind into a child scope as `params`,
 * and data-route-if guards with a plain expression. Templates are
 * harvested once at setup, so swaps never destroy them.
 * @example
 * <div id="view">
 *   <template data-route="/"><h1>Home</h1></template>
 *   <template data-route="/user/:id" data-route-if="isAdmin">
 *     <h1>User <span data-bind="params.id"></span></h1>
 *   </template>
 *   <template data-route-notfound><h1>Missing</h1></template>
 * </div>
 */
export interface LaghuRoute {
  path: string;
  render: (params: Record<string, string>, to: { path: string; params: Record<string, string> }) => string;
}

export interface LaghuRouterOptions {
  target?: string;
  scope?: any;
  actions?: Record<string, Function>;
  routes?: LaghuRoute[];
  notfound?: (to: { path: string; params: Record<string, string> }) => string;
  beforeEach?: (to: { path: string; params: Record<string, string> }, from: { path: string; params: Record<string, string> }) => boolean | void;
  afterEach?: (to: { path: string; params: Record<string, string> }, from: { path: string; params: Record<string, string> }) => void;
}

export interface LaghuRouterAPI {
  version: string;
  route(opts: LaghuRouterOptions): () => void;
  compile(pattern: string): (path: string) => Record<string, string> | null;
  current(): { path: string; params: Record<string, string> };
  navigate(path: string): void;
  afterEach(fn: (to: { path: string; params: Record<string, string> }, from: { path: string; params: Record<string, string> }) => void): void;
}

declare global {
  interface Window {
    LaghuRouter?: LaghuRouterAPI;
  }
}

export const LaghuRouter: LaghuRouterAPI = (() => {
  'use strict';
  var current: any = { path: '', params: {} };
  var afterEachFns: Array<Function> = [];

  /**
   * Compile "/user/:id" into a matcher. Static segments match
   * literally, :name captures one segment, * captures the rest.
   * @param {string} pattern
   * @returns {(path: string) => Record<string, string>|null}
   */
  function compile(pattern: string) {
    var names: Array<string> = [];
    var src = String(pattern).split('/').map(function (seg: any) {
      if (seg.charAt(0) === ':') { names.push(seg.slice(1)); return '([^/]+)'; }
      if (seg === '*') { names.push('wild'); return '(.*)'; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    var re = new RegExp('^' + src + '$');
    return function (path: any) {
      var m = path.match(re);
      if (!m) return null;
      var out: Record<string, string> = {};
      for (var i = 0; i < names.length; i++) out[names[i]] = decodeURIComponent(m[i + 1] || '');
      return out;
    };
  }

  /**
   * Start routing. Returns a stop function that detaches the listener.
   * @param {{target?: string, scope?: any, actions?: Record<string, Function>, routes?: Array<{path: string, render: Function}>, notfound?: Function, beforeEach?: Function, afterEach?: Function}} opts
   * @returns {Function} Call to stop listening.
   */
  function route(opts: any) {
    opts = opts || {};
    var targetSel = opts.target || '#view';
    var scope = opts.scope || {};
    var actions = opts.actions || {};
    var compiled = (opts.routes || []).map(function (r: any) {
      return { match: compile(r.path), render: r.render };
    });
    // Harvest declarative templates once, up front: the first swap
    // replaces the target's children, so live template elements would
    // not survive to the second navigation. Cached HTML re-renders
    // through the normal swap path (sanitize, preserve, hydrate).
    function tplHtml(tpl: Element): string {
      var holder = document.createElement('div');
      holder.appendChild((tpl as HTMLTemplateElement).content.cloneNode(true));
      return holder.innerHTML;
    }
    var declRoutes: Array<{ match: (path: string) => Record<string, string> | null; guard: string; html: string }> = [];
    var declNotfound = '';
    if (typeof document !== 'undefined') {
      var host = document.querySelector(targetSel);
      if (host) {
        Array.prototype.forEach.call(host.querySelectorAll('template[data-route]'), function (tpl: Element) {
          declRoutes.push({
            match: compile(tpl.getAttribute('data-route') || ''),
            guard: tpl.getAttribute('data-route-if') || '',
            html: tplHtml(tpl)
          });
        });
        var nf = host.querySelector('template[data-route-notfound]');
        if (nf) declNotfound = tplHtml(nf);
      }
    }
    function render() {
      var hash = (typeof location !== 'undefined' && location.hash) || '#/';
      var pathOnly = hash.charAt(0) === '#' ? hash.slice(1) : hash;
      if (!pathOnly) pathOnly = '/';
      var from = current;
      var B = (typeof window !== 'undefined' && ((window) as any).Laghu) || null;
      var target = typeof document !== 'undefined' ? document.querySelector(targetSel) : null;
      // Declarative routes win over render functions: params bind into
      // a child scope, guards are plain expressions on data-route-if.
      var declHit: { guard: string; html: string; params: Record<string, string> } | null = null;
      for (var d = 0; d < declRoutes.length; d++) {
        var pm = declRoutes[d].match(pathOnly);
        if (pm) { declHit = { guard: declRoutes[d].guard, html: declRoutes[d].html, params: pm }; break; }
      }
      var i, params: Record<string, string> | null = null, hit = null;
      if (!declHit) {
        for (i = 0; i < compiled.length; i++) {
          params = compiled[i].match(pathOnly);
          if (params) { hit = compiled[i]; break; }
        }
      } else {
        params = declHit.params;
      }
      var to = { path: pathOnly, params: params || {} };
      if (typeof opts.beforeEach === 'function' && opts.beforeEach(to, from) === false) return;
      if (declHit && declHit.guard && B && !B.eval(scope, declHit.guard)) return;
      current = to;
      if (declHit && B && target) {
        var child = B.scope ? B.scope(scope, { params: to.params }) : scope;
        B.swap(target, declHit.html, 'inner', child, actions);
      } else {
        var html = '';
        try {
          if (hit) html = hit.render(params, to) || '';
          else if (typeof opts.notfound === 'function') html = opts.notfound(to) || '';
          else html = declNotfound;
        } catch (e) {
          if (typeof console !== 'undefined') console.error('[laghu-router]', e);
          return;
        }
        if (B && target) B.swap(target, String(html), 'inner', scope, actions);
      }
      if (typeof opts.afterEach === 'function') {
        try { opts.afterEach(to, from); } catch (e) {}
      }
      for (var k = 0; k < afterEachFns.length; k++) {
        try { afterEachFns[k](to, from); } catch (e) {}
      }
    }
    function onHash() { render(); }
    if (typeof window !== 'undefined') window.addEventListener('hashchange', onHash);
    render();
    return function () {
      if (typeof window !== 'undefined') window.removeEventListener('hashchange', onHash);
    };
  }

  var api: LaghuRouterAPI = {
    version: '1.1.0',
    route: route,
    compile: compile,
    current: function () { return current; },
    navigate: function (path: string) {
      if (typeof location !== 'undefined') location.hash = '#' + path;
    },
    afterEach: function (fn: Function) { afterEachFns.push(fn); }
  };
  return api;
})();
