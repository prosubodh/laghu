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
export declare const LaghuValidate: LaghuValidateAPI;
