"use strict";
(() => {
  // src/laghu.ts
  var Laghu = (() => {
    "use strict";
    const VERSION = "1.2.2";
    function isDev() {
      return typeof window !== "undefined" && window.__LAGHU_DEV__ === true;
    }
    function warnDev(msg) {
      if (isDev() && typeof console !== "undefined") console.warn(msg);
    }
    function errorDev(err) {
      if (isDev() && typeof console !== "undefined") console.error("[laghu]", err);
    }
    const stores = /* @__PURE__ */ new Map();
    const directives = /* @__PURE__ */ new Map();
    const filters = /* @__PURE__ */ new Map();
    const targetMap = /* @__PURE__ */ new WeakMap();
    const proxyCache = /* @__PURE__ */ new WeakMap();
    const proxySet = /* @__PURE__ */ new WeakSet();
    let activeEffect = null;
    const jobQueue = /* @__PURE__ */ new Set();
    let flushing = false;
    const URL_ATTRS = {
      href: 1,
      src: 1,
      action: 1,
      formaction: 1,
      cite: 1,
      poster: 1,
      data: 1,
      srcset: 1,
      srcdoc: 1
    };
    function badSeg(seg) {
      return seg === "__proto__" || seg === "constructor" || seg === "prototype";
    }
    function unsafeUrl(value) {
      const s = String(value).replace(/[\s\x00-\x1f]+/g, "").toLowerCase();
      return s.indexOf("javascript:") === 0 || s.indexOf("data:text/html") === 0 || s.indexOf("vbscript:") === 0;
    }
    function defaultSanitize(html) {
      let s = String(html);
      s = s.replace(/<script[\s\S]*?(<\/script\s*>|$)/gi, "");
      s = s.replace(/<\/?(iframe|object|embed|link|meta|base)[^>]*>/gi, "");
      s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      s = s.replace(
        /(href|src|xlink:href|action|formaction|poster|data)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
        (match, attr, _q, d1, d2, d3) => {
          const v = d1 !== void 0 ? d1 : d2 !== void 0 ? d2 : d3;
          if (unsafeUrl(v)) return attr + '="#"';
          return match;
        }
      );
      return s;
    }
    let sanitize = defaultSanitize;
    function reportError(err) {
      try {
        if (typeof document !== "undefined" && document.dispatchEvent) {
          document.dispatchEvent(
            new CustomEvent("laghu:error", {
              detail: { error: String(err && err.message || err), version: VERSION }
            })
          );
        }
      } catch (e) {
      }
      errorDev(err);
    }
    function flush() {
      flushing = false;
      const jobs = Array.from(jobQueue);
      jobQueue.clear();
      for (let i = 0; i < jobs.length; i++) {
        jobs[i]();
      }
    }
    function schedule(fn) {
      jobQueue.add(fn);
      if (!flushing) {
        flushing = true;
        void Promise.resolve().then(flush);
      }
    }
    const effectStack = [];
    const runDeps = /* @__PURE__ */ new WeakMap();
    function effect(fn) {
      let stopped = false;
      const deps = [];
      const run = function() {
        if (stopped) return;
        for (let i = 0; i < deps.length; i++) deps[i].delete(run);
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
        for (let i = 0; i < deps.length; i++) deps[i].delete(run);
        deps.length = 0;
      };
    }
    function track(target, key) {
      if (!activeEffect) return;
      let propMap = targetMap.get(target);
      if (!propMap) {
        propMap = /* @__PURE__ */ new Map();
        targetMap.set(target, propMap);
      }
      let effectSet = propMap.get(key);
      if (!effectSet) {
        effectSet = /* @__PURE__ */ new Set();
        propMap.set(key, effectSet);
      }
      effectSet.add(activeEffect);
      runDeps.get(activeEffect).push(effectSet);
    }
    function trigger(target, key) {
      const propMap = targetMap.get(target);
      if (!propMap) return;
      const effectSet = propMap.get(key);
      if (!effectSet) return;
      effectSet.forEach((fn) => {
        schedule(fn);
      });
    }
    function isObj(value) {
      return value !== null && typeof value === "object";
    }
    function hasKey(obj, key) {
      return !!obj && key in obj;
    }
    function childScope(parentScope, variables) {
      const scopeObj = Object.create(parentScope);
      for (const key of Object.keys(variables)) {
        Object.defineProperty(scopeObj, key, {
          value: variables[key],
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
      return scopeObj;
    }
    function trackScopeChain(scope, head) {
      if (typeof head === "string" && isObj(scope)) {
        track(scope, head);
        let node = Object.getPrototypeOf(scope);
        while (node && node !== Object.prototype) {
          if (proxySet.has(node)) track(node, head);
          node = Object.getPrototypeOf(node);
        }
      }
    }
    function getStorePath(parts) {
      const storeObj = stores.get(parts[1]);
      if (!storeObj) return void 0;
      let current = storeObj;
      for (let k = 2; k < parts.length; k++) {
        if (badSeg(parts[k])) return void 0;
        if (!isObj(current)) return void 0;
        current = current[parts[k]];
      }
      return current;
    }
    function getPath(scope, path) {
      if (!path) return void 0;
      const parts = String(path).split(".");
      const head = parts[0].trim();
      if (badSeg(head)) return void 0;
      if (head === "$store") return getStorePath(parts);
      if (!(head in Object(scope))) {
        trackScopeChain(scope, head);
        return void 0;
      }
      let current = scope[head];
      for (let i = 1; i < parts.length; i++) {
        if (badSeg(parts[i])) return void 0;
        if (!isObj(current) && typeof current !== "function") return void 0;
        current = current[parts[i]];
      }
      return current;
    }
    function setStorePath(parts, val) {
      const storeObj = stores.get(parts[1]);
      if (!storeObj) return;
      let current = storeObj;
      for (let k = 2; k < parts.length - 1; k++) {
        if (!isObj(current[parts[k]])) current[parts[k]] = {};
        current = current[parts[k]];
      }
      current[parts[parts.length - 1]] = val;
    }
    function setPath(scope, path, val) {
      const parts = String(path).split(".");
      for (let g = 0; g < parts.length; g++) {
        if (badSeg(parts[g].trim())) {
          warnDev('[laghu] blocked unsafe path "' + path + '"');
          return;
        }
      }
      if (parts[0].trim() === "$store") {
        setStorePath(parts, val);
        return;
      }
      let base = scope;
      let node = scope;
      while (node && node !== Object.prototype) {
        if (Object.prototype.hasOwnProperty.call(node, parts[0])) {
          base = node;
          break;
        }
        node = Object.getPrototypeOf(node);
      }
      let current = base;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!isObj(current[key])) current[key] = {};
        current = current[key];
      }
      current[parts[parts.length - 1]] = val;
    }
    function reactive(obj) {
      if (!isObj(obj)) return obj;
      if (proxySet.has(obj)) return obj;
      const hit = proxyCache.get(obj);
      if (hit) return hit;
      const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
          if (typeof prop === "string") track(target, prop);
          const val = Reflect.get(target, prop, receiver);
          return isObj(val) ? reactive(val) : val;
        },
        set(target, prop, val) {
          const oldVal = target[prop];
          const ok = Reflect.set(target, prop, val);
          if (oldVal !== val && typeof prop === "string") {
            trigger(target, prop);
            trigger(proxyCache.get(target), prop);
          }
          return ok;
        },
        deleteProperty(target, prop) {
          const ok = Reflect.deleteProperty(target, prop);
          if (typeof prop === "string") {
            trigger(target, prop);
            trigger(proxyCache.get(target), prop);
          }
          return ok;
        }
      });
      proxyCache.set(obj, proxy);
      proxySet.add(proxy);
      return proxy;
    }
    function splitTop(sourceText, op) {
      const out = [];
      let depth = 0;
      let quoteChar = null;
      let current = "";
      for (let i = 0; i < sourceText.length; i++) {
        const ch = sourceText[i];
        if (quoteChar) {
          current += ch;
          if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          current += ch;
          continue;
        }
        if (ch === "(" || ch === "[") depth++;
        if (ch === ")" || ch === "]") depth--;
        if (depth === 0 && sourceText.slice(i, i + op.length) === op) {
          out.push(current);
          current = "";
          i += op.length - 1;
          continue;
        }
        current += ch;
      }
      out.push(current);
      return out;
    }
    function lastTopOp(sourceText, chars) {
      let depth = 0;
      let quoteChar = null;
      for (let i = sourceText.length - 1; i > 0; i--) {
        const ch = sourceText[i];
        if (quoteChar) {
          if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          continue;
        }
        if (ch === ")" || ch === "]") depth++;
        if (ch === "(" || ch === "[") depth--;
        if (depth === 0 && chars.indexOf(ch) >= 0) return i;
      }
      return -1;
    }
    function splitTernary(sourceText) {
      let depth = 0;
      let quoteChar = null;
      let questionIdx = -1;
      let i;
      for (i = 0; i < sourceText.length; i++) {
        const ch = sourceText[i];
        if (quoteChar) {
          if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          continue;
        }
        if (ch === "(" || ch === "[") depth++;
        if (ch === ")" || ch === "]") depth--;
        if (ch === "?" && depth === 0) {
          questionIdx = i;
          break;
        }
      }
      if (questionIdx < 0) return null;
      depth = 0;
      quoteChar = null;
      for (i = questionIdx + 1; i < sourceText.length; i++) {
        const ch = sourceText[i];
        if (quoteChar) {
          if (ch === quoteChar && sourceText[i - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          continue;
        }
        if (ch === "(" || ch === "[") depth++;
        if (ch === ")" || ch === "]") depth--;
        if (ch === ":" && depth === 0) {
          return [
            sourceText.slice(0, questionIdx),
            sourceText.slice(questionIdx + 1, i),
            sourceText.slice(i + 1)
          ];
        }
      }
      return null;
    }
    function evalLogical(scope, expr) {
      const orParts = splitTop(expr, "||");
      if (orParts.length > 1) {
        let r;
        for (let i = 0; i < orParts.length; i++) {
          r = evalExpr(scope, orParts[i]);
          if (r) return { matched: true, result: r };
        }
        return { matched: true, result: r };
      }
      const andParts = splitTop(expr, "&&");
      if (andParts.length > 1) {
        let rr;
        for (let j = 0; j < andParts.length; j++) {
          rr = evalExpr(scope, andParts[j]);
          if (!rr) return { matched: true, result: rr };
        }
        return { matched: true, result: rr };
      }
      return { matched: false, result: void 0 };
    }
    function evalComparison(scope, expr) {
      const match = expr.match(/^(.*?)(===|!==|>=|<=|==|!=|>|<)(.*)$/);
      if (!match) return { matched: false, result: void 0 };
      const leftVal = evalExpr(scope, match[1]);
      const rightVal = evalExpr(scope, match[3]);
      const op = match[2];
      if (op === ">") return { matched: true, result: leftVal > rightVal };
      if (op === "<") return { matched: true, result: leftVal < rightVal };
      if (op === ">=") return { matched: true, result: leftVal >= rightVal };
      if (op === "<=") return { matched: true, result: leftVal <= rightVal };
      if (op === "==") return { matched: true, result: leftVal == rightVal };
      if (op === "!=") return { matched: true, result: leftVal != rightVal };
      if (op === "===") return { matched: true, result: leftVal === rightVal };
      return { matched: true, result: leftVal !== rightVal };
    }
    function evalArithmetic(scope, expr) {
      const addSubIdx = lastTopOp(expr, "+-");
      if (addSubIdx > 0 && expr.slice(0, addSubIdx).trim() && expr.slice(addSubIdx + 1).trim()) {
        const leftVal = evalExpr(scope, expr.slice(0, addSubIdx));
        const rightVal = evalExpr(scope, expr.slice(addSubIdx + 1));
        return {
          matched: true,
          result: expr[addSubIdx] === "+" ? leftVal + rightVal : leftVal - rightVal
        };
      }
      const mulDivIdx = lastTopOp(expr, "*/%");
      if (mulDivIdx > 0 && expr.slice(0, mulDivIdx).trim() && expr.slice(mulDivIdx + 1).trim()) {
        const leftVal = evalExpr(scope, expr.slice(0, mulDivIdx));
        const rightVal = evalExpr(scope, expr.slice(mulDivIdx + 1));
        const op = expr[mulDivIdx];
        if (op === "*") return { matched: true, result: leftVal * rightVal };
        if (op === "/") return { matched: true, result: leftVal / rightVal };
        return { matched: true, result: leftVal % rightVal };
      }
      return { matched: false, result: void 0 };
    }
    function evalParenthesized(expr) {
      if (expr[0] !== "(") return null;
      let depth = 0;
      let quoteChar = null;
      let matchIdx = -1;
      for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (quoteChar) {
          if (ch === quoteChar && expr[i - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")") {
          depth--;
          if (depth === 0) {
            matchIdx = i;
            break;
          }
        }
      }
      return matchIdx === expr.length - 1 ? expr.slice(1, -1) : null;
    }
    function evalMethodCall(scope, expr) {
      if (expr.charAt(expr.length - 1) !== ")") return { matched: false, result: void 0 };
      const parenIdx = expr.indexOf("(");
      if (parenIdx <= 0) return { matched: false, result: void 0 };
      let depth = 0;
      let quoteChar = null;
      let closeIdx = -1;
      for (let k = parenIdx; k < expr.length; k++) {
        const ch = expr[k];
        if (quoteChar) {
          if (ch === quoteChar && expr[k - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")") {
          depth--;
          if (depth === 0) {
            closeIdx = k;
            break;
          }
        }
      }
      if (closeIdx !== expr.length - 1) return { matched: false, result: void 0 };
      const methodName = expr.slice(0, parenIdx);
      if (!/^[\w.$]+$/.test(methodName)) return { matched: false, result: void 0 };
      const fn = getPath(scope, methodName);
      if (typeof fn === "function") {
        const rawArgs = expr.slice(parenIdx + 1, closeIdx).trim();
        const evaluatedArgs = rawArgs ? splitTop(rawArgs, ",").map((arg) => evalExpr(scope, arg)) : [];
        return { matched: true, result: fn.apply(scope, evaluatedArgs) };
      }
      warnDev('[laghu] unknown method "' + expr + '"');
      return { matched: true, result: void 0 };
    }
    function evalLiteral(expr) {
      if (expr[0] === '"' && expr[expr.length - 1] === '"' || expr[0] === "'" && expr[expr.length - 1] === "'") {
        return { matched: true, result: expr.slice(1, -1) };
      }
      if (/^-?\d+(\.\d+)?$/.test(expr)) return { matched: true, result: Number(expr) };
      if (expr === "true") return { matched: true, result: true };
      if (expr === "false") return { matched: true, result: false };
      if (expr === "null") return { matched: true, result: null };
      if (expr === "undefined") return { matched: true, result: void 0 };
      return { matched: false, result: void 0 };
    }
    function evalExpr(scope, expr) {
      const s = String(expr).trim();
      if (!s) return void 0;
      const direct = getPath(scope, s);
      if (direct !== void 0) return direct;
      const ternary = splitTernary(s);
      if (ternary) {
        return evalExpr(scope, ternary[0]) ? evalExpr(scope, ternary[1]) : evalExpr(scope, ternary[2]);
      }
      const logical = evalLogical(scope, s);
      if (logical.matched) return logical.result;
      const comparison = evalComparison(scope, s);
      if (comparison.matched) return comparison.result;
      const arithmetic = evalArithmetic(scope, s);
      if (arithmetic.matched) return arithmetic.result;
      if (s[0] === "!") return !evalExpr(scope, s.slice(1));
      if (s[0] === "-") return -evalExpr(scope, s.slice(1));
      const parenInner = evalParenthesized(s);
      if (parenInner !== null) return evalExpr(scope, parenInner);
      const literal = evalLiteral(s);
      if (literal.matched) return literal.result;
      const callResult = evalMethodCall(scope, s);
      if (callResult.matched) return callResult.result;
      const bracketMatch = s.match(/^(.*)\[(\d+|"(?:[^"]*)"|'(?:[^']*)')\]$/);
      if (bracketMatch && bracketMatch[1]) {
        const baseObj = evalExpr(scope, bracketMatch[1]);
        if (baseObj === null || baseObj === void 0) return void 0;
        let keyVal = bracketMatch[2];
        if (keyVal[0] === '"' || keyVal[0] === "'") keyVal = keyVal.slice(1, -1);
        else keyVal = Number(keyVal);
        if (typeof keyVal === "string" && badSeg(keyVal)) return void 0;
        return baseObj[keyVal];
      }
      return getPath(scope, s);
    }
    function unknownAction(name) {
      warnDev('[laghu] unknown action "' + name + '"');
      if (typeof CustomEvent !== "undefined" && typeof document !== "undefined" && document.dispatchEvent) {
        document.dispatchEvent(new CustomEvent("laghu:unknown-action", { detail: { name } }));
      }
    }
    function execAction(scope, actions, code) {
      const s = String(code).trim();
      if (!s) return;
      const incMatch = s.match(/^([\w.$]+)\+\+$/);
      if (incMatch) {
        setPath(scope, incMatch[1], Number(evalExpr(scope, incMatch[1]) || 0) + 1);
        return;
      }
      const decMatch = s.match(/^([\w.$]+)--$/);
      if (decMatch) {
        setPath(scope, decMatch[1], Number(evalExpr(scope, decMatch[1]) || 0) - 1);
        return;
      }
      const asgMatch = s.match(/^([\w.$]+)\s*=\s*(.+)$/);
      if (asgMatch && !/^(==|===|!=|!==|>=|<=)/.test(s.slice(asgMatch[1].length))) {
        setPath(scope, asgMatch[1], evalExpr(scope, asgMatch[2]));
        return;
      }
      const bareName = s.replace(/\(\)$/, "");
      const fn = actions[bareName] || getPath(scope, bareName);
      if (typeof fn === "function") {
        fn.call(scope);
        return;
      }
      const callMatch = s.match(/^([\w.$]+)\s*\(([\s\S]*)\)$/);
      if (callMatch && typeof actions[callMatch[1]] === "function") {
        const inner = callMatch[2].trim();
        const callArgs = splitTop(inner, ",").map((arg) => evalExpr(scope, arg));
        actions[callMatch[1]].apply(scope, callArgs);
        return;
      }
      if (/^[A-Za-z_$][\w.$-]*$/.test(s)) {
        unknownAction(s);
        return;
      }
      const resultVal = evalExpr(scope, s);
      if (typeof resultVal === "function") resultVal.call(scope);
      else if (resultVal === void 0) unknownAction(s);
    }
    function onCleanup(el, fn) {
      const list = el._bcu || (el._bcu = []);
      list.push(fn);
    }
    function eachEl(root, selector, fn) {
      if (root instanceof Element && root.matches) {
        try {
          if (root.matches(selector)) fn(root);
        } catch (e) {
        }
      }
      Array.prototype.forEach.call(root.querySelectorAll(selector), fn);
    }
    function allEls(root) {
      const out = [];
      if (root instanceof Element) out.push(root);
      Array.prototype.forEach.call(root.querySelectorAll("*"), (node) => {
        out.push(node);
      });
      return out;
    }
    function transFrames(kind, out) {
      const from = kind.indexOf("slide") >= 0 ? "translateY(-8px)" : kind.indexOf("scale") >= 0 ? "scale(.96)" : "none";
      const a = { opacity: "0", transform: from };
      const b = { opacity: "1", transform: "none" };
      return out ? [b, a] : [a, b];
    }
    function transDur(el) {
      return parseMs(el.getAttribute("data-duration") || "150ms") || 150;
    }
    function setHidden(el, hide) {
      hide = !!hide;
      if (!!el.hidden === hide) return;
      const seen = el._bT;
      if (seen === void 0) {
        el._bT = 0;
        el.hidden = hide;
        return;
      }
      const kind = el.getAttribute && el.getAttribute("data-transition") || "";
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!kind || kind === "none" || reduce || typeof el.animate !== "function") {
        el.hidden = hide;
        return;
      }
      const dur = transDur(el);
      const tk = el._bT = (el._bT || 0) + 1;
      el._bHide = hide;
      if (!hide) {
        el.hidden = false;
        try {
          const anim = el.animate(transFrames(kind, false), { duration: dur, easing: "ease-out" });
          if (anim && anim.finished && anim.finished.catch) anim.finished.catch(() => {
          });
        } catch (e) {
        }
      } else {
        try {
          const anim = el.animate(transFrames(kind, true), { duration: dur, easing: "ease-in" });
          const onDone = function() {
            if (el._bT === tk && el._bHide && el.isConnected) el.hidden = true;
          };
          if (anim && anim.finished && anim.finished.then) anim.finished.then(onDone, onDone);
          else setTimeout(onDone, dur);
        } catch (e) {
          el.hidden = true;
        }
      }
    }
    function playEnter(root) {
      eachEl(root, "[data-transition]", (node) => {
        const el = node;
        if (el.hidden) return;
        const kind = el.getAttribute("data-transition") || "";
        if (!kind || kind === "none") return;
        if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return;
        }
        if (typeof el.animate !== "function") return;
        const dur = transDur(el);
        try {
          const anim = el.animate(transFrames(kind, false), { duration: dur, easing: "ease-out" });
          if (anim && anim.finished && anim.finished.catch) anim.finished.catch(() => {
          });
        } catch (e) {
        }
      });
    }
    function claimed(el, key) {
      const host = el;
      const map = host._bH || (host._bH = {});
      if (map[key]) return true;
      map[key] = 1;
      return false;
    }
    function cleanupNode(node) {
      if (node._bcu) {
        for (let i = 0; i < node._bcu.length; i++) {
          try {
            node._bcu[i]();
          } catch (e) {
          }
        }
        node._bcu = [];
      }
      node._bH = void 0;
      if (node._bReq) {
        try {
          node._bReq.abort();
        } catch (e) {
        }
        node._bReq = null;
      }
    }
    function destroyTree(root) {
      cleanupNode(root);
      const descendants = root.querySelectorAll("*");
      for (let i = 0; i < descendants.length; i++) {
        cleanupNode(descendants[i]);
      }
    }
    function parseScope(raw) {
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch (e) {
        warnDev("[laghu] data-scope must be JSON. Got: " + raw);
        return {};
      }
    }
    function coerceAttr(raw, cur) {
      if (raw === null || raw === void 0) return cur;
      if (typeof cur === "boolean") return raw !== "false" && raw !== "0";
      if (typeof cur === "number") {
        const n = Number(raw);
        return isNaN(n) ? cur : n;
      }
      if (raw === "true") return true;
      if (raw === "false") return false;
      if (raw !== "" && !isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
        return Number(raw);
      }
      return raw;
    }
    function parseMs(s) {
      const m = String(s).trim().match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      return m[2] === "s" ? n * 1e3 : n;
    }
    function defaultEvent(el) {
      const t = el.tagName;
      if (t === "FORM") return "submit";
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return "change";
      return "click";
    }
    function parseTrigger(spec, el) {
      const out = {
        on: "",
        delay: 0,
        throttle: 0,
        once: false,
        changed: false,
        queue: "last",
        from: "",
        every: 0,
        load: false,
        revealed: false
      };
      let s = String(spec || "").trim();
      if (!s) {
        out.on = defaultEvent(el);
        return out;
      }
      const everyMatch = s.match(/every\s+(\d+(?:\.\d+)?(?:ms|s)?)/);
      if (everyMatch) {
        out.every = parseMs(everyMatch[1]);
        s = s.replace(everyMatch[0], " ");
      }
      const delayMatch = s.match(/delay:(\S+)/);
      if (delayMatch) {
        out.delay = parseMs(delayMatch[1]);
        s = s.replace(delayMatch[0], " ");
      }
      const throttleMatch = s.match(/throttle:(\S+)/);
      if (throttleMatch) {
        out.throttle = parseMs(throttleMatch[1]);
        s = s.replace(throttleMatch[0], " ");
      }
      const queueMatch = s.match(/queue:(first|last|all|none)/);
      if (queueMatch) {
        out.queue = queueMatch[1];
        s = s.replace(queueMatch[0], " ");
      }
      const fromMatch = s.match(/from:(\S+)/);
      if (fromMatch) {
        out.from = fromMatch[1];
        s = s.replace(fromMatch[0], " ");
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
      const eventName = s.trim().split(/\s+/).filter(Boolean)[0] || "";
      out.on = eventName || defaultEvent(el);
      return out;
    }
    function bindTrigger(el, spec, fn) {
      const triggerInfo = parseTrigger(spec, el);
      const triggerState = { timer: 0, lastFire: 0, lastVal: null };
      const fire = function(e) {
        const input = el;
        if (triggerInfo.changed && (hasKey(input, "value") || hasKey(input, "checked"))) {
          const valStr = input.type === "checkbox" || input.type === "radio" ? String(input.checked) + ":" + String(input.value) : String(input.value);
          if (valStr === triggerState.lastVal) return;
          triggerState.lastVal = valStr;
        }
        const now = Date.now();
        if (triggerInfo.throttle && now - triggerState.lastFire < triggerInfo.throttle) return;
        const run = function() {
          triggerState.lastFire = Date.now();
          fn(e);
          if (triggerInfo.once) cleanup();
        };
        if (triggerInfo.delay) {
          clearTimeout(triggerState.timer);
          triggerState.timer = setTimeout(run, triggerInfo.delay);
        } else {
          run();
        }
      };
      const cleanups = [];
      const cleanup = function() {
        for (let ci = 0; ci < cleanups.length; ci++) {
          try {
            cleanups[ci]();
          } catch (e) {
          }
        }
        clearTimeout(triggerState.timer);
      };
      let listenTarget = el;
      if (triggerInfo.from === "document" && typeof document !== "undefined") {
        listenTarget = document;
      } else if (triggerInfo.from === "body" && typeof document !== "undefined") {
        listenTarget = document.body;
      } else if (triggerInfo.from && typeof document !== "undefined") {
        const docRoot = document;
        const delegator = function(ev) {
          const tgt = ev.target;
          if (tgt && tgt.closest && tgt.closest(triggerInfo.from)) fire(ev);
        };
        docRoot.addEventListener(triggerInfo.on, delegator);
        cleanups.push(() => docRoot.removeEventListener(triggerInfo.on, delegator));
        onCleanup(el, cleanup);
        return cleanup;
      }
      if (triggerInfo.every) {
        const intervalId = setInterval(() => {
          fire(new CustomEvent("laghu:poll"));
        }, triggerInfo.every);
        cleanups.push(() => clearInterval(intervalId));
      }
      if (triggerInfo.load) {
        if (typeof document !== "undefined" && document.readyState === "loading") {
          const onLoad = () => fire(new CustomEvent("laghu:load"));
          document.addEventListener("DOMContentLoaded", onLoad, { once: true });
          cleanups.push(() => document.removeEventListener("DOMContentLoaded", onLoad));
        } else {
          const runNow = () => fire(new CustomEvent("laghu:load"));
          if (typeof queueMicrotask !== "undefined") queueMicrotask(runNow);
          else setTimeout(runNow, 0);
        }
      }
      if (triggerInfo.revealed) {
        if (typeof IntersectionObserver !== "undefined") {
          const observerInstance = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                fire(new CustomEvent("laghu:revealed"));
                if (triggerInfo.once) observerInstance.disconnect();
              }
            });
          });
          observerInstance.observe(el);
          cleanups.push(() => observerInstance.disconnect());
        } else {
          fire(new CustomEvent("laghu:revealed"));
        }
      }
      listenTarget.addEventListener(triggerInfo.on, fire);
      cleanups.push(() => listenTarget.removeEventListener(triggerInfo.on, fire));
      onCleanup(el, cleanup);
      return cleanup;
    }
    function numArg(a) {
      const n = Number(a);
      return isNaN(n) ? 0 : n;
    }
    function strArg(a) {
      if (!a) return "";
      const first = a[0];
      const last = a[a.length - 1];
      if (a.length > 1 && (first === '"' || first === "'") && first === last) {
        return a.slice(1, -1);
      }
      return a;
    }
    filters.set("uppercase", (v) => String(v ?? "").toUpperCase());
    filters.set("lowercase", (v) => String(v ?? "").toLowerCase());
    filters.set("json", (v) => {
      try {
        return JSON.stringify(v);
      } catch (e) {
        return String(v);
      }
    });
    filters.set("fixed", (v, a) => {
      const n = Number(v);
      return isNaN(n) ? String(v ?? "") : n.toFixed(numArg(strArg(a)));
    });
    filters.set("currency", (v, a) => {
      const n = Number(v);
      const curr = strArg(a) || "$";
      return isNaN(n) ? String(v ?? "") : curr + n.toFixed(2);
    });
    filters.set("date", (v, a) => {
      const d = new Date(v);
      return isNaN(d.getTime()) ? "" : d.toLocaleDateString(strArg(a) || void 0);
    });
    filters.set("default", (v, a) => {
      return v === null || v === void 0 || v === "" ? strArg(a) : v;
    });
    filters.set("join", (v, a) => {
      return Array.isArray(v) ? v.join(a === "" ? ", " : strArg(a)) : v;
    });
    filters.set("length", (v) => {
      return v == null ? 0 : v.length === void 0 ? 0 : v.length;
    });
    function splitFilters(s) {
      let depth = 0;
      let quoteChar = null;
      let cur = "";
      const parts = [];
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quoteChar) {
          cur += ch;
          if (ch === quoteChar && s[i - 1] !== "\\") quoteChar = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteChar = ch;
          cur += ch;
          continue;
        }
        if (ch === "(" || ch === "[") depth++;
        if (ch === ")" || ch === "]") depth--;
        if (ch === "|" && depth === 0) {
          if (s[i + 1] === "|") {
            cur += "||";
            i++;
            continue;
          }
          parts.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      parts.push(cur);
      const expr = parts.shift();
      const filtersOut = parts.map((p) => {
        const colonIdx = p.indexOf(":");
        if (colonIdx < 0) return [p.trim(), ""];
        return [p.slice(0, colonIdx).trim(), p.slice(colonIdx + 1).trim()];
      });
      return [expr, filtersOut];
    }
    function filterValue(scope, expr, chain) {
      let val = evalExpr(scope, expr);
      for (let i = 0; i < chain.length; i++) {
        const filterFn = filters.get(chain[i][0]);
        if (typeof filterFn !== "function") {
          warnDev('[laghu] unknown filter "' + chain[i][0] + '"');
          continue;
        }
        try {
          val = filterFn(val, chain[i][1], scope);
        } catch (e) {
          reportError(e);
          return val;
        }
      }
      return val;
    }
    function bindTextAndHtml(root, scope) {
      eachEl(root, "[data-bind],[data-text]", (node) => {
        const el = node;
        if (claimed(el, "bind")) return;
        const path = el.getAttribute("data-bind") || el.getAttribute("data-text") || "";
        const [baseExpr, filterChain] = splitFilters(path);
        const stop = effect(() => {
          el.textContent = String(filterValue(scope, baseExpr, filterChain) ?? "");
        });
        onCleanup(el, stop);
      });
      eachEl(root, "[data-html]", (node) => {
        const el = node;
        if (claimed(el, "html")) return;
        const path = el.getAttribute("data-html") || "";
        const stop = effect(() => {
          el.innerHTML = sanitize(String(evalExpr(scope, path) ?? ""));
        });
        onCleanup(el, stop);
      });
    }
    function bindAttributes(root, scope) {
      Array.prototype.forEach.call(allEls(root), (node) => {
        const el = node;
        Array.prototype.forEach.call(el.attributes, (attr) => {
          const attrName = attr.name;
          if (attrName.indexOf("data-bind:") === 0) {
            if (claimed(el, "a:" + attrName)) return;
            const targetAttr = attrName.slice("data-bind:".length);
            const expr = attr.value;
            const stop = effect(() => {
              const v = evalExpr(scope, expr);
              if (v === false || v === null || v === void 0) {
                el.removeAttribute(targetAttr);
              } else if (URL_ATTRS[targetAttr.toLowerCase()] && unsafeUrl(v)) {
                el.removeAttribute(targetAttr);
                warnDev('[laghu] blocked scriptable URL for "' + targetAttr + '"');
              } else {
                el.setAttribute(targetAttr, String(v));
              }
            });
            onCleanup(el, stop);
          } else if (attrName.indexOf("data-class:") === 0) {
            if (claimed(el, "a:" + attrName)) return;
            const className = attrName.slice("data-class:".length);
            const expr = attr.value;
            const stop = effect(() => {
              el.classList.toggle(className, !!evalExpr(scope, expr));
            });
            onCleanup(el, stop);
          } else if (attrName.indexOf("data-style:") === 0) {
            if (claimed(el, "a:" + attrName)) return;
            const styleProp = attrName.slice("data-style:".length);
            const expr = attr.value;
            const stop = effect(() => {
              const v = evalExpr(scope, expr);
              el.style[styleProp] = v === false || v === null || v === void 0 ? "" : String(v);
            });
            onCleanup(el, stop);
          }
        });
      });
    }
    function bindModelInput(el, scope, path, isCheck, isRadio, isSelect) {
      const handler = function() {
        if (isCheck) {
          const cur = evalExpr(scope, path);
          if (Array.isArray(cur)) {
            const arr = cur.slice();
            const ix = arr.indexOf(el.value);
            if (el.checked && ix < 0) arr.push(el.value);
            if (!el.checked && ix >= 0) arr.splice(ix, 1);
            setPath(scope, path, arr);
          } else {
            setPath(scope, path, el.checked);
          }
        } else if (isSelect) {
          const selectedValues = [];
          Array.prototype.forEach.call(el.options, (opt) => {
            if (opt.selected) selectedValues.push(opt.value);
          });
          setPath(scope, path, selectedValues);
        } else if (el.type === "number") {
          setPath(scope, path, el.value === "" ? null : Number(el.value));
        } else {
          setPath(scope, path, el.value);
        }
      };
      const eventName = isCheck || isRadio || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(eventName, handler);
      onCleanup(el, () => el.removeEventListener(eventName, handler));
    }
    function bindModel(root, scope) {
      eachEl(root, "[data-model]", (node) => {
        const el = node;
        if (claimed(el, "model")) return;
        const path = el.getAttribute("data-model") || "";
        const isCheck = el.type === "checkbox";
        const isRadio = el.type === "radio";
        const isSelect = el.tagName === "SELECT" && el.multiple;
        const stop = effect(() => {
          const v = evalExpr(scope, path);
          if (document.activeElement === el && !isCheck && !isRadio) {
            if (el.value === String(v ?? "")) return;
          }
          if (isCheck) {
            if (Array.isArray(v)) el.checked = v.indexOf(el.value) >= 0;
            else el.checked = !!v;
          } else if (isRadio) {
            el.checked = String(v ?? "") === String(el.value);
          } else if (isSelect) {
            const arr = Array.isArray(v) ? v.map(String) : [];
            Array.prototype.forEach.call(el.options, (opt) => {
              opt.selected = arr.indexOf(String(opt.value)) >= 0;
            });
          } else if (el.tagName === "SELECT" || el.value !== void 0) {
            el.value = v === void 0 || v === null ? "" : String(v);
          }
        });
        onCleanup(el, stop);
        bindModelInput(el, scope, path, isCheck, isRadio, isSelect);
      });
    }
    function bindConditionals(root, scope) {
      eachEl(root, "[data-show]", (node) => {
        const el = node;
        if (claimed(el, "show")) return;
        const expr = el.getAttribute("data-show") || "";
        const stop = effect(() => {
          setHidden(el, !evalExpr(scope, expr));
        });
        onCleanup(el, stop);
      });
      eachEl(root, "[data-if]", (node) => {
        const el = node;
        if (el.tagName === "TEMPLATE") return;
        if (claimed(el, "if")) return;
        const expr = el.getAttribute("data-if") || "";
        const stop = effect(() => {
          setHidden(el, !evalExpr(scope, expr));
        });
        onCleanup(el, stop);
      });
    }
    function bindTemplateIf(root, scope, actions) {
      eachEl(root, "template[data-if]", (node) => {
        const tpl = node;
        const expr = tpl.getAttribute("data-if") || "";
        if (claimed(tpl, "tif")) return;
        const anchor = document.createComment("b-if");
        if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
        let frag = null;
        const stop = effect(() => {
          const on = !!evalExpr(scope, expr);
          if (on && !frag) {
            frag = tpl.content.cloneNode(true);
            if (anchor.parentNode) {
              anchor.parentNode.insertBefore(frag, anchor.nextSibling);
              if (anchor.parentNode instanceof Element) {
                hydrate(anchor.parentNode, scope, actions);
                let nn = anchor.nextSibling;
                while (nn && nn !== tpl) {
                  const nx2 = nn.nextSibling;
                  if (nn instanceof Element) playEnter(nn);
                  nn = nx2;
                }
              }
            }
          } else if (!on && frag) {
            let current = anchor.nextSibling;
            while (current && current !== tpl) {
              const next = current.nextSibling;
              if (current instanceof Element) destroyTree(current);
              if (current.parentNode) current.parentNode.removeChild(current);
              current = next;
            }
            frag = null;
          }
        });
        onCleanup(tpl, stop);
      });
    }
    function renderRows(tpl, anchor, scope, actions, itemVar, idxVar, listExpr, keyExpr, rows) {
      let list = evalExpr(scope, listExpr) || [];
      if (!Array.isArray(list)) {
        warnDev("[laghu] data-for not array: " + listExpr);
        list = [];
      }
      const parent = anchor.parentNode;
      if (!parent) return;
      const seen = /* @__PURE__ */ new Set();
      const order = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        let key = i;
        if (keyExpr) {
          let ki = evalExpr(item, keyExpr);
          if (ki === void 0 || ki === null) {
            const tmpVars = { [itemVar]: item };
            ki = evalExpr(childScope(scope, tmpVars), keyExpr);
          }
          if (ki !== void 0 && ki !== null) key = ki;
        }
        seen.add(key);
        order.push(key);
        const row = rows.get(key);
        if (!row) {
          const rsVars = { [itemVar]: item };
          if (idxVar) rsVars[idxVar] = i;
          const rs = childScope(scope, rsVars);
          const frag = tpl.content.cloneNode(true);
          const holder = document.createElement("span");
          holder.style.display = "contents";
          holder.setAttribute("data-bkey", String(key));
          holder.appendChild(frag);
          parent.insertBefore(holder, anchor);
          hydrate(holder, rs, actions);
          playEnter(holder);
          rows.set(key, { nodes: [holder], scope: rs });
        } else {
          const prevItem = row.scope[itemVar];
          const prevIdx = idxVar ? row.scope[idxVar] : -1;
          row.scope[itemVar] = item;
          if (idxVar) row.scope[idxVar] = i;
          if (prevItem !== item || idxVar && prevIdx !== i) {
            const h0 = row.nodes[0];
            destroyTree(h0);
            hydrate(h0, row.scope, actions);
          }
        }
      }
      const seq = [];
      const children = parent.childNodes;
      for (let q = 0; q < children.length; q++) {
        const child = children[q];
        if (child.nodeType === 1 && child.hasAttribute("data-bkey")) {
          seq.push(child.getAttribute("data-bkey") || "");
        }
      }
      let sameOrder = seq.length === order.length;
      if (sameOrder) {
        for (let k = 0; k < order.length; k++) {
          if (seq[k] !== String(order[k])) {
            sameOrder = false;
            break;
          }
        }
      }
      if (!sameOrder) {
        for (let j = 0; j < order.length; j++) {
          const r2 = rows.get(order[j]);
          parent.insertBefore(r2.nodes[0], anchor);
        }
      }
      rows.forEach((rObj, k) => {
        if (!seen.has(k)) {
          rObj.nodes.forEach((n) => {
            destroyTree(n);
            if (n.parentNode) n.parentNode.removeChild(n);
          });
          rows.delete(k);
        }
      });
    }
    function bindTemplateFor(root, scope, actions) {
      eachEl(root, "template[data-for]", (node) => {
        const tpl = node;
        const spec = tpl.getAttribute("data-for") || "";
        if (claimed(tpl, "tfor")) return;
        const match = spec.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(.+)\s*$/);
        if (!match) {
          warnDev('[laghu] bad data-for "' + spec + '"');
          return;
        }
        const itemVar = match[1];
        const idxVar = match[2];
        const listExpr = match[3];
        const keyExpr = tpl.getAttribute("data-key") || "";
        const anchor = document.createComment("b-for");
        if (tpl.parentNode) tpl.parentNode.insertBefore(anchor, tpl);
        const rows = /* @__PURE__ */ new Map();
        const stop = effect(() => {
          renderRows(tpl, anchor, scope, actions, itemVar, idxVar, listExpr, keyExpr, rows);
        });
        onCleanup(tpl, stop);
      });
    }
    function bindEventsAndActions(root, scope, actions) {
      eachEl(root, "[data-click]", (node) => {
        const el = node;
        if (claimed(el, "click")) return;
        const code = el.getAttribute("data-click") || "";
        const spec = el.getAttribute("data-trigger") || "click";
        bindTrigger(el, spec, () => {
          execAction(scope, actions, code);
        });
      });
      Array.prototype.forEach.call(allEls(root), (node) => {
        const el = node;
        Array.prototype.forEach.call(el.attributes, (attr) => {
          if (attr.name.indexOf("data-on:") === 0) {
            if (claimed(el, "on:" + attr.name)) return;
            const raw = attr.name.slice("data-on:".length);
            const parts = raw.split(".");
            const evName = parts[0];
            const mods = parts.slice(1);
            const code = attr.value;
            const spec = el.getAttribute("data-trigger") || evName;
            bindTrigger(el, spec, (e) => {
              if (mods.indexOf("prevent") >= 0) e.preventDefault();
              if (mods.indexOf("stop") >= 0) e.stopPropagation();
              const childSc = childScope(scope, { $event: e });
              execAction(childSc, actions, code);
              if (mods.indexOf("once") >= 0) {
                try {
                  el.removeAttribute(attr.name);
                } catch (err) {
                }
              }
            });
          }
        });
      });
      eachEl(root, "[data-init]", (node) => {
        const el = node;
        if (claimed(el, "init")) return;
        const code = el.getAttribute("data-init") || "";
        try {
          execAction(scope, actions, code);
        } catch (e) {
          reportError(e);
        }
      });
    }
    function bindCustomDirectives(root, scope) {
      directives.forEach((fn, dirName) => {
        eachEl(root, "[data-" + dirName + "]", (node) => {
          const el = node;
          if (claimed(el, "dir:" + dirName)) return;
          try {
            const cleanupFn = fn({
              el,
              get: () => evalExpr(scope, el.getAttribute("data-" + dirName) || ""),
              effect,
              scope
            });
            if (typeof cleanupFn === "function") onCleanup(el, cleanupFn);
          } catch (e) {
            reportError(e);
          }
        });
      });
    }
    function buildFetchOptions(el, method, ctrl) {
      const opts = {
        method,
        headers: { Accept: "application/json, text/html" },
        signal: ctrl ? ctrl.signal : void 0
      };
      let urlSuffix = "";
      const valsRaw = el.getAttribute("data-vals");
      if (valsRaw) {
        const wantForm = valsRaw.trim() === "form";
        const hostForm = el instanceof HTMLFormElement ? el : el.closest("form");
        const values = wantForm ? hostForm ? serializeForm(hostForm) : {} : tryJSON(valsRaw) || {};
        if (hostForm && !wantForm) {
          const formVals = serializeForm(hostForm);
          for (const k in formVals) values[k] = formVals[k];
        }
        if (method === "GET") {
          const queryParts = [];
          for (const qk in values) {
            if (Array.isArray(values[qk])) {
              for (let qi = 0; qi < values[qk].length; qi++) {
                queryParts.push(encodeURIComponent(qk) + "=" + encodeURIComponent(String(values[qk][qi])));
              }
            } else {
              queryParts.push(encodeURIComponent(qk) + "=" + encodeURIComponent(String(values[qk])));
            }
          }
          if (queryParts.length) urlSuffix = queryParts.join("&");
        } else {
          opts.headers["Content-Type"] = "application/json";
          opts.body = JSON.stringify(values);
        }
      } else if (method !== "GET") {
        const formEl = el instanceof HTMLFormElement ? el : el.closest("form");
        if (formEl) {
          opts.headers["Content-Type"] = "application/json";
          opts.body = JSON.stringify(serializeForm(formEl));
        }
      }
      const headersRaw = el.getAttribute("data-headers");
      if (headersRaw) {
        const parsedHeaders = tryJSON(headersRaw) || {};
        for (const hk in parsedHeaders) opts.headers[hk] = parsedHeaders[hk];
      }
      return { opts, urlSuffix };
    }
    function handleFetchResponse(el, res, scope, url, targetSel, swap, actions) {
      if (!res.ok) {
        setPath(scope, "$error", { status: res.status, url });
        el.dispatchEvent(
          new CustomEvent("laghu:request-error", {
            bubbles: true,
            detail: { status: res.status, url }
          })
        );
        return Promise.resolve();
      }
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType.indexOf("json") >= 0) {
        return res.json().then((data) => {
          setPath(scope, "$error", null);
          if (data && typeof data === "object" && !Array.isArray(data)) {
            Object.assign(scope, data);
          } else {
            setPath(scope, "result", data);
          }
        });
      }
      return res.text().then((textHtml) => {
        let finalHtml = textHtml;
        const selectSel = el.getAttribute("data-select");
        if (selectSel) {
          const tmp = document.createElement("template");
          tmp.innerHTML = sanitize(textHtml);
          const picked = tmp.content.querySelector(selectSel);
          finalHtml = picked ? picked.outerHTML : "";
        }
        const target = targetSel ? document.querySelector(targetSel) : el;
        if (!target) return;
        swapHtml(target, finalHtml, swap, scope, actions);
      });
    }
    function doFetch(el, scope, method, url, targetSel, swap) {
      const triggerData = parseTrigger(el.getAttribute("data-trigger") || defaultEvent(el), el);
      const self = el;
      if (!self._bReqs) self._bReqs = /* @__PURE__ */ new Set();
      if (self._bN > 0 && (triggerData.queue === "first" || triggerData.queue === "none")) return;
      if (triggerData.queue === "last") {
        self._bReqs.forEach((c) => {
          try {
            c.abort();
          } catch (e) {
          }
        });
        self._bReqs.clear();
      }
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (ctrl) self._bReqs.add(ctrl);
      self._bN = (self._bN || 0) + 1;
      let timedOut = false;
      const timeoutMs = parseMs(el.getAttribute("data-timeout") || "");
      let timer = 0;
      if (timeoutMs > 0 && ctrl) {
        timer = setTimeout(() => {
          timedOut = true;
          try {
            ctrl.abort();
          } catch (e) {
          }
        }, timeoutMs);
      }
      const actions = self._bActions;
      const setBusy = (on) => {
        const indSel = el.getAttribute("data-indicator");
        const ind = indSel ? document.querySelector(indSel) : null;
        if (ind && ind instanceof HTMLElement) ind.hidden = !on;
        if (on) {
          el.setAttribute("data-request", "");
          el.setAttribute("data-pending", "");
        } else {
          el.removeAttribute("data-request");
          el.removeAttribute("data-pending");
        }
        if (el.hasAttribute("data-disable")) el.toggleAttribute("disabled", on);
      };
      setBusy(true);
      const beforeEvt = new CustomEvent("laghu:before-request", {
        bubbles: true,
        cancelable: true,
        detail: { url, method }
      });
      let finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (ctrl) self._bReqs.delete(ctrl);
        self._bN = Math.max(0, self._bN - 1);
        setBusy(false);
      }
      if (!el.dispatchEvent(beforeEvt)) {
        finish();
        return;
      }
      const { opts, urlSuffix } = buildFetchOptions(el, method, ctrl);
      let requestUrl = url;
      if (urlSuffix) {
        requestUrl += (requestUrl.indexOf("?") >= 0 ? "&" : "?") + urlSuffix;
      }
      fetch(requestUrl, opts).then((res) => {
        finish();
        el.dispatchEvent(
          new CustomEvent("laghu:after-request", {
            bubbles: true,
            detail: { status: res.status, url: requestUrl }
          })
        );
        return handleFetchResponse(el, res, scope, requestUrl, targetSel, swap, actions);
      }).catch((err) => {
        finish();
        if (err && err.name === "AbortError" && !timedOut) return;
        setPath(scope, "$error", {
          message: String(err && err.message || err),
          timeout: timedOut
        });
        el.dispatchEvent(
          new CustomEvent("laghu:request-error", {
            bubbles: true,
            detail: { error: err, timeout: timedOut }
          })
        );
        reportError(err);
      });
    }
    function setupFetch(el, scope, method, url, actions) {
      const targetSel = el.getAttribute("data-target") || "";
      const swap = el.getAttribute("data-swap") || "inner";
      const triggerSpec = el.getAttribute("data-trigger") || defaultEvent(el);
      el._bActions = actions;
      const fire = function(e) {
        if (el instanceof HTMLFormElement && e && e.type === "submit" && e.cancelable) {
          e.preventDefault();
        }
        doFetch(el, scope, method, url, targetSel, swap);
      };
      bindTrigger(el, triggerSpec, fire);
    }
    function bindDeclarativeFetch(root, scope, actions) {
      Array.prototype.forEach.call(allEls(root), (node) => {
        const el = node;
        let method = "";
        let url = "";
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
        if (!url && !el.hasAttribute("data-get") && !el.hasAttribute("data-post") && !el.hasAttribute("data-put") && !el.hasAttribute("data-patch") && !el.hasAttribute("data-delete")) {
          return;
        }
        method = (el.getAttribute("data-method") || method).toUpperCase();
        if (claimed(el, "fetch")) return;
        setupFetch(el, scope, method, url, actions);
      });
    }
    function tryJSON(s) {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    }
    function serializeForm(form) {
      const out = {};
      const fd = new FormData(form);
      fd.forEach((v, k) => {
        const strVal = typeof v === "string" ? v : String(v);
        if (k in out) {
          if (!Array.isArray(out[k])) out[k] = [out[k]];
          out[k].push(strVal);
        } else {
          out[k] = strVal;
        }
      });
      return out;
    }
    function executeSwap(target, frag, mode, text) {
      if (mode === "inner") {
        target.innerHTML = "";
        target.appendChild(frag);
      } else if (mode === "text") {
        target.textContent = text;
      } else if (mode === "outer") {
        target.replaceWith(frag);
      } else if (mode === "append" || mode === "beforeend") {
        target.appendChild(frag);
      } else if (mode === "prepend" || mode === "afterbegin") {
        target.insertBefore(frag, target.firstChild);
      } else if (mode === "beforebegin") {
        if (target.parentNode) target.parentNode.insertBefore(frag, target);
      } else if (mode === "afterend") {
        if (target.parentNode) target.parentNode.insertBefore(frag, target.nextSibling);
      } else {
        target.innerHTML = "";
        target.appendChild(frag);
      }
    }
    function restorePreserved(target, kept) {
      kept.forEach((node, id) => {
        let sel = "#";
        try {
          const escaped = typeof CSS !== "undefined" && CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
          sel = "#" + escaped;
        } catch (e) {
          sel = '[id="' + String(id).replace(/"/g, "") + '"]';
        }
        let fresh = target.querySelector(sel);
        if (!fresh) fresh = document.getElementById(id);
        if (fresh && fresh !== node && node.parentNode !== fresh) {
          fresh.replaceWith(node);
        }
      });
    }
    function restoreFocus(id, selStart, selEnd) {
      if (!id) return;
      const focusedEl = document.getElementById(id);
      if (focusedEl && focusedEl instanceof HTMLElement) {
        try {
          focusedEl.focus({ preventScroll: true });
        } catch (e) {
          try {
            focusedEl.focus();
          } catch (e2) {
          }
        }
        try {
          if (selStart >= 0 && focusedEl.setSelectionRange) {
            focusedEl.setSelectionRange(selStart, selEnd);
          }
        } catch (e) {
        }
      }
    }
    function swapHtml(target, html, swap = "inner", scope = {}, actions = {}) {
      let mode = String(swap || "inner").toLowerCase();
      if (mode === "none") {
        target.dispatchEvent(
          new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: mode } })
        );
        return;
      }
      const activeEl = document.activeElement;
      const focusId = activeEl && activeEl.id ? activeEl.id : null;
      const selStart = activeEl && typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : -1;
      const selEnd = activeEl && typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : -1;
      target.dispatchEvent(
        new CustomEvent("laghu:before-swap", {
          bubbles: true,
          cancelable: false,
          detail: { swap: mode }
        })
      );
      const isMorph = mode.indexOf("morph") === 0;
      const morphPlugin = window.LaghuMorph;
      if (isMorph) {
        if (morphPlugin && morphPlugin.morph) {
          morphPlugin.morph(target, sanitize(html), { mode: mode === "morph:outer" ? "outer" : "inner" });
          hydrate(target, scope, actions);
          target.dispatchEvent(
            new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: mode } })
          );
          restoreFocus(focusId, selStart, selEnd);
          return;
        }
        warnDev('[laghu] data-swap="morph" needs morph.js (window.LaghuMorph). Falling back to inner.');
        mode = "inner";
      }
      if (mode === "delete") {
        destroyTree(target);
        if (target.parentNode) target.parentNode.removeChild(target);
        return;
      }
      const tmp = document.createElement("template");
      tmp.innerHTML = sanitize(html);
      const frag = tmp.content;
      const kept = /* @__PURE__ */ new Map();
      target.querySelectorAll("[data-preserve][id]").forEach((node) => {
        kept.set(node.id, node);
      });
      destroyTree(target);
      executeSwap(target, frag, mode, tmp.content.textContent || "");
      restorePreserved(target, kept);
      hydrate(target, scope, actions);
      playEnter(target);
      target.dispatchEvent(
        new CustomEvent("laghu:after-swap", { bubbles: true, detail: { swap: mode } })
      );
      restoreFocus(focusId, selStart, selEnd);
    }
    function upgradePredefinedProps(element, initial) {
      for (const key in initial) {
        if (Object.prototype.hasOwnProperty.call(element, key)) {
          try {
            initial[key] = element[key];
            delete element[key];
          } catch (e) {
          }
        }
      }
    }
    function syncAttributesOnConnect(element, initial, observed) {
      const pend = element._bPend;
      if (pend) {
        for (const pk in pend) {
          if (pk in initial) initial[pk] = coerceAttr(pend[pk], initial[pk]);
          else initial[pk] = pend[pk];
        }
        element._bPend = null;
      } else {
        for (let i = 0; i < observed.length; i++) {
          const attrName = observed[i];
          if (element.hasAttribute && element.hasAttribute(attrName) && attrName in initial) {
            initial[attrName] = coerceAttr(element.getAttribute(attrName), initial[attrName]);
          }
        }
      }
    }
    function define(tag, setup) {
      if (!tag || tag.indexOf("-") < 0) {
        throw new Error("[laghu] tag must contain hyphen: " + tag);
      }
      const probe = setup() || {};
      const observedAttrs = probe.observed || Object.keys(probe.state || {}).filter((k) => {
        const val = probe.state[k];
        return typeof val === "string" || typeof val === "number" || typeof val === "boolean";
      });
      const ComponentClass = class extends HTMLElement {
        connectedCallback() {
          if (this._bInit) return;
          this._bInit = true;
          const config = setup() || {};
          const initial = config.state || {};
          upgradePredefinedProps(this, initial);
          syncAttributesOnConnect(this, initial, observedAttrs);
          const state = reactive(initial);
          this.state = state;
          this.actions = config.actions || {};
          if (typeof config.onUnmount === "function") this._bOnUnmount = config.onUnmount;
          hydrate(this, state, config.actions || {});
          try {
            if (typeof config.onMount === "function") config.onMount.call(state);
          } catch (e) {
            reportError(e);
          }
          this.classList.add("is-defined");
          this.dispatchEvent(new CustomEvent("laghu:mount"));
        }
        disconnectedCallback() {
          try {
            const st = this.state;
            const un = this._bOnUnmount;
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
        attributeChangedCallback(name, oldVal, newVal) {
          if (oldVal === newVal) return;
          const st = this.state;
          if (st && name in st) {
            st[name] = coerceAttr(newVal, st[name]);
          } else {
            const p = this._bPend || {};
            p[name] = newVal;
            this._bPend = p;
          }
        }
      };
      ComponentClass.observedAttributes = observedAttrs;
      customElements.define(tag, ComponentClass);
      return ComponentClass;
    }
    let mutationObserver = null;
    function autoObserve() {
      if (mutationObserver || typeof MutationObserver === "undefined") return;
      mutationObserver = new MutationObserver((mutations) => {
        const added = /* @__PURE__ */ new Set();
        mutations.forEach((m) => {
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) added.add(n);
          });
        });
        mutations.forEach((m) => {
          m.addedNodes.forEach((n) => {
            if (n instanceof Element && n.hasAttribute && n.hasAttribute("data-scope") && !n._bScope) {
              try {
                const apiInstance = window.Laghu;
                if (apiInstance) {
                  apiInstance.hydrate(n, parseScope(n.getAttribute("data-scope")), {});
                }
              } catch (e) {
                reportError(e);
              }
            }
          });
          m.removedNodes.forEach((n) => {
            if (n instanceof Element && !added.has(n)) destroyTree(n);
          });
        });
      });
      mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    function seedErrorSlot(scope) {
      try {
        if (isObj(scope) && !("$error" in Object(scope))) setPath(scope, "$error", null);
      } catch {
      }
    }
    function hydrate(root, state, actions = {}) {
      const scope = state;
      seedErrorSlot(scope);
      bindTextAndHtml(root, scope);
      bindAttributes(root, scope);
      bindModel(root, scope);
      bindConditionals(root, scope);
      bindTemplateIf(root, scope, actions);
      bindTemplateFor(root, scope, actions);
      bindEventsAndActions(root, scope, actions);
      bindCustomDirectives(root, scope);
      bindDeclarativeFetch(root, scope, actions);
    }
    const api = {
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
      sanitize(fn) {
        if (typeof fn === "function") sanitize = fn;
        else sanitize = defaultSanitize;
      },
      hydrate(root, state, actions) {
        const s = reactive(state || parseScope(root.getAttribute("data-scope")));
        root._bScope = s;
        hydrate(root, s, actions || {});
        return s;
      },
      destroyTree,
      store(name, init) {
        if (init !== void 0) {
          const s = reactive(init);
          stores.set(name, s);
          return s;
        }
        return stores.get(name);
      },
      computed(fn) {
        const box = reactive({ v: void 0 });
        effect(() => {
          box.v = fn();
        });
        return () => box.v;
      },
      watch(scope, expr, cb) {
        let started = false;
        let prev;
        return effect(() => {
          const next = evalExpr(scope, expr);
          if (!started) {
            started = true;
            prev = next;
            return;
          }
          if (next !== prev) {
            const oldVal = prev;
            prev = next;
            cb(next, oldVal);
          }
        });
      },
      persist(name, opts) {
        const options = opts || {};
        const key = options.key || "laghu:" + name;
        const ver = options.version === void 0 ? 1 : options.version;
        const wait = options.debounce === void 0 ? 300 : options.debounce;
        const st = stores.get(name);
        if (!st) return null;
        try {
          const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved && saved.v === ver && saved.state && typeof saved.state === "object") {
              Object.assign(st, saved.state);
            }
          }
        } catch (e) {
          reportError(e);
        }
        let timer = 0;
        effect(() => {
          JSON.stringify(st);
          if (typeof localStorage === "undefined") return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              localStorage.setItem(key, JSON.stringify({ v: ver, state: st }));
            } catch (e) {
              reportError(e);
            }
          }, wait);
        });
        return st;
      },
      directive(name, fn) {
        directives.set(name, fn);
      },
      filter(name, fn) {
        filters.set(name, fn);
      },
      scope(parent, vars) {
        return childScope(parent, vars || {});
      },
      init() {
        if (typeof document !== "undefined") {
          document.addEventListener("DOMContentLoaded", () => {
            autoObserve();
            document.querySelectorAll("[data-scope]").forEach((node) => {
              const el = node;
              if (el._bScope) return;
              api.hydrate(el, parseScope(el.getAttribute("data-scope")), {});
            });
          });
        }
      }
    };
    api.init();
    return api;
  })();

  // src/laghu.global.ts
  window.Laghu = Laghu;
})();
