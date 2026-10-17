# Changelog

All notable changes to laghu are recorded here. Versioning follows
semver: patch for fixes, minor for backwards-compatible additions,
major for breaking changes.

## [Unreleased]

## [1.2.2]

Packaging only; the runtime bundles are unchanged.

- Global type augmentations (`window.Laghu` and the internal `_b*`
  bookkeeping fields) moved out of the published modules into
  `src/globals.ts`. The modules now contain no `declare global`, which
  is what JSR requires — it rejects global augmentations because they
  can change global types for unrelated packages.
- The npm typing entry is now `dist/globals.d.ts`, which re-exports the
  API surface and still declares `window.Laghu`, `window.LaghuRouter`,
  `window.LaghuMorph` and `window.LaghuValidate` for `<script>` users.
- Published to JSR as [`@prosubodh/laghu`](https://jsr.io/@prosubodh/laghu).

## [1.2.1]

Reactivity fixes for state that appears after the first render:

- Bindings hydrated against a child scope (declarative route templates,
  `data-for` rows) now wake when a missed key is added later on the
  reactive ancestor. Previously such a `data-bind` silently stayed
  empty, so values computed during a later fetch (a formatted result
  count, for example) never appeared.
- `data-click` / `data-on` actions called with arguments, such as
  `data-click="switchTab('prs')"`, now reach the component's actions.
  Argument calls were resolved from the scope alone, so an action
  living only in the `actions` map was reported as unknown and never
  ran.

## [1.2.0]

Declarative push:

- Display filters: `data-bind="price | currency"` with nine
  built-ins plus `Laghu.filter` for custom ones. `||` stays
  logical-or.
- Declarative router templates: `template[data-route]`,
  `data-route-if` guards, `template[data-route-notfound]`,
  params bound as `params` in a child scope.
- `Laghu.scope` for custom renderers needing child scopes.
- Automatic triggers (every, load, revealed) combine with the
  event listener: `data-trigger="load"` loads on ready and still
  reloads on click.
- Forms owning a declarative fetch stop their native submit.
- First application of a toggle is instant (no opening animation
  on initial render); reduced-motion handling unchanged.

Toolchain (no library behavior change):

- `npm run lint` (`vp lint`) and `npm run validate`
  (`node scripts/validate-cli.js`) now exist, so the `hooks.json`
  post-tool lint hook and the Stop verifier run instead of erroring or
  skipping silently. Generated `dist/` is excluded from lint.
- `npm run test:coverage` reports V8 coverage of `src/`; no threshold
  is enforced.
- The vendored scaffolder is now upstream's `bootstrap_workspace.mjs`
  (azcodr 2.8.0), which resolves `HOME` correctly on Windows. The three
  inert POSIX-only `.sh` scripts laghu dropped stay dropped
  (`memory.md` ADR-006).

Docs:

- The routing section of `README.md` now leads with declarative
  `template[data-route]` markup; `render` functions are documented as
  the computed-view escape hatch.

## [1.1.0]

Security baseline (breaking only for attack patterns):

- Default HTML sanitizer: `data-html` and swaps strip scripts,
  frames, event-handler attributes, and scriptable URLs out of the
  box. Override with `Laghu.sanitize` (DOMPurify recommended for
  untrusted content).
- URL policy: `data-bind:href/src/action/...` refuses
  `javascript:`, `data:text/html`, and `vbscript:` values.
- Prototype pollution guards in path reads, writes, and action
  strings (`__proto__`, `constructor`, `prototype` blocked).
- `DEV` now defaults off (`__LAGHU_DEV__ === true` enables). Error
  visibility moves to events that always fire: `laghu:error`,
  `laghu:request-error`, `laghu:unknown-action`.

Reliability:

- One throwing binding no longer kills the page; failures report
  `laghu:error` and the scan continues.
- Effects unsubscribe on stop and prune stale deps on re-run;
  nested effects compose through a stack.
- Swapped content keeps the requesting element's actions;
  `morph:outer` forwards its mode.
- Fetch overlap uses a controller set (correct `queue:all`),
  `data-timeout` aborts hung requests, GET arrays repeat params,
  `+json` content types merge, failures record `state.$error`
  with `data-pending` on the element.
- `onUnmount` setup hooks now run on disconnect.
- Row scopes own their variables; keyed lists use item-relative
  `data-key` and rebind only on identity change; the observer
  treats intra-batch moves as moves, not removals.

Expressions (still no `new Function`, still CSP-safe):

- Ternary (`a ? b : c`), arithmetic (`+ - * / %` with precedence),
  parenthesized groups, calls with evaluated arguments,
  bracket indexes (`list[0]`, `map["key"]`).
- Plain kebab-case action names stay literal; hyphens mean
  subtraction only inside larger expressions.

New API:

- `Laghu.computed(fn)`, `Laghu.watch(scope, expr, cb)`,
  `Laghu.persist(name, opts)` (localStorage, versioned).
- `LaghuRouter` opt-in plugin (`dist/router.min.js`): hash routes
  with params, guards, notfound, programmatic navigate.
- Late-added state keys wake readers (miss tracking); `$error`
  seeded at hydrate.

Docs: full JSDoc with examples on all public API, TSDoc
declarations, 17-section README with linked contents.

## [1.0.0]

Initial release: zero-build IIFE core, Light-DOM components, Proxy
reactivity, HTML-first templates, JSON/HTML fetch, morph plugin,
9 examples, 2 demo apps, 5-way benchmark.
