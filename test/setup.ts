// Shared Vitest setup: expose the Laghu global the plugins and app
// scripts expect, and give every test a clean document.
import { beforeEach } from 'vite-plus/test';
import { Laghu } from '../src/laghu';

declare global {
  // Test convenience: every element under test is an HTMLElement in
  // practice; this keeps click() call sites free of casts.
  interface Element {
    click(): void;
  }
}
import { LaghuMorph } from '../src/morph';
import { LaghuRouter } from '../src/router';
import { LaghuValidate } from '../src/validate';

// Plugins and demo-app scripts read globals off window, so publish
// the module singletons the same way the IIFE bundles do.
(window as any).Laghu = Laghu;
(window as any).LaghuMorph = LaghuMorph;
(window as any).LaghuRouter = LaghuRouter;
(window as any).LaghuValidate = LaghuValidate;

export function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

export { Laghu };
