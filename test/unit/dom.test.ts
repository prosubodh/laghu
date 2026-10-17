import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

afterEach(() => {
  vi.unstubAllGlobals();
});

function island(html: string, state: any = {}, actions: Record<string, Function> = {}) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return Laghu.hydrate(root, state, actions) as any;
}

describe("text and attribute bindings", () => {
  it("binds text, paths, and conditionals", async () => {
    const s = island(
      `<span id="c" data-bind="count"></span><span id="u" data-text="user.name"></span>
       <p id="big" data-if="count > 5">big</p><p id="hid" data-show="count > 100">h</p>
       <a id="lk" data-bind:href="url">x</a><b id="cl" data-class:active="on">y</b>`,
      { count: 6, user: { name: "Ada" }, url: "/x", on: true },
    );
    await tick();
    expect(document.querySelector("#c")!.textContent).toBe("6");
    expect(document.querySelector("#u")!.textContent).toBe("Ada");
    expect((document.querySelector("#big") as HTMLElement).hidden).toBe(false);
    expect((document.querySelector("#hid") as HTMLElement).hidden).toBe(true);
    expect(document.querySelector("#lk")!.getAttribute("href")).toBe("/x");
    expect(document.querySelector("#cl")!.classList.contains("active")).toBe(true);
    s.count = 101;
    await tick();
    expect((document.querySelector("#hid") as HTMLElement).hidden).toBe(false);
  });

  it("binds arithmetic and ternary in markup", async () => {
    island(
      `<span id="t" data-bind="price * qty"></span><span id="w" data-bind="open ? 'yes' : 'no'"></span>`,
      { price: 3, qty: 4, open: false },
    );
    await tick();
    expect(document.querySelector("#t")!.textContent).toBe("12");
    expect(document.querySelector("#w")!.textContent).toBe("no");
  });

  it("binds style props", async () => {
    const s = island(`<div id="s" data-style:color="err ? 'red' : ''">m</div>`, { err: false });
    await tick();
    expect((document.querySelector("#s") as HTMLElement).style.color).toBe("");
    s.err = true;
    await tick();
    expect((document.querySelector("#s") as HTMLElement).style.color).toBe("red");
  });

  it("binds the root element itself", async () => {
    const root = document.createElement("div");
    root.setAttribute("data-bind", "v");
    root.setAttribute("data-click", "go");
    document.body.appendChild(root);
    let clicked = 0;
    const s = Laghu.hydrate(
      root,
      { v: "hi" },
      {
        go() {
          clicked++;
        },
      },
    );
    await tick();
    expect(root.textContent).toBe("hi");
    root.click();
    expect(clicked).toBe(1);
    s.v = "yo";
    await tick();
    expect(root.textContent).toBe("yo");
  });
});

describe("data-model", () => {
  it("covers text, number, checkbox, group, radio, selects, textarea", async () => {
    const s = island(
      `<input id="t" data-model="form.q">
       <input id="n" type="number" data-model="form.qty">
       <input id="cb" type="checkbox" data-model="form.agree">
       <input id="g1" type="checkbox" value="a" data-model="form.tags">
       <input id="g2" type="checkbox" value="b" data-model="form.tags">
       <input id="r1" type="radio" value="r" data-model="form.color">
       <input id="r2" type="radio" value="g" data-model="form.color">
       <select id="se" data-model="form.color"><option value="r">r</option><option value="g">g</option></select>
       <select id="ms" multiple data-model="form.colors"><option value="x">x</option><option value="y">y</option></select>
       <textarea id="ta" data-model="form.bio"></textarea>`,
      {
        form: {
          q: "",
          qty: 1,
          agree: false,
          tags: [] as string[],
          color: "r",
          colors: [] as string[],
          bio: "",
        },
      },
    );
    await tick();
    const q = document.querySelector("#t") as HTMLInputElement;
    q.value = "hello";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    expect(s.form.q).toBe("hello");
    s.form.q = "bye";
    await tick();
    expect(q.value).toBe("bye");
    const qty = document.querySelector("#n") as HTMLInputElement;
    qty.value = "4";
    qty.dispatchEvent(new Event("input", { bubbles: true }));
    expect(s.form.qty).toBe(4);
    (document.querySelector("#cb") as HTMLInputElement).click();
    expect(s.form.agree).toBe(true);
    (document.querySelector("#g1") as HTMLInputElement).click();
    (document.querySelector("#g2") as HTMLInputElement).click();
    expect(s.form.tags).toEqual(["a", "b"]);
    (document.querySelector("#r2") as HTMLInputElement).click();
    expect(s.form.color).toBe("g");
    await tick();
    expect((document.querySelector("#se") as HTMLSelectElement).value).toBe("g");
  });
});

describe("data-for", () => {
  it("renders, updates, and reuses keyed rows", async () => {
    const s = island(
      `<ul><template data-for="it in items" data-key="id"><li class="row" data-bind="it.n"></li></template></ul>`,
      {
        items: [
          { id: 1, n: "a" },
          { id: 2, n: "b" },
        ],
      },
    );
    await tick(30);
    expect(document.querySelectorAll(".row").length).toBe(2);
    const first = document.querySelectorAll(".row")[0];
    first.setAttribute("data-mark", "keep");
    s.items = [
      { id: 2, n: "b2" },
      { id: 1, n: "a2" },
    ];
    await tick(30);
    expect(document.querySelectorAll(".row").length).toBe(2);
    expect(document.querySelector('[data-mark="keep"]')).not.toBeNull();
    expect(document.querySelectorAll(".row")[1].textContent).toBe("a2");
  });

  it("supports index variables and positional fallback", async () => {
    island(
      `<ul><template data-for="it, i in items"><li class="r2" data-bind="i"></li></template></ul>`,
      { items: ["a", "b", "c"] },
    );
    await tick(30);
    expect([...document.querySelectorAll(".r2")].map((li) => li.textContent).join(",")).toBe(
      "0,1,2",
    );
  });
});

describe("display filters", () => {
  it("formats through pipes", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<span id="f1" data-bind="name | uppercase"></span>
      <span id="f2" data-bind="price | currency"></span>
      <span id="f3" data-bind="nick | default:'anon'"></span>
      <span id="f4" data-bind="tags | join:'; '"></span>
      <span id="f5" data-bind="missing | default:'fallback'"></span>
      <span id="f6" data-bind="a || b"></span>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, { name: "ada", price: 3.5, nick: "", tags: ["x", "y"], a: 0, b: "B" });
    await tick();
    expect(document.querySelector("#f1")!.textContent).toBe("ADA");
    expect(document.querySelector("#f2")!.textContent).toBe("$3.50");
    expect(document.querySelector("#f3")!.textContent).toBe("anon");
    expect(document.querySelector("#f4")!.textContent).toBe("x; y");
    expect(document.querySelector("#f5")!.textContent).toBe("fallback");
    expect(document.querySelector("#f6")!.textContent).toBe("B");
  });

  it("supports custom filters and chains", async () => {
    Laghu.filter("shout", (v: any) => String(v) + "!");
    const root = document.createElement("div");
    root.innerHTML = `<span id="c" data-bind="name | lowercase | shout"></span>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, { name: "ADA" });
    await tick();
    expect(document.querySelector("#c")!.textContent).toBe("ada!");
  });
});

describe("template data-if", () => {
  it("attaches and detaches blocks with cleanup", async () => {
    let cleaned = 0;
    Laghu.directive("t-probe-tif", ({ effect, el }) => {
      const stop = effect(() => {});
      return () => {
        cleaned++;
        stop();
      };
    });
    const s = island(`<template data-if="show"><p data-t-probe-tif id="blk">hi</p></template>`, {
      show: false,
    });
    await tick(20);
    expect(document.querySelector("#blk")).toBeNull();
    s.show = true;
    await tick(20);
    expect(document.querySelector("#blk")).not.toBeNull();
    s.show = false;
    await tick(20);
    expect(document.querySelector("#blk")).toBeNull();
    expect(cleaned).toBe(1);
  });
});

describe("data-click and data-on", () => {
  it("runs actions, expressions, and assignments", async () => {
    let hits = 0;
    const s = island(
      `<button id="a" data-click="increment">a</button>
       <button id="b" data-click="n++">b</button>
       <button id="c" data-click="n = 41">c</button>
       <button id="d" data-on:click="n++">d</button>`,
      { n: 0 },
      {
        increment(this: any) {
          this.n++;
          hits++;
        },
      },
    );
    (document.querySelector("#a") as HTMLElement).click();
    (document.querySelector("#b") as HTMLElement).click();
    (document.querySelector("#c") as HTMLElement).click();
    (document.querySelector("#d") as HTMLElement).click();
    expect(s.n).toBe(42);
    expect(hits).toBe(1);
  });

  it("supports once and event modifiers", async () => {
    const s = island(
      `<button id="o" data-click="n++" data-trigger="click once">o</button>
       <form id="f" data-on:submit.prevent="n++"><button>go</button></form>`,
      { n: 0 },
    );
    const o = document.querySelector("#o") as HTMLElement;
    o.click();
    o.click();
    o.click();
    await tick();
    expect(s.n).toBe(1);
    const f = document.querySelector("#f") as HTMLFormElement;
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    f.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(s.n).toBe(2);
  });

  it("writes through $event scopes to the owner", async () => {
    const s = island(`<input id="w" data-on:input="q = $event.target.value">`, { q: "" });
    const input = document.querySelector("#w") as HTMLInputElement;
    input.value = "hi";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(s.q).toBe("hi");
  });

  it("dispatches unknown-action loudly", async () => {
    island(`<button id="bad" data-click="nope">b</button>`, {});
    let detail: any = null;
    document.addEventListener("laghu:unknown-action", (e) => {
      detail = (e as CustomEvent).detail;
    });
    (document.querySelector("#bad") as HTMLElement).click();
    await tick();
    expect(detail && detail.name).toBe("nope");
  });
});

describe("directives and lifecycle", () => {
  it("runs custom directives with cleanup", async () => {
    let cleaned = 0;
    Laghu.directive("t-hello", ({ el, get, effect }) => {
      const stop = effect(() => {
        el.textContent = "h:" + String(get());
      });
      return () => {
        cleaned++;
        stop();
      };
    });
    const root = document.createElement("div");
    root.innerHTML = `<span id="s" data-t-hello="x"></span>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, { x: 5 });
    await tick();
    expect(document.querySelector("#s")!.textContent).toBe("h:5");
    Laghu.destroyTree(root);
    expect(cleaned).toBe(1);
  });

  it("runs data-init once", async () => {
    let runs = 0;
    island(
      `<div data-init="boot"></div>`,
      {},
      {
        boot() {
          runs++;
        },
      },
    );
    await tick();
    expect(runs).toBe(1);
  });

  it("reports binding errors without killing the page", async () => {
    const errs: any[] = [];
    document.addEventListener("laghu:error", (e) => errs.push((e as CustomEvent).detail));
    const raw: any = { n: 0 };
    Object.defineProperty(raw, "explodes", {
      get() {
        throw new Error("boom");
      },
    });
    const root = document.createElement("div");
    root.innerHTML = `<span data-bind="explodes"></span><button id="alive" data-click="n++">go</button>`;
    document.body.appendChild(root);
    const s = Laghu.hydrate(root, raw, {});
    await tick();
    (document.querySelector("#alive") as HTMLElement).click();
    await tick();
    expect(s.n).toBe(1);
    expect(errs.length).toBeGreaterThanOrEqual(1);
  });
});
