import { describe, it, expect, vi } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

describe("reactive", () => {
  it("tracks reads and triggers writes", async () => {
    const s = Laghu.reactive({ n: 0 });
    let seen = -1;
    Laghu.effect(() => {
      seen = s.n;
    });
    expect(seen).toBe(0);
    s.n = 5;
    await tick();
    expect(seen).toBe(5);
  });

  it("batches synchronous writes into one run", async () => {
    const s = Laghu.reactive({ n: 0 });
    let runs = 0;
    Laghu.effect(() => {
      runs++;
      return s.n;
    });
    s.n = 1;
    s.n = 2;
    s.n = 3;
    await tick();
    expect(runs).toBe(2); // initial + one batched
  });

  it("wraps nested objects lazily", async () => {
    const s = Laghu.reactive({ user: { name: "a" } });
    let seen = "";
    Laghu.effect(() => {
      seen = s.user.name;
    });
    s.user.name = "b";
    await tick();
    expect(seen).toBe("b");
  });

  it("returns the same proxy for the same object", () => {
    const raw = { a: 1 };
    expect(Laghu.reactive(raw)).toBe(Laghu.reactive(raw));
  });

  it("passes primitives through", () => {
    expect(Laghu.reactive(5 as any)).toBe(5);
  });

  it("stop() unsubscribes fully", async () => {
    const s = Laghu.reactive({ v: 0 });
    let runs = 0;
    const stop = Laghu.effect(() => {
      runs++;
      return s.v;
    });
    const before = runs;
    stop();
    s.v = 99;
    await tick(20);
    expect(runs).toBe(before);
  });

  it("nested effects compose without clobbering outer deps", async () => {
    const s = Laghu.reactive({ a: 0, b: 0 });
    let outer = -1;
    Laghu.effect(() => {
      Laghu.effect(() => {
        return s.b;
      });
      outer = s.a;
    });
    s.a = 7;
    await tick();
    expect(outer).toBe(7);
  });

  it("conditional branches release untaken paths", async () => {
    const s = Laghu.reactive({ on: true, x: 0, y: 0 });
    let runs = 0;
    Laghu.effect(() => {
      runs++;
      return s.on ? s.x : s.y;
    });
    const base = runs;
    s.y = 42; // untaken while on === true
    await tick(20);
    expect(runs).toBe(base);
    s.on = false;
    await tick();
    const afterFlip = runs;
    s.y = 43;
    await tick();
    expect(runs).toBe(afterFlip + 1);
  });
});

describe("computed", () => {
  it("derives and stays fresh", async () => {
    const s = Laghu.reactive({ price: 3, qty: 4 });
    const total = Laghu.computed(() => s.price * s.qty);
    let shown = -1;
    Laghu.effect(() => {
      shown = total();
    });
    await tick();
    expect(shown).toBe(12);
    s.qty = 5;
    await tick();
    expect(shown).toBe(15);
  });
});

describe("watch", () => {
  it("reports transitions, skipping initial value", async () => {
    const s = Laghu.reactive({ qty: 5 });
    const seen: Array<[any, any]> = [];
    Laghu.watch(s, "qty", (n, o) => seen.push([n, o]));
    s.qty = 5;
    await tick();
    s.qty = 6;
    await tick();
    expect(seen).toEqual([[6, 5]]);
  });

  it("triggers effects on deleteProperty", async () => {
    const s = Laghu.reactive({ tag: "old" } as any);
    let seen = "";
    Laghu.effect(() => {
      seen = s.tag ?? "none";
    });
    expect(seen).toBe("old");
    delete s.tag;
    await tick();
    expect(seen).toBe("none");
  });
});

describe("store and persist", () => {
  it("registers global stores and supports $store path get and set", () => {
    const cart = Laghu.store("shopCart", { count: 1, nested: { item: "pen" } });
    expect(cart.count).toBe(1);
    expect(Laghu.get({}, "$store.shopCart.count")).toBe(1);
    expect(Laghu.get({}, "$store.shopCart.nested.item")).toBe("pen");
    expect(Laghu.get({}, "$store.nonExistent.item")).toBeUndefined();
    expect(Laghu.get({}, "$store.shopCart.__proto__.pollute")).toBeUndefined();

    Laghu.set({}, "$store.shopCart.count", 3);
    expect(cart.count).toBe(3);
    Laghu.set({}, "$store.shopCart.nested.item", "book");
    expect(cart.nested.item).toBe("book");
  });

  it("persists stores to localStorage with versioning", async () => {
    localStorage.clear();
    localStorage.setItem(
      "test:settings",
      JSON.stringify({
        v: 1,
        state: { theme: "dark" },
      })
    );

    const settings = Laghu.store("settings", { theme: "light" });
    Laghu.persist("settings", { key: "test:settings", version: 1, debounce: 5 });
    expect(settings.theme).toBe("dark");

    settings.theme = "sepia";
    await tick(30);
    expect(localStorage.getItem("test:settings")).toContain("sepia");
    expect(Laghu.persist("unknownStore", {})).toBeNull();
  });

  it("creates child scopes with Laghu.scope", () => {
    const parent = { base: 10 };
    const child = Laghu.scope(parent, { extra: 20 });
    expect(child.base).toBe(10);
    expect(child.extra).toBe(20);
  });

  it("handles effect error during microtask flush", async () => {
    const s = Laghu.reactive({ count: 0, boom: false });
    let errors: any[] = [];
    const handler = (e: any) => errors.push(e.detail.error);
    document.addEventListener("laghu:error", handler);

    Laghu.effect(() => {
      if (s.boom) throw new Error("flush explosion");
      void s.count;
    });

    s.boom = true;
    s.count = 1;
    await tick();

    expect(errors.some((msg) => msg.includes("flush explosion"))).toBe(true);
    document.removeEventListener("laghu:error", handler);
  });

  it("handles persist when localStorage is undefined or setItem throws", async () => {
    const storeObj = Laghu.store("unstableStore", { val: 1 });
    let errors: any[] = [];
    const handler = (e: any) => errors.push(e.detail.error);
    document.addEventListener("laghu:error", handler);

    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    Laghu.persist("unstableStore", { key: "unstable:key", debounce: 5 });
    storeObj.val = 2;
    await tick(50);

    expect(errors.some((msg) => msg.includes("quota exceeded"))).toBe(true);
    spy.mockRestore();

    // Now test when localStorage is undefined
    const origStorage = (globalThis as any).localStorage;
    delete (globalThis as any).localStorage;

    storeObj.val = 3;
    await tick(50);

    (globalThis as any).localStorage = origStorage;
    document.removeEventListener("laghu:error", handler);
  });

  it("covers watch when next equals prev, persist without opts, and scope without vars", async () => {
    const s = Laghu.reactive({ a: 1, b: 2 });
    let watchFired = 0;
    Laghu.watch(s, "a + (b - b)", () => {
      watchFired++;
    });
    s.b = 99;
    await tick();
    expect(watchFired).toBe(0);

    s.a = 2;
    await tick();
    expect(watchFired).toBe(1);

    // Persist without options:
    Laghu.store("noOptStore", { count: 10 });
    const pSt = Laghu.persist("noOptStore");
    expect(pSt).toBeDefined();

    // Persist when localStorage is completely undefined:
    const origStorage = (globalThis as any).localStorage;
    delete (globalThis as any).localStorage;
    Laghu.store("noStorageStore", { count: 20 });
    const pSt2 = Laghu.persist("noStorageStore");
    expect(pSt2).toBeDefined();
    (globalThis as any).localStorage = origStorage;

    // Laghu.scope without vars:
    const child = Laghu.scope({ x: 1 }, undefined as any);
    expect(child.x).toBe(1);
  });
});
