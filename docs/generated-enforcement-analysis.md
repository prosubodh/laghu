# Generated-Project Enforcement Analysis: What a Scaffolded Project Actually Gets

> **Status:** evidence, not prose. Every claim below was produced by running the
> scaffolder on 2026-10-08, not by reading the skills docs.
> **Answers the plan's open question:** which linters does a non-TypeScript
> project actually get — and whether the "executable architecture" promise holds
> outside azcodr's own repo.

---

## Method

1. Ran `scaffold({ force: true, noGit: true })` from compiled `lib/` into a clean
   temp dir; inventoried every emitted file.
2. Ran `bootstrap_workspace.sh . <topology> <language>` under Git Bash for
   `backend+typescript`, `backend+python`, `cli+go`, `extension+typescript`,
   `systems-library+c`; diffed the file lists.
3. Executed the scaffolded project's `.agents/scripts/agent_guard.js` with a
   must-block payload (`rm -rf /`), with the azcodr repo itself as control.

## Finding 1: No deterministic linter in any generated project

The scaffolded project contains exactly one toolchain-adjacent file:
`.editorconfig`. Its `package.json` lint script is:

```json
"lint": "echo \"No linter configured yet. Run /lets-build to configure toolchain.\""
```

The polyglot fitness-function table (`docs/rules/clean_code.md`, § Polyglot
Fitness Function Standards: ESLint / ruff / clippy / golangci-lint /
Checkstyle / Roslyn) ships as **documentation only**. Phase 4 step 3 of
`lets-build/SKILL.md` instructs the *agent* to "generate … deterministic
linter configurations" — i.e. enforcement in a user's project is agent-authored
and non-deterministic, exactly the gap the plan flagged. **A non-TypeScript
project gets no linter at all unless the agent writes one.**

## Finding 2: LANGUAGE does not change generated output

`backend+typescript` and `backend+python` produce byte-identical file lists
(18 files each: `.gitkeep` dirs, `tokens.json`, `smoke_test.sh`,
`workspace-profile.env`). `LANGUAGE` is validated and recorded but never
branches generation. Topology *does* scope directories (7–18 files by
topology). So: topology-scoping is deterministic; language support is a
recorded intention, not a generated artifact.

## Finding 3: The shipped runtime guard is inert in generated projects (fail-open)

`TEMPLATE_ITEMS` (`src/scaffold.ts`) ships `docs`, `.agents`, `scripts`,
`.github` — but **not** `src/`, `lib/`, or `bin/`. Consequences, all verified:

| Check | azcodr repo (control) | Scaffolded project |
|---|---|---|
| `.agents/scripts/agent_guard.js` vs `rm -rf /` payload | **BLOCKED** (exit 1) | **ALLOWED** (exit 0) |
| `lib/agent-guard.js` present | yes | **missing** — the guard's dynamic import rejects, and `main().catch(() => process.exit(0))` fails open |
| `.agents/hooks.json` references `agent_guard.js` | no | no |
| All hook blocks in `hooks.json` | `enabled: false` | `enabled: false` (shipped copy) |

The flagship "agent cannot skip" control therefore degrades, in a generated
project, to: an unwired hook script, with its engine missing, configured off,
that permits on error. The `boundaries` engine (`npx azcodr boundaries`)
likewise does not ship — only `scripts/validate-cli.js` (config/ledger/link
checks) is present.

## What *does* transfer deterministically

- 28 rule docs, 6 skills, `AGENTS.md` parity pointers, empty ADR ledger
  (`data/memory.template`), `safety_guard.sh` + `verify_completion.sh` (present
  but disabled in `hooks.json`), `smoke_test.sh` placeholder, topology-scoped
  directories, `tokens.json` (backend/web only), `.azcodr/workspace-profile.env`.

## Recommendations (product decisions, not taken here)

1. **Either ship the engine or stop implying it ships.** Options: (a) add a
   dependency on the published `azcodr` package + `lib/`- backed guard entry in
   the starter `package.json`; (b) vendor a self-contained guard bundle into
   `.agents/scripts/` with no `../../lib` import; (c) reword SKILL.md Phase 4
   step 3 from "generate deterministic linter configurations" to an explicit
   agent-authored checklist with verification (`npm run lint` must fail before
   configs land, not echo).
2. **Fail closed, and wire the hook.** `agent_guard.js`'s catch-all `exit(0)`
   is the wrong default for a security boundary; and `hooks.json` should ship
   with at least the safety guard enabled plus a setup step that proves the
   harness honors it (harnesses ignore unknown/unenabled hooks silently).
3. **Make LANGUAGE generative or say it isn't.** Either branch
   `bootstrap_workspace.sh` per language (build manifests + pinned linter
   configs per `clean_code.md` table) or change the skill wording to record the
   language decision for the agent to implement in Phase 4.
4. **Close the benchmark gap this reveals.** `benchmark/RESULTS.md` Arm B/C
   assume working hooks + boundary engine; in a real scaffolded project neither
   is present. A fourth arm — *raw scaffolded project, no agent-authored
   additions* — would measure the actual out-of-box enforcement: expect 0/3
   traps caught.

---

## Addendum (2026-10-08): findings fixed — verify, don't trust

The three findings above are closed by the enforcement change set; each fix
names the test that locks it:

1. **No deterministic linter → per-language gate configs emitted.**
   `bootstrap_workspace.sh` now writes the pinned config for the recorded
   language (`eslint.config.js`, `ruff.toml`, `clippy.toml`, `.golangci.yml`,
   `checkstyle.xml`, `.editorconfig` CA block, `.clang-tidy`; `generic` emits
   none). Locked by `tests/bootstrap-toolchain.test.ts` (9 tests); presence is
   re-checked on every `validate` run by the new phase 7
   (`scripts/validate/toolchain.js`, 100% covered).
2. **LANGUAGE decorative → generative for toolchain.**
   `backend+typescript` and `backend+python` still share directory trees
   (topology-scoping, by design) but now differ in emitted gate configs; the
   profile feed (`readProfileLanguage`) drives the validator. The agent still
   owns build manifests (naming decisions) plus tool install and the Phase 5
   live-block proof (`lets-build/SKILL.md`).
3. **Fail-open guard → vendored engine + fail-closed install.**
   The guard engine ships inside `.agents/` (`.agents/lib/`, byte-locked to
   `lib/` output by test), `agent_guard.js` resolves vendored-first, and a
   missing engine exits 2 naming every path tried. Unparseable *payloads*
   still fail open inside `inspectPreTool` per ADR-005 (ambiguous input, not a
   broken install). `hooks.json` (+`.example`) wires an `architectural-guard`
   PreToolUse entry. Locked by the three new `tests/agent-guard.test.ts` cases.
4. **Benchmark assumes working hooks → Arm D measures the scaffold.**
   `runArmD()` + `auditScaffoldEnforcement()` score a real scaffold before and
   after bootstrap; `benchmark/RESULTS.md` §5 carries the scorecard.
5. **Echo lint placeholder → rewired for Node profiles.** `bootstrap` points
   the starter `lint` script at the emitted `eslint.config.js` (placeholder
   only, never agent-wired entries; skipped when node is unavailable), so
   `npm run lint` fails until the pinned tool lands instead of echoing
   success.

## Addendum (2026-10-09): boundaries shipped, starter CI generated, hooks on

6. **Boundary engine now ships in the scaffold.** `lib/boundaries.js` is
   vendored into `.agents/lib/boundaries.js` (byte-locked by
   `tests/boundary-guard.test.ts`, re-copied after every build per
   `CONTRIBUTING.md`) and a vendored-first runner `.agents/scripts/boundary_guard.js`
   exits 0/1 on a repo's cycle & layer verdict (exit 2 on a missing engine).
   The starter `package.json` gains a `boundaries` script pointing at it.
7. **Generated CI is now green out of the box.** azcodr's own dev workflows
   (`ci.yml`, `publish.yml`) call scripts a fresh project does not have, so
   shipping them verbatim made a scaffolded repo's CI fail on every push. The
   scaffolder now replaces them with a starter `.github/workflows/ci.yml` that
   only needs Node, the vendored boundary guard, and `scripts/validate-cli.js`.
   Locked by `tests/scaffold-ci.test.ts`.
8. **Hooks ship enabled.** `.agents/hooks.json` (+`.example`) now ships all four
   hooks `enabled: true` (safety, architectural, post-tool-lint, stop-verifier),
   amending ADR-020 which deliberately shipped them disabled. The trade-off is
   recorded in the 2026-10-09 ADR: default-on means a harness that loads the
   file blocks immediately, at the cost that lint/stop hooks can interrupt
   worthless-but-harmless sessions in a bare scaffold.

## Reproduce

```bash
# 1. Scaffold inventory
node -e "const {scaffold}=require('./lib/scaffold.js'); scaffold({targetDir:'<tmp>',force:true,noGit:true})"
# 2. Topology x language matrix (Git Bash)
bash .agents/skills/lets-build/scripts/bootstrap_workspace.sh <tmp> backend python
# 3. Guard fail-open proof
echo '{"tool_name":"run_command","tool_input":{"command":"rm -rf /"}}' \
  | node <scaffold>/.agents/scripts/agent_guard.js; echo "exit=$?"
```
