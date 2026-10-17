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

  it("handles animation error, reject catch, timeout fallback, and none transition", async () => {
    (window as any).matchMedia = () => ({ matches: false });
    // mock animate returning rejecting promise
    (window.HTMLElement.prototype as any).animate = () => ({
      finished: Promise.reject(new Error("aborted")),
    });

    const root = document.createElement("div");
    root.innerHTML = `
      <div id="p-rej" data-show="show" data-transition="fade" data-duration="10ms">p</div>
      <div id="p-none" data-show="show" data-transition="none">none</div>
    `;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { show: false });
    await tick(30);
    s.show = true;
    await tick(30);
    expect((document.getElementById("p-rej") as HTMLElement).hidden).toBe(false);

    // animate returning object without .then (fallback to setTimeout)
    (window.HTMLElement.prototype as any).animate = () => ({});
    s.show = false;
    await tick(30);
    expect((document.getElementById("p-rej") as HTMLElement).hidden).toBe(true);

    // animate throwing error
    (window.HTMLElement.prototype as any).animate = () => {
      throw new Error("animate crashed");
    };
    s.show = true;
    await tick(20);
    s.show = false;
    await tick(20);
    expect((document.getElementById("p-rej") as HTMLElement).hidden).toBe(true);

    // playEnter with rejecting promise
    (window.HTMLElement.prototype as any).animate = () => ({
      finished: Promise.reject(new Error("playEnter reject")),
    });
    const rootEnter = document.createElement("div");
    rootEnter.innerHTML = `<template data-if="enterGo"><p id="enter-p" data-transition="fade">enter</p></template>`;
    document.body.appendChild(rootEnter);
    const enterState: any = Laghu.hydrate(rootEnter, { enterGo: false });
    enterState.enterGo = true;
    await tick(30);
    expect(document.querySelector("#enter-p")).not.toBeNull();
  });

  it("covers playEnter early exits: hidden, none, reduced motion, and no animate", async () => {
    // 1. el.hidden, empty transition, and none transition in template insert
    (window as any).matchMedia = () => ({ matches: false });
    const calls = animateStub();

    const root = document.createElement("div");
    root.innerHTML = `
      <template data-if="show">
        <div>
          <span id="pe-hidden" data-transition="fade" hidden>h</span>
          <span id="pe-none" data-transition="none">n</span>
          <span id="pe-empty" data-transition="">e</span>
          <span id="pe-valid" data-transition="fade">v</span>
        </div>
      </template>
    `;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { show: false });
    s.show = true;
    await tick(30);

    expect(calls.length).toBe(1);

    // 2. Reduced motion during template insert
    calls.length = 0;
    (window as any).matchMedia = () => ({ matches: true });
    const root2 = document.createElement("div");
    root2.innerHTML = `
      <template data-if="show2">
        <span id="pe-motion" data-transition="fade">m</span>
      </template>
    `;
    document.body.appendChild(root2);
    const s2: any = Laghu.hydrate(root2, { show2: false });
    s2.show2 = true;
    await tick(30);
    expect(calls.length).toBe(0);

    // 3. el.animate is not a function
    const origHtmlAnimate = (window.HTMLElement.prototype as any).animate;
    const origElAnimate = (window.Element.prototype as any).animate;
    delete (window.HTMLElement.prototype as any).animate;
    delete (window.Element.prototype as any).animate;
    (window as any).matchMedia = () => ({ matches: false });

    const root3 = document.createElement("div");
    root3.innerHTML = `
      <template data-if="show3">
        <span id="pe-noanim" data-transition="fade">na</span>
      </template>
    `;
    document.body.appendChild(root3);
    const s3: any = Laghu.hydrate(root3, { show3: false });
    s3.show3 = true;
    await tick(30);

    (window.HTMLElement.prototype as any).animate = origHtmlAnimate;
    if (origElAnimate) (window.Element.prototype as any).animate = origElAnimate;
  });

  it("covers scale transition and invalid data-duration fallback", async () => {
    const calls = animateStub();
    (window as any).matchMedia = () => ({ matches: false });
    const root = document.createElement("div");
    root.innerHTML = `<div id="p-scale" data-show="open" data-transition="scale" data-duration="invalid">scale</div>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { open: false });
    await tick(20);
    s.open = true;
    await tick(30);
    expect(calls.some((c) => JSON.stringify(c.frames).includes("scale(.96)"))).toBe(true);
    expect(calls.some((c) => c.dur === 150)).toBe(true);
    root.remove();
  });

  it("covers leave transition completion when element is re-shown", async () => {
    let doneCallback: any;
    (window.HTMLElement.prototype as any).animate = () => ({
      finished: {
        // oxlint-disable-next-line unicorn/no-thenable
        /* eslint-disable-next-line unicorn/no-thenable */
        then: (onDone: any) => {
          doneCallback = onDone;
        },
      },
    });
    (window as any).matchMedia = () => ({ matches: false });
    const root = document.createElement("div");
    root.innerHTML = `<div id="p-cancel" data-show="open" data-transition="fade">p</div>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { open: true });
    await tick(20);
    const p = document.getElementById("p-cancel") as HTMLElement;
    (p as any)._bT = 0;

    // Trigger hide (leave transition)
    s.open = false;
    await tick(20);
    expect(doneCallback).toBeDefined();

    // Disconnect element from DOM before onDone fires (el.isConnected is false)
    p.remove();
    expect(p.isConnected).toBe(false);
    doneCallback();
    root.remove();
  });

  it("covers playEnter animation without catch method", async () => {
    (window.HTMLElement.prototype as any).animate = () => ({
      finished: {},
    });
    (window as any).matchMedia = () => ({ matches: false });
    const root = document.createElement("div");
    root.innerHTML = `<template data-if="show"><span data-transition="fade">enter</span></template>`;
    document.body.appendChild(root);
    const s: any = Laghu.hydrate(root, { show: false });
    s.show = true;
    await tick(20);
    root.remove();
  });
});

