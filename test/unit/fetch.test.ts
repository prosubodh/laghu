import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import "../../src/morph";
import { tick } from "../setup";

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(data: any, status = 200, ct = "application/json") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => ct },
    json: async () => data,
  };
}
function html(text: string) {
  return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => text };
}

describe(" Laghu.swap modes", () => {
  it("covers inner, outer, append, prepend, text, none, delete", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<div id="box"><p id="keep" data-preserve>old</p></div>`;
    document.body.appendChild(root);
    const s: any = {};
    const box = () => document.querySelector("#box") as HTMLElement;
    Laghu.swap(box(), '<p id="n">new</p>', "inner", s);
    expect(document.querySelector("#n")).not.toBeNull();
    Laghu.swap(box(), "<b>x</b>", "append", s);
    expect(box().querySelectorAll("b").length).toBe(1);
    Laghu.swap(box(), "<i>y</i>", "prepend", s);
    expect(box().firstElementChild!.tagName).toBe("I");
    const before = box().innerHTML;
    Laghu.swap(box(), "<p>ignored</p>", "none", s);
    expect(box().innerHTML).toBe(before);
    Laghu.swap(box(), "<p>plain</p>", "text", s);
    expect(box().querySelectorAll("p").length).toBe(0);
    expect(box().textContent).toContain("plain");

    // test delete
    const delTarget = document.createElement("div");
    delTarget.innerHTML = `<span id="del-me">bye</span>`;
    box().appendChild(delTarget);
    Laghu.swap(document.getElementById("del-me")!, "", "delete", s);
    expect(document.getElementById("del-me")).toBeNull();

    // test outer
    const outerTarget = document.createElement("div");
    outerTarget.id = "outer-box";
    box().appendChild(outerTarget);
    Laghu.swap(
      document.getElementById("outer-box")!,
      `<section id="fresh-sec">fresh</section>`,
      "outer",
      s,
    );
    expect(document.getElementById("outer-box")).toBeNull();
    expect(document.getElementById("fresh-sec")).not.toBeNull();

    // test beforebegin and afterend
    const mid = document.createElement("span");
    mid.id = "mid-span";
    box().appendChild(mid);
    Laghu.swap(mid, `<i id="bb-node">bb</i>`, "beforebegin", s);
    expect(mid.previousElementSibling!.id).toBe("bb-node");
    Laghu.swap(mid, `<b id="ae-node">ae</b>`, "afterend", s);
    expect(mid.nextElementSibling!.id).toBe("ae-node");

    // test morph without LaghuMorph global
    const origMorph = (window as any).LaghuMorph;
    (window as any).LaghuMorph = null;
    (window as any).__LAGHU_DEV__ = true;
    Laghu.swap(box(), `<p id="morph-fallback">fallback</p>`, "morph", s);
    expect(document.getElementById("morph-fallback")).not.toBeNull();
    (window as any).LaghuMorph = origMorph;
  });

  it("preserves data-preserve nodes by identity", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<div id="box"><p id="keep" data-preserve>old</p></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {});
    const keepBefore = document.querySelector("#keep");
    Laghu.swap(
      document.querySelector("#box")!,
      '<p id="keep" data-preserve>fresh</p><p id="nw">new</p>',
      "inner",
      {},
    );
    await tick();
    expect(document.querySelector("#nw")).not.toBeNull();
    expect(document.querySelector("#keep")).toBe(keepBefore);
  });

  it(" morph keeps node identity, typed values, and focus", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<div id="box"><input id="mi" value="server"></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {});
    const inp = document.getElementById("mi") as HTMLInputElement;
    inp.value = "typed";
    inp.focus();
    Laghu.swap(document.querySelector("#box")!, '<input id="mi" value="other">', "morph:inner", {});
    await tick();
    const mi = document.getElementById("mi") as HTMLInputElement;
    expect(mi).toBe(inp);
    expect(mi.value).toBe("typed");
    expect(document.activeElement && (document.activeElement as HTMLElement).id).toBe("mi");
  });

  it("morph:outer replaces the element", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<p id="old">x</p>`;
    document.body.appendChild(root);
    const old = document.querySelector("#old")!;
    Laghu.swap(old, '<section id="new2">y</section>', "morph:outer", {});
    await tick();
    expect(document.body.contains(old)).toBe(false);
    expect(document.querySelector("#new2")).not.toBeNull();
  });

  it("swapped content keeps the requester actions", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<div id="t4"></div>`;
    document.body.appendChild(root);
    const s: any = { n: 0 };
    Laghu.swap(
      document.querySelector("#t4")!,
      '<button id="b4" data-click="inc">go</button>',
      "inner",
      s,
      {
        inc(this: any) {
          this.n++;
        },
      },
    );
    await tick();
    (document.querySelector("#b4") as HTMLElement).click();
    await tick();
    expect(s.n).toBe(1);
  });

  it("dispatches swap events that bubble", async () => {
    const seen: string[] = [];
    document.addEventListener("laghu:after-swap", (e) => seen.push((e as CustomEvent).detail.swap));
    const root = document.createElement("div");
    root.innerHTML = `<div id="box"></div>`;
    document.body.appendChild(root);
    Laghu.swap(document.querySelector("#box")!, "<p>x</p>", "append", {});
    expect(seen).toContain("append");
  });
});

describe("declarative fetch", () => {
  it("merges JSON objects and sets result for arrays", async () => {
    const stub = vi.fn(async (url: string) => {
      if (String(url).includes("/obj")) return json({ a: 42 });
      return json([1, 2]);
    });
    vi.stubGlobal("fetch", stub);
    const root = document.createElement("div");
    root.innerHTML = `<button id="o" data-get="/obj">o</button><button id="a" data-get="/arr">a</button><span id="t" data-bind="a"></span>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { a: 1 });
    (document.querySelector("#o") as HTMLElement).click();
    await tick(20);
    expect(s.a).toBe(42);
    (document.querySelector("#a") as HTMLElement).click();
    await tick(20);
    expect(s.result).toEqual([1, 2]);
  });

  it("accepts +json content types", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/hal+json" },
      json: async () => ({ got: 1 }),
    }));
    const root = document.createElement("div");
    root.innerHTML = `<button id="j" data-get="/j">j</button>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, {});
    (document.querySelector("#j") as HTMLElement).click();
    await tick(20);
    expect(s.got).toBe(1);
  });

  it("repeats array params on GET and posts form JSON", async () => {
    let seenUrl = "";
    let seenBody: any = null;
    vi.stubGlobal("fetch", async (url: string, opts: any) => {
      seenUrl = String(url);
      seenBody = opts && opts.body ? JSON.parse(opts.body) : null;
      return json({ ok: true });
    });
    const root = document.createElement("div");
    root.innerHTML = `<button id="g" data-get="/arr" data-vals='{"a":[1,2],"b":"x"}'>go</button>
      <form id="f" data-post="/save"><input name="email" value="a@b.co"></form>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    (document.querySelector("#g") as HTMLElement).click();
    await tick(20);
    expect(seenUrl).toContain("a=1");
    expect(seenUrl).toContain("a=2");
    expect(seenUrl).toContain("b=x");
    const form = document.querySelector("#f") as HTMLFormElement;
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    await tick(20);
    expect(ev.defaultPrevented).toBe(true);
    expect(seenBody).toMatchObject({ email: "a@b.co" });
  });

  it('serializes data-vals="form" on non-form elements', async () => {
    let seenUrl = "";
    vi.stubGlobal("fetch", async (url: string) => {
      seenUrl = String(url);
      return json({ ok: true });
    });
    const root = document.createElement("div");
    root.innerHTML = `<form><select name="userId"><option value="1">1</option><option value="2" selected>2</option></select>
      <button type="button" id="ld" data-get="/posts" data-vals="form">load</button></form>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    (document.querySelector("#ld") as HTMLElement).click();
    await tick(20);
    expect(seenUrl).toContain("userId=2");
  });

  it("tracks pending, error state, timeouts, and queue aborts", async () => {
    const releasers: Array<(v: any) => void> = [];
    let aborted = false;
    vi.stubGlobal("fetch", (url: string, opts: any) => {
      if (String(url).includes("/slow")) {
        return new Promise((res, rej) => {
          releasers.push(res);
          opts.signal.addEventListener("abort", () => {
            aborted = true;
            const e: any = new Error("aborted");
            e.name = "AbortError";
            rej(e);
          });
        });
      }
      return Promise.resolve(json({ ok: true }));
    });
    const root = document.createElement("div");
    root.innerHTML = `<button id="s" data-get="/slow" data-timeout="30">slow</button>
      <span id="e" data-bind="$error.status"></span>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, {});
    const errors: any[] = [];
    document.addEventListener("laghu:request-error", (e) => errors.push((e as CustomEvent).detail));
    const btn = document.querySelector("#s") as HTMLElement;
    btn.click();
    expect(btn.hasAttribute("data-pending")).toBe(true);
    releasers[0]({ ok: false, status: 503, headers: { get: () => "" } });
    await tick(30);
    expect(s.$error && s.$error.status).toBe(503);
    expect(btn.hasAttribute("data-pending")).toBe(false);
    await tick();
    expect(document.querySelector("#e")!.textContent).toBe("503");
    btn.click();
    await tick(80);
    expect(aborted).toBe(true);
    expect(errors.some((d) => d.timeout === true)).toBe(true);
    expect(s.$error && s.$error.timeout).toBe(true);
    expect(btn.hasAttribute("data-pending")).toBe(false);
  });

  it("aborts previous request on queue:last", async () => {
    const aborts: string[] = [];
    vi.stubGlobal("fetch", (url: string, opts: any) => {
      return new Promise((res, rej) => {
        opts.signal.addEventListener("abort", () => {
          aborts.push(String(url));
          const e: any = new Error("aborted");
          e.name = "AbortError";
          rej(e);
        });
      });
    });
    const root = document.createElement("div");
    root.innerHTML = `<button id="q" data-get="/s">s</button>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    const q = document.querySelector("#q") as HTMLElement;
    q.click();
    q.click();
    await tick(30);
    expect(aborts.length).toBe(1);
  });

  it("selects fragments and cancels via before-request", async () => {
    vi.stubGlobal("fetch", async () =>
      html('<section><b id="pick">P</b><b id="other">O</b></section>'),
    );
    const root = document.createElement("div");
    root.innerHTML = `<button id="p" data-get="/page" data-target="#box" data-select="#pick">p</button><div id="box"></div>`;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});
    (document.querySelector("#p") as HTMLElement).click();
    await tick(30);
    expect(document.querySelector("#pick")).not.toBeNull();
    expect(document.querySelector("#other")).toBeNull();
    let cancelled = false;
    const root2 = document.createElement("div");
    root2.innerHTML = `<button id="c" data-get="/never">c</button>`;
    document.body.appendChild(root2);
    Laghu.hydrate(root2, {}, {});
    document.querySelector("#c")!.addEventListener("laghu:before-request", (e) => {
      e.preventDefault();
      cancelled = true;
    });
    (document.querySelector("#c") as HTMLElement).click();
    await tick(20);
    expect(cancelled).toBe(true);
  });

  it("handles put, patch, delete, headers, form array fields, and missing target", async () => {
    let lastMethod = "";
    let lastHeaders: any = {};
    let lastBody: any = null;

    vi.stubGlobal("fetch", async (url: string, opts: any) => {
      lastMethod = opts.method;
      lastHeaders = opts.headers;
      lastBody = opts.body;
      return json({ ok: true });
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <form id="fetch-form">
        <input name="tag" value="t1">
        <input name="tag" value="t2">
        <button id="btn-put" data-put="/item/1" data-headers='{"X-Custom": "val"}'></button>
        <button id="btn-patch" data-patch="/item/2"></button>
        <button id="btn-del" data-delete="/item/3"></button>
        <button id="btn-method" data-get="/item/4" data-method="HEAD"></button>
        <button id="btn-miss" data-get="/item/5" data-target="#missing-target"></button>
      </form>
    `;
    document.body.appendChild(root);
    Laghu.hydrate(root, {}, {});

    // PUT with headers and form serialization
    (document.querySelector("#btn-put") as HTMLElement).click();
    await tick(30);
    expect(lastMethod).toBe("PUT");
    expect(lastHeaders["X-Custom"]).toBe("val");
    const parsedBody = JSON.parse(lastBody);
    expect(parsedBody.tag).toEqual(["t1", "t2"]);

    // PATCH
    (document.querySelector("#btn-patch") as HTMLElement).click();
    await tick(30);
    expect(lastMethod).toBe("PATCH");

    // DELETE
    (document.querySelector("#btn-del") as HTMLElement).click();
    await tick(30);
    expect(lastMethod).toBe("DELETE");

    // data-method HEAD override
    (document.querySelector("#btn-method") as HTMLElement).click();
    await tick(30);
    expect(lastMethod).toBe("HEAD");

    // missing target returns early
    (document.querySelector("#btn-miss") as HTMLElement).click();
    await tick(30);

    // destroyTree on element with _bReq
    let aborted = false;
    const reqHost: any = document.createElement("div");
    reqHost._bReq = {
      abort() {
        aborted = true;
      },
    };
    Laghu.destroyTree(reqHost);
    expect(aborted).toBe(true);
    expect(reqHost._bReq).toBeNull();
  });

  it("covers default GET method, queue:first/none, indicators, data-disable, and error reset", async () => {
    let callCount = 0;
    let lastMethod = "";
    vi.stubGlobal("fetch", (url: string, opts: any) => {
      callCount++;
      lastMethod = opts.method;
      return new Promise((res) => {
        setTimeout(() => {
          res(json({ success: true }));
        }, 40);
      });
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <div id="loader-spin" hidden>Loading...</div>
      <button id="btn-default-get" data-get="/api/default" data-method="">Default</button>
      <button id="btn-qfirst" data-get="/api/first" data-trigger="click queue:first">First</button>
      <button id="btn-qnone" data-get="/api/none" data-trigger="click queue:none">None</button>
      <button id="btn-with-ind" data-get="/api/ind" data-indicator="#loader-spin" data-disable>Ind</button>
    `;
    document.body.appendChild(root);

    const state: any = Laghu.hydrate(root, { $error: { status: 500 } });
    await tick();

    // 1. default GET method
    (document.querySelector("#btn-default-get") as HTMLElement).click();
    await tick(10);
    expect(lastMethod).toBe("GET");

    // 2. queue first drops second click while pending
    const btnFirst = document.querySelector("#btn-qfirst") as HTMLElement;
    btnFirst.click();
    btnFirst.click(); // dropped
    expect(callCount).toBe(2);

    // 3. queue none drops second click while pending
    const btnNone = document.querySelector("#btn-qnone") as HTMLElement;
    btnNone.click();
    btnNone.click(); // dropped
    expect(callCount).toBe(3);

    // 4. indicator and data-disable toggles
    const spinner = document.getElementById("loader-spin")!;
    const btnInd = document.getElementById("btn-with-ind") as HTMLButtonElement;
    expect(spinner.hidden).toBe(true);
    expect(btnInd.disabled).toBe(false);

    btnInd.click();
    expect(spinner.hidden).toBe(false);
    expect(btnInd.disabled).toBe(true);

    // wait for requests to complete
    await tick(60);
    expect(spinner.hidden).toBe(true);
    expect(btnInd.disabled).toBe(false);

    // 5. error reset to null on success
    expect(state.$error).toBeNull();

    // 6. rehydrating elements with data-fetch hits claimed guard
    Laghu.hydrate(root, state);
  });

  it("handles invalid data-vals, form+vals merge on POST, double finish on json error, and missing target", async () => {
    let lastBody: any = null;
    let lastHeaders: any = null;

    vi.stubGlobal("fetch", async (url: string, opts: any) => {
      lastBody = opts && opts.body ? JSON.parse(opts.body) : null;
      lastHeaders = opts && opts.headers;

      if (String(url).includes("/throw-json")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => {
            throw new Error("malformed json stream");
          },
        };
      }
      if (String(url).includes("/text-html")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => "<div>replacement</div>",
        };
      }
      return json({ success: true });
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <form id="merge-form">
        <input name="user" value="alice">
        <button type="button" id="btn-merge-post" data-post="/api/merge" data-vals='{"role":"admin"}'>Merge</button>
      </form>
      <button id="btn-bad-vals" data-get="/api/bad-vals" data-vals="[not valid json">Bad Vals</button>
      <button id="btn-throw-json" data-get="/api/throw-json">Throw JSON</button>
      <button id="btn-bad-tgt" data-get="/api/text-html" data-target="#nowhere-found">Bad Tgt</button>
    `;
    document.body.appendChild(root);

    const state: any = Laghu.hydrate(root, {});
    await tick();

    // 1. form + data-vals merge on POST
    (document.getElementById("btn-merge-post") as HTMLElement).click();
    await tick(20);
    expect(lastHeaders["Content-Type"]).toBe("application/json");
    expect(lastBody).toEqual({ user: "alice", role: "admin" });

    // 2. invalid data-vals falls back gracefully
    (document.getElementById("btn-bad-vals") as HTMLElement).click();
    await tick(20);

    // 3. json() throw in response triggers double finish guard
    (document.getElementById("btn-throw-json") as HTMLElement).click();
    await tick(20);
    expect(state.$error.message).toContain("malformed json stream");

    // 4. text response with missing data-target selector returns early
    (document.getElementById("btn-bad-tgt") as HTMLElement).click();
    await tick(20);
  });

  it("covers fetch edge branches: form element vals, standalone vals, no-form post, bad headers, null ct, missing select, self target, query param append, string rejection, 3 multi-inputs, and empty fetch attrs", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;

    vi.stubGlobal("fetch", async (url: string, opts: any) => {
      capturedUrl = String(url);
      capturedBody = opts && opts.body ? JSON.parse(opts.body) : null;
      if (capturedUrl.includes("/api/null-ct")) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => "<p>no-ct</p>" };
      }
      if (capturedUrl.includes("/api/missing-select")) {
        return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<div><p id='other'>p</p></div>" };
      }
      if (capturedUrl.includes("/api/string-reject")) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject("fetch failed with plain string");
      }
      return json({ ok: true });
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <form id="f-host" data-post="/api/form-host" data-vals="form">
        <input name="email" value="form@host.com">
      </form>
      <button id="btn-stand-vals" data-post="/api/stand-vals" data-vals="form">Stand</button>
      <button id="btn-no-form-post" data-post="/api/no-form">NoForm</button>
      <button id="btn-bad-hdr" data-get="/api/bad-hdr" data-headers="not-valid-json">Hdr</button>
      <button id="btn-null-ct" data-get="/api/null-ct" data-target="#null-ct-target">NullCT</button>
      <div id="null-ct-target"></div>
      <button id="btn-missing-sel" data-get="/api/missing-select" data-select="#non-existent" data-target="#sel-target">Sel</button>
      <div id="sel-target">initial</div>
      <button id="btn-self-target" data-get="/api/null-ct">SelfTarget</button>
      <button id="btn-query-amp" data-get="/api/search?existing=1" data-vals='{"tag":"tech"}'>Query</button>
      <button id="btn-str-rej" data-get="/api/string-reject">StrRej</button>
      <form id="f-multi">
        <input name="item" value="a">
        <input name="item" value="b">
        <input name="item" value="c">
        <button type="button" id="btn-multi-3" data-post="/api/multi-3" data-vals="form">Multi</button>
      </form>
      <div id="empty-get" data-get=""></div>
      <div id="empty-post" data-post=""></div>
      <div id="empty-put" data-put=""></div>
      <div id="empty-patch" data-patch=""></div>
      <div id="empty-del" data-delete=""></div>
    `;
    document.body.appendChild(root);

    const state: any = Laghu.hydrate(root, {});
    await tick();

    // 1. form element with data-vals="form"
    const fHost = document.getElementById("f-host") as HTMLFormElement;
    fHost.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await tick(20);
    expect(capturedBody).toEqual({ email: "form@host.com" });

    // 2. standalone button with data-vals="form"
    (document.getElementById("btn-stand-vals") as HTMLElement).click();
    await tick(20);
    expect(capturedBody).toEqual({});

    // 3. standalone button with data-post without form
    (document.getElementById("btn-no-form-post") as HTMLElement).click();
    await tick(20);

    // 4. data-headers with invalid json
    (document.getElementById("btn-bad-hdr") as HTMLElement).click();
    await tick(20);

    // 5. null content-type header
    (document.getElementById("btn-null-ct") as HTMLElement).click();
    await tick(20);
    expect(document.getElementById("null-ct-target")!.innerHTML).toContain("no-ct");

    // 6. data-select matching nothing
    (document.getElementById("btn-missing-sel") as HTMLElement).click();
    await tick(20);
    expect(document.getElementById("sel-target")!.innerHTML).toBe("");

    // 7. self target
    (document.getElementById("btn-self-target") as HTMLElement).click();
    await tick(20);
    expect(document.getElementById("btn-self-target")!.innerHTML).toContain("no-ct");

    // 8. query param append (&)
    (document.getElementById("btn-query-amp") as HTMLElement).click();
    await tick(20);
    expect(capturedUrl).toContain("existing=1&tag=tech");

    // 9. string rejection error
    (document.getElementById("btn-str-rej") as HTMLElement).click();
    await tick(20);
    expect(state.$error.message).toContain("fetch failed with plain string");

    // 10. multi-3 inputs (Array.isArray true on 3rd item)
    (document.getElementById("btn-multi-3") as HTMLElement).click();
    await tick(20);
    expect(capturedBody.item).toEqual(["a", "b", "c"]);

    // 11. Empty fetch attributes trigger
    (document.getElementById("empty-get") as HTMLElement).click();
    (document.getElementById("empty-post") as HTMLElement).click();
    (document.getElementById("empty-put") as HTMLElement).click();
    (document.getElementById("empty-patch") as HTMLElement).click();
    (document.getElementById("empty-del") as HTMLElement).click();
    await tick(20);

    // 12. Test fetch without AbortController
    vi.stubGlobal("AbortController", undefined);
    (document.getElementById("btn-no-form-post") as HTMLElement).click();
    await tick(20);
    vi.unstubAllGlobals();

    root.remove();
  });
});

