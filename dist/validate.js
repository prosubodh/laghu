"use strict";
(() => {
  // src/validate.ts
  var LaghuValidate = (() => {
    "use strict";
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function parseRules(spec) {
      return String(spec || "").split("|").map((part) => part.trim()).filter(Boolean).map((part) => {
        const colonIndex = part.indexOf(":");
        if (colonIndex < 0) return { name: part, arg: "" };
        return {
          name: part.slice(0, colonIndex).trim(),
          arg: part.slice(colonIndex + 1).trim()
        };
      });
    }
    function ownerForm(element) {
      if (element instanceof HTMLFormElement) return element;
      if (element.closest) {
        const form = element.closest("form");
        if (form instanceof HTMLFormElement) return form;
      }
      return null;
    }
    function findErrorSlot(element, fieldName) {
      const parentForm = ownerForm(element);
      const selector = `[data-errors-for="${fieldName.replace(/"/g, "")}"]`;
      const inForm = parentForm ? parentForm.querySelector(selector) : null;
      if (inForm) return inForm;
      return typeof document !== "undefined" ? document.querySelector(selector) : null;
    }
    function evaluateRule(rule, value, fieldName, element) {
      if (rule.name === "required" && !value.trim()) {
        return `${fieldName} is required`;
      }
      if (value === "") return null;
      switch (rule.name) {
        case "email":
          return !EMAIL_PATTERN.test(value) ? `${fieldName} must be an email` : null;
        case "number":
          return isNaN(Number(value)) ? `${fieldName} must be a number` : null;
        case "min":
          return value.length < Number(rule.arg) ? `${fieldName} needs at least ${rule.arg} characters` : null;
        case "max":
          return value.length > Number(rule.arg) ? `${fieldName} needs at most ${rule.arg} characters` : null;
        case "minv":
          return Number(value) < Number(rule.arg) ? `${fieldName} must be at least ${rule.arg}` : null;
        case "maxv":
          return Number(value) > Number(rule.arg) ? `${fieldName} must be at most ${rule.arg}` : null;
        case "match": {
          const parentForm = ownerForm(element);
          const matchSelector = `[name="${rule.arg.replace(/"/g, "")}"]`;
          const otherElement = parentForm ? parentForm.querySelector(matchSelector) : null;
          const otherValue = otherElement && "value" in otherElement ? String(otherElement.value) : "";
          return value !== otherValue ? `${fieldName} must match ${rule.arg}` : null;
        }
        default:
          return null;
      }
    }
    function validateField(element) {
      const spec = element.getAttribute("data-validate") || "";
      const rules = parseRules(spec);
      const fieldName = element.getAttribute("name") || element.id || "field";
      const fieldValue = "value" in element ? String(element.value) : "";
      let errorMessage = null;
      for (let index = 0; index < rules.length; index++) {
        errorMessage = evaluateRule(rules[index], fieldValue, fieldName, element);
        if (errorMessage) break;
      }
      const customMessage = element.getAttribute("data-message");
      if (errorMessage && customMessage) {
        errorMessage = customMessage;
      }
      const slot = findErrorSlot(element, fieldName);
      if (slot) {
        slot.textContent = errorMessage || "";
      }
      element.setAttribute("aria-invalid", errorMessage ? "true" : "false");
      if (errorMessage) {
        element.setAttribute("data-invalid", "");
      } else {
        element.removeAttribute("data-invalid");
      }
      return errorMessage;
    }
    function validateForm(formElement) {
      let firstInvalidField = null;
      const fields = formElement.querySelectorAll("[data-validate]");
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        field._bTouched = true;
        if (validateField(field) && !firstInvalidField) {
          firstInvalidField = field;
        }
      }
      if (firstInvalidField) {
        try {
          firstInvalidField.focus();
        } catch {
        }
        return false;
      }
      return true;
    }
    function wireField(element) {
      if (element._bVal) return;
      element._bVal = true;
      element.addEventListener("input", () => {
        if (element._bTouched || element.form && element.form._bTried) {
          validateField(element);
        }
      });
      element.addEventListener("change", () => {
        element._bTouched = true;
        validateField(element);
      });
    }
    function wireForm(formElement) {
      if (formElement._bValForm) return;
      formElement._bValForm = true;
      const fields = formElement.querySelectorAll("[data-validate]");
      for (let index = 0; index < fields.length; index++) {
        wireField(fields[index]);
      }
      formElement.addEventListener("submit", (event) => {
        formElement._bTried = true;
        if (!validateForm(formElement)) {
          if (event.cancelable) event.preventDefault();
          return;
        }
        if (!formElement.getAttribute("action") && event.cancelable) {
          event.preventDefault();
        }
      });
    }
    function scan(root) {
      if (!root || !root.querySelectorAll) return;
      const fields = root.querySelectorAll("[data-validate]");
      for (let index = 0; index < fields.length; index++) {
        wireField(fields[index]);
      }
      const forms = root.querySelectorAll("form[data-form]");
      for (let index = 0; index < forms.length; index++) {
        wireForm(forms[index]);
      }
    }
    function watch() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      if (!document.documentElement) return;
      const observer = new MutationObserver((mutations) => {
        for (let m = 0; m < mutations.length; m++) {
          const addedNodes = mutations[m].addedNodes;
          for (let n = 0; n < addedNodes.length; n++) {
            const node = addedNodes[n];
            if (!(node instanceof Element)) continue;
            if (node.hasAttribute("data-validate")) wireField(node);
            if (node.tagName === "FORM" && node.hasAttribute("data-form")) wireForm(node);
            if (node.querySelectorAll) {
              const nestedFields = node.querySelectorAll("[data-validate]");
              for (let i = 0; i < nestedFields.length; i++) wireField(nestedFields[i]);
              const nestedForms = node.querySelectorAll("form[data-form]");
              for (let i = 0; i < nestedForms.length; i++) wireForm(nestedForms[i]);
            }
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    function init() {
      if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
          scan(document);
          watch();
        });
        if (document.readyState !== "loading") {
          scan(document);
          watch();
        }
      }
    }
    init();
    return {
      version: "1.2.0",
      validateField,
      validateForm,
      parseRules,
      scan,
      watch,
      init
    };
  })();

  // src/validate.global.ts
  window.LaghuValidate = LaghuValidate;
})();
