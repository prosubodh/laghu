import { describe, it, expect } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

const scope = {
  count: 6,
  price: 3,
  qty: 4,
  open: false,
  name: "Ada",
  user: { name: "Bo" },
  list: [10, 20, 30],
  map: { k: "v" },
  add(a: number, b: number) {
    return a + b;
  },
  reset() {
    return "r";
  },
};

describe("evalExpr grammar", () => {
  it.each([
    ["count > 5", true],
    ["user.name", "Bo"],
    ["!open", true],
    ["price * qty", 12],
    ["price * qty + 1", 13],
    ["(price + 1) * qty", 16],
    ["10 - 3 - 2", 5],
    ["20 / 4", 5],
    ["7 % 3", 1],
    ['count > 5 ? "big" : "small"', "big"],
    ["open ? 1 : 2", 2],
    ["add(2, 3)", 5],
    ["add(price, qty)", 7],
    ["reset()", "r"],
    ["list[0]", 10],
    ["list[2]", 30],
    ['map["k"]', "v"],
    ["map['k']", "v"],
    ['"a" + "b"', "ab"],
    ['name + "!"', "Ada!"],
    ["count >= 6 && price < 5", true],
    ["-qty", -4],
    ["!open && count", 6],
  ])("evaluates %s", (expr, want) => {
    expect(Laghu.eval(scope, expr)).toEqual(want);
  });

  it("returns undefined for unknown paths", () => {
    expect(Laghu.eval(scope, "nope")).toBeUndefined();
    expect(Laghu.eval(scope, "count++")).toBeUndefined();
  });

  it("blocks prototype gadgets", () => {
    expect(Laghu.eval({}, "constructor.name")).toBeUndefined();
    expect(Laghu.eval({}, "__proto__.x")).toBeUndefined();
    expect(Laghu.eval({}, "add(1)")).toBeUndefined();
  });
});

describe("get/set paths", () => {
  it("reads dotted paths and misses", () => {
    expect(Laghu.get({ user: { name: "x" } }, "user.name")).toBe("x");
    expect(Laghu.get({}, "missing.deep")).toBeUndefined();
  });

  it("writes create intermediate objects", () => {
    const s: any = {};
    Laghu.set(s, "user.name", "Ada");
    expect(s).toEqual({ user: { name: "Ada" } });
  });

  it("refuses pollution segments", () => {
    const s: any = {};
    Laghu.set(s, "__proto__.pwned", 1);
    expect(({} as any).pwned).toBeUndefined();
    Laghu.set(s, "constructor.x", 1);
    expect(s.constructor).toBe(Object);
  });

  it("writes through scope chains to the owner", () => {
    const parent: any = { n: 0 };
    const child = Object.create(parent);
    Laghu.set(child, "n", 9);
    expect(parent.n).toBe(9);
    expect(Object.prototype.hasOwnProperty.call(child, "n")).toBe(false);
  });

  it("missed reads subscribe late-added keys", async () => {
    const s = Laghu.reactive({} as any);
    let seen: any = "empty";
    Laghu.effect(() => {
      seen = Laghu.get(s, "future.key") ?? "empty";
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBe("empty");
    Laghu.set(s, "future", { key: "now" });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBe("now");
  });

  it("missed reads on a child scope subscribe the reactive ancestor", async () => {
    // Route params and data-for rows hydrate against a child scope, so a
    // miss must also subscribe on the reactive parent up the chain.
    const parent = Laghu.reactive({} as any);
    const child = Laghu.scope(parent, { params: {} });
    let seen: any = "empty";
    Laghu.effect(() => {
      seen = Laghu.get(child, "future") ?? "empty";
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBe("empty");
    parent.future = "now";
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBe("now");
  });

  it("evaluates literals, comparisons, and bracket expressions", () => {
    (window as any).__LAGHU_DEV__ = true;
    expect(Laghu.eval({}, "true")).toBe(true);
    expect(Laghu.eval({}, "false")).toBe(false);
    expect(Laghu.eval({}, "null")).toBeNull();
    expect(Laghu.eval({}, "undefined")).toBeUndefined();
    expect(Laghu.eval({}, "")).toBeUndefined();

    expect(Laghu.eval({ a: 2, b: 3 }, "a <= b")).toBe(true);
    expect(Laghu.eval({ a: 2, b: 2 }, "a == b")).toBe(true);
    expect(Laghu.eval({ a: 2, b: 3 }, "a != b")).toBe(true);
    expect(Laghu.eval({ a: 2, b: 3 }, "a === b")).toBe(false);
    expect(Laghu.eval({ a: 2, b: 3 }, "a !== b")).toBe(true);

    expect(Laghu.eval({ obj: { text: "str" } }, 'obj["text"]')).toBe("str");
    expect(Laghu.eval({}, "missing[0]")).toBeUndefined();
    expect(Laghu.eval({ obj: {} }, 'obj["__proto__"]')).toBeUndefined();
    expect(Laghu.eval({ list: [1] }, "list[0] > 0 ? 'yes' : 'no'")).toBe("yes");
    expect(Laghu.eval({}, "('quoted string inside parens')")).toBe("quoted string inside parens");
    expect(Laghu.eval({}, "add('a, b', 'c')")).toBeUndefined();
  });

  it("handles getPath and setPath edge cases", () => {
    (window as any).__LAGHU_DEV__ = true;
    expect(Laghu.get({}, "")).toBeUndefined();
    expect(Laghu.get({ num: 5 }, "num.sub")).toBeUndefined();
    expect(Laghu.get({}, "$store.missing.deep")).toBeUndefined();

    Laghu.store("deepStore", {});
    Laghu.set({}, "$store.deepStore.level1.level2", "val");
    expect(Laghu.get({}, "$store.deepStore.level1.level2")).toBe("val");

    Laghu.set({}, "$store.nonExistentStore.level1", "fail");
    Laghu.set({}, "bad.__proto__.pwn", 1);
  });

  it("covers ternary parens/brackets, unknown method calls, action function eval, and filter parens/brackets", async () => {
    (window as any).__LAGHU_DEV__ = true;

    // 1. splitTernary depth with calls and brackets, and malformed ternary
    const scope = {
      cond: true,
      doubler: (n: number) => n * 2,
      nums: [100, 200],
    };
    expect(Laghu.eval(scope, "cond ? doubler(21) : 0")).toBe(42);
    expect(Laghu.eval(scope, "cond ? nums[1] : 0")).toBe(200);
    expect(Laghu.eval(scope, "cond ? 42")).toBeUndefined();

    // 2. unknown method on object
    expect(Laghu.eval({ obj: { val: 1 } }, "obj.nonExistent()")).toBeUndefined();

    // 3. action string evaluating to a function, undefined action, and empty action
    let workDone = 0;
    let unknownLogged = false;
    document.addEventListener("laghu:unknown-action", () => {
      unknownLogged = true;
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <button id="btn-action-fn" data-click="sub['doWork']">Fn</button>
      <button id="btn-action-undef" data-click="sub['missing']">Undef</button>
      <button id="btn-action-empty" data-click="">Empty</button>
      <span id="f-paren" data-bind="(base + bonus) | fixed:1"></span>
      <span id="f-brack" data-bind="nums[0] | fixed:0"></span>
      <span id="f-unk" data-bind="base | nonExistentFilter"></span>
    `;
    document.body.appendChild(root);

    Laghu.hydrate(root, {
      sub: {
        doWork: () => workDone++,
      },
      base: 10.55,
      bonus: 2.1,
      nums: [99.4],
    });
    await tick();

    (document.getElementById("btn-action-fn") as HTMLElement).click();
    expect(workDone).toBe(1);

    (document.getElementById("btn-action-undef") as HTMLElement).click();
    expect(unknownLogged).toBe(true);

    (document.getElementById("btn-action-empty") as HTMLElement).click();

    expect(document.getElementById("f-paren")!.textContent).toBe("12.7");
    expect(document.getElementById("f-brack")!.textContent).toBe("99");
    expect(document.getElementById("f-unk")!.textContent).toBe("10.55");
  });

  it("handles deep getPath on non-object $store property and unsafe dotted segment", () => {
    Laghu.store("primitiveStore", { count: 42 });
    // Reading deeper into a primitive property of a store:
    expect(Laghu.get({}, "$store.primitiveStore.count.invalid")).toBeUndefined();

    // Dotted path with unsafe prototype segment:
    const s = { user: { name: "Ada" } };
    expect(Laghu.get(s, "user.__proto__.name")).toBeUndefined();
    expect(Laghu.get(s, "user.constructor.name")).toBeUndefined();
  });

  it("handles evalMethodCall edge cases: stray paren, chained calls, and non-identifier method names", () => {
    // 1. Stray paren
    expect(Laghu.eval({}, ")")).toBeUndefined();

    // 2. Chained call or non-terminal paren
    expect(Laghu.eval({}, "fn()()")).toBeUndefined();

    // 3. Non-identifier method name
    expect(Laghu.eval({}, "a b()")).toBeUndefined();
  });

  it("covers trackScopeChain with plain object prototype and non-object scope", () => {
    const plainProto = { protoVal: 10 };
    const child = Object.create(plainProto);
    const reactiveChild = Laghu.reactive(child);
    expect(Laghu.get(reactiveChild, "protoVal")).toBe(10);
    expect(Laghu.get(reactiveChild, "missingVal")).toBeUndefined();
    expect(Laghu.get(123 as any, "foo")).toBeUndefined();
    expect(Laghu.get(null as any, "foo")).toBeUndefined();
  });

  it("covers deleteProperty trap with symbol property", () => {
    const sym = Symbol("test");
    const obj = Laghu.reactive({ [sym]: "val" } as any);
    expect(delete obj[sym]).toBe(true);
  });

  it("covers nested parens in evalParenthesized, non-terminal match, and evalMethodCall", () => {
    expect(Laghu.eval({}, "((1 + 2))")).toBe(3);
    expect(Laghu.eval({}, "(1) + (2)")).toBe(3);
    const methodScope = {
      calc: (x: number, y: number) => x * y,
      add: (a: number, b: number) => a + b,
    };
    expect(Laghu.eval(methodScope, "calc(add(2, 3), 4)")).toBe(20);
  });

  it("covers decrement action with zero or undefined start", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<button id="btn-dec" data-click="c--">dec</button>`;
    document.body.appendChild(root);
    const state = Laghu.hydrate(root, { c: 0 });
    (document.getElementById("btn-dec") as HTMLElement).click();
    await tick();
    expect(state.c).toBe(-1);
    root.remove();
  });

  it("covers non-function non-undefined action evaluations", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<button id="btn-lit" data-click="1 + 1">lit</button>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {});
    expect(() => (document.getElementById("btn-lit") as HTMLElement).click()).not.toThrow();
    root.remove();
  });

  it("covers built-in filter edge cases: strArg, uppercase, lowercase, fixed, currency, date, default, join, length", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span id="f-uc" data-bind="n | uppercase"></span>
      <span id="f-lc" data-bind="u | lowercase"></span>
      <span id="f-fix1" data-bind="nan | fixed"></span>
      <span id="f-fix2" data-bind="n | fixed"></span>
      <span id="f-fix-u" data-bind="u | fixed"></span>
      <span id="f-fix3" data-bind="pi | fixed: 3"></span>
      <span id="f-cur1" data-bind="n | currency"></span>
      <span id="f-cur-u" data-bind="u | currency"></span>
      <span id="f-cur2" data-bind="p | currency: '€'"></span>
      <span id="f-cur3" data-bind="p | currency: ''"></span>
      <span id="f-dt1" data-bind="badDate | date"></span>
      <span id="f-dt2" data-bind="goodDate | date: ''"></span>
      <span id="f-dt3" data-bind="goodDate | date: 'en-US'"></span>
      <span id="f-def1" data-bind="exists | default: 'fallback'"></span>
      <span id="f-def2" data-bind="empty | default: 'fallback'"></span>
      <span id="f-jn1" data-bind="notArr | join"></span>
      <span id="f-jn2" data-bind="arr | join"></span>
      <span id="f-jn-empty" data-bind="arr | join: ''"></span>
      <span id="f-jn3" data-bind="arr | join: '-'"></span>
      <span id="f-jn4" data-bind="arr | join: x"></span>
      <span id="f-len1" data-bind="n | length"></span>
      <span id="f-len2" data-bind="u | length"></span>
      <span id="f-len3" data-bind="objNoLen | length"></span>
      <span id="f-len4" data-bind="arr | length"></span>
      <span id="f-len5" data-bind="str | length"></span>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, {
      n: null,
      u: undefined,
      nan: "not-a-number",
      pi: 3.14159,
      p: 12,
      badDate: "invalid-date",
      goodDate: "2026-01-01T00:00:00Z",
      exists: "exists",
      empty: "",
      notArr: "not-an-array",
      arr: [1, 2],
      objNoLen: {},
      str: "hello",
    });
    await tick();
    expect(document.getElementById("f-uc")!.textContent).toBe("");
    expect(document.getElementById("f-lc")!.textContent).toBe("");
    expect(document.getElementById("f-fix1")!.textContent).toBe("not-a-number");
    expect(document.getElementById("f-fix2")!.textContent).toBe("0");
    expect(document.getElementById("f-fix-u")!.textContent).toBe("");
    expect(document.getElementById("f-fix3")!.textContent).toBe("3.142");
    expect(document.getElementById("f-cur1")!.textContent).toBe("$0.00");
    expect(document.getElementById("f-cur-u")!.textContent).toBe("");
    expect(document.getElementById("f-cur2")!.textContent).toBe("€12.00");
    expect(document.getElementById("f-cur3")!.textContent).toBe("$12.00");
    expect(document.getElementById("f-dt1")!.textContent).toBe("");
    expect(document.getElementById("f-dt2")!.textContent).toBeTruthy();
    expect(document.getElementById("f-dt3")!.textContent).toBeTruthy();
    expect(document.getElementById("f-def1")!.textContent).toBe("exists");
    expect(document.getElementById("f-def2")!.textContent).toBe("fallback");
    expect(document.getElementById("f-jn1")!.textContent).toBe("not-an-array");
    expect(document.getElementById("f-jn2")!.textContent).toBe("1, 2");
    expect(document.getElementById("f-jn-empty")!.textContent).toBe("12");
    expect(document.getElementById("f-jn3")!.textContent).toBe("1-2");
    expect(document.getElementById("f-jn4")!.textContent).toBe("1x2");
    expect(document.getElementById("f-len1")!.textContent).toBe("0");
    expect(document.getElementById("f-len2")!.textContent).toBe("0");
    expect(document.getElementById("f-len3")!.textContent).toBe("0");
    expect(document.getElementById("f-len4")!.textContent).toBe("2");
    expect(document.getElementById("f-len5")!.textContent).toBe("5");
    root.remove();
  });

  it("covers evalParenthesized closing early and double-quoted filter arguments", async () => {
    // 1. evalParenthesized returns null when parens close early
    expect(Laghu.eval({ a: { b: 99 } }, "(a).b")).toBeUndefined();
    expect(Laghu.eval({ a: 10, b: 5 }, "(a) + b")).toBe(15);

    // 2. double-quoted, unquoted multi-char, and mismatched quote filter arguments
    const root = document.createElement("div");
    root.innerHTML = `
      <span id="f-cur-dq" data-bind='p | currency: "£"'></span>
      <span id="f-cur-uq" data-bind="p | currency: USD"></span>
      <span id="f-cur-mismatch" data-bind='p | currency: "USD'></span>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, { p: 42 });
    await tick();
    expect(document.getElementById("f-cur-dq")!.textContent).toBe("£42.00");
    expect(document.getElementById("f-cur-uq")!.textContent).toBe("USD42.00");
    expect(document.getElementById("f-cur-mismatch")!.textContent).toBe("\"USD42.00");
    root.remove();
  });
});


