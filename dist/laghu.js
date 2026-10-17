"use strict";
(() => {
  // src/laghu.ts
  var Laghu = (() => {
    "use strict";
    var VERSION = "1.1.0";
    var DEV = typeof window !== "undefined" && window.__LAGHU_DEV__ === true;
    var stores = /* @__PURE__ */ new Map();
    var directives = /* @__PURE__ */ new Map();
    var targetMap = /* @__PURE__ */ new WeakMap();
    var proxyCache = /* @__PURE__ */ new WeakMap();
    var proxySet = /* @__PURE__ */ new WeakSet();
    var activeEffect = null;
    var jobQueue = /* @__PURE__ */ new Set();
    var flushing = false;
    var URL_ATTRS = { href: 1, src: 1, action: 1, formaction: 1, cite: 1, poster: 1, data: 1, srcset: 1, srcdoc: 1 };
    function badSeg(seg) {
      return seg === "__proto__" || seg === "constructor" || seg === "prototype";
    }
    function unsafeUrl(v) {
      var s = String(v).replace(/[\s\x00-\x1f]+/g, "").toLowerCase();
      return s.indexOf("javascript:") === 0 || s.indexOf("data:text/html") === 0 || s.indexOf("vbscript:") === 0;
    }
    function defaultSanitize(html) {
      var s = String(html);
      s = s.replace(/<script[\s\S]*?(<\/script\s*>|$)/gi, "");
      s = s.replace(/<\/?(iframe|object|embed|link|meta|base)[^>]*>/gi, "");
      s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      s = s.replace(/(href|src|xlink:href|action|formaction|poster|data)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, function(m, a, q, d1, d2, d3) {
        var v = d1 !== void 0 ? d1 : d2 !== void 0 ? d2 : d3;
        if (unsafeUrl(v)) return a + '="#"';
        return m;
      });
      return s;
    }
    var sanitize = defaultSanitize;
    function reportError(err) {
      try {
        if (typeof document !== "undefined" && document.dispatchEvent) {
          document.dispatchEvent(new CustomEvent("laghu:error", {
            detail: { error: String(err && err.message || err), version: VERSION }
          }));
        }
      } catch (e) {
      }
      if (DEV && typeof console !== "undefined") console.error("[laghu]", err);
    }
    function flush() {
      flushing = false;
      var jobs = Array.from(jobQueue);
      jobQueue.clear();
      for (var i = 0; i < jobs.length; i++) {
        try {
          jobs[i]();
        } catch (e) {
          reportError(e);
        }
      }
    }
    function schedule(fn) {
      jobQueue.add(fn);
      if (!flushing) {
        flushing = true;
        Promise.resolve().then(flush);
      }
    }
    var effectStack = [];
    var runDeps = /* @__PURE__ */ new WeakMap();
    function effect(fn) {
      var stopped = false;
      var deps = [];
      var run = function() {
        if (stopped) return;
        for (var i = 0; i < deps.length; i++) deps[i].delete(run);
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
      return function() {
        stopped = true;
        for (var i = 0; i < deps.length; i++) deps[i].delete(run);
        deps.length = 0;
      };
    }
    function track(t, k) {
      if (!activeEffect) return;
      var m = targetMap.get(t);
      if (!m) {
        m = /* @__PURE__ */ new Map();
        targetMap.set(t, m);
      }
      var s = m.get(k);
      if (!s) {
        s = /* @__PURE__ */ new Set();
        m.set(k, s);
      }
      s.add(activeEffect);
      var arr = runDeps.get(activeEffect);
      if (arr) arr.push(s);
    }
    function trigger(t, k) {
      var m = targetMap.get(t);
      if (!m) return;
      var s = m.get(k);
      if (!s) return;
      s.forEach(function(fn) {
        schedule(fn);
      });
    }
    function isObj(v) {
      return v !== null && typeof v === "object";
    }
    function hasKey(o, k) {
      return !!o && k in o;
    }
    function childScope(scope, vars) {
      var o = Object.create(scope);
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) {
          Object.defineProperty(o, k, {
            value: vars[k],
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return o;
    }
    function getPath(scope, path) {
      if (!path) return void 0;
      var parts = String(path).split(".");
      var head = parts[0].trim();
      if (badSeg(head)) return void 0;
      if (head === "$store") {
        var sn = parts[1];
        var st = stores.get(sn);
        if (!st) return void 0;
        var cur2 = st;
        for (var k = 2; k < parts.length; k++) {
          if (badSeg(parts[k])) return void 0;
          if (!isObj(cur2)) return void 0;
          cur2 = cur2[parts[k]];
        }
        return cur2;
      }
      if (!(head in Object(scope))) {
        if (typeof head === "string" && isObj(scope)) track(scope, head);
        return void 0;
      }
      var cur = scope[head];
      for (var i = 1; i < parts.length; i++) {
        if (badSeg(parts[i])) return void 0;
        if (!isObj(cur) && typeof cur !== "function") return void 0;
        cur = cur[parts[i]];
      }
      return cur;
    }
    function setPath(scope, path, val) {
      var parts = String(path).split(".");
      for (var g = 0; g < parts.length; g++) {
        if (badSeg(parts[g].trim())) {
          if (DEV && typeof console !== "undefined") console.warn('[laghu] blocked unsafe path "' + path + '"');
          return;
        }
      }
      if (parts[0].trim() === "$store") {
        var st = stores.get(parts[1]);
        if (!st) return;
        var c2 = st;
        for (var k = 2; k < parts.length - 1; k++) {
          if (!isObj(c2[parts[k]])) c2[parts[k]] = {};
          c2 = c2[parts[k]];
        }
        c2[parts[parts.length - 1]] = val;
        return;
      }
      var base = scope;
      var node = scope;
      while (node && node !== Object.prototype) {
        if (Object.prototype.hasOwnProperty.call(node, parts[0])) {
          base = node;
          break;
        }
        node = Object.getPrototypeOf(node);
      }
      var cur = base;
      for (var i = 0; i < parts.length - 1; i++) {
        var key = parts[i];
        if (!isObj(cur[key])) cur[key] = {};
        cur = cur[key];
      }
      cur[parts[parts.length - 1]] = val;
    }
    function reactive(obj) {
      if (!isObj(obj)) return obj;
      if (proxySet.has(obj)) return obj;
      var hit = proxyCache.get(obj);
      if (hit) return hit;
      var proxy = new Proxy(obj, {
        get: function(t, p, r) {
          if (typeof p === "string") track(t, p);
          var v = Reflect.get(t, p, r);
          return isObj(v) ? reactive(v) : v;
        },
        set: function(t, p, v) {
          var old = t[p];
          var ok = Reflect.set(t, p, v);
          if (old !== v && typeof p === "string") {
            trigger(t, p);
            var px = proxyCache.get(t);
            if (px) trigger(px, p);
          }
          return ok;
        },
        deleteProperty: function(t, p) {
          var ok = Reflect.deleteProperty(t, p);
          if (typeof p === "string") {
            trigger(t, p);
            var px = proxyCache.get(t);
            if (px) trigger(px, p);
          }
          return ok;
        }
      });
      proxyCache.set(obj, proxy);
      proxySet.add(proxy);
      return proxy;
    }
    function splitTop(s, op) {
      var out = [];
      var depth = 0;
      var q = null;
      var cur = "";
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (q) {
          cur += c;
          if (c === q && s[i - 1] !== "\\") q = null;
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          cur += c;
          continue;
        }
        if (c === "(" || c === "[") depth++;
        if (c === ")" || c === "]") depth--;
        if (depth === 0 && s.slice(i, i + op.length) === op) {
          out.push(cur);
          cur = "";
          i += op.length - 1;
          continue;
        }
        cur += c;
      }
      out.push(cur);
      return out;
    }
    function lastTopOp(s, chars) {
      var depth = 0, q = null;
      for (var i = s.length - 1; i > 0; i--) {
        var c = s[i];
        if (q) {
          if (c === q && s[i - 1] !== "\\") q = null;
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          continue;
        }
        if (c === ")") depth++;
        if (c === "(") depth--;
        if (depth === 0 && chars.indexOf(c) >= 0) return i;
      }
      return -1;
    }
    function splitTernary(s) {
      var depth = 0, q = null, qi = -1;
      var i;
      for (i = 0; i < s.length; i++) {
        var c = s[i];
        if (q) {
          if (c === q && s[i - 1] !== "\\") q = null;
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          continue;
        }
        if (c === "(" || c === "[") depth++;
        if (c === ")" || c === "]") depth--;
        if (c === "?" && depth === 0) {
          qi = i;
          break;
        }
      }
      if (qi < 0) return null;
      depth = 0;
      q = null;
      for (i = qi + 1; i < s.length; i++) {
        var d = s[i];
        if (q) {
          if (d === q && s[i - 1] !== "\\") q = null;
          continue;
        }
        if (d === '"' || d === "'") {
          q = d;
          continue;
        }
        if (d === "(" || d === "[") depth++;
        if (d === ")" || d === "]") depth--;
        if (d === ":" && depth === 0) return [s.slice(0, qi), s.slice(qi + 1, i), s.slice(i + 1)];
      }
      return null;
    }
    function evalExpr(scope, expr) {
      var s = String(expr).trim();
      if (!s) return void 0;
      var direct = getPath(scope, s);
      if (direct !== void 0) return direct;
      var ter0 = splitTernary(s);
      if (ter0) return evalExpr(scope, ter0[0]) ? evalExpr(scope, ter0[1]) : evalExpr(scope, ter0[2]);
      var or = splitTop(s, "||");
      if (or.length > 1) {
        var r;
        for (var i = 0; i < or.length; i++) {
          r = evalExpr(scope, or[i]);
          if (r) return r;
        }
        return r;
      }
      var and = splitTop(s, "&&");
      if (and.length > 1) {
        var rr;
        for (var j = 0; j < and.length; j++) {
          rr = evalExpr(scope, and[j]);
          if (!rr) return rr;
        }
        return rr;
      }
      var m = s.match(/^(.*?)(===|!==|>=|<=|==|!=|>|<)(.*)$/);
      if (m) {
        var L = evalExpr(scope, m[1]);
        var R = evalExpr(scope, m[3]);
        var op = m[2];
        if (op === ">") return L > R;
        if (op === "<") return L < R;
        if (op === ">=") return L >= R;
        if (op === "<=") return L <= R;
        if (op === "==") return L == R;
        if (op === "!=") return L != R;
        if (op === "===") return L === R;
        return L !== R;
      }
      var ai = lastTopOp(s, "+-");
      if (ai > 0 && s.slice(0, ai).trim() && s.slice(ai + 1).trim()) {
        var lop = s[ai];
        var la = evalExpr(scope, s.slice(0, ai));
        var ra = evalExpr(scope, s.slice(ai + 1));
        return lop === "+" ? la + ra : la - ra;
      }
      var mi = lastTopOp(s, "*/%");
      if (mi > 0 && s.slice(0, mi).trim() && s.slice(mi + 1).trim()) {
        var mop = s[mi];
        var lm = evalExpr(scope, s.slice(0, mi));
        var rm = evalExpr(scope, s.slice(mi + 1));
        if (mop === "*") return lm * rm;
        if (mop === "/") return lm / rm;
        return lm % rm;
      }
      if (s[0] === "!") return !evalExpr(scope, s.slice(1));
      if (s[0] === "-") return -evalExpr(scope, s.slice(1));
      if (s[0] === "(") {
        var gd = 0, gq = null, gm = -1, gi;
        for (gi = 0; gi < s.length; gi++) {
          var gc = s[gi];
          if (gq) {
            if (gc === gq && s[gi - 1] !== "\\") gq = null;
            continue;
          }
          if (gc === '"' || gc === "'") {
            gq = gc;
            continue;
          }
          if (gc === "(") gd++;
          if (gc === ")") {
            gd--;
            if (gd === 0) {
              gm = gi;
              break;
            }
          }
        }
        if (gm === s.length - 1) return evalExpr(scope, s.slice(1, -1));
      }
      if (s[0] === '"' && s[s.length - 1] === '"' || s[0] === "'" && s[s.length - 1] === "'") return s.slice(1, -1);
      if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
      if (s === "true") return true;
      if (s === "false") return false;
      if (s === "null") return null;
      if (s === "undefined") return void 0;
      if (s.charAt(s.length - 1) === ")") {
        var op2 = s.indexOf("(");
        if (op2 > 0) {
          var depth = 0, qq = null, match = -1, k;
          for (k = op2; k < s.length; k++) {
            var ch = s[k];
            if (qq) {
              if (ch === qq && s[k - 1] !== "\\") qq = null;
              continue;
            }
            if (ch === '"' || ch === "'") {
              qq = ch;
              continue;
            }
            if (ch === "(") depth++;
            if (ch === ")") {
              depth--;
              if (depth === 0) {
                match = k;
                break;
              }
            }
          }
          if (match === s.length - 1) {
            var cname = s.slice(0, op2);
            if (/^[\w.$]+$/.test(cname)) {
              var fn = getPath(scope, cname);
              if (typeof fn === "function") {
                var raw = s.slice(op2 + 1, match).trim();
                var args = raw ? splitTop(raw, ",").map(function(a) {
                  return evalExpr(scope, a);
                }) : [];
                return fn.apply(scope, args);
              }
              if (DEV && typeof console !== "undefined") console.warn('[laghu] unknown method "' + s + '"');
              return void 0;
            }
          }
        }
      }
      var br = s.match(/^(.*)\[(\d+|"(?:[^"]*)"|'(?:[^']*)')\]$/);
      if (br && br[1]) {
        var base = evalExpr(scope, br[1]);
        if (base === null || base === void 0) return void 0;
        var key = br[2];
        if (key[0] === '"' || key[0] === "'") key = key.slice(1, -1);
        else key = Number(key);
        if (typeof key === "string" && badSeg(key)) return void 0;
        return base[key];
      }
      return getPath(scope, s);
    }
    function execAction(scope, actions, code) {
      var s = String(code).trim();
      if (!s) return;
      var inc = s.match(/^([\w.$]+)\+\+$/);
      if (inc) {
        setPath(scope, inc[1], Number(evalExpr(scope, inc[1]) || 0) + 1);
        return;
      }
      var dec = s.match(/^([\w.$]+)--$/);
      if (dec) {
        setPath(scope, dec[1], Number(evalExpr(scope, dec[1]) || 0) - 1);
        return;
      }
      var asg = s.match(/^([\w.$]+)\s*=\s*(.+)$/);
      if (asg && !/^(==|===|!=|!==|>=|<=)/.test(s.slice(asg[1].length))) {
        setPath(scope, asg[1], evalExpr(scope, asg[2]));
        return;
      }
      var name = s.replace(/\(\)$/, "");
      var fn = actions[name] || getPath(scope, name);
      if (typeof fn === "function") {
        fn.call(scope);
        return;
      }
      if (/^[A-Za-z_$][\w.$-]*$/.test(s)) {
        unknownAction(s);
        return;
      }
      var v = evalExpr(scope, s);
      if (typeof v === "function") v.call(scope);
      else if (v === void 0) unknownAction(s);
    }
    function unknownAction(s) {
      if (DEV && typeof console !== "undefined") console.warn('[laghu] unknown action "' + s + '"');
      if (typeof CustomEvent !== "undefined" && typeof document !== "undefined" && document.dispatchEvent) {
        document.dispatchEvent(new CustomEvent("laghu:unknown-action", { detail: { name: s } }));
      }
    }
    function onCleanup(el, fn) {
      var list = el._bcu;
      if (!list) {
        list = [];
        el._bcu = list;
      }
      list.push(fn);
    }
    function eachEl(root, sel, fn) {
      if (root instanceof Element && root.matches) {
        try {
          if (root.matches(sel)) fn(root);
        } catch (e) {
        }
      }
      Array.prototype.forEach.call(root.querySelectorAll(sel), fn);
    }
    function allEls(root) {
      var out = [];
      if (root instanceof Element) out.push(root);
      Array.prototype.forEach.call(root.querySelectorAll("*"), function(n) {
        out.push(n);
      });
      return out;
    }
    function transFrames(kind, out) {
      var from = kind.indexOf("slide") >= 0 ? "translateY(-8px)" : kind.indexOf("scale") >= 0 ? "scale(.96)" : "none";
      var a = { opacity: "0", transform: from };
      var b = { opacity: "1", transform: "none" };
      return out ? [b, a] : [a, b];
    }
    function transDur(el) {
      return parseMs(el.getAttribute("data-duration") || "150ms") || 150;
    }
    function setHidden(el, hide) {
      hide = !!hide;
      if (!!el.hidden === hide) return;
      var seen = el._bT;
      if (seen === void 0) {
        el._bT = 0;
        el.hidden = hide;
        return;
      }
      var kind = el.getAttribute && el.getAttribute("data-transition") || "";
      var reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!kind || kind === "none" || reduce || typeof el.animate !== "function") {
        el.hidden = hide;
        return;
      }
      var dur = transDur(el);
      var tk = el._bT = (el._bT || 0) + 1;
      el._bHide = hide;
      if (!hide) {
        el.hidden = false;
        try {
          var a = el.animate(transFrames(kind, false), { duration: dur, easing: "ease-out" });
          if (a && a.finished && a.finished.catch) a.finished.catch(function() {
          });
        } catch (e) {
        }
      } else {
        try {
          var a2 = el.animate(transFrames(kind, true), { duration: dur, easing: "ease-in" });
          var done = function() {
            if (el._bT === tk && el._bHide && el.isConnected) el.hidden = true;
          };
          if (a2 && a2.finished && a2.finished.then) a2.finished.then(done, done);
          else setTimeout(done, dur);
        } catch (e) {
          el.hidden = true;
        }
      }
    }
    function playEnter(root) {
      eachEl(root, "[data-transition]", function(node) {
        var el = node;
        if (el.hidden) return;
        var kind = el.getAttribute("data-transition") || "";
        if (!kind || kind === "none") return;
        if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (typeof el.animate !== "function") return;
        var dur = transDur(el);
        try {
          var a = el.animate(transFrames(kind, false), { duration: dur, easing: "ease-out" });
          if (a && a.finished && a.finished.catch) a.finished.catch(function() {
          });
        } catch (e) {
        }
      });
    }
    function claimed(el, key) {
      var host = el;
      var map = host._bH || (host._bH = {});
      if (map[key]) return true;
      map[key] = 1;
      return false;
    }
    function destroyTree(root) {
      if (root._bcu) {
        root._bcu.forEach(function(fn) {
          try {
            fn();
          } catch (e) {
          }
        });
        root._bcu = [];
      }
      root._bH = void 0;
      var kids = root.querySelectorAll ? root.querySelectorAll("*") : [];
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c._bcu) {
          c._bcu.forEach(function(fn) {
            try {
              fn();
            } catch (e) {
            }
          });
          c._bcu = [];
        }
        c._bH = void 0;
        if (c._bReq) {
          try {
            c._bReq.abort();
          } catch (e) {
          }
          c._bReq = null;
        }
      }
      var self = root;
      if (self._bReq) {
        try {
          self._bReq.abort();
        } catch (e) {
        }
        self._bReq = null;
      }
    }
    function parseScope(raw) {
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch (e) {
        if (DEV && typeof console !== "undefined") console.warn("[laghu] data-scope must be JSON. Got: " + raw);
        return {};
      }
    }
    function coerceAttr(raw, cur) {
      if (raw === null || raw === void 0) return cur;
      if (typeof cur === "boolean") return raw !== "false" && raw !== "0";
      if (typeof cur === "number") {
        var n = Number(raw);
        return isNaN(n) ? cur : n;
      }
      if (raw === "true") return true;
      if (raw === "false") return false;
      if (raw !== "" && !isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw);
      return raw;
    }
    function parseMs(s) {
      var m = String(s).trim().match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
      if (!m) return 0;
      var n = parseFloat(m[1]);
      return m[2] === "s" ? n * 1e3 : n;
    }
    function defaultEvent(el) {
      var t = el.tagName;
      if (t === "FORM") return "submit";
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return "change";
      return "click";
    }
    function parseTrigger(spec, el) {
      var out = { on: "", delay: 0, throttle: 0, once: false, changed: false, queue: "last", from: "", every: 0, load: false, revealed: false };
      var s = String(spec || "").trim();
      if (!s) {
        out.on = defaultEvent(el);
        return out;
      }
      var m;
      m = s.match(/every\s+(\d+(?:\.\d+)?(?:ms|s)?)/);
      if (m) {
        out.every = parseMs(m[1]);
        s = s.replace(m[0], " ");
      }
      m = s.match(/delay:(\S+)/);
      if (m) {
        out.delay = parseMs(m[1]);
        s = s.replace(m[0], " ");
      }
      m = s.match(/throttle:(\S+)/);
      if (m) {
        out.throttle = parseMs(m[1]);
        s = s.replace(m[0], " ");
      }
      m = s.match(/queue:(first|last|all|none)/);
      if (m) {
        out.queue = m[1];
        s = s.replace(m[0], " ");
      }
      m = s.match(/from:(\S+)/);
      if (m) {
        out.from = m[1];
        s = s.replace(m[0], " ");
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
      var ev = s.trim().split(/\s+/).filter(Boolean)[0] || "";
      out.on = ev || defaultEvent(el);
      return out;
    }
    function bindTrigger(el, spec, fn) {
      var t = parseTrigger(spec, el);
      var state = { timer: 0, lastFire: 0, lastVal: null, done: false };
      var fire = function(e) {
        if (state.done) return;
        var input = el;
        if (t.changed && (hasKey(input, "value") || hasKey(input, "checked"))) {
          var v = input.type === "checkbox" || input.type === "radio" ? String(input.checked) + ":" + String(input.value) : String(input.value);
          if (v === state.lastVal) return;
          state.lastVal = v;
        }
        var now = Date.now();
        if (t.throttle && now - state.lastFire < t.throttle) return;
        var run = function() {
          state.lastFire = Date.now();
          fn(e);
          if (t.once) {
            state.done = true;
            cleanup();
          }
        };
        if (t.delay) {
          clearTimeout(state.timer);
          state.timer = /** @type {any} */
          setTimeout(run, t.delay);
        } else run();
      };
      var cleanups = [];
      var cleanup = function() {
        for (var ci = 0; ci < cleanups.length; ci++) {
          try {
            cleanups[ci]();
          } catch (e) {
          }
        }
        clearTimeout(state.timer);
      };
      var listenOn = el;
      if (t.from === "document" && typeof document !== "undefined") listenOn = document;
      else if (t.from === "body" && typeof document !== "undefined") listenOn = document.body;
      else if (t.from && typeof document !== "undefined") {
        var root = document;
        var h = function(e) {
          var tgt = e.target;
          if (tgt && tgt.closest && tgt.closest(t.from)) fire(e);
        };
        root.addEventListener(t.on, h);
        cleanups.push(function() {
          root.removeEventListener(t.on, h);
        });
        onCleanup(el, cleanup);
        return cleanup;
      }
      if (t.every) {
        var id = setInterval(function() {
          fire(new CustomEvent("laghu:poll"));
        }, t.every);
        cleanups.push(function() {
          clearInterval(id);
        });
      }
      if (t.load) {
        if (typeof document !== "undefined" && document.readyState === "loading") {
          var lh = function() {
            fire(new CustomEvent("laghu:load"));
          };
          document.addEventListener("DOMContentLoaded", lh, { once: true });
          cleanups.push(function() {
            document.removeEventListener("DOMContentLoaded", lh);
          });
        } else {
          var runNow = function() {
            fire(new CustomEvent("laghu:load"));
          };
          if (typeof queueMicrotask !== "undefined") queueMicrotask(runNow);
          else setTimeout(runNow, 0);
        }
      }
      if (t.revealed) {
        if (typeof IntersectionObserver !== "undefined") {
          var io = new IntersectionObserver(function(es) {
            es.forEach(function(en) {
              if (en.isIntersecting) {
                fire(new CustomEvent("laghu:revealed"));
                if (t.once) io.disconnect();
              }
            });
          });
          io.observe(el);
          cleanups.push(function() {
            io.disconnect();
          });
        } else {
          fire(new CustomEvent("laghu:revealed"));
        }
      }
      listenOn.addEventListener(t.on, fire);
      cleanups.push(function() {
        listenOn.removeEventListener(t.on, fire);
      });
      onCleanup(el, cleanup);
      return cleanup;
    }
    var filters = /* @__PURE__ */ new Map();
    function numArg(a) {
      var n = Number(a);
      return isNaN(n) ? 0 : n;
    }
    function strArg(a) {
      var s = String(a == null ? "" : a);
      if (s.length > 1 && (s[0] === '"' && s[s.length - 1] === '"' || s[0] === "'" && s[s.length - 1] === "'")) {
        return s.slice(1, -1);
      }
      return s;
    }
    [
      ["uppercase", function(v) {
        return String(v ?? "").toUpperCase();
      }],
      ["lowercase", function(v) {
        return String(v ?? "").toLowerCase();
      }],
      ["json", function(v) {
        try {
          return JSON.stringify(v);
        } catch (e) {
          return String(v);
        }
      }],
      ["fixed", function(v, a) {
        var n = Number(v);
        return isNaN(n) ? String(v ?? "") : n.toFixed(numArg(strArg(a)));
      }],
      ["currency", function(v, a) {
        var n = Number(v);
        var c = strArg(a) || "$";
        return isNaN(n) ? String(v ?? "") : c + n.toFixed(2);
      }],
      ["date", function(v, a) {
        var d = new Date(v);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(strArg(a) || void 0);
      }],
      ["default", function(v, a) {
        return v === null || v === void 0 || v === "" ? strArg(a) : v;
      }],
      ["join", function(v, a) {
        return Array.isArray(v) ? v.join(a === "" ? ", " : strArg(a)) : v;
      }],
      ["length", function(v) {
        return v == null ? 0 : v.length === void 0 ? 0 : v.length;
      }]
    ].forEach(function(p) {
      filters.set(p[0], p[1]);
    });
    function splitFilters(s) {
      var depth = 0, q = null, cur = "", parts = [];
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (q) {
          cur += c;
          if (c === q && s[i - 1] !== "\\") q = null;
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          cur += c;
          continue;
        }
        if (c === "(" || c === "[") depth++;
        if (c === ")" || c === "]") depth--;
        if (c === "|" && depth === 0) {
          if (s[i + 1] === "|") {
            cur += "||";
            i++;
            continue;
          }
          parts.push(cur);
          cur = "";
          continue;
        }
        cur += c;
      }
      parts.push(cur);
      var expr = parts.shift() || "";
      var filtersOut = parts.map(function(p) {
        var ci = p.indexOf(":");
        if (ci < 0) return [p.trim(), ""];
        return [p.slice(0, ci).trim(), p.slice(ci + 1).trim()];
      });
      return [expr, filtersOut];
    }
    function filterValue(scope, expr, chain) {
      var v = evalExpr(scope, expr);
      for (var i = 0; i < chain.length; i++) {
        var fn = filters.get(chain[i][0]);
        if (typeof fn !== "function") {
          if (DEV && typeof console !== "undefined") console.warn('[laghu] unknown filter "' + chain[i][0] + '"');
          continue;
        }
        try {
          v = fn(v, chain[i][1], scope);
        } catch (e) {
          reportError(e);
          return v;
        }
      }
      return v;
    }
    function hydrate(root, state, actions) {
      actions = actions || {};
      var scope = state;
      try {
        if (isObj(scope) && !("$error" in Object(scope))) setPath(scope, "$error", null);
      } catch (e) {
      }
      if (root instanceof Element && root.hasAttribute && root.hasAttribute("data-scope") && !root._bScope) {
        root._bScope = scope;
      }
      eachEl(root, "[data-bind],[data-text]", function(node) {
        var el = node;
        if (claimed(el, "bind")) return;
        var path = el.getAttribute("data-bind") || el.getAttribute("data-text") || "";
        var split = splitFilters(path);
        var stop = effect(function() {
          el.textContent = String(filterValue(scope, split[0], split[1]) ?? "");
        });
        onCleanup(el, stop);
      });
      eachEl(root, "[data-html]", function(node) {
        var el = node;
        if (claimed(el, "html")) return;
        var path = el.getAttribute("data-html") || "";
        var stop = effect(function() {
          el.innerHTML = sanitize(String(evalExpr(scope, path) ?? ""));
        });
        onCleanup(el, stop);
      });
      Array.prototype.forEach.call(allEls(root), function(node) {
        var el = node;
        Array.prototype.forEach.call(el.attributes || [], function(a) {
          var an = a.name;
          if (an.indexOf("data-bind:") === 0) {
            if (claimed(el, "a:" + an)) return;
            var attr = an.slice("data-bind:".length);
            var expr = a.value;
            var stop = effect(function() {
              var v = evalExpr(scope, expr);
              if (v === false || v === null || v === void 0) el.removeAttribute(attr);
              else if (URL_ATTRS[attr.toLowerCase()] && unsafeUrl(v)) {
                el.removeAttribute(attr);
                if (DEV && typeof console !== "undefined") console.warn('[laghu] blocked scriptable URL for "' + attr + '"');
              } else el.setAttribute(attr, String(v));
            });
            onCleanup(el, stop);
          } else if (an.indexOf("data-class:") === 0) {
            if (claimed(el, "a:" + an)) return;
            var cls = an.slice("data-class:".length);
            var e2 = a.value;
            var s2 = effect(function() {
              el.classList.toggle(cls, !!evalExpr(scope, e2));
            });
            onCleanup(el, s2);
          } else if (an.indexOf("data-style:") === 0) {
            if (claimed(el, "a:" + an)) return;
            var prop = an.slice("data-style:".length);
            var e3 = a.value;
            var s3 = effect(function() {
              var v = evalExpr(scope, e3);
              el.style[prop] = v === false || v === null || v === void 0 ? "" : String(v);
            });
            onCleanup(el, s3);
          }
        });
      });
      eachEl(root, "[data-model]", function(node) {
        var el = node;
        if (claimed(el, "model")) return;
        var path = el.getAttribute("data-model") || "";
        var isCheck = el.type === "checkbox";
        var isRadio = el.type === "radio";
        var isSelect = el.tagName === "SELECT" && el.multiple;
        var stop = effect(function() {
          var v = evalExpr(scope, path);
          if (document.activeElement === el && !isCheck && !isRadio && el.type !== "checkbox") {
            if (el.value === String(v ?? "")) return;
          }
          if (isCheck) {
            if (Array.isArray(v)) el.checked = v.indexOf(el.value) >= 0;
            else el.checked = !!v;
          } else if (isRadio) {
            el.checked = String(v ?? "") === String(el.value);
          } else if (isSelect) {
            var arr = Array.isArray(v) ? v.map(String) : [];
            Array.prototype.forEach.call(el.options || [], function(o) {
              o.selected = arr.indexOf(String(o.value)) >= 0;
            });
          } else if (el.tagName === "SELECT" || el.value !== void 0) {
            el.value = v === void 0 || v === null ? "" : String(v);
          }
        });
        onCleanup(el, stop);
        var evt = isCheck || isRadio || el.tagName === "SELECT" ? "change" : "input";
        var h = function() {
          if (isCheck) {
            var cur = evalExpr(scope, path);
            if (Array.isArray(cur)) {
              var arr = cur.slice();
              var ix = arr.indexOf(el.value);
              if (el.checked && ix < 0) arr.push(el.value);
              if (!el.checked && ix >= 0) arr.splice(ix, 1);
              setPath(scope, path, arr);
            } else setPath(scope, path, el.checked);
          } else if (isSelect) {
            var out = [];
            Array.prototype.forEach.call(el.selectedOptions || [], function(o) {
              out.push(o.value);
            });
            setPath(scope, path, out);
          } else if (el.type === "number" || el.getAttribute("data-type") === "number") {
            setPath(scope, path, el.value === "" ? null : Number(el.value));
          } else {
            setPath(scope, path, el.value);
          }
        };
        el.addEventListener(evt, h);
        onCleanup(el, function() {
          el.removeEventListener(evt, h);
        });
      });
      eachEl(root, "[data-show]", function(node) {
        var el = node;
        if (claimed(el, "show")) return;
        var expr = el.getAttribute("data-show") || "";
        var stop = effect(function() {
          setHidden(el, !evalExpr(scope, expr));
        });
        onCleanup(el, stop);
      });
      eachEl(root, "[data-if]", function(node) {
        var el = node;
        if (el.tagName === "TEMPLATE") return;
        if (claimed(el, "if")) return;
        var expr = el.getAttribute("data-if") || "";
        var stop = effect(function() {
          setHidden(el, !evalExpr(scope, expr));
        });
        onCleanup(el, stop);
      });
      eachEl(root, "template[data-if]", function(node) {
        var tpl = node;
        var expr = tpl.getAttribute("data-if") || "";
        if (claimed(tpl, "tif")) return;
        var anchor = document.createComment("b-if");
        if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
        var frag = null;
        var stop = effect(function() {
          var on = !!evalExpr(scope, expr);
          if (on && !frag) {
            frag = /** @type {DocumentFragment} */
            tpl.content.cloneNode(true);
            if (anchor.parentNode) anchor.parentNode.insertBefore(frag, anchor.nextSibling);
            if (anchor.parentNode && anchor.parentNode instanceof Element) {
              hydrate(anchor.parentNode, scope, actions);
              var nn = anchor.nextSibling;
              while (nn && nn !== tpl) {
                var nx2 = nn.nextSibling;
                if (nn instanceof Element) playEnter(nn);
                nn = nx2;
              }
            }
          } else if (!on && frag) {
            var n = anchor.nextSibling;
            while (n && n !== tpl) {
              var nx = n.nextSibling;
              if (n instanceof Element) destroyTree(n);
              if (n.parentNode) n.parentNode.removeChild(n);
              if (frag && n === frag.lastChild) break;
              n = nx;
            }
            frag = null;
          }
        });
        onCleanup(tpl, stop);
      });
      eachEl(root, "template[data-for]", function(node) {
        var tpl = node;
        var spec = tpl.getAttribute("data-for") || "";
        if (claimed(tpl, "tfor")) return;
        var mm = spec.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(.+)\s*$/);
        if (!mm) {
          if (DEV && typeof console !== "undefined") console.warn('[laghu] bad data-for "' + spec + '"');
          return;
        }
        var itemVar = mm[1];
        var idxVar = mm[2];
        var listExpr = mm[3];
        var keyExpr = tpl.getAttribute("data-key") || "";
        var anchor = document.createComment("b-for");
        if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
        var rows = /* @__PURE__ */ new Map();
        var render = function() {
          var list = evalExpr(scope, listExpr) || [];
          if (!Array.isArray(list)) {
            if (DEV && typeof console !== "undefined") console.warn("[laghu] data-for not array: " + listExpr);
            list = [];
          }
          var parent = anchor.parentNode;
          if (!parent) return;
          var seen = /* @__PURE__ */ new Set();
          var order = [];
          for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var key = i;
            if (keyExpr) {
              var ki = evalExpr(item, keyExpr);
              if (ki === void 0 || ki === null) {
                var tmpVars = {};
                tmpVars[itemVar] = item;
                ki = evalExpr(childScope(scope, tmpVars), keyExpr);
              }
              if (ki !== void 0 && ki !== null) key = ki;
            }
            seen.add(key);
            order.push(key);
            var row = rows.get(key);
            if (!row) {
              var rsVars = {};
              rsVars[itemVar] = item;
              if (idxVar) rsVars[idxVar] = i;
              var rs = childScope(scope, rsVars);
              var f = (
                /** @type {DocumentFragment} */
                tpl.content.cloneNode(true)
              );
              var holder = document.createElement("span");
              holder.style.display = "contents";
              holder.setAttribute("data-bkey", String(key));
              holder.appendChild(f);
              parent.insertBefore(holder, anchor);
              hydrate(holder, rs, actions);
              playEnter(holder);
              rows.set(key, { nodes: [holder], scope: rs });
            } else {
              var prevItem = row.scope[itemVar];
              var prevIdx = idxVar ? row.scope[idxVar] : -1;
              row.scope[itemVar] = item;
              if (idxVar) row.scope[idxVar] = i;
              if (prevItem !== item || idxVar && prevIdx !== i) {
                var h0 = row.nodes[0];
                if (h0 instanceof Element) {
                  destroyTree(h0);
                  hydrate(h0, row.scope, actions);
                }
              }
            }
          }
          var seq = [];
          var chn = parent.childNodes;
          for (var q = 0; q < chn.length; q++) {
            var hn = chn[q];
            if (hn.nodeType === 1 && hn.hasAttribute("data-bkey")) {
              seq.push(hn.getAttribute("data-bkey"));
            }
          }
          var sameOrder = seq.length === order.length;
          if (sameOrder) {
            for (var q2 = 0; q2 < order.length; q2++) {
              if (seq[q2] !== String(order[q2])) {
                sameOrder = false;
                break;
              }
            }
          }
          if (!sameOrder) {
            for (var k = 0; k < order.length; k++) {
              var r2 = rows.get(order[k]);
              if (r2) parent.insertBefore(r2.nodes[0], anchor);
            }
          }
          rows.forEach(function(row2, kk) {
            if (!seen.has(kk)) {
              row2.nodes.forEach(function(nn) {
                if (nn instanceof Element) destroyTree(nn);
                if (nn.parentNode) nn.parentNode.removeChild(nn);
              });
              rows.delete(kk);
            }
          });
        };
        var stop = effect(render);
        onCleanup(tpl, stop);
      });
      eachEl(root, "[data-click]", function(node) {
        var el = node;
        if (claimed(el, "click")) return;
        var code = el.getAttribute("data-click") || "";
        var spec = el.getAttribute("data-trigger") || "click";
        bindTrigger(el, spec, function() {
          execAction(scope, actions || {}, code);
        });
      });
      Array.prototype.forEach.call(allEls(root), function(node) {
        var el = node;
        Array.prototype.forEach.call(el.attributes || [], function(a) {
          if (a.name.indexOf("data-on:") === 0) {
            if (claimed(el, "on:" + a.name)) return;
            var raw = a.name.slice("data-on:".length);
            var parts = raw.split(".");
            var ev = parts[0];
            var mods = parts.slice(1);
            var code = a.value;
            var spec = el.getAttribute("data-trigger") || ev;
            bindTrigger(el, spec, function(e) {
              if (mods.indexOf("prevent") >= 0) e.preventDefault();
              if (mods.indexOf("stop") >= 0) e.stopPropagation();
              var s2 = childScope(scope, { $event: e });
              execAction(s2, actions || {}, code);
              if (mods.indexOf("once") >= 0) {
                try {
                  el.removeAttribute(a.name);
                } catch (err) {
                }
              }
            });
          }
        });
      });
      eachEl(root, "[data-init]", function(node) {
        var el = node;
        if (claimed(el, "init")) return;
        var code = el.getAttribute("data-init") || "";
        try {
          execAction(scope, actions || {}, code);
        } catch (e) {
          reportError(e);
        }
      });
      directives.forEach(function(fn, name) {
        eachEl(root, "[data-" + name + "]", function(node) {
          var el = node;
          if (claimed(el, "dir:" + name)) return;
          try {
            var out = fn({ el, get: function() {
              return evalExpr(scope, el.getAttribute("data-" + name) || "");
            }, effect, scope });
            if (typeof out === "function") onCleanup(el, out);
          } catch (e) {
            reportError(e);
          }
        });
      });
      Array.prototype.forEach.call(allEls(root), function(node) {
        var el = node;
        var method = "";
        var url = "";
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
        if (!url && !el.hasAttribute("data-get") && !el.hasAttribute("data-post") && !el.hasAttribute("data-put") && !el.hasAttribute("data-patch") && !el.hasAttribute("data-delete")) return;
        if (el.hasAttribute("data-method")) method = String(el.getAttribute("data-method") || method).toUpperCase();
        if (!method) method = "GET";
        if (claimed(el, "fetch")) return;
        setupFetch(el, scope, method, url, actions);
      });
    }
    function setupFetch(el, scope, method, url, actions) {
      var targetSel = el.getAttribute("data-target") || "";
      var swap = el.getAttribute("data-swap") || "inner";
      var triggerSpec = el.getAttribute("data-trigger") || defaultEvent(el);
      el._bActions = actions || {};
      var hasErr = false;
      try {
        hasErr = "$error" in Object(scope);
      } catch (e) {
      }
      if (!hasErr) setPath(scope, "$error", null);
      var fire = function(e) {
        if (el instanceof HTMLFormElement && e && e.type === "submit" && e.cancelable) e.preventDefault();
        doFetch(el, scope, method, url, targetSel, swap);
      };
      bindTrigger(el, triggerSpec, fire);
    }
    function tryJSON(s) {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    }
    function doFetch(el, scope, method, url, targetSel, swap) {
      var m = parseTrigger(el.getAttribute("data-trigger") || defaultEvent(el), el);
      var self = el;
      if (!self._bReqs) self._bReqs = /* @__PURE__ */ new Set();
      if (self._bN > 0 && (m.queue === "first" || m.queue === "none")) return;
      if (m.queue === "last") {
        self._bReqs.forEach(function(c) {
          try {
            c.abort();
          } catch (e) {
          }
        });
        self._bReqs.clear();
      }
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (ctrl) self._bReqs.add(ctrl);
      self._bN = (self._bN || 0) + 1;
      var timedOut = false;
      var timeoutMs = parseMs(el.getAttribute("data-timeout") || "");
      var timer = 0;
      if (timeoutMs > 0 && ctrl) {
        timer = /** @type {any} */
        setTimeout(function() {
          timedOut = true;
          try {
            if (ctrl) ctrl.abort();
          } catch (e) {
          }
        }, timeoutMs);
      }
      var actions = self._bActions || {};
      var setBusy = function(on) {
        var indSel = el.getAttribute("data-indicator");
        var ind = indSel ? document.querySelector(indSel) : null;
        if (ind && ind instanceof HTMLElement) ind.hidden = !on ? true : false;
        if (el instanceof HTMLElement) {
          if (on) {
            el.setAttribute("data-request", "");
            el.setAttribute("data-pending", "");
          } else {
            el.removeAttribute("data-request");
            el.removeAttribute("data-pending");
          }
          if (el.hasAttribute("data-disable")) el.toggleAttribute("disabled", on);
        }
      };
      setBusy(true);
      var before = new CustomEvent("laghu:before-request", { bubbles: true, cancelable: true, detail: { url, method } });
      if (!el.dispatchEvent(before)) {
        finish();
        return;
      }
      var opts = { method, headers: { Accept: "application/json, text/html" }, signal: ctrl ? ctrl.signal : void 0 };
      var valsRaw = el.getAttribute("data-vals");
      var body = null;
      if (valsRaw) {
        var wantForm = valsRaw.trim() === "form";
        var hostForm = el instanceof HTMLFormElement ? el : el.closest ? el.closest("form") : null;
        var v = wantForm ? hostForm ? serializeForm(hostForm) : {} : tryJSON(valsRaw) || {};
        if (hostForm && !wantForm) {
          var fv = serializeForm(hostForm);
          for (var k in fv) v[k] = fv[k];
        }
        if (method === "GET") {
          var parts = [];
          for (var qk in v) {
            if (Array.isArray(v[qk])) {
              for (var qi = 0; qi < v[qk].length; qi++) {
                parts.push(encodeURIComponent(qk) + "=" + encodeURIComponent(String(v[qk][qi])));
              }
            } else {
              parts.push(encodeURIComponent(qk) + "=" + encodeURIComponent(String(v[qk])));
            }
          }
          if (parts.length) url += (url.indexOf("?") >= 0 ? "&" : "?") + parts.join("&");
        } else {
          opts.headers["Content-Type"] = "application/json";
          body = JSON.stringify(v);
          opts.body = body;
        }
      } else if (method !== "GET") {
        var f2 = el instanceof HTMLFormElement ? el : el.closest ? el.closest("form") : null;
        if (f2) {
          opts.headers["Content-Type"] = "application/json";
          opts.body = JSON.stringify(serializeForm(f2));
        }
      }
      var hRaw = el.getAttribute("data-headers");
      if (hRaw) {
        var hh = tryJSON(hRaw) || {};
        for (var hk in hh) opts.headers[hk] = hh[hk];
      }
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (ctrl) self._bReqs.delete(ctrl);
        self._bN = Math.max(0, (self._bN || 1) - 1);
        setBusy(false);
      }
      fetch(url, opts).then(function(res) {
        finish();
        el.dispatchEvent(new CustomEvent("laghu:after-request", { bubbles: true, detail: { status: res.status, url } }));
        if (!res.ok) {
          setPath(scope, "$error", { status: res.status, url });
          el.dispatchEvent(new CustomEvent("laghu:request-error", { bubbles: true, detail: { status: res.status, url } }));
          return;
        }
        var ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.indexOf("json") >= 0) return res.json().then(function(data) {
          setPath(scope, "$error", null);
          if (data && typeof data === "object" && !Array.isArray(data)) Object.assign(scope, data);
          else setPath(scope, "result", data);
        });
        return res.text().then(function(html) {
          var sel = el.getAttribute("data-select");
          if (sel) {
            var tmp = document.createElement("template");
            tmp.innerHTML = sanitize(html);
            var picked = tmp.content.querySelector(sel);
            html = picked ? picked.outerHTML : "";
          }
          var target = targetSel ? document.querySelector(targetSel) : el;
          if (!target) return;
          swapHtml(target, html, swap, scope, actions);
        });
      }).catch(function(err) {
        finish();
        if (err && err.name === "AbortError" && !timedOut) return;
        setPath(scope, "$error", { message: String(err && err.message || err), timeout: timedOut });
        el.dispatchEvent(new CustomEvent("laghu:request-error", { bubbles: true, detail: { error: err, timeout: timedOut } }));
        reportError(err);
      });
    }
    function serializeForm(form) {
      var out = {};
      var fd = new FormData(form);
      fd.forEach(function(v, k) {
        if (k in out) {
          if (!Array.isArray(out[k])) out[k] = [out[k]];
          out[k].push(typeof v === "string" ? v : String(v));
        } else out[k] = typeof v === "string" ? v : String(v);
      });
      return out;
    }
    function swapHtml(target, html, swap, scope, actions) {
      actions = actions || {};
      var s = String(swap || "inner").toLowerCase();
      var s = String(swap || "inner").toLowerCase();
      if (s === "none") {
        target.dispatchEvent(new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: s } }));
        return;
      }
      var focusId = document.activeElement && document.activeElement.id ? document.activeElement.id : null;
      var ae = document.activeElement;
      var selStart = ae && typeof ae.selectionStart === "number" ? ae.selectionStart : -1;
      var selEnd = ae && typeof ae.selectionEnd === "number" ? ae.selectionEnd : -1;
      target.dispatchEvent(new CustomEvent("laghu:before-swap", { bubbles: true, cancelable: false, detail: { swap: s } }));
      var isMorph = s.indexOf("morph") === 0;
      var M = typeof window !== "undefined" ? window.LaghuMorph : null;
      if (isMorph) {
        if (M && M.morph) {
          M.morph(target, sanitize(html), { mode: s === "morph:outer" ? "outer" : "inner" });
          hydrate(target, scope, actions);
          target.dispatchEvent(new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: s } }));
          restoreFocus(focusId, selStart, selEnd);
          return;
        }
        if (DEV && typeof console !== "undefined") console.warn('[laghu] data-swap="morph" needs morph.js (window.LaghuMorph). Falling back to inner.');
        s = "inner";
      }
      if (s === "delete") {
        destroyTree(target);
        if (target.parentNode) target.parentNode.removeChild(target);
        return;
      }
      var tmp = document.createElement("template");
      tmp.innerHTML = sanitize(html);
      var frag = tmp.content;
      var kept = /* @__PURE__ */ new Map();
      target.querySelectorAll("[data-preserve][id]").forEach(function(n) {
        kept.set(n.id, n);
      });
      destroyTree(target);
      if (s === "inner") {
        target.innerHTML = "";
        target.appendChild(frag);
      } else if (s === "text") {
        target.textContent = tmp.content.textContent;
      } else if (s === "outer") {
        target.replaceWith(frag);
      } else if (s === "append" || s === "beforeend") {
        target.appendChild(frag);
      } else if (s === "prepend" || s === "afterbegin") {
        target.insertBefore(frag, target.firstChild);
      } else if (s === "beforebegin") {
        if (target.parentNode) target.parentNode.insertBefore(frag, target);
      } else if (s === "afterend") {
        if (target.parentNode) target.parentNode.insertBefore(frag, target.nextSibling);
      } else {
        target.innerHTML = "";
        target.appendChild(frag);
      }
      kept.forEach(function(node, id) {
        var sel = "#";
        try {
          var CE = typeof CSS !== "undefined" && CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
          sel = "#" + CE;
        } catch (e) {
          sel = '[id="' + String(id).replace(/"/g, "") + '"]';
        }
        var fresh = target.querySelector ? target.querySelector(sel) : null;
        if (!fresh) {
          fresh = document.getElementById(id);
        }
        if (fresh && fresh !== node && node.parentNode !== fresh) {
          fresh.replaceWith(node);
        }
      });
      var root = s === "outer" ? target.parentNode instanceof Element ? target.parentNode : document.body : target;
      hydrate(root, scope, actions);
      target.dispatchEvent(new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: s } }));
      restoreFocus(focusId, selStart, selEnd);
    }
    function restoreFocus(id, a, b) {
      if (!id) return;
      var f = document.getElementById(id);
      if (f && f instanceof HTMLElement) {
        try {
          f.focus({ preventScroll: true });
        } catch (e) {
          try {
            f.focus();
          } catch (e2) {
          }
        }
        try {
          if (a >= 0 && f.setSelectionRange) f.setSelectionRange(a, b);
        } catch (e) {
        }
      }
    }
    function define(tag, setup) {
      if (!tag || tag.indexOf("-") < 0) throw new Error("[laghu] tag must contain hyphen: " + tag);
      var probe = setup() || {};
      var obs = probe.observed || Object.keys(probe.state || {}).filter(function(k) {
        var v = probe.state[k];
        return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
      });
      var Klass = class extends HTMLElement {
        connectedCallback() {
          if (this._bInit) return;
          this._bInit = true;
          var r = setup() || {};
          var initial = r.state || {};
          for (var k in initial) {
            if (Object.prototype.hasOwnProperty.call(this, k)) {
              try {
                initial[k] = this[k];
                delete this[k];
              } catch (e) {
              }
            }
          }
          var pend = this._bPend;
          if (pend) {
            for (var pk in pend) {
              if (pk in initial) initial[pk] = coerceAttr(pend[pk], initial[pk]);
              else initial[pk] = pend[pk];
            }
            this._bPend = null;
          } else {
            for (var i = 0; i < obs.length; i++) {
              var an = obs[i];
              if (this.hasAttribute && this.hasAttribute(an) && an in initial) {
                initial[an] = coerceAttr(this.getAttribute(an), initial[an]);
              }
            }
          }
          var state = reactive(initial);
          this.state = state;
          this.actions = r.actions || {};
          if (typeof r.onUnmount === "function") this._bOnUnmount = r.onUnmount;
          hydrate(this, state, r.actions || {});
          try {
            if (typeof r.onMount === "function") r.onMount.call(state);
          } catch (e) {
            reportError(e);
          }
          this.classList.add("is-defined");
          this.dispatchEvent(new CustomEvent("laghu:mount"));
        }
        disconnectedCallback() {
          try {
            var st = this.state;
            var un = this._bOnUnmount;
            if (typeof un === "function" && st) un.call(st);
          } catch (e) {
            reportError(e);
          }
          destroyTree(this);
          this.dispatchEvent(new CustomEvent("laghu:unmount"));
          this._bInit = false;
        }
        connectedMoveCallback() {
        }
        attributeChangedCallback(name, old, val) {
          if (old === val) return;
          var st = this.state;
          if (st && name in st) st[name] = coerceAttr(val, st[name]);
          else {
            var p = this._bPend || {};
            p[name] = val;
            this._bPend = p;
          }
        }
      };
      Klass.observedAttributes = obs;
      customElements.define(tag, Klass);
      return Klass;
    }
    var observer = null;
    function autoObserve() {
      if (observer || typeof MutationObserver === "undefined") return;
      observer = new MutationObserver(function(muts) {
        var added = /* @__PURE__ */ new Set();
        muts.forEach(function(m) {
          m.addedNodes.forEach(function(n) {
            if (n instanceof Element) added.add(n);
          });
        });
        muts.forEach(function(m) {
          m.addedNodes.forEach(function(n) {
            if (n instanceof Element) {
              if (n.hasAttribute && n.hasAttribute("data-scope") && !n._bScope) {
                try {
                  var api2 = window.Laghu;
                  if (api2) api2.hydrate(n, parseScope(n.getAttribute("data-scope")), {});
                } catch (e) {
                  reportError(e);
                }
              }
            }
          });
          m.removedNodes.forEach(function(n) {
            if (n instanceof Element && !added.has(n)) destroyTree(n);
          });
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    var api = {
      version: VERSION,
      define,
      reactive,
      effect,
      eval: evalExpr,
      get: getPath,
      set: setPath,
      parseTrigger,
      swap: swapHtml,
      css: "laghu:not(:defined),[data-laghu]:not(:defined){visibility:hidden}laghu.is-defined,[data-laghu].is-defined{visibility:visible}",
      sanitize: function(fn) {
        if (typeof fn === "function") sanitize = fn;
      },
      hydrate: function(root, state, actions) {
        var s = reactive(state || parseScope(root.getAttribute("data-scope")));
        root._bScope = s;
        hydrate(root, s, actions || {});
        return s;
      },
      destroyTree,
      store: function(name, init) {
        if (init !== void 0) {
          var s = reactive(init);
          stores.set(name, s);
          return s;
        }
        return stores.get(name);
      },
      /**
       * Derived value kept fresh by an effect. Call the getter inside
       * bindings or other effects to subscribe; eager recompute keeps
       * it simple and predictable at this scale.
       * @example
       * var doubled = Laghu.computed(function () { return state.count * 2; });
       * Laghu.effect(function () { el.textContent = doubled(); });
       */
      computed: function(fn) {
        var box = reactive({ v: void 0 });
        effect(function() {
          box.v = fn();
        });
        return function() {
          return box.v;
        };
      },
      /**
       * Call back with (next, prev) whenever an expression's value
       * changes. Reads without subscribing the caller's own effect.
       * @example
       * Laghu.watch(state, 'user.name', function (n, o) { console.log(o, 'becomes', n); });
       */
      watch: function(scope, expr, cb) {
        var started = false;
        var prev;
        return effect(function() {
          var next = evalExpr(scope, expr);
          if (!started) {
            started = true;
            prev = next;
            return;
          }
          if (next !== prev) {
            var o = prev;
            prev = next;
            cb(next, o);
          }
        });
      },
      /**
       * Persist a named store to localStorage (debounced) and restore it
       * on next boot. Version mismatch reseeds from init. No-op without
       * localStorage (file:// included where available).
       * @example
       * Laghu.store('cart', { n: 0 });
       * Laghu.persist('cart', { key: 'cart:v1', version: 1 });
       */
      persist: function(name, opts) {
        opts = opts || {};
        var key = opts.key || "laghu:" + name;
        var ver = opts.version === void 0 ? 1 : opts.version;
        var wait = opts.debounce === void 0 ? 300 : opts.debounce;
        var st = stores.get(name);
        if (!st) return null;
        try {
          var raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
          if (raw) {
            var saved = JSON.parse(raw);
            if (saved && saved.v === ver && saved.state && typeof saved.state === "object") {
              Object.assign(st, saved.state);
            }
          }
        } catch (e) {
          reportError(e);
        }
        var timer = 0;
        effect(function() {
          JSON.stringify(st);
          if (typeof localStorage === "undefined") return;
          if (timer) clearTimeout(timer);
          timer = /** @type {any} */
          setTimeout(function() {
            try {
              localStorage.setItem(key, JSON.stringify({ v: ver, state: st }));
            } catch (e) {
              reportError(e);
            }
          }, wait);
        });
        return st;
      },
      directive: function(name, fn) {
        directives.set(name, fn);
      },
      filter: function(name, fn) {
        filters.set(name, fn);
      },
      scope: function(parent, vars) {
        return childScope(parent, vars || {});
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("DOMContentLoaded", function() {
        autoObserve();
        document.querySelectorAll("[data-scope]").forEach(function(n) {
          var el = n;
          if (el._bScope) return;
          api.hydrate(el, parseScope(el.getAttribute("data-scope")), {});
        });
      });
    }
    return api;
  })();

  // src/laghu.global.ts
  window.Laghu = Laghu;
})();
