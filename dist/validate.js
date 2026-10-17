"use strict";
(() => {
  // src/validate.ts
  var LaghuValidate = (() => {
    "use strict";
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function parseRules(spec) {
      return String(spec || "").split("|").map(function(p) {
        return p.trim();
      }).filter(Boolean).map(function(p) {
        var i = p.indexOf(":");
        if (i < 0) return { name: p, arg: "" };
        return { name: p.slice(0, i).trim(), arg: p.slice(i + 1).trim() };
      });
    }
    function ownerForm(el) {
      if (el instanceof HTMLFormElement) return el;
      if (el.closest) {
        var f = el.closest("form");
        if (f instanceof HTMLFormElement) return f;
      }
      return null;
    }
    function errorSlot(el, name) {
      var form = ownerForm(el);
      var sel = '[data-errors-for="' + name.replace(/"/g, "") + '"]';
      var found = form ? form.querySelector(sel) : null;
      if (found) return found;
      return typeof document !== "undefined" ? document.querySelector(sel) : null;
    }
    function validateField(el) {
      var spec = el.getAttribute("data-validate") || "";
      var rules = parseRules(spec);
      var name = el.getAttribute("name") || el.id || "field";
      var val = "value" in el ? String(el.value) : "";
      var msg = null;
      for (var i = 0; i < rules.length && !msg; i++) {
        var r = rules[i];
        if (r.name === "required" && !val.trim()) msg = name + " is required";
        else if (val !== "") {
          if (r.name === "email" && !EMAIL.test(val)) msg = name + " must be an email";
          else if (r.name === "number" && isNaN(Number(val))) msg = name + " must be a number";
          else if (r.name === "min" && val.length < Number(r.arg))
            msg = name + " needs at least " + r.arg + " characters";
          else if (r.name === "max" && val.length > Number(r.arg))
            msg = name + " needs at most " + r.arg + " characters";
          else if (r.name === "minv" && Number(val) < Number(r.arg))
            msg = name + " must be at least " + r.arg;
          else if (r.name === "maxv" && Number(val) > Number(r.arg))
            msg = name + " must be at most " + r.arg;
          else if (r.name === "match") {
            var form = ownerForm(el);
            var other = form ? form.querySelector('[name="' + r.arg.replace(/"/g, "") + '"]') : null;
            var ov = other && "value" in other ? String(other.value) : "";
            if (val !== ov) msg = name + " must match " + r.arg;
          }
        }
      }
      var custom = el.getAttribute("data-message");
      if (msg && custom) msg = custom;
      var slot = errorSlot(el, el.getAttribute("name") || "");
      if (slot) slot.textContent = msg || "";
      el.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) el.setAttribute("data-invalid", "");
      else el.removeAttribute("data-invalid");
      return msg;
    }
    function validateForm(form) {
      var bad = null;
      Array.prototype.forEach.call(form.querySelectorAll("[data-validate]"), function(node) {
        var el = node;
        el._bTouched = true;
        if (validateField(el) && !bad) bad = el;
      });
      if (bad) {
        try {
          bad.focus();
        } catch (e) {
        }
        return false;
      }
      return true;
    }
    function wireInput(el) {
      if (el._bVal) return;
      el._bVal = true;
      el.addEventListener("input", function() {
        if (el._bTouched || el.form && el.form._bTried) validateField(el);
      });
      el.addEventListener("change", function() {
        el._bTouched = true;
        validateField(el);
      });
    }
    function wireForm(form) {
      if (form._bValForm) return;
      form._bValForm = true;
      Array.prototype.forEach.call(form.querySelectorAll("[data-validate]"), wireInput);
      form.addEventListener("submit", function(e) {
        form._bTried = true;
        if (!validateForm(form)) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (!form.getAttribute("action") && e.cancelable) e.preventDefault();
      });
    }
    function scan(root) {
      if (!root.querySelectorAll) return;
      Array.prototype.forEach.call(root.querySelectorAll("[data-validate]"), wireInput);
      Array.prototype.forEach.call(root.querySelectorAll("form[data-form]"), wireForm);
    }
    var api = {
      version: "1.2.0",
      validateField,
      validateForm,
      parseRules,
      scan
    };
    function watch() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      if (!document.documentElement) return;
      var mo = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
          m.addedNodes.forEach(function(n) {
            if (!(n instanceof Element)) return;
            if (n.hasAttribute("data-validate")) wireInput(n);
            if (n.tagName === "FORM" && n.hasAttribute("data-form")) wireForm(n);
            if (n.querySelectorAll) {
              Array.prototype.forEach.call(n.querySelectorAll("[data-validate]"), wireInput);
              Array.prototype.forEach.call(n.querySelectorAll("form[data-form]"), wireForm);
            }
          });
        });
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
    if (typeof document !== "undefined") {
      document.addEventListener("DOMContentLoaded", function() {
        scan(document);
        watch();
      });
      if (document.readyState !== "loading") {
        scan(document);
        watch();
      }
    }
    return api;
  })();

  // src/validate.global.ts
  window.LaghuValidate = LaghuValidate;
})();
