"use strict";
(() => {
  // src/router.ts
  var LaghuRouter = (() => {
    "use strict";
    let currentRoute = { path: "", params: {} };
    const globalAfterEachFns = [];
    function compile(pattern) {
      const paramNames = [];
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
      return (path) => {
        const match = path.match(regex);
        if (!match) return null;
        const params = {};
        for (let index = 0; index < paramNames.length; index++) {
          params[paramNames[index]] = decodeURIComponent(match[index + 1]);
        }
        return params;
      };
    }
    function extractTemplateHtml(templateElement) {
      const container = document.createElement("div");
      container.appendChild(templateElement.content.cloneNode(true));
      return container.innerHTML;
    }
    function harvestDeclarativeRoutes(hostElement) {
      const routes = [];
      let notfoundHtml = "";
      const templates = hostElement.querySelectorAll("template[data-route]");
      for (let index = 0; index < templates.length; index++) {
        const template = templates[index];
        routes.push({
          match: compile(template.getAttribute("data-route") || ""),
          guard: template.getAttribute("data-route-if") || "",
          html: extractTemplateHtml(template)
        });
      }
      const notfoundTemplate = hostElement.querySelector("template[data-route-notfound]");
      if (notfoundTemplate) {
        notfoundHtml = extractTemplateHtml(notfoundTemplate);
      }
      return { routes, notfoundHtml };
    }
    function resolveCurrentPath() {
      const rawHash = typeof window !== "undefined" ? window.location.hash : "";
      if (rawHash.length > 1) {
        return rawHash.slice(1);
      }
      return "/";
    }
    function safelyInvoke(fn, ...args) {
      try {
        fn(...args);
      } catch {
      }
    }
    function route(opts) {
      const options = opts || {};
      const targetSelector = options.target || "#view";
      const scope = options.scope || {};
      const actions = options.actions || {};
      const compiledRoutes = (options.routes || []).map((r) => ({
        match: compile(r.path),
        render: r.render
      }));
      let declarativeRoutes = [];
      let declarativeNotFoundHtml = "";
      const hostElement = typeof document !== "undefined" ? document.querySelector(targetSelector) : null;
      if (hostElement) {
        const harvested = harvestDeclarativeRoutes(hostElement);
        declarativeRoutes = harvested.routes;
        declarativeNotFoundHtml = harvested.notfoundHtml;
      }
      function render() {
        const pathOnly = resolveCurrentPath();
        const from = currentRoute;
        const laghuInstance = typeof window !== "undefined" && window.Laghu || null;
        const targetElement = typeof document !== "undefined" ? document.querySelector(targetSelector) : null;
        let declarativeHit = null;
        for (let index = 0; index < declarativeRoutes.length; index++) {
          const matched = declarativeRoutes[index].match(pathOnly);
          if (matched) {
            declarativeHit = {
              guard: declarativeRoutes[index].guard,
              html: declarativeRoutes[index].html,
              params: matched
            };
            break;
          }
        }
        let matchedParams = null;
        let matchedRoute = null;
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
      function onHash() {
        render();
      }
      if (typeof window !== "undefined") {
        window.addEventListener("hashchange", onHash);
      }
      render();
      return function stop() {
        if (typeof window !== "undefined") {
          window.removeEventListener("hashchange", onHash);
        }
      };
    }
    return {
      version: "1.1.0",
      route,
      compile,
      current() {
        return currentRoute;
      },
      navigate(path) {
        if (typeof window !== "undefined") {
          window.location.hash = `#${path}`;
        }
      },
      afterEach(fn) {
        globalAfterEachFns.push(fn);
      }
    };
  })();

  // src/router.global.ts
  window.LaghuRouter = LaghuRouter;
})();
