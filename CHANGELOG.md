# Changelog

All notable changes to laghu are recorded here. Versioning follows
semver: patch for fixes, minor for backwards-compatible additions,
major for breaking changes.

## [Unreleased]

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
