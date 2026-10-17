import { describe, it, expect } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

function animateStub() {
  const calls: Array<{ tag: string; frames: any; dur: any }> = [];
  (window.HTMLElement.prototype as any).animate = function (frames: any, opts: any) {
    calls.push({
      tag: this.tagName,
      frames: JSON.parse(JSON.stringify(frames)),
      dur: opts && opts.duration,
    });
    return { finished: Promise.resolve() };
  };
  return calls;
}

describe("transitions", () => {
  it("animates enter on show and hides after leave", async () => {
    const calls = animateStub();
    (window as any).matchMedia = () => ({ matches: false });
    const root = document.createElement("div");
    root.innerHTML = `<div data-scope>
      <button data-click="open = !open">t</button>
      <div id="panel" data-show="open" data-transition="slide" data-duration="200">p</div>
    </div>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { open: false });
    await tick(30);
    const panel = document.querySelector("#panel") as HTMLElement;
    expect(panel.hidden).toBe(true);
    expect(calls.length).toBe(0);
    s.open = true;
    await tick(30);
    expect(panel.hidden).toBe(false);
    const enter = calls.find((c) => c.dur === 200 && JSON.stringify(c.frames[0]).includes("-8px"));
    expect(!!enter).toBe(true);
    s.open = false;
    await tick(40);
    expect(panel.hidden).toBe(true);
    expect(calls.some((c) => JSON.stringify(c.frames[0]).includes('"opacity":"1"'))).toBe(true);
  });

  it("respects reduced motion", async () => {
    const calls = animateStub();
    (window as any).matchMedia = () => ({ matches: true });
    const root = document.createElement("div");
    root.innerHTML = `<div id="p2" data-show="open" data-transition="fade">p</div>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { open: false });
    await tick(20);
    s.open = true;
    await tick(20);
    expect((document.querySelector("#p2") as HTMLElement).hidden).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("animates template inserts", async () => {
    const calls = animateStub();
    (window as any).matchMedia = () => ({ matches: false });
    const root = document.createElement("div");
    root.innerHTML = `<template data-if="go"><p id="ip" data-transition="fade">in</p></template>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { go: false });
    await tick(20);
    s.go = true;
    await tick(30);
    expect(document.querySelector("#ip")).not.toBeNull();
    expect(calls.length).toBeGreaterThan(0);
  });
});
