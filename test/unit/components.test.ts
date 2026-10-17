import { describe, it, expect } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

let tagN = 0;
function tag(base: string) {
  tagN++;
  return `${base}-${tagN}`;
}

describe("define", () => {
  it("hydrates light DOM and wires actions", async () => {
    const t = tag("t-counter");
    document.body.innerHTML = `<${t}><strong data-bind="count">0</strong><button data-click="increment">+</button></${t}>`;
    Laghu.define(t, () => ({
      state: { count: 0 },
      actions: {
        increment(this: any) {
          this.count++;
        },
      },
    }));
    await tick();
    expect(document.querySelector("strong")!.textContent).toBe("0");
    document.querySelector("button")!.click();
    await tick();
    expect(document.querySelector("strong")!.textContent).toBe("1");
  });

  it("syncs primitive attributes into state", async () => {
    const t = tag("t-badge");
    document.body.innerHTML = `<${t} count="5" label="hi"></${t}>`;
    Laghu.define(t, () => ({ state: { count: 0, label: "" } }));
    await tick();
    const el: any = document.querySelector(t);
    expect(el.state.count).toBe(5);
    expect(el.state.label).toBe("hi");
    el.setAttribute("count", "9");
    await tick(20);
    expect(el.state.count).toBe(9);
  });

  it("upgrades pre-defined properties", async () => {
    const t = tag("t-up");
    document.body.innerHTML = `<${t}></${t}>`;
    const el: any = document.querySelector(t);
    el.user = { name: "Zed" };
    Laghu.define(t, () => ({ state: { user: null as any } }));
    await tick();
    expect(el.state.user).toEqual({ name: "Zed" });
  });

  it("runs mount and unmount hooks", async () => {
    const t = tag("t-life");
    let mounted = 0,
      unmounted = 0,
      events = 0;
    document.body.innerHTML = `<${t}></${t}>`;
    Laghu.define(t, () => ({
      state: {},
      actions: {},
      onMount() {
        mounted++;
      },
      onUnmount() {
        unmounted++;
      },
    }));
    const el = document.querySelector(t)!;
    el.addEventListener("laghu:unmount", () => {
      events++;
    });
    await tick(20);
    expect(mounted).toBe(1);
    el.remove();
    await tick(20);
    expect(unmounted).toBe(1);
    expect(events).toBe(1);
  });

  it("requires hyphenated tags", () => {
    expect(() => Laghu.define("nope", () => ({}))).toThrow();
  });

  it("keeps instances independent", async () => {
    const t = tag("t-card");
    document.body.innerHTML =
      `<${t} name="Grace"><span data-bind="name"></span> <span data-bind="likes"></span> <button data-click="like">l</button></${t}>` +
      `<${t} name="Ada"><span data-bind="name"></span> <span data-bind="likes"></span> <button data-click="like">l</button></${t}>`;
    Laghu.define(t, () => ({
      state: { name: "", likes: 0 },
      actions: {
        like(this: any) {
          this.likes++;
        },
      },
      observed: ["name"],
    }));
    await tick(20);
    const cards = [...document.querySelectorAll(t)] as any[];
    cards[0].querySelector("button").click();
    await tick();
    expect(cards[0].state.likes).toBe(1);
    expect(cards[1].state.likes).toBe(0);
    cards[0].setAttribute("name", "Hopper");
    await tick();
    expect(cards[0].querySelector("span").textContent).toBe("Hopper");
  });
});

describe("store sharing across islands", () => {
  it("syncs two islands through $store", async () => {
    Laghu.store("u-cart", { count: 0, name: "Ada" });
    const actions = {
      inc() {
        Laghu.store("u-cart").count++;
      },
      dec() {
        Laghu.store("u-cart").count--;
      },
    };
    const a = document.createElement("div");
    a.innerHTML = `<p><span data-bind="$store.u-cart.count"></span></p><button data-click="inc">+</button><button data-click="dec">-</button>`;
    const b = document.createElement("div");
    b.innerHTML = `<p><span data-bind="$store.u-cart.count"></span></p><input data-model="$store.u-cart.name"><span data-bind="$store.u-cart.name"></span>`;
    document.body.append(a, b);
    Laghu.hydrate(a, {}, actions);
    Laghu.hydrate(b, {}, actions);
    await tick();
    a.querySelectorAll("button")[0].click();
    await tick();
    const spans = [...document.querySelectorAll("span")].filter((s) => s.textContent === "1");
    expect(spans.length).toBe(2);
    const input = b.querySelector("input") as HTMLInputElement;
    input.value = "Bo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(Laghu.store("u-cart").name).toBe("Bo");
  });

  it("handles custom element attributeChanged before connect, connectedMoveCallback, and unmount error", async () => {
    (window as any).__LAGHU_DEV__ = true;
    const t = tag("t-adv");
    const el: any = document.createElement(t);
    // attribute change before connectedCallback stores in _bPend
    el.setAttribute("title", "Initial Title");
    el.setAttribute("active", "true");
    el.setAttribute("num", "42");

    Laghu.define(t, () => ({
      state: { title: "default", active: false, num: 0 },
      onUnmount() {
        throw new Error("error on unmount");
      },
    }));

    document.body.appendChild(el);
    await tick(20);
    expect(el.state.title).toBe("Initial Title");
    expect(el.state.active).toBe(true);
    expect(el.state.num).toBe(42);

    // unchanged attribute does nothing
    el.attributeChangedCallback("title", "Initial Title", "Initial Title");
    expect(el.state.title).toBe("Initial Title");

    // connectedMoveCallback is a no-op
    el.connectedMoveCallback();

    // removing triggers onUnmount error handling
    el.remove();
    await tick(20);
  });

  it("handles DOMContentLoaded auto-hydration, data-scope parsing, and autoObserve", async () => {
    (window as any).__LAGHU_DEV__ = true;
    const div = document.createElement("div");
    div.setAttribute("data-scope", '{"count": 7}');
    div.innerHTML = `<span id="scope-val" data-bind="count"></span>`;
    document.body.appendChild(div);

    // dispatch DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await tick(30);
    expect(document.getElementById("scope-val")!.textContent).toBe("7");

    // dynamically inserted data-scope via MutationObserver
    const dynScope = document.createElement("div");
    dynScope.setAttribute("data-scope", '{"dyn": 99}');
    dynScope.innerHTML = `<span id="dyn-scope-val" data-bind="dyn"></span>`;
    document.body.appendChild(dynScope);
    await tick(30);
    expect(document.getElementById("dyn-scope-val")!.textContent).toBe("99");

    // invalid json in data-scope
    const badScope = document.createElement("div");
    badScope.setAttribute("data-scope", "not-valid-json");
    badScope.innerHTML = `<span id="bad-scope-val" data-bind="foo"></span>`;
    document.body.appendChild(badScope);
    await tick(30);
    expect(document.getElementById("bad-scope-val")!.textContent).toBe("");

    // removal triggers destroyTree
    dynScope.remove();
    await tick(20);
  });

  it("handles onMount error, mapped and unmapped attribute pend, and coerceAttr", async () => {
    const t = tag("t-err-mount");
    Laghu.define(t, () => ({
      state: {
        regular: "ok",
        "mapped-bool": false,
        "mapped-false": true,
        "mapped-num": 0,
        "mapped-str-bool": "fallback",
        "mapped-str-false": "fallback",
        "mapped-str-num": "fallback",
        "mapped-null": "preserve",
        "mapped-nan-num": 999,
      },
      observed: [
        "extra-pend",
        "mapped-bool",
        "mapped-false",
        "mapped-num",
        "mapped-str-bool",
        "mapped-str-false",
        "mapped-str-num",
        "mapped-null",
        "mapped-nan-num",
      ],
      onMount() {
        throw new Error("mount exploded");
      },
    }));

    const el: any = document.createElement(t);
    el.setAttribute("extra-pend", "raw-value");
    el.setAttribute("mapped-bool", "true");
    el.setAttribute("mapped-false", "false");
    el.setAttribute("mapped-num", "123");
    el.setAttribute("mapped-nan-num", "not-a-number");
    el.setAttribute("mapped-str-bool", "true");
    el.setAttribute("mapped-str-false", "false");
    el.setAttribute("mapped-str-num", "456");
    (el as any)._bPend = {
      ...(el as any)._bPend,
      "mapped-null": null,
    };

    document.body.appendChild(el);
    await tick(20);
    expect(el.state["extra-pend"]).toBe("raw-value");
    expect(el.state["mapped-bool"]).toBe(true);
    expect(el.state["mapped-false"]).toBe(false);
    expect(el.state["mapped-num"]).toBe(123);
    expect(el.state["mapped-nan-num"]).toBe(999);
    expect(el.state["mapped-str-bool"]).toBe(true);
    expect(el.state["mapped-str-false"]).toBe(false);
    expect(el.state["mapped-str-num"]).toBe(456);
    expect(el.state["mapped-null"]).toBe("preserve");
  });

  it("handles autoObserve duplicate call and mutation hydration error", async () => {
    // 1. Dispatching DOMContentLoaded again triggers autoObserve duplicate guard
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // 2. Element added with data-scope where Laghu.hydrate throws
    let errors: any[] = [];
    const handler = (e: any) => errors.push(e.detail.error);
    document.addEventListener("laghu:error", handler);

    const origHydrate = (window as any).Laghu.hydrate;
    (window as any).Laghu.hydrate = () => {
      throw new Error("mutation hydrate boom");
    };

    const mutEl = document.createElement("div");
    mutEl.setAttribute("data-scope", '{"x": 1}');
    document.body.appendChild(mutEl);
    await tick(30);

    expect(errors.some((m) => m.includes("mutation hydrate boom"))).toBe(true);

    (window as any).Laghu.hydrate = origHydrate;
    document.removeEventListener("laghu:error", handler);
    mutEl.remove();
  });

  it("handles component definition with undefined or empty setup result", async () => {
    const tEmpty = tag("t-empty-setup");
    Laghu.define(tEmpty, () => (undefined as any));
    const el = document.createElement(tEmpty);
    document.body.appendChild(el);
    await tick(20);
    expect((el as any).state).toBeDefined();
    el.remove();

    const tNoState = tag("t-no-state");
    Laghu.define(tNoState, () => ({ state: undefined } as any));
    const el2 = document.createElement(tNoState);
    document.body.appendChild(el2);
    await tick(20);
    expect((el2 as any).state).toBeDefined();
    el2.remove();
  });

  it("handles mutation observer when window.Laghu is undefined", async () => {
    const origLaghu = (window as any).Laghu;
    delete (window as any).Laghu;
    const mutEl = document.createElement("div");
    mutEl.setAttribute("data-scope", '{"x": 2}');
    document.body.appendChild(mutEl);
    await tick(20);
    mutEl.remove();
    (window as any).Laghu = origLaghu;
  });
});


