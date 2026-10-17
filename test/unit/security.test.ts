import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

afterEach(() => {
  vi.unstubAllGlobals();
  Laghu.sanitize(); // reset to defaultSanitize
  delete (window as any).__LAGHU_DEV__;
});

function island(html: string, state: any = {}, actions: Record<string, Function> = {}) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return Laghu.hydrate(root, state, actions) as any;
}

describe("default sanitizer", () => {
  it("strips scripts and event handlers, keeps safe markup, rewrites unsafe URLs", async () => {
    const s = island(`<div id="h" data-html="body"></div>`, { body: "" });
    await tick();
    s.body = '<a id="evil-link" href="javascript:alert(1)">evil</a><img src=x onerror=alert(1)><script>alert(2)</script><p>safe</p>';
    await tick();
    const h = document.querySelector("#h")!;
    expect(h.querySelector("script")).toBeNull();
    expect(h.innerHTML).not.toContain("onerror");
    expect(h.textContent).toContain("safe");
    const evilLink = h.querySelector("#evil-link") as HTMLAnchorElement;
    expect(evilLink.getAttribute("href")).toBe("#");

    // Single-quoted unsafe href:
    s.body = `<a id="evil-single" href='javascript:alert(2)'>single evil</a>`;
    await tick();
    const evilSingle = h.querySelector("#evil-single") as HTMLAnchorElement;
    expect(evilSingle.getAttribute("href")).toBe("#");
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
    expect(Laghu.get({ a: "string" }, "a.b.c")).toBeUndefined();
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

  it("supports custom sanitize hook and cleans unsafe href in html", async () => {
    Laghu.sanitize((raw: string) => raw.replace(/bad/g, "good"));
    island(`<div id="cust-h" data-html="content"></div>`, {
      content: 'bad <a href="javascript:alert(1)">click</a>',
    });
    await tick();
    const custH = document.querySelector("#cust-h")!;
    expect(custH.textContent).toContain("good");
  });

  it("handles decrement action, DEV mode logs, and error reporting", async () => {
    // 1. DEV mode error and warning logging
    (window as any).__LAGHU_DEV__ = true;
    const warns: string[] = [];
    const errors: string[] = [];
    const origWarn = console.warn;
    const origError = console.error;
    console.warn = (...a: any[]) => warns.push(a.join(" "));
    console.error = (...a: any[]) => errors.push(a.join(" "));

    try {
      Laghu.set({}, "bad.__proto__.key", 1);
      expect(warns.some((w) => w.includes("blocked unsafe path"))).toBe(true);

      const errorDetails: any[] = [];
      document.addEventListener("laghu:error", (e: any) => {
        errorDetails.push(e.detail);
      });

      const s = island(`<button id="dec" data-click="val--">dec</button>`, { val: 5 });
      await tick();
      (document.querySelector("#dec") as HTMLElement).click();
      await tick();
      expect(s.val).toBe(4);

      // flush error reporting in DEV mode
      Laghu.effect(() => {
        if (s.val === 4) {
          throw new Error("reactive crash in dev");
        }
      });
      s.val = 3;
      await tick(30);

      expect(errors.some((e) => e.includes("reactive crash in dev"))).toBe(true);
      expect(errorDetails.some((d) => d.error.includes("reactive crash in dev"))).toBe(true);
    } finally {
      console.warn = origWarn;
      console.error = origError;
      delete (window as any).__LAGHU_DEV__;
    }
  });

  it("handles string errors and environment without document", async () => {
    const errorDetails: any[] = [];
    const onErr = (e: any) => errorDetails.push(e.detail);
    document.addEventListener("laghu:error", onErr);

    // Trigger effect with a non-Error thrown (e.g. string)
    Laghu.effect(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "string-error-message";
    });
    await tick();
    expect(errorDetails.some((d) => d.error === "string-error-message")).toBe(true);
    document.removeEventListener("laghu:error", onErr);

    // Now test when document is stubbed
    vi.stubGlobal("document", undefined);
    expect(() => {
      Laghu.effect(() => {
        throw new Error("no doc error");
      });
    }).not.toThrow();
    vi.unstubAllGlobals();
  });
});

