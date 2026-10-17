import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { LaghuRouter } from "../../src/router";
import { tick } from "../setup";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

describe("LaghuRouter.compile", () => {
  it("matches static paths", () => {
    expect(LaghuRouter.compile("/a")("/a")).toEqual({});
  });

  it("captures params", () => {
    expect(LaghuRouter.compile("/u/:id")("/u/42")).toEqual({ id: "42" });
  });

  it("rejects misses", () => {
    expect(LaghuRouter.compile("/u/:id")("/x/42")).toBeNull();
  });
});

describe("LaghuRouter.route", () => {
  it("renders routes, params, notfound, and wires actions", async () => {
    (window as any).Laghu = Laghu;
    document.body.innerHTML = `<div id="view"></div>`;
    const seen: string[] = [];
    const state = Laghu.reactive({ n: 0 });
    const stop = LaghuRouter.route({
      target: "#view",
      scope: state,
      actions: {
        inc(this: any) {
          this.n++;
        },
      },
      routes: [
        { path: "/", render: () => "<h1>home</h1>" },
        {
          path: "/u/:id",
          render: (p) => "<h1>user " + p.id + '</h1><button data-click="inc">go</button>',
        },
      ],
      notfound: () => "<h1>lost</h1>",
      beforeEach: (to) => {
        seen.push(to.path);
        return true;
      },
      afterEach: () => {},
    });
    window.location.hash = "#/";
    await tick(20);
    expect(document.querySelector("#view")!.textContent).toContain("home");
    window.location.hash = "#/u/42";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toContain("user 42");
    expect(seen.join(",")).toContain("/u/42");
    document.querySelector("#view button")!.click();
    await tick();
    expect(state.n).toBe(1);
    expect(LaghuRouter.current().params.id).toBe("42");
    window.location.hash = "#/nope";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toContain("lost");
    stop();
  });

  it("guards cancel renders", async () => {
    (window as any).Laghu = Laghu;
    document.body.innerHTML = `<div id="view">old</div>`;
    const stop = LaghuRouter.route({
      target: "#view",
      scope: {},
      routes: [{ path: "/x", render: () => "x" }],
      notfound: () => "lost2",
      beforeEach: () => false,
    });
    const before = document.querySelector("#view")!.textContent;
    window.location.hash = "#/x";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toBe(before);
    stop();
  });

  it("navigates programmatically", async () => {
    LaghuRouter.navigate("/u/7");
    await tick(10);
    expect(window.location.hash).toBe("#/u/7");
    window.location.hash = "#/";
  });
});

describe("router.html page", () => {
  it("boots the shipped page end to end", async () => {
    (window as any).Laghu = Laghu;
    (window as any).LaghuRouter = LaghuRouter;
    const html = fs.readFileSync(path.join(root, "examples", "router.html"), "utf8");
    document.body.innerHTML = html.slice(html.indexOf("<nav>"), html.indexOf("<script src"));

    const origRoute = LaghuRouter.route;
    let stopExample: any;
    LaghuRouter.route = (opts: any) => {
      stopExample = origRoute(opts);
      return stopExample;
    };

    window.eval(
      fs
        .readFileSync(path.join(root, "examples", "router.html"), "utf8")
        .split("<script>")
        .slice(1)
        .map((s) => s.split("</script>")[0])
        .join("\n"),
    );
    window.location.hash = "#/";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toContain("Home");
    window.location.hash = "#/user/42";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toContain("User 42");
    window.location.hash = "#/";
    await tick(30);
    document.querySelector("#view button")!.click();
    await tick();
    expect(document.querySelector("#view")!.textContent).toContain("1");
    window.location.hash = "#/user/42";
    await tick(30);
    window.location.hash = "#/";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toContain("1");
    window.location.hash = "#/vip";
    await tick(30);
    expect((document.querySelector("#view")!.textContent || "").includes("VIP")).toBe(false);
    document.querySelector("#toggle")!.click();
    window.location.hash = "#/vipx";
    await tick(20);
    window.location.hash = "#/vip";
    await tick(30);
    expect(document.querySelector("#view")!.textContent).toContain("VIP");
    window.location.hash = "#/";
    if (stopExample) stopExample();
    LaghuRouter.route = origRoute;
  });
});

describe("LaghuRouter declarative templates", () => {
  it("renders templates with bound params", async () => {
    (window as any).Laghu = Laghu;
    document.body.innerHTML = `<div id="dv">
      <template data-route="/"><h1>home</h1></template>
      <template data-route="/u/:id"><h1>user <span data-bind="params.id"></span></h1></template>
      <template data-route-notfound><h1>lost-t</h1></template>
    </div>`;
    const state = Laghu.reactive({});
    const stop = LaghuRouter.route({ target: "#dv", scope: state });
    window.location.hash = "#/";
    await tick(30);
    expect(document.querySelector("#dv")!.textContent).toContain("home");
    window.location.hash = "#/u/99";
    await tick(30);
    expect(document.querySelector("#dv")!.textContent).toContain("user 99");
    window.location.hash = "#/missing";
    await tick(30);
    expect(document.querySelector("#dv")!.textContent).toContain("lost-t");
    // templates survive swaps: navigate back and again
    window.location.hash = "#/u/7";
    await tick(30);
    expect(document.querySelector("#dv")!.textContent).toContain("user 7");
    stop();
    window.location.hash = "#/";
  });

  it("honors data-route-if guards", async () => {
    (window as any).Laghu = Laghu;
    document.body.innerHTML = `<div id="dg">
      <template data-route="/vip" data-route-if="isAdmin"><h1>vip</h1></template>
    </div>`;
    const state = Laghu.reactive({ isAdmin: false });
    const stop = LaghuRouter.route({ target: "#dg", scope: state });
    window.location.hash = "#/vip";
    await tick(30);
    expect((document.querySelector("#dg")!.textContent || "").includes("vip")).toBe(false);
    state.isAdmin = true;
    window.location.hash = "#/vipx";
    await tick(20);
    window.location.hash = "#/vip";
    await tick(30);
    expect(document.querySelector("#dg")!.textContent).toContain("vip");
    stop();
    window.location.hash = "#/";
  });

  it("wakes a binding when the parent gains the key after first render", async () => {
    (window as any).Laghu = Laghu;
    document.body.innerHTML = `<div id="dl">
      <template data-route="/"><span id="late" data-bind="lateCount"></span></template>
    </div>`;
    // Routes hydrate against a child scope (params live there), so the
    // late key lands on the reactive parent, not on the hydrated scope.
    const state = Laghu.reactive({} as any);
    const stop = LaghuRouter.route({ target: "#dl", scope: state });
    window.location.hash = "#/";
    await tick(30);
    expect(document.querySelector("#late")!.textContent).toBe("");
    state.lateCount = "132";
    await tick(30);
    expect(document.querySelector("#late")!.textContent).toBe("132");
    stop();
    window.location.hash = "#/";
  });

  it("compiles wildcard patterns and matches wildcard tail", () => {
    const match = LaghuRouter.compile("/files/*");
    expect(match("/files/sub/dir/file.txt")).toEqual({ wild: "sub/dir/file.txt" });
  });

  it("handles render errors gracefully and executes afterEach hooks", async () => {
    (window as any).Laghu = Laghu;
    document.body.innerHTML = `<div id="err-view"></div>`;
    let hookRan = false;
    LaghuRouter.afterEach(() => {
      hookRan = true;
    });

    const stop = LaghuRouter.route({
      target: "#err-view",
      scope: {},
      routes: [
        {
          path: "/throw",
          render: () => {
            throw new Error("render fail");
          },
        },
      ],
    });

    window.location.hash = "#/throw";
    await tick(30);
    expect(document.querySelector("#err-view")!.textContent).toBe("");

    window.location.hash = "";
    await tick(30);
    expect(LaghuRouter.current().path).toBe("/");
    expect(hookRan).toBe(true);
    stop();
  });

  it("covers navigate, hash fallback, beforeEach abort, guard abort, notfound fn, and hook errors", async () => {
    (window as any).Laghu = {
      eval: Laghu.eval,
      swap: Laghu.swap,
    };
    document.body.innerHTML = `
      <div id="router-view">
        <template data-route="/secret" data-route-if="allowed">Secret Content</template>
      </div>
    `;

    LaghuRouter.afterEach(() => {
      throw new Error("hook boom");
    });

    const stop = LaghuRouter.route({
      target: "#router-view",
      scope: { allowed: false },
      beforeEach(to: any) {
        if (to.path === "/blocked") return false;
      },
      afterEach() {
        throw new Error("opts boom");
      },
      notfound(to) {
        return `<div>Custom 404: ${to.path}</div>`;
      },
      routes: [
        {
          path: "/public",
          render: () => "Public Page",
        },
      ],
    });

    // test location.hash = "#" (empty after #)
    window.location.hash = "#";
    await tick(30);
    expect(LaghuRouter.current().path).toBe("/");
    expect(document.querySelector("#router-view")!.textContent).toContain("Custom 404: /");

    // test navigate
    LaghuRouter.navigate("/public");
    await tick(30);
    expect(LaghuRouter.current().path).toBe("/public");
    expect(document.querySelector("#router-view")!.textContent).toBe("Public Page");

    // test beforeEach blocking
    LaghuRouter.navigate("/blocked");
    await tick(30);
    expect(LaghuRouter.current().path).toBe("/public");

    // test decl route guard blocking
    LaghuRouter.navigate("/secret");
    await tick(30);
    expect(LaghuRouter.current().path).toBe("/public");

    // allow and enter declarative route with fallback scope (B.scope undefined)
    (window as any).Laghu.scope = undefined;
    stop();

    document.body.innerHTML = `
      <div id="router-view">
        <template data-route="/secret" data-route-if="allowed">Secret Content</template>
      </div>
    `;
    const stop2 = LaghuRouter.route({
      target: "#router-view",
      scope: { allowed: true },
    });
    LaghuRouter.navigate("/secret");
    await tick(30);
    expect(document.querySelector("#router-view")!.textContent).toContain("Secret Content");

    stop2();
    window.location.hash = "#/";
  });

  it("covers compile fallbacks, default route options, missing targets, falsy returns, and SSR guards", async () => {
    // 1. compile fallbacks
    const matchEmpty = LaghuRouter.compile(undefined as any);
    expect(matchEmpty("")).toEqual({});

    const matchWild = LaghuRouter.compile("/items/:category/*");
    expect(matchWild("/items/books/fiction/sci-fi")).toEqual({
      category: "books",
      wild: "fiction/sci-fi",
    });

    // 2. default route options and missing target element
    document.body.innerHTML = "";
    const stopDefault = LaghuRouter.route();
    stopDefault();

    // 3. route render and notfound returning falsy
    document.body.innerHTML = `<div id="empty-view"></div>`;
    const stopEmpty = LaghuRouter.route({
      target: "#empty-view",
      routes: [
        {
          path: "/blank",
          render: () => undefined as any,
        },
      ],
      notfound: () => undefined as any,
    });
    LaghuRouter.navigate("/blank");
    await tick(30);
    expect(document.querySelector("#empty-view")!.textContent).toBe("");

    LaghuRouter.navigate("/nonexistent-missing");
    await tick(30);
    expect(document.querySelector("#empty-view")!.textContent).toBe("");
    stopEmpty();

    // 4. hash without leading '#' and window without Laghu
    const origLaghu = (window as any).Laghu;
    delete (window as any).Laghu;
    window.location.hash = "plain-hash-without-prefix";
    const stopNoLaghu = LaghuRouter.route({
      target: "#empty-view",
      routes: [{ path: "plain-hash-without-prefix", render: () => "Plain" }],
    });
    await tick(30);
    stopNoLaghu();
    (window as any).Laghu = origLaghu;

    // 5. template without data-route and template with empty data-route
    document.body.innerHTML = `<div id="tpl-view"><template>Ignored</template><template data-route="">Blank</template></div>`;
    const stopTpl = LaghuRouter.route({ target: "#tpl-view" });
    stopTpl();

    // 6. SSR guards when window and document are undefined
    const origWin = (globalThis as any).window;
    const origDoc = (globalThis as any).document;
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    try {
      const stopSSR = LaghuRouter.route();
      stopSSR();
      LaghuRouter.navigate("/ssr");
    } finally {
      (globalThis as any).window = origWin;
      (globalThis as any).document = origDoc;
    }
  });
});



