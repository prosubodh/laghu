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

describe("default sanitizer", () => {
  it("strips scripts and event handlers, keeps safe markup", async () => {
    const s = island(`<div id="h" data-html="body"></div>`, { body: "" });
    await tick();
    s.body = "<img src=x onerror=alert(1)><script>alert(2)</script><p>safe</p>";
    await tick();
    const h = document.querySelector("#h")!;
    expect(h.querySelector("script")).toBeNull();
    expect(h.innerHTML).not.toContain("onerror");
    expect(h.textContent).toContain("safe");
  });
});

describe("URL policy", () => {
  it("refuses scriptable URLs, passes plain ones", async () => {
    const s = island(`<a id="lk" data-bind:href="url">x</a>`, { url: "/x" });
    await tick();
    s.url = "JaVaScRiPt:alert(1)";
    await tick();
    expect(document.querySelector("#lk")!.hasAttribute("href")).toBe(false);
    s.url = "/ok";
    await tick();
    expect(document.querySelector("#lk")!.getAttribute("href")).toBe("/ok");
  });
});

describe("prototype guards", () => {
  it("blocks pollution on write and gadgets on read", () => {
    Laghu.set({}, "__proto__.pwned", 1);
    expect(({} as any).pwned).toBeUndefined();
    expect(Laghu.get({ a: 1 }, "constructor.name")).toBeUndefined();
    expect(Laghu.get({}, "__proto__.x")).toBeUndefined();
  });

  it("blocks pollution through action strings", async () => {
    island(`<button id="evil" data-click="__proto__.x = 1">x</button>`, {});
    await tick();
    (document.querySelector("#evil") as HTMLElement).click();
    await tick();
    expect(({} as any).x).toBeUndefined();
  });
});

describe("laghu:error reporting", () => {
  it("fires in production-quiet mode", async () => {
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...a: any[]) => {
      warnings.push(a.join(" "));
    };
    let detail: any = null;
    document.addEventListener("laghu:unknown-action", (e) => {
      detail = (e as CustomEvent).detail;
    });
    island(`<button id="q" data-click="missing-thing">x</button>`, {});
    (document.querySelector("#q") as HTMLElement).click();
    await tick();
    console.warn = orig;
    expect(warnings.length).toBe(0);
    expect(detail && detail.name).toBe("missing-thing");
  });
});
