# memory.md - laghu

Decision log for the laghu frontend library. Newest first.
Clean slate per lets-build: no template ADRs carried over.

### ADR Master Index

| ADR                                                                                | Title                                               | Date       | Status                | Governs                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- | ---------- | --------------------- | -------------------------------------- |
| [ADR-008](./memory.md#adr-008-enforce-100-test-coverage-and-clean-code-architecture) | Enforce 100% test coverage and Clean Code architecture | 2026-10-17 | ACCEPTED              | [`vitest.config.ts`](./vitest.config.ts) |
| [ADR-007](./memory.md#adr-007-enforce-harness-parity-by-content-not-symlinks)      | Enforce harness parity by content, not symlinks     | 2026-10-17 | ACCEPTED              | [`AGENTS.md`](./AGENTS.md)             |
| [ADR-006](./memory.md#adr-006-cross-platform-toolchain-fix-and-governance-re-sync) | Cross-platform toolchain fix and governance re-sync | 2026-10-17 | ACCEPTED              | [`package.json`](./package.json)       |
| [ADR-005](./memory.md#adr-005-adopt-azcodr-governance-keep-laghu-code)             | Adopt azcodr governance, keep laghu code            | 2026-10-16 | ACCEPTED              | [`AGENTS.md`](./AGENTS.md)             |
| [ADR-004](./memory.md#adr-004-azcodr-check-triage-scope-boundary)                  | azcodr check triage scope boundary                  | 2026-10-16 | SUPERSEDED by ADR-005 | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| [ADR-003](./memory.md#adr-003-vitest-tdd-units-against-src)                        | Vitest TDD, units against src                       | 2026-10-16 | ACCEPTED              | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| [ADR-002](./memory.md#adr-002-typescript-source-zero-build-consumption)            | TypeScript source, zero-build consumption           | 2026-10-16 | ACCEPTED              | [`tsconfig.json`](./tsconfig.json)     |
| [ADR-001](./memory.md#adr-001-target-technology-stack-scaffolding-baseline)        | Target Technology Stack & Scaffolding Baseline      | 2026-10-16 | ACCEPTED              | [`README.md`](./README.md)             |

#### ADR-008: Enforce 100% test coverage and Clean Code architecture

- **Date:** 2026-10-17 | **Status:** ACCEPTED
- **Context:** azcodr governance mandates strict 100% test coverage across all metrics (lines, statements, branches, functions) alongside Uncle Bob's Clean Code and Steve McConnell's Barricade Technique. Prior coverage stood at ~89-97% branches due to defensive fallback bloat inside internal routines (such as redundant Element type narrowings on private span holder nodes, redundant `actions || {}` fallbacks, unneeded `el.closest ? ... : null` checks, and `self._bN || 1`) and unexercised boundary conditions (DocumentFragment hydrations, keyed loop row reordering with index variables, empty string keys, custom directive empty attributes, and SSR bootstrap when document is absent).
- **Decision:** Eliminate all redundant defensive branches in internal invariants per McConnell's Barricade Technique, implement deterministic unit tests for all boundary and lifecycle conditions, export lifecycle `init` hook on `LaghuAPI`, and lock strict 100% thresholds (`lines: 100`, `functions: 100`, `branches: 100`, `statements: 100`) directly in [`vitest.config.ts`](./vitest.config.ts).
- **Consequences:** Every single branch, line, statement, and function across `src/laghu.ts`, `src/morph.ts`, `src/router.ts`, and `src/validate.ts` is verified under automated regression testing (194 passing tests). Gzip bundle size decreased from 10,297 bytes to 10,273 bytes (479 bytes below the 10,752 byte budget). Zero breaking changes to the public API surface.
- **Enforced In:** [`vitest.config.ts`](./vitest.config.ts), [`src/laghu.ts`](./src/laghu.ts), [`test/unit/dom.test.ts`](./test/unit/dom.test.ts), [`test/unit/expr.test.ts`](./test/unit/expr.test.ts), [`test/unit/transitions.test.ts`](./test/unit/transitions.test.ts).

#### ADR-007: Enforce harness parity by content, not symlinks

- **Date:** 2026-10-17 | **Status:** ACCEPTED
- **Context:** the vendored `docs/rules/agentic_configuration.md` (section 3)
  and the harness bullet in [`AGENTS.md`](./AGENTS.md) both standardise on
  filesystem symbolic links (`ln -sf AGENTS.md CLAUDE.md`), and forbid
  duplicating content across harness files. This workspace cannot
  materialise one: `core.symlinks` is `false`, and creating a symlink fails
  for want of administrator privilege (Windows needs Developer Mode or
  elevation). Committed symlinks would therefore check out as plain files
  holding the literal text `AGENTS.md` — the exact divergence the standard
  exists to prevent. `agents.md` cannot coexist with `AGENTS.md` at all on a
  case-insensitive filesystem.
- **Decision:** keep `CLAUDE.md`, `GEMINI.md`, `.cursorrules` and
  `.windsurfrules` as committed byte-identical copies of `AGENTS.md`, and
  keep `.github/copilot-instructions.md` as a one-line text pointer.
  `agents.md` stays satisfied natively by `AGENTS.md` case-insensitively.
  `npm run validate` is the enforcement:
  [`scripts/validate/parity.js`](./scripts/validate/parity.js) fails any
  harness file that drifts from `AGENTS.md`, on every platform, which is the
  outcome the symlink standard exists to produce.
- **Consequences:** zero configuration divergence across harnesses is
  enforced deterministically in CI instead of depending on developer-mode
  privileges, and the vendored validator reports the copies as a Windows
  symlink fallback warning rather than a failure. Accepted trade-off: four
  committed files repeat `AGENTS.md`'s body on disk, so every `AGENTS.md`
  edit must be mirrored — the gate catches a missed mirror immediately.
- **Enforced In:** [`scripts/validate/parity.js`](./scripts/validate/parity.js), [`AGENTS.md`](./AGENTS.md).

#### ADR-006: Cross-platform toolchain fix and governance re-sync

- Status: ACCEPTED 2026-10-17
- Context: the vendored `hooks.json` post-tool-lint hook runs
  `npm run lint`, and `verify_completion.js` runs `npm run validate`
  but silently skips it when the script is absent
  (`typeof scripts.validate === "string"`). It calls `npm run
  test:coverage` with the same guard, and `AGENTS.md` advertised that as
  a "coverage gate" although neither the script nor any threshold
  existed. None of the three scripts were present, so every command
  errored in the hook and the Stop gate skipped its checks without
  saying so. Four POSIX-only `.sh` files were also
  inherited from the azcodr 2.7.1 scaffold, though this repo's stated
  requirement is cross-platform tooling. Upstream then fixed the
  scaffolder itself: azcodr 2.8.0 (ADR-023) ships
  `bootstrap_workspace.mjs`, driven by `node`, and emits
  `scripts/smoke_test.mjs`.
- Decision: add the three missing scripts (`lint` -> `vp lint`,
  `validate` -> `node scripts/validate-cli.js`, `test:coverage` ->
  `vitest run --coverage`), exclude generated `dist/` from lint so the
  new gate stays signal-only, and reword the `AGENTS.md` harness line to
  say "coverage report" rather than "coverage gate", since vitest
  enforces no threshold. Delete the
  three POSIX-only duplicates that nothing here invokes or tests:
  `safety_guard.sh` and `verify_completion.sh` (the `.js` twins are
  what `hooks.json` runs) and `validate_agentic_configs.sh`
  (superseded by `scripts/validate-cli.js`). Adopt the upstream
  scaffolder port instead of maintaining a local one, so
  `bootstrap_workspace.mjs` matches the released azcodr 2.8.0
  artifact apart from Oxfmt formatting.
- Consequences: laghu now diverges from the vendored `.agents/` by
  exactly three files. Upstream RETAINS those scripts because
  `shell-scripts.test.ts` and `safety-guard.test.ts` pin them; laghu
  has no such tests (its suite is `test/unit/*.test.ts`) and nothing
  here runs them, so a later scaffold re-sync must re-apply those
  deletions rather than import dead weight. The scaffolder itself
  needs no divergence: `scripts/smoke_test.mjs` is emitted upstream
  and runs under `node`.

#### ADR-005: Adopt azcodr governance, keep laghu code

- Status: ACCEPTED 2026-10-16 (supersedes ADR-004)
- Context: User directed `npx azcodr` init on the existing laghu
  repo, keeping all existing code, then conforming to azcodr rules.
  ADR-004 had rejected the azcodr apparatus as bloat; that rejection
  is now explicitly reversed by user direction.
- Decision: scaffold azcodr 2.7.1 with `npx azcodr . --force --no-git`,
  then merge (not overwrite): keep laghu `README.md`, `LICENSE`,
  `docs/knowledge/ubiquitous_language.md`, `scripts/size.mjs`+`sri.mjs`,
  `.github/workflows/publish.yml`, and `package.json`; merge
  `.gitignore` (template plus `bench/*/dist`), merge
  `.github/workflows/ci.yml` (laghu gate plus azcodr governance job),
  append condensed Vite+ section to `AGENTS.md` (stays <=120 lines),
  keep laghu ADRs and record this adoption. Existing `src/`, `test/`,
  `examples/`, `apps/`, `bench/` untouched.
- Consequences: `npx azcodr check` and `boundaries` become required
  gates alongside `npm run check`, `npm run size`, `npm test`.
  `docs/rules/` (28 rules) and `.agents/skills/` (6 skills) are now
  authoritative; harness symlinks (`CLAUDE.md`, `GEMINI.md`,
  `.cursorrules`, `.windsurfrules`, copilot instructions) must stay
  in sync with `AGENTS.md`.

#### ADR-004: azcodr check triage scope boundary

- Status: SUPERSEDED by ADR-005 2026-10-16
- Context: `azcodr check` reports 10 findings on this repo. Three
  were genuine (ADR heading format, glossary shape, index table)
  and are fixed. The remaining six demand azcodr's own governance
  apparatus (harness symlink set, `docs/rules/`, `.agents/skills/`,
  copilot instructions).
- Decision: do NOT import that apparatus. It governs azcodr
  workspaces, not a published JS library; laghu already has
  CONTRIBUTING, SECURITY, and CHANGELOG contracts covering the
  same needs. Importing it would be speculative bloat against the
  YAGNI rule both projects share. The residual check failures are
  accepted as out-of-scope by design, not as defects.

#### ADR-002: TypeScript source, zero-build consumption

- Status: approved for implementation (user direction 2026-10-16,
  amends ADR-001 decision 1; all other ADR-001 decisions stand)
- Context: ADR-001 chose JSDoc-checked JavaScript to protect the
  zero-build story. Maintainer-side type safety has since become
  the binding constraint (strict `tsc` on JSDoc is weaker than
  real types: no generic inference, verbose casts, declaration
  files hand-maintained with drift risk).
- Decision: sources migrate to TypeScript compiled with `tsc`
  plus esbuild bundling. Consumers still need no compiler:
  committed `dist/` ships plain-JS IIFE (`window.Laghu`, works
  from `file://`) and a thin ESM wrapper, and `.d.ts` files are
  generated, never hand-written. Tests execute against the built
  `dist` so the shipped artifact is what is proven.
- Consequences: `tsconfig.json` (strict, editor) plus
  `tsconfig.build.json` (declarations); `npm run build`
  (tsc + esbuild + terser) becomes a required gate before tests
  and publish; publish workflow gains a dist-parity check
  (`git diff --exit-code dist/`).

#### ADR-001: Target Technology Stack & Scaffolding Baseline

- Status: proposed (awaiting user sign-off)
- Date: 2026-10-16
- Context: Problem-first interview under `/lets_build`. Goal: a
  frontend library measurably more efficient than React, Vue,
  Angular, and peer UI libraries, across size, latency, startup,
  memory, and DX. Existing codebase at v1.1.0 (npm `laghu`);
  interview governs its evolution, not a from-scratch rewrite.
- Topology: frontend-only browser library (Topology A variant).
  Style: zero-build IIFE core with opt-in plugins, Light-DOM
  Web Components, Proxy fine-grained reactivity, HTML-first
  templates, JSON-into-state fetch.
- Decision:
  1. Language: JSDoc-checked JavaScript (`// @ts-check`, strict),
     hand-maintained `dist/laghu.d.ts`. No TypeScript source, no
     compiler, no JSX. Rationale: zero-build is the product.
  2. Packaging: single-file IIFE primary (`window.Laghu`,
     `file://` compatible) plus thin ESM wrapper; publish to npm
     with jsDelivr CDN. JSR listed as target, held until explicit
     go-ahead (prior standing instruction).
  3. Compatibility baseline: modern evergreen (Chrome, Firefox,
     Safari, Edge) using Proxy, Custom Elements, and
     IntersectionObserver with feature-detect fallbacks. Full
     legacy-engine reach explicitly out of scope: Proxy cannot be
     polyfilled, and faking it would break the size budget.
     Recorded as a sign-off tension against the "all browsers"
     answer.
  4. Performance contract: gzip budgets enforced in CI (core,
     morph, router, validate plugin lines), plus the five-way
     Playwright benchmark (vanilla, laghu, React, Vue, Angular)
     kept green on every release. New work must not regress the
     table without a recorded trade-off.
  5. Capability scope: hash router plugin, persisted stores,
     validation plugin, WAAPI transitions, ecosystem interop
     recipes (Tailwind, icons, charts, i18n), devtools overlay,
     docs site, three-browser matrix. Explicit non-goals carried
     forward: compiler toolchain, VDOM core, built-in auth/i18n/
     charts/offline-sync, Node SSR server, full SPA parity.
- Consequences: `memory.md` is now the decision ledger; every
  later ADR appends newest-first. No scaffolding or rewrites
  until the blueprint below is approved.

#### ADR-003: Vitest TDD, units against src

- Status: implemented 2026-10-16 (supersedes ad-hoc node harnesses)
- Context: suites lived as bespoke `node test/*.mjs` scripts that
  booted whole example pages and evaled bundles. No watch mode, no
  isolation guarantees, no toolchain alignment; `vp test` found
  nothing.
- Decision: Vitest 5 (pinned to the `vp` toolchain) with happy-dom.
  `test/unit/*.test.ts` covers behavior against `src/` modules;
  example pages are documentation, not fixtures, and the shipped
  bundle is proven by one `dist.test.ts` load check plus the publish
  workflow's packed-install smoke test. `npm test` runs `vitest run`.
- Consequences: `test/*.mjs` deleted; jsdom removed (happy-dom
  covers); `types: ["node"]` for test file imports.
