import { describe, it, expect } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

describe("parseTrigger", () => {
  it("defaults by tag", () => {
    const btn = document.createElement("button");
    expect(Laghu.parseTrigger("", btn).on).toBe("click");
    const form = document.createElement("form");
    expect(Laghu.parseTrigger("", form).on).toBe("submit");
    const input = document.createElement("input");
    expect(Laghu.parseTrigger("", input).on).toBe("change");
  });

  it("parses every modifier", () => {
    const t = Laghu.parseTrigger(
      "click delay:200ms throttle:1s once changed queue:last every 2s load revealed",
      document.createElement("button"),
    );
    expect(t).toMatchObject({
      on: "click",
      delay: 200,
      throttle: 1000,
      once: true,
      changed: true,
      queue: "last",
      every: 2000,
      load: true,
      revealed: true,
    });
  });

  it("parses seconds and queues", () => {
    const el = document.createElement("button");
    expect(Laghu.parseTrigger("every 5s", el).every).toBe(5000);
    expect(Laghu.parseTrigger("click queue:first", el).queue).toBe("first");
    expect(Laghu.parseTrigger("click from:document", el).from).toBe("document");
  });
});

describe("store and persist", () => {
  it("creates and fetches named stores", () => {
    Laghu.store("t-cart", { n: 2 });
    expect(Laghu.store("t-cart").n).toBe(2);
  });

  it("reads stores in expressions", () => {
    Laghu.store("t-read", { n: 7 });
    expect(Laghu.eval({}, "$store.t-read.n")).toBe(7);
  });

  it("persists and restores versioned state", async () => {
    Laghu.store("t-pz", { n: 1 });
    Laghu.persist("t-pz", { key: "laghu:test-pz", version: 1, debounce: 10 });
    Laghu.store("t-pz").n = 42;
    await tick(60);
    expect(window.localStorage.getItem("laghu:test-pz") || "").toContain("42");
    Laghu.store("t-pz2", { n: 0 });
    window.localStorage.setItem("laghu:test-pz2", JSON.stringify({ v: 1, state: { n: 9 } }));
    Laghu.persist("t-pz2", { key: "laghu:test-pz2", version: 1, debounce: 10 });
    expect(Laghu.store("t-pz2").n).toBe(9);
  });

  it("reseeds on version mismatch", () => {
    Laghu.store("t-pz3", { n: 1 });
    window.localStorage.setItem("laghu:test-pz3", JSON.stringify({ v: 999, state: { n: 5 } }));
    Laghu.persist("t-pz3", { key: "laghu:test-pz3", version: 1, debounce: 10 });
    expect(Laghu.store("t-pz3").n).toBe(1);
  });

  it("handles persist errors and corrupted storage gracefully", async () => {
    Laghu.store("err-store", { a: 1 });
    window.localStorage.setItem("laghu:err-store", "invalid-json{{{");
    Laghu.persist("err-store", { debounce: 10 });

    const origSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error("storage quota");
    };
    Laghu.store("err-store").a = 2;
    await tick(30);
    window.localStorage.setItem = origSetItem;
  });
});

describe("bindTrigger live behavior", () => {
  it("handles changed modifier on inputs and checkboxes", async () => {
    let count = 0;
    const root = document.createElement("div");
    root.innerHTML = `
      <input id="ch-text" data-on:input="inc" data-trigger="input changed">
      <input id="ch-box" type="checkbox" data-on:change="inc" data-trigger="change changed">
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, { inc: () => count++ });

    const text = document.getElementById("ch-text") as HTMLInputElement;
    text.value = "first";
    text.dispatchEvent(new Event("input"));
    expect(count).toBe(1);

    // duplicate value does not fire
    text.dispatchEvent(new Event("input"));
    expect(count).toBe(1);

    text.value = "second";
    text.dispatchEvent(new Event("input"));
    expect(count).toBe(2);

    const box = document.getElementById("ch-box") as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    expect(count).toBe(3);
    box.dispatchEvent(new Event("change"));
    expect(count).toBe(3);
  });

  it("handles delay, throttle, and once modifiers", async () => {
    let fires = 0;
    const root = document.createElement("div");
    root.innerHTML = `
      <button id="dto-btn" data-click="run" data-trigger="click delay:15ms throttle:40ms once">btn</button>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, { run: () => fires++ });

    const btn = document.getElementById("dto-btn")!;
    btn.click();
    expect(fires).toBe(0);
    btn.click(); // throttle skips
    await tick(35);
    expect(fires).toBe(1);

    // once prevents further runs
    btn.click();
    await tick(35);
    expect(fires).toBe(1);
  });

  it("handles from delegation, every, load, and revealed", async () => {
    let fromFired = 0;
    let pollFired = 0;
    let loadFired = 0;
    let revFired = 0;

    let obsCallback: any;
    let disconnected = 0;
    const MockIO = class {
      constructor(cb: any) {
        obsCallback = cb;
      }
      observe() {}
      disconnect() {
        disconnected++;
      }
    };
    (globalThis as any).IntersectionObserver = MockIO;
    (window as any).IntersectionObserver = MockIO;

    const root = document.createElement("div");
    root.innerHTML = `
      <div id="from-host" data-click="onFrom" data-trigger="click from:#child-target">
        <button id="child-target">click target</button>
      </div>
      <div id="every-host" data-click="onPoll" data-trigger="every 15ms"></div>
      <div id="load-host" data-click="onLoad" data-trigger="load"></div>
      <div id="rev-host" data-click="onRev" data-trigger="revealed once"></div>
    `;
    document.body.appendChild(root);

    Laghu.hydrate(
      root,
      {},
      {
        onFrom: () => fromFired++,
        onPoll: () => pollFired++,
        onLoad: () => loadFired++,
        onRev: () => revFired++,
      },
    );

    document.getElementById("child-target")!.click();
    expect(fromFired).toBe(1);

    if (obsCallback) {
      obsCallback([{ isIntersecting: false }]);
      expect(revFired).toBe(0);
      obsCallback([{ isIntersecting: true }]);
      expect(revFired).toBe(1);
    }

    await tick(35);
    expect(pollFired).toBeGreaterThanOrEqual(1);
    expect(loadFired).toBe(1);

    Laghu.destroyTree(root);
    expect(disconnected).toBe(3);
    delete (globalThis as any).IntersectionObserver;
    delete (window as any).IntersectionObserver;
  });

  it("handles load trigger during document readyState loading", async () => {
    let loadFired = 0;
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });

    const root = document.createElement("div");
    root.innerHTML = `<button id="loading-btn" data-click="onLoad" data-trigger="load"></button>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, { onLoad: () => loadFired++ });

    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(loadFired).toBe(1);

    Laghu.destroyTree(root);
    Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
  });

  it("handles throttle without delay and once state.done guard", async () => {
    let fired = 0;
    const root = document.createElement("div");
    root.innerHTML = `<button id="throttle-btn" data-click="run" data-trigger="click throttle:50ms once">btn</button>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, { run: () => fired++ });

    const btn = document.getElementById("throttle-btn")!;
    btn.click(); // fires and sets state.done = true
    expect(fired).toBe(1);

    // Second click hits if (state.done) return
    btn.click();
    expect(fired).toBe(1);

    // Pure throttle without once
    let throttleFires = 0;
    const root2 = document.createElement("div");
    root2.innerHTML = `<button id="th-pure" data-click="run" data-trigger="click throttle:100ms">btn</button>`;
    document.body.appendChild(root2);
    Laghu.hydrate(root2, {}, { run: () => throttleFires++ });

    const btn2 = document.getElementById("th-pure")!;
    btn2.click(); // first click fires
    expect(throttleFires).toBe(1);
    btn2.click(); // within 100ms -> skipped
    expect(throttleFires).toBe(1);
  });

  it("handles from:document and from:body delegation", () => {
    let docFired = 0;
    let bodyFired = 0;

    const root = document.createElement("div");
    root.innerHTML = `
      <div data-click="onDoc" data-trigger="click from:document"></div>
      <div data-click="onBody" data-trigger="click from:body"></div>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(
      root,
      {},
      {
        onDoc: () => docFired++,
        onBody: () => bodyFired++,
      },
    );

    document.dispatchEvent(new Event("click"));
    document.body.dispatchEvent(new Event("click"));

    expect(docFired).toBeGreaterThanOrEqual(1);
    expect(bodyFired).toBeGreaterThanOrEqual(1);

    Laghu.destroyTree(root);
  });

  it("handles load without queueMicrotask and revealed without IntersectionObserver", async () => {
    // 1. load fallback when queueMicrotask is undefined
    const origQueue = (globalThis as any).queueMicrotask;
    delete (globalThis as any).queueMicrotask;

    let loadFired = 0;
    const root = document.createElement("div");
    root.innerHTML = `<div data-click="onLoad" data-trigger="load"></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, { onLoad: () => loadFired++ });

    await tick(20);
    expect(loadFired).toBe(1);
    (globalThis as any).queueMicrotask = origQueue;

    // 2. revealed fallback when IntersectionObserver is undefined
    const origIO = (globalThis as any).IntersectionObserver;
    const origWinIO = (window as any).IntersectionObserver;
    delete (globalThis as any).IntersectionObserver;
    delete (window as any).IntersectionObserver;

    let revFired = 0;
    const root2 = document.createElement("div");
    root2.innerHTML = `<div data-click="onRev" data-trigger="revealed"></div>`;
    document.body.appendChild(root2);
    Laghu.hydrate(root2, {}, { onRev: () => revFired++ });

    expect(revFired).toBe(1);

    if (origIO) (globalThis as any).IntersectionObserver = origIO;
    if (origWinIO) (window as any).IntersectionObserver = origWinIO;
  });

  it("covers non-input element with changed modifier, from-delegation miss, and revealed without once", async () => {
    let divClicks = 0;
    let fromClicks = 0;
    let revCount = 0;
    let disconnectedCount = 0;

    let ioCallback: any;
    const MockIO = class {
      constructor(cb: any) {
        ioCallback = cb;
      }
      observe() {}
      disconnect() {
        disconnectedCount++;
      }
    };
    (globalThis as any).IntersectionObserver = MockIO;
    (window as any).IntersectionObserver = MockIO;

    const root = document.createElement("div");
    root.innerHTML = `
      <div id="div-changed" data-click="onDiv" data-trigger="click changed">div</div>
      <div id="from-parent" data-click="onFrom" data-trigger="click from:#allowed-child">
        <button id="allowed-child">allowed</button>
        <button id="ignored-child">ignored</button>
      </div>
      <div id="rev-no-once" data-click="onRev" data-trigger="revealed">rev</div>
    `;
    document.body.appendChild(root);

    Laghu.hydrate(
      root,
      {},
      {
        onDiv: () => divClicks++,
        onFrom: () => fromClicks++,
        onRev: () => revCount++,
      },
    );

    // 1. Click div with changed modifier: div is not an input, has no value/checked
    (document.getElementById("div-changed") as HTMLElement).click();
    expect(divClicks).toBe(1);

    // 2. Click ignored-child: closest("#allowed-child") is null -> false branch taken
    (document.getElementById("ignored-child") as HTMLElement).click();
    expect(fromClicks).toBe(0);

    // Click allowed-child -> fires
    (document.getElementById("allowed-child") as HTMLElement).click();
    expect(fromClicks).toBe(1);

    // 3. Revealed without once: observer fires, but disconnect is NOT called
    if (ioCallback) {
      ioCallback([{ isIntersecting: true }]);
    }
    expect(revCount).toBe(1);
    expect(disconnectedCount).toBe(0);

    root.remove();
  });
});


