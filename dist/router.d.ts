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
    render: (params: Record<string, string>, to: {
        path: string;
        params: Record<string, string>;
    }) => string;
}
export interface LaghuRouterOptions {
    target?: string;
    scope?: any;
    actions?: Record<string, Function>;
    routes?: LaghuRoute[];
    notfound?: (to: {
        path: string;
        params: Record<string, string>;
    }) => string;
    beforeEach?: (to: {
        path: string;
        params: Record<string, string>;
    }, from: {
        path: string;
        params: Record<string, string>;
    }) => boolean | void;
    afterEach?: (to: {
        path: string;
        params: Record<string, string>;
    }, from: {
        path: string;
        params: Record<string, string>;
    }) => void;
}
export interface LaghuRouterAPI {
    version: string;
    route(opts: LaghuRouterOptions): () => void;
    compile(pattern: string): (path: string) => Record<string, string> | null;
    current(): {
        path: string;
        params: Record<string, string>;
    };
    navigate(path: string): void;
    afterEach(fn: (to: {
        path: string;
        params: Record<string, string>;
    }, from: {
        path: string;
        params: Record<string, string>;
    }) => void): void;
}
declare global {
    interface Window {
        LaghuRouter?: LaghuRouterAPI;
    }
}
export declare const LaghuRouter: LaghuRouterAPI;
