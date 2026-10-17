import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vite-plus/test";
import { tick } from "../setup";

// The only suite that touches build output: proves the shipped IIFE
// bundles load, expose the documented API, and run a counter. All
// behavior coverage lives in unit/ against src/.
const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function loadDist() {
  for (const f of ["dist/laghu.js", "dist/morph.js", "dist/router.js", "dist/validate.js"]) {
    window.eval(fs.readFileSync(path.join(root, f), "utf8"));
  }
  return (window as any).Laghu;
}

describe("dist bundles", () => {
  it("expose versioned globals", () => {
    const Laghu = loadDist();
    expect(Laghu.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof (window as any).LaghuMorph.morph).toBe("function");
    expect(typeof (window as any).LaghuRouter.route).toBe("function");
    expect(typeof (window as any).LaghuValidate.validateForm).toBe("function");
  });

  it("runs a counter from the bundle", async () => {
    const Laghu = loadDist();
    const tag = "dist-counter";
    // Markup first, registration second: upgrade then sees the full
    // subtree (same order real pages use with end-of-body scripts).
    document.body.innerHTML = `<${tag}><span data-bind="n"></span><button data-click="inc">+</button></${tag}>`;
    if (!customElements.get(tag)) {
      Laghu.define(tag, () => ({
        state: { n: 0 },
        actions: {
          inc(this: any) {
            this.n++;
          },
        },
      }));
    }
    await tick(20);
    expect(document.querySelector("span")!.textContent).toBe("0");
    document.querySelector("button")!.click();
    await tick();
    expect(document.querySelector("span")!.textContent).toBe("1");
  });
});
