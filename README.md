# laghu.js v1.0.0 — full spec

Zero-build IIFE micro-framework. Light-DOM Web Components, Proxy reactivity,
HTML-first templates, CSP-safe (no `new Function`/`eval`), `file://` compatible.

## Files
- `src/laghu.js` — core (min 21.1kB, gzip 6.85kB)
- `src/morph.js` — opt-in id/key morph (min 2.3kB, gzip 0.99kB)
- `dist/laghu.min.js`, `dist/morph.min.js`, `dist/laghu.d.ts`

## API
`data-bind/text="path"`, `data-html`, `data-bind:attr`, `data-class:x`, `data-style:p`,
`data-model` (text/checkbox/radio/select/multi/number, focus-safe),
`data-show`/`data-if` (element hidden) + `template[data-if]`,
`template[data-for="x[,i] in list"]` + `data-key` (keyed reuse, order-preserving),
`data-click="action|count++|x=expr"`, `data-on:evt.prevent.stop.once`,
`data-init`, `data-scope='{"json":true}'`, `data-preserve` + `[id]`,
`data-get/post/put/patch/delete` + `data-method/vals/headers/target/swap/select/indicator/disable/trigger`,
`data-swap`: inner/outer/text/append/prepend/beforebegin/afterend/delete/none/morph:inner,
`data-trigger`: `click delay:500ms throttle:1s once changed queue:last from:document every 2s load revealed`.
Methods emit `laghu:before/after-request`, `request-error`, `before/after-swap`, `unknown-action`.
`Laghu.define(tag, () => ({state, actions, observed, onMount}))` — attr→state coerce
(string/number/boolean from state type), prop upgrade, `state` public, `is-defined` class,
`laghu:mount/unmount`. `Laghu.store/directive/sanitize/swap/css/destroyTree`.
`LaghuMorph.morph(target, html)` used automatically for `morph:*` swaps.

## Rules
- Server JSON merges into state (`Object.assign`); HTML swaps re-hydrate + restore focus by id + caret.
- `textContent` default; `data-html`/swaps go through `Laghu.sanitize` hook (plug DOMPurify).
- Strict CSP: external files only, no inline handlers, no `unsafe-eval`.
- FOUC: `tag:not(:defined){visibility:hidden}` or pre-rendered Light DOM (preferred, SEO-safe).
- Budgets: core ≤7.5kB gzip, morph ≤3kB gzip (`node scripts/size.mjs`).

## Verify
`npm install; npx tsc --noEmit -p jsconfig.json; node scripts/size.mjs; node test/run.mjs` → 37/37.
