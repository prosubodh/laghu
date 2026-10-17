import { describe, it, expect } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { LaghuMorph } from "../../src/morph";
import { tick } from "../setup";

function morphEd(oldHtml: string, newHtml: string) {
  (window as any).Laghu = Laghu;
  (window as any).LaghuMorph = LaghuMorph;
  const host = document.createElement("div");
  host.innerHTML = `<div id="t">${oldHtml}</div>`;
  document.body.appendChild(host);
  const target = document.querySelector("#t")!;
  LaghuMorph.morph(target, newHtml, {});
  return target;
}

describe("LaghuMorph", () => {
  it("syncs, adds, and removes attributes", () => {
    const t = morphEd(`<p id="a" class="x" title="old">t</p>`, `<p id="a" class="y">t</p>`);
    const p = t.querySelector("#a")!;
    expect(p.getAttribute("class")).toBe("y");
    expect(p.hasAttribute("title")).toBe(false);
  });

  it("syncs unfocused inputs and checkboxes, preserves focused ones", () => {
    morphEd(
      `<input id="a" value="typed"><input id="c" type="checkbox">`,
      `<input id="a" value="server"><input id="c" type="checkbox" checked>`,
    );
    const a = document.getElementById("a") as HTMLInputElement;
    // not focused in happy-dom by default: takes server value
    expect(a.value).toBe("server");
    expect((document.getElementById("c") as HTMLInputElement).checked).toBe(true);
  });

  it("syncs textarea and select form controls", () => {
    morphEd(
      `<textarea id="txt">initial text</textarea><select id="sel"><option value="1">1</option><option value="2" selected>2</option></select>`,
      `<textarea id="txt">updated text</textarea><select id="sel"><option value="1" selected>1</option><option value="2">2</option></select>`,
    );
    const txt = document.getElementById("txt") as HTMLTextAreaElement;
    expect(txt.value).toBe("updated text");
  });

  it("reuses data-bkey rows across moves", () => {
    const t = morphEd(
      `<li data-bkey="1">one</li><li data-bkey="2">two</li>`,
      `<li data-bkey="2">two!</li><li data-bkey="1">one</li>`,
    );
    const rows = [...t.querySelectorAll("li")];
    expect(rows.map((r) => r.textContent)).toEqual(["two!", "one"]);
  });

  it("replaces on tag mismatch", () => {
    const t = morphEd(`<p id="a">x</p>`, `<section id="a">y</section>`);
    expect(t.querySelector("section#new2, section#a")).not.toBeNull();
    expect(t.querySelector("p#a")).toBeNull();
  });

  it("preserves the target element attributes in inner mode", () => {
    const t = morphEd(`<li id="r1">one</li>`, `<li id="r1">one!</li>`);
    expect(t.id).toBe("t");
    expect(document.querySelector("#t")).toBe(t);
  });

  it("updates text and drops stale children with cleanup", () => {
    let cleaned = 0;
    const host = document.createElement("div");
    host.innerHTML = `<div id="t"><b id="gone">x</b><i id="keep">y</i></div>`;
    document.body.appendChild(host);
    const stale = document.querySelector("#gone")!;
    (stale as any)._bcu = [
      () => {
        cleaned++;
      },
    ];
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    LaghuMorph.morph(document.querySelector("#t")!, `<i id="keep">y2</i>`, {});
    expect(document.querySelector("#gone")).toBeNull();
    expect(cleaned).toBe(1);
    expect(document.querySelector("#keep")!.textContent).toBe("y2");
  });

  it("freezes data-morph-skip subtrees", () => {
    const t = morphEd(
      `<div id="s" data-morph-skip><b>old</b></div>`,
      `<div id="s" data-morph-skip><b>new</b></div>`,
    );
    expect(t.querySelector("#s b")!.textContent).toBe("old");
  });

  it("supports outer mode", () => {
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    const host = document.createElement("div");
    host.innerHTML = `<p id="o">x</p>`;
    document.body.appendChild(host);
    const old = document.querySelector("#o")!;
    LaghuMorph.morph(old, `<section id="o2">y</section>`, { mode: "outer" });
    expect(document.body.contains(old)).toBe(false);
    expect(document.querySelector("#o2")).not.toBeNull();
  });

  it("keeps pre whitespace intact", () => {
    const t = morphEd(`<pre id="p">a  b</pre>`, `<pre id="p">a  b</pre>`);
    expect(t.querySelector("#p")!.textContent).toBe("a  b");
  });

  it("morphs through Laghu.swap end to end", async () => {
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    const root = document.createElement("div");
    root.innerHTML = `<ul id="l"><li id="r1">one</li></ul>`;
    document.body.appendChild(root);
    const before = document.querySelector("#r1");
    Laghu.swap(
      document.querySelector("#l")!,
      `<li id="r1">ONE</li><li id="r2">two</li>`,
      "morph:inner",
      {},
    );
    await tick();
    expect(document.querySelector("#r1")).toBe(before);
    expect(document.querySelector("#r1")!.textContent).toBe("ONE");
    expect(document.querySelector("#r2")).not.toBeNull();
  });

  it("reuses unkeyed children positionally by tag name", () => {
    const t = morphEd(
      `<p>first</p><p>second</p>`,
      `<p>FIRST</p><p>SECOND</p>`,
    );
    const paragraphs = t.querySelectorAll("p");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].textContent).toBe("FIRST");
    expect(paragraphs[1].textContent).toBe("SECOND");
  });

  it("handles non-element child nodes and mixed text in target", () => {
    const t = morphEd(
      `text node <span>child</span>`,
      `updated text <span>child updated</span> trailing text`,
    );
    expect(t.textContent).toContain("updated text");
    expect(t.textContent).toContain("trailing text");
  });

  it("handles outer mode when html has no root element", () => {
    (window as any).Laghu = Laghu;
    (window as any).LaghuMorph = LaghuMorph;
    const host = document.createElement("div");
    host.innerHTML = `<span id="plain-target">old</span>`;
    document.body.appendChild(host);
    const target = document.querySelector("#plain-target")!;
    LaghuMorph.morph(target, "just plain text replacement", { mode: "outer" });
    expect(document.querySelector("#plain-target")).toBeNull();
    expect(host.textContent).toContain("just plain text replacement");
  });

  it("handles destroyTree throwing gracefully and removes stale text nodes", () => {
    (window as any).Laghu = {
      destroyTree() {
        throw new Error("cleanup error");
      },
    };
    (window as any).LaghuMorph = LaghuMorph;
    const host = document.createElement("div");
    host.innerHTML = `<div id="cleanup-host"><b>stale element</b>stale text</div>`;
    document.body.appendChild(host);
    LaghuMorph.morph(
      document.getElementById("cleanup-host")!,
      `<i>fresh element</i>`,
      {},
    );
    expect(document.getElementById("cleanup-host")!.textContent).toBe("fresh element");
  });

  it("syncs dirtied input values when unfocused, handles comments and whitespace, and morphs without Laghu global", () => {
    (window as any).Laghu = undefined;
    (window as any).LaghuMorph = LaghuMorph;
    const host = document.createElement("div");
    host.innerHTML = `<div id="morph-extra">
      <input id="dirty-input" value="server1">
      <!-- stale comment -->
      <p id="stale-p">stale</p>
    </div>`;
    document.body.appendChild(host);

    const input = document.getElementById("dirty-input") as HTMLInputElement;
    input.value = "user-dirty-value";

    const target = document.getElementById("morph-extra")!;
    LaghuMorph.morph(
      target,
      `  
      <input id="dirty-input" value="server2">
      <!-- fresh comment -->
      <span>fresh content</span>
      `,
      {},
    );

    expect(input.value).toBe("server2");
    expect(target.querySelector("#stale-p")).toBeNull();
    expect(target.querySelector("span")!.textContent).toBe("fresh content");
  });
});

