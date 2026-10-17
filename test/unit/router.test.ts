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
});
