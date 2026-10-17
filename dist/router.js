"use strict";
(() => {
  // src/router.ts
  var LaghuRouter = (() => {
    "use strict";
    var current = { path: "", params: {} };
    var afterEachFns = [];
    function compile(pattern) {
      var names = [];
      var src = String(pattern).split("/").map(function(seg) {
        if (seg.charAt(0) === ":") {
          names.push(seg.slice(1));
          return "([^/]+)";
        }
        if (seg === "*") {
          names.push("wild");
          return "(.*)";
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("/");
      var re = new RegExp("^" + src + "$");
      return function(path) {
        var m = path.match(re);
        if (!m) return null;
        var out = {};
        for (var i = 0; i < names.length; i++) out[names[i]] = decodeURIComponent(m[i + 1] || "");
        return out;
      };
    }
    function route(opts) {
      opts = opts || {};
      var targetSel = opts.target || "#view";
      var scope = opts.scope || {};
      var actions = opts.actions || {};
      var compiled = (opts.routes || []).map(function(r) {
        return { match: compile(r.path), render: r.render };
      });
      function tplHtml(tpl) {
        var holder = document.createElement("div");
        holder.appendChild(tpl.content.cloneNode(true));
        return holder.innerHTML;
      }
      var declRoutes = [];
      var declNotfound = "";
      if (typeof document !== "undefined") {
        var host = document.querySelector(targetSel);
        if (host) {
          Array.prototype.forEach.call(host.querySelectorAll("template[data-route]"), function(tpl) {
            declRoutes.push({
              match: compile(tpl.getAttribute("data-route") || ""),
              guard: tpl.getAttribute("data-route-if") || "",
              html: tplHtml(tpl)
            });
          });
          var nf = host.querySelector("template[data-route-notfound]");
          if (nf) declNotfound = tplHtml(nf);
        }
      }
      function render() {
        var hash = typeof location !== "undefined" && location.hash || "#/";
        var pathOnly = hash.charAt(0) === "#" ? hash.slice(1) : hash;
        if (!pathOnly) pathOnly = "/";
        var from = current;
        var B = typeof window !== "undefined" && window.Laghu || null;
        var target = typeof document !== "undefined" ? document.querySelector(targetSel) : null;
        var declHit = null;
        for (var d = 0; d < declRoutes.length; d++) {
          var pm = declRoutes[d].match(pathOnly);
          if (pm) {
            declHit = { guard: declRoutes[d].guard, html: declRoutes[d].html, params: pm };
            break;
          }
        }
        var i, params = null, hit = null;
        if (!declHit) {
          for (i = 0; i < compiled.length; i++) {
            params = compiled[i].match(pathOnly);
            if (params) {
              hit = compiled[i];
              break;
            }
          }
        } else {
          params = declHit.params;
        }
        var to = { path: pathOnly, params: params || {} };
        if (typeof opts.beforeEach === "function" && opts.beforeEach(to, from) === false) return;
        if (declHit && declHit.guard && B && !B.eval(scope, declHit.guard)) return;
        current = to;
        if (declHit && B && target) {
          var child = B.scope ? B.scope(scope, { params: to.params }) : scope;
          B.swap(target, declHit.html, "inner", child, actions);
        } else {
          var html = "";
          try {
            if (hit) html = hit.render(params, to) || "";
            else if (typeof opts.notfound === "function") html = opts.notfound(to) || "";
            else html = declNotfound;
          } catch (e) {
            if (typeof console !== "undefined") console.error("[laghu-router]", e);
            return;
          }
          if (B && target) B.swap(target, String(html), "inner", scope, actions);
        }
        if (typeof opts.afterEach === "function") {
          try {
            opts.afterEach(to, from);
          } catch (e) {
          }
        }
        for (var k = 0; k < afterEachFns.length; k++) {
          try {
            afterEachFns[k](to, from);
          } catch (e) {
          }
        }
      }
      function onHash() {
        render();
      }
      if (typeof window !== "undefined") window.addEventListener("hashchange", onHash);
      render();
      return function() {
        if (typeof window !== "undefined") window.removeEventListener("hashchange", onHash);
      };
    }
    var api = {
      version: "1.1.0",
      route,
      compile,
      current: function() {
        return current;
      },
      navigate: function(path) {
        if (typeof location !== "undefined") location.hash = "#" + path;
      },
      afterEach: function(fn) {
        afterEachFns.push(fn);
      }
    };
    return api;
  })();

  // src/router.global.ts
  window.LaghuRouter = LaghuRouter;
})();
