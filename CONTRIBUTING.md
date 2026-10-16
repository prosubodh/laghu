# Contributing

## Ground rules

- Keep the zero-build promise: `src/` runs in the browser as
  shipped, no compiler, no `new Function`, no `eval`.
- Keep it small: core budget is 10kB gzip (`node scripts/size.mjs`
  enforces; morph 3kB, router 2.5kB). Justify every byte in the PR.
- Plain ASCII in docs and comments. No em dashes, no special
  symbols. Code examples use double quotes for HTML, single for JS.
- Every behavior change ships with a test in `test/` and a
  CHANGELOG entry. Fix the bug and the missing coverage together.

## Workflow

1. Fork, branch, change, then run the full gate before pushing:
   `npx tsc --noEmit -p jsconfig.json`, `node scripts/size.mjs`,
   `npm test` (runs run, examples, apps, router suites).
2. New examples go in `examples/` with coverage in
   `test/examples.mjs`. New apps go in `apps/` with coverage in
   `test/apps.mjs`.
3. Docs live with code: JSDoc with `@example` on every public
   function, TSDoc in `dist/laghu.d.ts`, README sections with
   linked contents entries.
4. Security-sensitive changes (sinks, paths, fetch, swaps) need
   regression tests proving the attack fails, not just the feature
   works.

## Releases

Maintainers cut releases from GitHub Releases with tag `vX.Y.Z`
matching `package.json`. The publish workflow verifies types,
tests, sizes, tarball contents, and a packed smoke test, then
publishes with provenance. Never publish from a laptop.
