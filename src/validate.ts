// @ts-check
/**
 * laghu validation plugin (opt-in, separate file, own 2kB gzip budget).
 *
 * Declarative rules on inputs, errors next to fields, submit guards
 * on forms. No schemas, no build: rules are attribute text, messages
 * are plain strings, and everything stays CSP-safe.
 *
 * Rules (pipe separated): required, email, number, min:N (length),
 * max:N (length), minv:N (value), maxv:N (value), match:otherName.
 *
 * Wiring: inputs carry data-validate, error slots carry
 * data-errors-for="fieldname", forms carry data-form to block
 * invalid submits and focus the first offender. Live validation
 * starts after first touch (change) or submit; aria-invalid and
 * data-invalid reflect state for styling and assistive tech.
 *
 * @example
 * <form data-form>
 *   <input name="email" data-validate="required|email">
 *   <span data-errors-for="email"></span>
 *   <input name="pw" type="password" data-validate="required|min:8">
 *   <span data-errors-for="pw"></span>
 *   <input name="pw2" type="password" data-validate="required|match:pw">
 *   <span data-errors-for="pw2"></span>
 *   <button>Join</button>
 * </form>
 */
export interface ValidationRule {
  name: string;
  arg: string;
}

export interface LaghuValidateAPI {
  version: string;
  validateField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null;
  validateForm(form: HTMLFormElement): boolean;
  parseRules(spec: string): ValidationRule[];
  scan(root: Element | Document): void;
  watch?(): void;
  init?(): void;
}

export const LaghuValidate: LaghuValidateAPI = (() => {
  "use strict";

  const EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Split "required|min:3|match:pw" into structured rule descriptors.
   */
  function parseRules(spec: string): ValidationRule[] {
    return String(spec || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const colonIndex = part.indexOf(":");
        if (colonIndex < 0) return { name: part, arg: "" };
        return {
          name: part.slice(0, colonIndex).trim(),
          arg: part.slice(colonIndex + 1).trim(),
        };
      });
  }

  /**
   * Resolve owning form of an input, or null if outside any form.
   */
  function ownerForm(element: Element): HTMLFormElement | null {
    if (element instanceof HTMLFormElement) return element;
    if (element.closest) {
      const form = element.closest("form");
      if (form instanceof HTMLFormElement) return form;
    }
    return null;
  }

  /**
   * Locate the error slot for a field within its form, or in the wider document.
   */
  function findErrorSlot(element: Element, fieldName: string): Element | null {
    const parentForm = ownerForm(element);
    const selector = `[data-errors-for="${fieldName.replace(/"/g, "")}"]`;
    const inForm = parentForm ? parentForm.querySelector(selector) : null;
    if (inForm) return inForm;
    return typeof document !== "undefined" ? document.querySelector(selector) : null;
  }

  /**
   * Evaluate a single validation rule against the current field value.
   */
  function evaluateRule(
    rule: ValidationRule,
    value: string,
    fieldName: string,
    element: Element,
  ): string | null {
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
        return value.length < Number(rule.arg)
          ? `${fieldName} needs at least ${rule.arg} characters`
          : null;
      case "max":
        return value.length > Number(rule.arg)
          ? `${fieldName} needs at most ${rule.arg} characters`
          : null;
      case "minv":
        return Number(value) < Number(rule.arg)
          ? `${fieldName} must be at least ${rule.arg}`
          : null;
      case "maxv":
        return Number(value) > Number(rule.arg)
          ? `${fieldName} must be at most ${rule.arg}`
          : null;
      case "match": {
        const parentForm = ownerForm(element);
        const matchSelector = `[name="${rule.arg.replace(/"/g, "")}"]`;
        const otherElement = parentForm ? parentForm.querySelector(matchSelector) : null;
        const otherValue =
          otherElement && "value" in otherElement ? String((otherElement as any).value) : "";
        return value !== otherValue ? `${fieldName} must match ${rule.arg}` : null;
      }
      default:
        return null;
    }
  }

  /**
   * Validate one input against its data-validate rules.
   */
  function validateField(
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ): string | null {
    const spec = element.getAttribute("data-validate") || "";
    const rules = parseRules(spec);
    const fieldName = element.getAttribute("name") || element.id || "field";
    const fieldValue = "value" in element ? String((element as any).value) : "";

    let errorMessage: string | null = null;
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

  /**
   * Validate every data-validate control in a form.
   */
  function validateForm(formElement: HTMLFormElement): boolean {
    let firstInvalidField: HTMLElement | null = null;
    const fields = formElement.querySelectorAll("[data-validate]");
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index] as any;
      field._bTouched = true;
      if (validateField(field) && !firstInvalidField) {
        firstInvalidField = field;
      }
    }

    if (firstInvalidField) {
      try {
        firstInvalidField.focus();
      } catch {
        // Ignored: focusing elements that do not implement focus in test environments
      }
      return false;
    }
    return true;
  }

  function wireField(element: any): void {
    if (element._bVal) return;
    element._bVal = true;

    element.addEventListener("input", () => {
      if (element._bTouched || (element.form && element.form._bTried)) {
        validateField(element);
      }
    });

    element.addEventListener("change", () => {
      element._bTouched = true;
      validateField(element);
    });
  }

  function wireForm(formElement: any): void {
    if (formElement._bValForm) return;
    formElement._bValForm = true;

    const fields = formElement.querySelectorAll("[data-validate]");
    for (let index = 0; index < fields.length; index++) {
      wireField(fields[index]);
    }

    formElement.addEventListener("submit", (event: Event) => {
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

  function scan(root: Element | Document): void {
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

  function watch(): void {
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

  function init(): void {
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
    init,
  };
})();

