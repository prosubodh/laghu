# memory.md - laghu

Decision log for the laghu frontend library. Newest first.
Clean slate per lets-build: no template ADRs carried over.

### ADR Master Index

| ADR | Title | Date | Status | Governs |
| --- | ----- | ---- | ------ | ------- |
| [ADR-005](./memory.md#adr-005-adopt-azcodr-governance-keep-laghu-code) | Adopt azcodr governance, keep laghu code | 2026-10-16 | ACCEPTED | [`AGENTS.md`](./AGENTS.md) |
| [ADR-004](./memory.md#adr-004-azcodr-check-triage-scope-boundary) | azcodr check triage scope boundary | 2026-10-16 | SUPERSEDED by ADR-005 | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| [ADR-003](./memory.md#adr-003-vitest-tdd-units-against-src) | Vitest TDD, units against src | 2026-10-16 | ACCEPTED | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| [ADR-002](./memory.md#adr-002-typescript-source-zero-build-consumption) | TypeScript source, zero-build consumption | 2026-10-16 | ACCEPTED | [`tsconfig.json`](./tsconfig.json) |
| [ADR-001](./memory.md#adr-001-target-technology-stack-scaffolding-baseline) | Target Technology Stack & Scaffolding Baseline | 2026-10-16 | ACCEPTED | [`README.md`](./README.md) |

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
