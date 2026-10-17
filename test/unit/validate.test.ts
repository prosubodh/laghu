import { describe, it, expect } from "vite-plus/test";
import { LaghuValidate } from "../../src/validate";
import { tick } from "../setup";

function form() {
  const root = document.createElement("div");
  root.innerHTML = `<form id="join" data-form>
    <input name="email" data-validate="required|email"><span data-errors-for="email"></span>
    <input name="age" data-validate="required|number|minv:13|maxv:120"><span data-errors-for="age"></span>
    <input name="pw" type="password" data-validate="required|min:8"><span data-errors-for="pw"></span>
    <input name="pw2" type="password" data-validate="required|match:pw"><span data-errors-for="pw2"></span>
    <button>Join</button>
  </form>`;
  document.body.appendChild(root);
  LaghuValidate.scan(document);
  return document.querySelector("#join") as HTMLFormElement;
}

function slot(name: string) {
  return document.querySelector(`[data-errors-for="${name}"]`)!;
}

function field(name: string) {
  return document.querySelector(`[name="${name}"]`) as HTMLInputElement;
}

describe("LaghuValidate", () => {
  it("exposes a versioned api and parses rules", () => {
    expect(LaghuValidate.version).toBe("1.2.0");
    expect(LaghuValidate.parseRules("required|min:3|match:pw")).toEqual([
      { name: "required", arg: "" },
      { name: "min", arg: "3" },
      { name: "match", arg: "pw" },
    ]);
  });

  it("stays quiet until touch, then reports and clears", async () => {
    form();
    const email = field("email");
    email.value = "not-an-email";
    email.dispatchEvent(new Event("input", { bubbles: true }));
    expect(slot("email").textContent).toBe("");
    email.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(slot("email").textContent).toContain("email");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.hasAttribute("data-invalid")).toBe(true);
    email.value = "a@b.co";
    email.dispatchEvent(new Event("input", { bubbles: true }));
    expect(slot("email").textContent).toBe("");
    expect(email.getAttribute("aria-invalid")).toBe("false");
  });

  it("blocks invalid submits and passes valid ones", async () => {
    const f = form();
    field("pw").value = "secret12";
    field("pw2").value = "other";
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    f.dispatchEvent(ev);
    await tick();
    expect(ev.defaultPrevented).toBe(true);
    expect(slot("pw2").textContent).toContain("match");
    field("email").value = "a@b.co";
    field("age").value = "30";
    field("pw2").value = "secret12";
    const ev2 = new Event("submit", { bubbles: true, cancelable: true });
    f.dispatchEvent(ev2);
    await tick();
    expect(ev2.defaultPrevented).toBe(true); // actionless forms stay local
    expect(LaghuValidate.validateForm(f)).toBe(true);
  });

  it("enforces numeric ranges", () => {
    form();
    const age = field("age");
    age.value = "9";
    age.dispatchEvent(new Event("change", { bubbles: true }));
    expect(slot("age").textContent).toContain("13");
  });

  it("validates max length, max value, number type, and data-message overrides", () => {
    const root = document.createElement("div");
    root.innerHTML = `<form id="extra-form">
      <input name="pin" data-validate="number|max:4" data-message="Invalid PIN">
      <span data-errors-for="pin"></span>
      <input name="score" data-validate="number|maxv:50">
      <span data-errors-for="score"></span>
    </form>`;
    document.body.appendChild(root);
    LaghuValidate.scan(root);
    const pin = root.querySelector('[name="pin"]') as HTMLInputElement;
    pin.value = "abcde";
    expect(LaghuValidate.validateField(pin)).toBe("Invalid PIN");

    const root2 = document.createElement("div");
    root2.innerHTML = `<input name="bio" data-validate="min:5|max:10">`;
    document.body.appendChild(root2);
    const bio = root2.querySelector('[name="bio"]') as HTMLInputElement;
    bio.value = "ab";
    expect(LaghuValidate.validateField(bio)).toContain("at least 5 characters");
    bio.value = "123456789012";
    expect(LaghuValidate.validateField(bio)).toContain("at most 10 characters");

    const score = root.querySelector('[name="score"]') as HTMLInputElement;
    score.value = "99";
    expect(LaghuValidate.validateField(score)).toContain("at most 50");
  });

  it("handles standalone input outside form and error slot in document", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input id="alone" data-validate="required" name="alone"><span data-errors-for="alone"></span>`;
    document.body.appendChild(root);
    LaghuValidate.scan(root);
    const inp = root.querySelector("#alone") as HTMLInputElement;
    inp.value = "";
    expect(LaghuValidate.validateField(inp)).toBe("alone is required");
    expect(root.querySelector('[data-errors-for="alone"]')!.textContent).toBe("alone is required");
  });

  it("handles scan with invalid root and DOMContentLoaded event", () => {
    LaghuValidate.scan({} as any);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(LaghuValidate.version).toBe("1.2.0");
  });

  it("automatically wires dynamically inserted nodes via MutationObserver", async () => {
    const dynamicForm = document.createElement("form");
    dynamicForm.setAttribute("data-form", "");
    dynamicForm.innerHTML = `<input name="dyn" data-validate="required"><span data-errors-for="dyn"></span>`;
    document.body.appendChild(dynamicForm);
    await tick(30);

    const dynInput = dynamicForm.querySelector('input[name="dyn"]') as HTMLInputElement;
    dynInput.value = "";
    expect(LaghuValidate.validateField(dynInput)).toBe("dyn is required");

    // direct input and comment node via observer
    const comment = document.createComment("observer comment");
    document.body.appendChild(comment);
    const directInp = document.createElement("input");
    directInp.setAttribute("data-validate", "required");
    directInp.setAttribute("name", "direct");
    document.body.appendChild(directInp);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<form data-form><input name="nested" data-validate="required"></form>`;
    document.body.appendChild(wrapper);
    await tick(30);

    // form element passed to validateField triggers ownerForm form check
    const standaloneForm = document.createElement("form");
    standaloneForm.setAttribute("data-validate", "required");
    standaloneForm.setAttribute("name", "stForm");
    expect(LaghuValidate.validateField(standaloneForm as any)).toBe("stForm is required");
  });

  it("covers parseRules fallbacks, empty optional fields, valid numbers, match misses, and action submits", async () => {
    // 1. parseRules with falsy spec
    expect(LaghuValidate.parseRules(undefined as any)).toEqual([]);
    expect(LaghuValidate.parseRules("")).toEqual([]);

    // 2. empty optional field returns null
    const optInput = document.createElement("input");
    optInput.setAttribute("data-validate", "email");
    optInput.setAttribute("name", "optEmail");
    optInput.value = "";
    expect(LaghuValidate.validateField(optInput)).toBeNull();

    // 3. valid number returns null
    const numInput = document.createElement("input");
    numInput.setAttribute("data-validate", "number");
    numInput.setAttribute("name", "quantity");
    numInput.value = "42";
    expect(LaghuValidate.validateField(numInput)).toBeNull();

    // 4. match rule against nonexistent field
    const matchForm = document.createElement("form");
    matchForm.innerHTML = `<input name="confirm" data-validate="match:missingTarget">`;
    document.body.appendChild(matchForm);
    const confirmInput = matchForm.querySelector("input") as HTMLInputElement;
    confirmInput.value = "mismatch";
    expect(LaghuValidate.validateField(confirmInput)).toBe("confirm must match missingTarget");

    // 5. input with only id and input with neither name nor id
    const idOnlyInput = document.createElement("input");
    idOnlyInput.id = "onlyId";
    idOnlyInput.setAttribute("data-validate", "required");
    idOnlyInput.value = "";
    expect(LaghuValidate.validateField(idOnlyInput)).toBe("onlyId is required");

    const noNameInput = document.createElement("input");
    noNameInput.setAttribute("data-validate", "required");
    noNameInput.value = "";
    expect(LaghuValidate.validateField(noNameInput)).toBe("field is required");

    // 6. form with action allows native submit
    const actionForm = document.createElement("form");
    actionForm.setAttribute("data-form", "");
    actionForm.setAttribute("action", "/server/post");
    actionForm.innerHTML = `<input name="user" data-validate="required" value="alice">`;
    document.body.appendChild(actionForm);
    LaghuValidate.scan(actionForm);
    const submitEv = new Event("submit", { bubbles: true, cancelable: true });
    actionForm.dispatchEvent(submitEv);
    expect(submitEv.defaultPrevented).toBe(false);

    // 7. valid max length and input without data-validate
    const maxInput = document.createElement("input");
    maxInput.setAttribute("data-validate", "max:10");
    maxInput.value = "short";
    expect(LaghuValidate.validateField(maxInput)).toBeNull();

    const noAttr = document.createElement("input");
    expect(LaghuValidate.validateField(noAttr)).toBeNull();

    // 8. match against element without value (e.g. div)
    const divMatchForm = document.createElement("form");
    divMatchForm.innerHTML = `<div name="divTarget"></div><input name="testMatch" data-validate="match:divTarget" value="abc">`;
    document.body.appendChild(divMatchForm);
    const testMatchInput = divMatchForm.querySelector("input") as HTMLInputElement;
    expect(LaghuValidate.validateField(testMatchInput)).toBe("testMatch must match divTarget");

    // 9. scan idempotency and scan null
    LaghuValidate.scan(null as any);
    LaghuValidate.scan(actionForm);

    // 10. form tried input trigger without previous touch
    const triedForm = document.createElement("form");
    triedForm.setAttribute("data-form", "");
    triedForm.innerHTML = `<input name="userField" data-validate="required">`;
    document.body.appendChild(triedForm);
    LaghuValidate.scan(document);
    triedForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const uField = triedForm.querySelector("input") as HTMLInputElement;
    uField.dispatchEvent(new Event("input", { bubbles: true }));
    expect(uField.getAttribute("aria-invalid")).toBe("true");

    // 11. watch SSR and documentElement guards
    const origMO = (globalThis as any).MutationObserver;
    delete (globalThis as any).MutationObserver;
    LaghuValidate.watch!();
    (globalThis as any).MutationObserver = origMO;

    const origDocElem = document.documentElement;
    Object.defineProperty(document, "documentElement", { value: null, configurable: true });
    LaghuValidate.watch!();
    Object.defineProperty(document, "documentElement", { value: origDocElem, configurable: true });

    // 12. non-cancelable submit events on valid and invalid forms
    const invalidForm = document.createElement("form");
    invalidForm.setAttribute("data-form", "");
    invalidForm.innerHTML = `<input name="req" data-validate="required" value="">`;
    document.body.appendChild(invalidForm);
    LaghuValidate.scan(document);
    const nonCancelable1 = new Event("submit", { bubbles: true, cancelable: false });
    invalidForm.dispatchEvent(nonCancelable1);

    const validActionless = document.createElement("form");
    validActionless.setAttribute("data-form", "");
    validActionless.innerHTML = `<input name="req" data-validate="required" value="done">`;
    document.body.appendChild(validActionless);
    LaghuValidate.scan(document);
    const nonCancelable2 = new Event("submit", { bubbles: true, cancelable: false });
    validActionless.dispatchEvent(nonCancelable2);

    // 13. match rule outside form, closest-less node, and querySelectorAll-less node in observer
    const outsideMatch = document.createElement("input");
    outsideMatch.setAttribute("data-validate", "match:anything");
    outsideMatch.value = "xyz";
    expect(LaghuValidate.validateField(outsideMatch)).toBe("field must match anything");

    const noClosestNode = document.createElement("input");
    (noClosestNode as any).closest = undefined;
    noClosestNode.setAttribute("data-validate", "required");
    noClosestNode.value = "val";
    expect(LaghuValidate.validateField(noClosestNode)).toBeNull();

    const noQSA = document.createElement("div");
    (noQSA as any).querySelectorAll = null;
    document.body.appendChild(noQSA);
    await tick(30);

    // 14. init when readyState is loading
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });
    LaghuValidate.init!();
    Object.defineProperty(document, "readyState", { value: "complete", configurable: true });

    // 15. SSR when document is undefined
    const origDoc = (globalThis as any).document;
    delete (globalThis as any).document;
    try {
      LaghuValidate.watch!();
      LaghuValidate.init!();
      expect(LaghuValidate.validateField(noAttr)).toBeNull();
    } finally {
      (globalThis as any).document = origDoc;
    }
  });
});




