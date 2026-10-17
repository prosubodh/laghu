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
  render: (
    params: Record<string, string>,
    to: { path: string; params: Record<string, string> },
  ) => string;
}

export interface LaghuRouterOptions {
  target?: string;
  scope?: any;
  actions?: Record<string, Function>;
  routes?: LaghuRoute[];
  notfound?: (to: { path: string; params: Record<string, string> }) => string;
  beforeEach?: (
    to: { path: string; params: Record<string, string> },
    from: { path: string; params: Record<string, string> },
  ) => boolean | void;
  afterEach?: (
    to: { path: string; params: Record<string, string> },
    from: { path: string; params: Record<string, string> },
  ) => void;
}

export interface LaghuRouterAPI {
  version: string;
  route(opts?: LaghuRouterOptions): () => void;
  compile(pattern: string): (path: string) => Record<string, string> | null;
  current(): { path: string; params: Record<string, string> };
  navigate(path: string): void;
  afterEach(
    fn: (
      to: { path: string; params: Record<string, string> },
      from: { path: string; params: Record<string, string> },
    ) => void,
  ): void;
}

interface DeclarativeRoute {
  match: (path: string) => Record<string, string> | null;
  guard: string;
  html: string;
}

export const LaghuRouter: LaghuRouterAPI = (() => {
  "use strict";

  let currentRoute = { path: "", params: {} as Record<string, string> };
  const globalAfterEachFns: Array<Function> = [];

  /**
   * Compile "/user/:id" into a matcher. Static segments match
   * literally, :name captures one segment, * captures the rest.
   */
  function compile(pattern: string): (path: string) => Record<string, string> | null {
    const paramNames: string[] = [];
    const patternSegments = String(pattern || "").split("/");
    const regexSegments = patternSegments.map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      if (segment === "*") {
        paramNames.push("wild");
        return "(.*)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    const regex = new RegExp(`^${regexSegments.join("/")}$`);

    return (path: string): Record<string, string> | null => {
      const match = path.match(regex);
      if (!match) return null;
      const params: Record<string, string> = {};
      for (let index = 0; index < paramNames.length; index++) {
        params[paramNames[index]] = decodeURIComponent(match[index + 1]);
      }
      return params;
    };
  }

  /**
   * Clone template contents into a container element and extract serialized HTML.
   */
  function extractTemplateHtml(templateElement: Element): string {
    const container = document.createElement("div");
    container.appendChild((templateElement as HTMLTemplateElement).content.cloneNode(true));
    return container.innerHTML;
  }

  /**
   * Harvest declarative route and notfound templates from the host element.
   */
  function harvestDeclarativeRoutes(hostElement: Element): {
    routes: DeclarativeRoute[];
    notfoundHtml: string;
  } {
    const routes: DeclarativeRoute[] = [];
    let notfoundHtml = "";

    const templates = hostElement.querySelectorAll("template[data-route]");
    for (let index = 0; index < templates.length; index++) {
      const template = templates[index];
      routes.push({
        match: compile(template.getAttribute("data-route") || ""),
        guard: template.getAttribute("data-route-if") || "",
        html: extractTemplateHtml(template),
      });
    }

    const notfoundTemplate = hostElement.querySelector("template[data-route-notfound]");
    if (notfoundTemplate) {
      notfoundHtml = extractTemplateHtml(notfoundTemplate);
    }

    return { routes, notfoundHtml };
  }

  /**
   * Extract normalized path from location hash (defaults to "/").
   */
  function resolveCurrentPath(): string {
    const rawHash = typeof window !== "undefined" ? window.location.hash : "";
    if (rawHash.length > 1) {
      return rawHash.slice(1);
    }
    return "/";
  }

  /**
   * Safely invoke a callback, swallowing errors to prevent navigation collapse.
   */
  function safelyInvoke(fn: Function, ...args: any[]): void {
    try {
      fn(...args);
    } catch {
      // Ignored: afterEach errors must not crash navigation
    }
  }

  /**
   * Start routing. Returns a stop function that detaches the hash listener.
   */
  function route(opts?: LaghuRouterOptions): () => void {
    const options = opts || {};
    const targetSelector = options.target || "#view";
    const scope = options.scope || {};
    const actions = options.actions || {};
    const compiledRoutes = (options.routes || []).map((r) => ({
      match: compile(r.path),
      render: r.render,
    }));

    let declarativeRoutes: DeclarativeRoute[] = [];
    let declarativeNotFoundHtml = "";

    const hostElement = typeof document !== "undefined" ? document.querySelector(targetSelector) : null;
    if (hostElement) {
      const harvested = harvestDeclarativeRoutes(hostElement);
      declarativeRoutes = harvested.routes;
      declarativeNotFoundHtml = harvested.notfoundHtml;
    }

    function render(): void {
      const pathOnly = resolveCurrentPath();
      const from = currentRoute;
      const laghuInstance = (typeof window !== "undefined" && (window as any).Laghu) || null;
      const targetElement = typeof document !== "undefined" ? document.querySelector(targetSelector) : null;

      let declarativeHit: { guard: string; html: string; params: Record<string, string> } | null = null;
      for (let index = 0; index < declarativeRoutes.length; index++) {
        const matched = declarativeRoutes[index].match(pathOnly);
        if (matched) {
          declarativeHit = {
            guard: declarativeRoutes[index].guard,
            html: declarativeRoutes[index].html,
            params: matched,
          };
          break;
        }
      }

      let matchedParams: Record<string, string> | null = null;
      let matchedRoute: { match: Function; render: Function } | null = null;

      if (!declarativeHit) {
        for (let index = 0; index < compiledRoutes.length; index++) {
          matchedParams = compiledRoutes[index].match(pathOnly);
          if (matchedParams) {
            matchedRoute = compiledRoutes[index];
            break;
          }
        }
      } else {
        matchedParams = declarativeHit.params;
      }

      const to = { path: pathOnly, params: matchedParams || {} };

      if (typeof options.beforeEach === "function" && options.beforeEach(to, from) === false) {
        return;
      }

      if (declarativeHit && declarativeHit.guard && laghuInstance && !laghuInstance.eval(scope, declarativeHit.guard)) {
        return;
      }

      currentRoute = to;

      if (declarativeHit && laghuInstance && targetElement) {
        const childScope = laghuInstance.scope ? laghuInstance.scope(scope, { params: to.params }) : scope;
        laghuInstance.swap(targetElement, declarativeHit.html, "inner", childScope, actions);
      } else {
        let html = "";
        try {
          if (matchedRoute) {
            html = matchedRoute.render(matchedParams, to) || "";
          } else if (typeof options.notfound === "function") {
            html = options.notfound(to) || "";
          } else {
            html = declarativeNotFoundHtml;
          }
        } catch (error) {
          console.error("[laghu-router]", error);
          return;
        }
        if (laghuInstance && targetElement) {
          laghuInstance.swap(targetElement, String(html), "inner", scope, actions);
        }
      }

      if (typeof options.afterEach === "function") {
        safelyInvoke(options.afterEach, to, from);
      }
      for (let index = 0; index < globalAfterEachFns.length; index++) {
        safelyInvoke(globalAfterEachFns[index], to, from);
      }
    }

    function onHash(): void {
      render();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", onHash);
    }
    render();

    return function stop(): void {
      if (typeof window !== "undefined") {
        window.removeEventListener("hashchange", onHash);
      }
    };
  }

  return {
    version: "1.1.0",
    route,
    compile,
    current(): { path: string; params: Record<string, string> } {
      return currentRoute;
    },
    navigate(path: string): void {
      if (typeof window !== "undefined") {
        window.location.hash = `#${path}`;
      }
    },
    afterEach(fn: Function): void {
      globalAfterEachFns.push(fn);
    },
  };
})();

