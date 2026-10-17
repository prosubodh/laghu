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

  it("calls component actions with arguments", async () => {
    const seen: Array<[string, any]> = [];
    const s = island(
      `<button id="one" data-click="pick('one', 1)">1</button>
       <button id="two" data-click="pick('two', 2)">2</button>`,
      { n: 5 },
      {
        pick(this: any, name: string, num: number) {
          // `this` must stay the scope so actions can read/mutate state.
          seen.push([name, num + this.n]);
        },
      },
    );
    (document.querySelector("#one") as HTMLElement).click();
    (document.querySelector("#two") as HTMLElement).click();
    expect(seen).toEqual([
      ["one", 6],
      ["two", 7],
    ]);
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

  it("handles multi-select data-model and caret preservation", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <select id="multi-sel" multiple data-model="selected">
        <option value="opt1" selected>Opt 1</option>
        <option value="opt2" selected>Opt 2</option>
        <option value="opt3">Opt 3</option>
      </select>
      <input id="focused-inp" data-model="text">
    `;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { selected: [], text: "hi" });
    await tick();

    const sel = document.getElementById("multi-sel") as HTMLSelectElement;
    (sel.options[0] as HTMLOptionElement).selected = true;
    (sel.options[1] as HTMLOptionElement).selected = true;
    sel.dispatchEvent(new Event("change"));
    expect(s.selected).toEqual(["opt1", "opt2"]);

    const inp = document.getElementById("focused-inp") as HTMLInputElement;
    inp.focus();
    s.text = "hi"; // same value while focused triggers early return
    await tick();
    expect(inp.value).toBe("hi");
  });

  it("handles data-for row removal, bad syntax, and non-array warnings", async () => {
    (window as any).__LAGHU_DEV__ = true;
    const root = document.createElement("div");
    root.innerHTML = `
      <ul id="list-for">
        <template data-for="item in items" data-key="item.sub.id">
          <li class="item-node" data-bind="item.name"></li>
        </template>
        <template id="bad-for" data-for="invalid-syntax"></template>
        <template id="non-arr" data-for="x in notList"></template>
      </ul>
    `;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, {
      items: [
        { sub: { id: "a" }, name: "Alpha" },
        { sub: { id: "b" }, name: "Beta" },
      ],
      notList: 123,
    });
    await tick(30);
    expect(root.querySelectorAll(".item-node").length).toBe(2);

    // remove an item: triggers destroyTree and node removal
    s.items = [{ sub: { id: "b" }, name: "Beta" }];
    await tick(30);
    expect(root.querySelectorAll(".item-node").length).toBe(1);
    expect(root.querySelector(".item-node")!.textContent).toBe("Beta");
  });

  it("covers all display filter edge cases and error handling", async () => {
    (window as any).__LAGHU_DEV__ = true;
    const cyclic: any = {};
    cyclic.self = cyclic;

    Laghu.filter("exploder", () => {
      throw new Error("filter explode");
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <span id="fl-json" data-bind="c | json"></span>
      <span id="fl-fixed" data-bind="n | fixed:2"></span>
      <span id="fl-curr" data-bind="n | currency"></span>
      <span id="fl-date" data-bind="invDate | date"></span>
      <span id="fl-join" data-bind="nonArr | join"></span>
      <span id="fl-len" data-bind="missing | length"></span>
      <span id="fl-unk" data-bind="val | unknownFilter"></span>
      <span id="fl-exp" data-bind="val | exploder"></span>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, {
      c: cyclic,
      n: "not-a-number",
      invDate: "invalid-date-string",
      nonArr: 42,
      missing: null,
      val: "hello",
    });
    await tick();

    expect(document.getElementById("fl-json")!.textContent).toBe("[object Object]");
    expect(document.getElementById("fl-fixed")!.textContent).toBe("not-a-number");
    expect(document.getElementById("fl-curr")!.textContent).toBe("not-a-number");
    expect(document.getElementById("fl-date")!.textContent).toBe("");
    expect(document.getElementById("fl-join")!.textContent).toBe("42");
    expect(document.getElementById("fl-len")!.textContent).toBe("0");
    expect(document.getElementById("fl-unk")!.textContent).toBe("hello");
  });

  it("blocks scriptable URLs on data-bind attributes and handles claimed elements", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <a id="bad-link" data-bind:href="badUrl">link</a>
      <span id="double-wire" data-bind="msg"></span>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, { badUrl: "javascript:alert(1)", msg: "first" });
    await tick();
    const link = document.getElementById("bad-link") as HTMLAnchorElement;
    expect(link.hasAttribute("href")).toBe(false);

    // Re-hydrating root exercises claimed guards
    Laghu.hydrate(root, { badUrl: "javascript:alert(1)", msg: "second" });
    await tick();
    expect(document.getElementById("double-wire")!.textContent).toBe("first");
  });

  it("handles numArg in fixed filter, data-model cleanup, and event modifiers", async () => {
    // numArg evaluation via data-bind
    const fRoot = document.createElement("div");
    fRoot.innerHTML = `
      <span id="num-fix" data-bind="n | fixed:2"></span>
      <span id="num-bad" data-bind="n | fixed:'abc'"></span>
    `;
    document.body.appendChild(fRoot);
    Laghu.hydrate(fRoot, { n: 12.345 }, {});
    await tick();
    expect(document.getElementById("num-fix")!.textContent).toBe("12.35");
    expect(document.getElementById("num-bad")!.textContent).toBe("12");

    // data-on modifiers: prevent, stop, once
    let fired = false;
    const root = document.createElement("div");
    root.innerHTML = `
      <button id="mod-btn" data-on:click.prevent.stop.once="onAction">click</button>
      <input id="clean-model" data-model="foo">
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, { foo: "bar" }, { onAction: () => (fired = true) });
    await tick();

    const btn = document.getElementById("mod-btn") as HTMLButtonElement;
    const ev = new MouseEvent("click", { cancelable: true, bubbles: true });
    btn.dispatchEvent(ev);
    expect(fired).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
    expect(btn.hasAttribute("data-on:click.prevent.stop.once")).toBe(false);

    // cleanup on data-model element
    Laghu.destroyTree(document.getElementById("clean-model")!);
  });

  it("covers checkbox uncheck array splice, attr removal, data-for edge cases, directive errors, and scan scope", async () => {
    // 1. checkbox array uncheck
    const cbRoot = document.createElement("div");
    cbRoot.innerHTML = `
      <input type="checkbox" id="cb-red" data-model="selected" value="red">
      <input type="checkbox" id="cb-blue" data-model="selected" value="blue">
    `;
    document.body.appendChild(cbRoot);
    const cbState: any = Laghu.hydrate(cbRoot, { selected: ["red", "blue"] });
    await tick();
    const cbRed = document.getElementById("cb-red") as HTMLInputElement;
    expect(cbRed.checked).toBe(true);

    // uncheck red
    cbRed.checked = false;
    cbRed.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(cbState.selected).toEqual(["blue"]);

    // 2. data-bind:attr removal on false, null, undefined, and blocked scriptable URL
    const attrRoot = document.createElement("div");
    attrRoot.innerHTML = `
      <div id="attr-target" data-bind:title="titleVal" data-bind:href="badHref">text</div>
    `;
    document.body.appendChild(attrRoot);
    const attrState: any = Laghu.hydrate(attrRoot, {
      titleVal: "initial title",
      badHref: "javascript:alert(1)",
    });
    await tick();
    const attrTarget = document.getElementById("attr-target")!;
    expect(attrTarget.getAttribute("title")).toBe("initial title");
    expect(attrTarget.hasAttribute("href")).toBe(false);

    attrState.titleVal = false;
    await tick();
    expect(attrTarget.hasAttribute("title")).toBe(false);

    attrState.titleVal = "second title";
    await tick();
    expect(attrTarget.getAttribute("title")).toBe("second title");

    attrState.titleVal = null;
    await tick();
    expect(attrTarget.hasAttribute("title")).toBe(false);

    attrState.titleVal = undefined;
    await tick();
    expect(attrTarget.hasAttribute("title")).toBe(false);

    // 3. data-for bad syntax, non-array list, and missing parent
    const forRoot = document.createElement("div");
    forRoot.innerHTML = `
      <template data-for="badSyntaxWithoutIn"><span>item</span></template>
      <template data-for="x in notAnArray"><span>{{x}}</span></template>
    `;
    document.body.appendChild(forRoot);
    Laghu.hydrate(forRoot, { notAnArray: "a string instead of array" });
    await tick();

    const orphanTpl = document.createElement("template");
    orphanTpl.setAttribute("data-for", "i in list");
    Laghu.hydrate(orphanTpl, { list: [1, 2] });

    // 4. data-init throwing and custom directive throwing
    Laghu.directive("faildir", () => {
      throw new Error("directive boom");
    });
    const errRoot = document.createElement("div");
    errRoot.innerHTML = `
      <div id="init-throw" data-init="throwAction()"></div>
      <div id="dir-throw" data-faildir="123"></div>
    `;
    document.body.appendChild(errRoot);
    Laghu.hydrate(errRoot, {}, {
      throwAction: () => {
        throw new Error("init action boom");
      },
    });
    await tick();

    // 5. DOMContentLoaded on element that already has _bScope
    const preScoped = document.createElement("div");
    preScoped.setAttribute("data-scope", "{}");
    (preScoped as any)._bScope = {};
    document.body.appendChild(preScoped);
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // 6. claimed checks across all directives on rehydration
    Laghu.directive("testdir", () => {});
    const rehydRoot = document.createElement("div");
    rehydRoot.innerHTML = `
      <div id="rh-html" data-html="rawHtml"></div>
      <div id="rh-attr" data-bind:title="t" data-class:active="vis" data-style:color="t"></div>
      <input id="rh-mod" data-model="inputVal">
      <div id="rh-show" data-show="vis"></div>
      <div id="rh-plain-if" data-if="vis">plain if</div>
      <template id="rh-if" data-if="vis"><span>rh-if</span></template>
      <template id="rh-for" data-for="item in items"><span>rh-for</span></template>
      <button id="rh-click" data-click="run">rh</button>
      <button id="rh-on" data-on:click="run">rh on</button>
      <div id="rh-dir" data-testdir="t">rh dir</div>
      <div id="rh-init" data-init="run"></div>
    `;
    document.body.appendChild(rehydRoot);
    const rhState: any = Laghu.hydrate(rehydRoot, {
      rawHtml: "<b>rh</b>",
      t: "rh",
      inputVal: "rh",
      vis: true,
      items: [1],
    }, { run: () => {} });
    await tick();

    // Re-hydrate the same elements with claimed guards returning early
    Laghu.hydrate(rehydRoot, rhState, { run: () => {} });
    await tick();
  });

  it("handles child request abort on cleanup, root data-scope setting, caret preservation, swap fallback, and focus options fallback", async () => {
    // 1. Child element with _bReq is aborted on parent destroyTree
    let childAborted = false;
    const parentEl = document.createElement("div");
    const childEl = document.createElement("div");
    (childEl as any)._bReq = {
      abort: () => {
        childAborted = true;
      },
    };
    parentEl.appendChild(childEl);
    Laghu.destroyTree(parentEl);
    expect(childAborted).toBe(true);

    // 2. Laghu.hydrate on root element having data-scope sets root._bScope
    const rootScopeEl = document.createElement("div");
    rootScopeEl.setAttribute("data-scope", '{"flag": true}');
    document.body.appendChild(rootScopeEl);
    const hydratedScope: any = Laghu.hydrate(rootScopeEl);
    expect(hydratedScope.flag).toBe(true);
    expect((rootScopeEl as any)._bScope.flag).toBe(true);

    // 2b. Laghu.hydrate on root without data-scope or state exercises parseScope(null)
    const noScopeEl = document.createElement("div");
    document.body.appendChild(noScopeEl);
    const emptyState: any = Laghu.hydrate(noScopeEl);
    expect(emptyState).toBeDefined();

    // 3. Caret preservation: activeElement input does not overwrite value when matching
    const caretRoot = document.createElement("div");
    caretRoot.innerHTML = `<input id="caret-input" data-model="text">`;
    document.body.appendChild(caretRoot);
    const caretState: any = Laghu.hydrate(caretRoot, { text: "hello" });
    await tick();

    const caretInput = document.getElementById("caret-input") as HTMLInputElement;
    caretInput.focus();
    caretInput.value = "world";
    caretState.text = "world";
    await tick();
    expect(caretInput.value).toBe("world");

    // 4. Swap unknown mode fallback
    const swapTarget = document.createElement("div");
    swapTarget.innerHTML = "<span>old</span>";
    document.body.appendChild(swapTarget);
    Laghu.swap(swapTarget, "<p>fallback content</p>", "unsupported-mode" as any);
    expect(swapTarget.innerHTML).toContain("fallback content");

    // 5. Swap with CSS.escape failure fallback
    const cssProto = Object.getPrototypeOf(CSS);
    const origEscape = cssProto.escape;
    cssProto.escape = () => {
      throw new Error("CSS.escape failed");
    };

    const presTarget = document.createElement("div");
    presTarget.innerHTML = '<span id="p-preserved" data-preserve>kept</span>';
    document.body.appendChild(presTarget);
    Laghu.swap(presTarget, '<span id="p-preserved" data-preserve>fresh</span>', "inner");
    cssProto.escape = origEscape;

    // 6. Focus options failure fallback
    const focEl = document.createElement("input");
    focEl.id = "foc-input";
    document.body.appendChild(focEl);
    window.HTMLElement.prototype.focus.call(focEl);

    let fallbackFocusCalled = false;
    focEl.focus = (opts?: any) => {
      if (opts) throw new Error("options unsupported");
      fallbackFocusCalled = true;
    };

    const swapContainer = document.createElement("div");
    swapContainer.innerHTML = "<span>to-swap</span>";
    document.body.appendChild(swapContainer);
    Laghu.swap(swapContainer, "<span>swapped</span>", "inner");
    expect(fallbackFocusCalled).toBe(true);
  });

  it("covers DOM binding branches: empty attrs, clear number input, focused update, null models, null data-html, and no-actions hydration", async () => {
    // 1. Hydrate island without actions parameter
    const rootNoActions = document.createElement("div");
    rootNoActions.innerHTML = `
      <button id="btn-no-act-click" data-click="n++">click</button>
      <button id="btn-no-act-on" data-on:click="n++">on</button>
      <span id="init-no-act" data-init="n = 10"></span>
      <span id="init-empty" data-init=""></span>
    `;
    document.body.appendChild(rootNoActions);
    const sNoActions = Laghu.hydrate(rootNoActions, { n: 0 });
    await tick();
    expect(sNoActions.n).toBe(10);
    (document.getElementById("btn-no-act-click") as HTMLElement).click();
    await tick();
    expect(sNoActions.n).toBe(11);
    (document.getElementById("btn-no-act-on") as HTMLElement).click();
    await tick();
    expect(sNoActions.n).toBe(12);
    rootNoActions.remove();

    // 2. Clear number input and null model values
    const rootModels = document.createElement("div");
    rootModels.innerHTML = `
      <input type="number" id="inp-num" data-model="numVal">
      <input type="text" id="inp-txt" data-model="txtVal">
      <input type="radio" id="rad-val" data-model="radVal" value="r1">
      <select multiple id="sel-multi" data-model="multiVal"><option value="o1">O1</option></select>
      <span id="txt-empty" data-text=""></span>
      <span id="html-empty" data-html=""></span>
      <span id="html-null" data-html="nullHtml"></span>
      <div id="show-empty" data-show=""></div>
      <div id="if-empty" data-if=""></div>
      <input id="model-empty" data-model="">
    `;
    document.body.appendChild(rootModels);
    const sModels = Laghu.hydrate(rootModels, {
      numVal: 42,
      txtVal: "initial",
      radVal: null,
      multiVal: null,
      nullHtml: null,
    });
    await tick();

    const inpNum = document.getElementById("inp-num") as HTMLInputElement;
    const inpTxt = document.getElementById("inp-txt") as HTMLInputElement;
    const radVal = document.getElementById("rad-val") as HTMLInputElement;

    expect(inpNum.value).toBe("42");
    expect(radVal.checked).toBe(false);

    // Clear number input by user
    inpNum.value = "";
    inpNum.dispatchEvent(new Event("input"));
    await tick();
    expect(sModels.numVal).toBeNull();

    // Set model to null to clear value
    sModels.txtVal = null;
    await tick();
    expect(inpTxt.value).toBe("");

    // Active element focused where value does NOT match:
    window.HTMLElement.prototype.focus.call(inpTxt);
    inpTxt.value = "user-typed";
    sModels.txtVal = "server-updated";
    await tick();
    expect(inpTxt.value).toBe("server-updated");

    rootModels.remove();
  });

  it("covers template and for-loop branches: text nodes in if, null list, missing key, and row reuse", async () => {
    const rootTpl = document.createElement("div");
    rootTpl.innerHTML = `
      <template id="tpl-empty-if" data-if=""></template>
      <template id="tpl-empty-for" data-for=""></template>
      <template id="tpl-with-text" data-if="showIf">
        <span id="span-if">one</span>
        trailing text node
      </template>
      <template id="tpl-for" data-for="item in items" data-key="id">
        <p data-text="item.name"></p>
      </template>
    `;
    document.body.appendChild(rootTpl);

    const sTpl = Laghu.hydrate(rootTpl, {
      showIf: true,
      items: null,
    });
    await tick();
    expect(document.getElementById("span-if")).not.toBeNull();

    // Toggle if to false: destroys and removes text node along with element
    sTpl.showIf = false;
    await tick();
    expect(document.getElementById("span-if")).toBeNull();

    // Missing key in item (falls back to index i)
    sTpl.items = [{ name: "no-id" }];
    await tick();
    expect(rootTpl.textContent).toContain("no-id");

    // Same item reference updated (prevItem === item)
    const objItem = { id: 1, name: "Ada" };
    sTpl.items = [objItem];
    await tick();
    expect(rootTpl.textContent).toContain("Ada");
    // Trigger loop re-render with identical item instance
    sTpl.items = [objItem];
    await tick();
    expect(rootTpl.textContent).toContain("Ada");

    // Reorder items
    const item1 = { id: 1, name: "First" };
    const item2 = { id: 2, name: "Second" };
    sTpl.items = [item1, item2];
    await tick();
    sTpl.items = [item2, item1];
    await tick();
    expect(rootTpl.textContent).toMatch(/Second[\s\S]*First/);

    rootTpl.remove();
  });

  it("covers swapHtml branches: detached target for beforebegin/afterend/delete, empty swap, and fallback CSS escaping", () => {
    // 1. Detached targets for beforebegin, afterend, and delete
    const detached = document.createElement("div");
    Laghu.swap(detached, "<p>p</p>", "beforebegin");
    Laghu.swap(detached, "<p>p</p>", "afterend");
    Laghu.swap(detached, "<p>p</p>", "delete");

    // 2. Empty swap parameter
    const targetEmptySwap = document.createElement("div");
    document.body.appendChild(targetEmptySwap);
    Laghu.swap(targetEmptySwap, "<span>empty-mode</span>", "");
    expect(targetEmptySwap.innerHTML).toContain("empty-mode");

    // 3. CSS undefined fallback
    const origCSS = (window as any).CSS;
    delete (window as any).CSS;
    const targetNoCSS = document.createElement("div");
    targetNoCSS.innerHTML = `<span id="no-css-pres" data-preserve>orig</span>`;
    document.body.appendChild(targetNoCSS);
    Laghu.swap(targetNoCSS, `<span id="no-css-pres" data-preserve>fresh</span>`, "inner");
    (window as any).CSS = origCSS;

    // 4. Focus restore where target element has no setSelectionRange
    const btnFocus = document.createElement("button");
    btnFocus.id = "btn-focus-target";
    document.body.appendChild(btnFocus);
    window.HTMLElement.prototype.focus.call(btnFocus);
    const swapTarget = document.createElement("div");
    document.body.appendChild(swapTarget);
    Laghu.swap(swapTarget, "<p>swapped</p>", "inner");

    targetEmptySwap.remove();
    targetNoCSS.remove();
    btnFocus.remove();
    swapTarget.remove();
  });

  it("covers remaining DOM edge cases: DocumentFragment roots, SSR init, bindModel null/div, and template lifecycle", async () => {
    // 1. unknownAction when document.dispatchEvent is undefined
    const origDispatch = document.dispatchEvent;
    (document as any).dispatchEvent = undefined;
    const rootUnknown = document.createElement("div");
    rootUnknown.innerHTML = `<span data-init="missingAction"></span>`;
    document.body.appendChild(rootUnknown);
    try {
      Laghu.hydrate(rootUnknown, {});
    } finally {
      document.dispatchEvent = origDispatch;
      rootUnknown.remove();
    }

    // 2. DocumentFragment passed as root to hydrate (eachEl & allEls with DocumentFragment)
    const frag = document.createDocumentFragment();
    const spanInFrag = document.createElement("span");
    spanInFrag.setAttribute("data-bind", "val");
    frag.appendChild(spanInFrag);
    Laghu.hydrate(frag as any, { val: "frag-text" });
    await tick();
    expect(spanInFrag.textContent).toBe("frag-text");

    // 3. data-style when value evaluates to null/false
    const rootStyle = document.createElement("div");
    rootStyle.innerHTML = `<span id="st-test" data-style:color="cNull"></span>`;
    document.body.appendChild(rootStyle);
    Laghu.hydrate(rootStyle, { cNull: null });
    await tick();
    expect((document.getElementById("st-test") as HTMLElement).style.color).toBe("");
    rootStyle.remove();

    // 4. bindModel on focused element when value is nullish, and bindModel on element without value property (div)
    const rootModel = document.createElement("div");
    rootModel.innerHTML = `
      <input id="bm-inp-null" data-model="textVal">
      <div id="bm-div" data-model="textVal"></div>
    `;
    document.body.appendChild(rootModel);
    const inpNull = document.getElementById("bm-inp-null") as HTMLInputElement;
    inpNull.focus();
    const sModel: any = Laghu.hydrate(rootModel, { textVal: null });
    await tick();
    sModel.textVal = null;
    await tick();
    rootModel.remove();

    // 5. bindTemplateIf with detached template (no parent) and DocumentFragment parent
    const tplNoParent = document.createElement("template");
    tplNoParent.setAttribute("data-if", "show");
    Laghu.hydrate(tplNoParent, { show: true });

    const fragTpl = document.createDocumentFragment();
    const tplInFrag = document.createElement("template");
    tplInFrag.setAttribute("data-if", "show");
    tplInFrag.innerHTML = `<span id="in-frag-child">ok</span>`;
    fragTpl.appendChild(tplInFrag);
    Laghu.hydrate(fragTpl as any, { show: true });

    // 6. bindTemplateIf teardown where child node is removed during cleanup
    const rootIfCleanup = document.createElement("div");
    rootIfCleanup.innerHTML = `<template data-if="show"><div id="self-rem">rem</div></template>`;
    document.body.appendChild(rootIfCleanup);
    const sIf: any = Laghu.hydrate(rootIfCleanup, { show: true });
    await tick();
    const selfRemChild = document.getElementById("self-rem")!;
    (selfRemChild as any)._bcu = [() => selfRemChild.remove()];
    sIf.show = false;
    await tick();
    rootIfCleanup.remove();

    // 7. bindTemplateFor: reordering items with index variable (prevIdx !== i) and empty string key
    const rootFor = document.createElement("div");
    rootFor.innerHTML = `
      <template data-for="item, idx in items" data-key="id">
        <span class="row">{{idx}}:{{item.id}}</span>
      </template>
    `;
    document.body.appendChild(rootFor);
    const item1 = { id: "" };
    const item2 = { id: "2" };
    const sFor: any = Laghu.hydrate(rootFor, { items: [item1, item2] });
    await tick();
    // Swap item positions to trigger (idxVar && prevIdx !== i) on same item reference
    sFor.items = [item2, item1];
    await tick();
    // Delete items with cleanup hook on row node that removes itself
    const holderEl = rootFor.querySelector("[data-bkey='2']")!;
    (holderEl as any)._bcu = [() => holderEl.remove()];
    sFor.items = [];
    await tick();
    rootFor.remove();

    // 8. custom directive on element with empty attribute value
    let dirEmptyVal: any;
    Laghu.directive("t-empty-attr", ({ get }) => {
      dirEmptyVal = get();
    });
    const rootDir = document.createElement("div");
    rootDir.innerHTML = `<span data-t-empty-attr=""></span>`;
    document.body.appendChild(rootDir);
    Laghu.hydrate(rootDir, {});
    await tick();
    expect(dirEmptyVal).toBeUndefined();
    rootDir.remove();

    // 9. serializeForm with Blob entry in FormData
    const origFD = window.FormData;
    (window as any).FormData = class extends origFD {
      forEach(cb: any) {
        super.forEach(cb);
        cb(new Blob(["binary"]), "blobKey");
      }
    };
    const formBlob = document.createElement("form");
    formBlob.innerHTML = `<button id="btn-blob-post" data-post="/api/upload" data-vals="form"></button>`;
    document.body.appendChild(formBlob);
    Laghu.hydrate(formBlob, {});
    document.getElementById("btn-blob-post")!.click();
    (window as any).FormData = origFD;
    formBlob.remove();

    // 10. restoreFocus when focused element is removed by swap
    const swapTarget2 = document.createElement("div");
    swapTarget2.innerHTML = `<button id="vanish-focus-btn">btn</button>`;
    document.body.appendChild(swapTarget2);
    document.getElementById("vanish-focus-btn")!.focus();
    Laghu.swap(swapTarget2, "<p>no-focus-btn</p>", "inner");
    swapTarget2.remove();

    // 11. SSR Laghu.init when document is undefined
    const origDoc = (globalThis as any).document;
    delete (globalThis as any).document;
    try {
      Laghu.init!();
    } finally {
      (globalThis as any).document = origDoc;
    }
  });
});



