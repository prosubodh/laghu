# Agentic Configuration, Governance & Harness Standards

> **Core Mandate:** Enforce progressive disclosure across agent entrypoints, strict skill front matter standards, workspace sovereignty, continuous learning via the direct rule ingestion loop, and immutable Architectural Decision Records (ADRs).

---

## 1. The Root AGENTS.md Standard

Root configuration files (`AGENTS.md`) are injected into the agent context on **every single prompt**. To prevent context pollution and token degradation:

### Required Contents (Keep under 100–120 lines)
- **Identity & Mission:** 1–2 sentences defining workspace purpose and core domain.
- **Runtime Environment:** Declared package manager, runtime version, and non-standard scripts.
- **Core Operating Framework:** Foundational principles (Rule Zero, Zero-Assumption, Relentless Questioning, 5-stage lifecycle, action boundaries).
- **Open-Source Mandate:** Strict requirement to standardize on 100% open-source packages and tools.
- **High-Level Layout:** High-level architectural boundaries only (packages, apps).
- **Progressive Disclosure Table:** Clean index linking to specialized domain rules in `docs/rules/*.md`.

### Explicit Prohibitions (What NOT to Include)
- **No Developer Onboarding / Getting Started Guides:** Do not include steps for cloning, environment setup, or basic onboarding meant for human engineers.
- **No Granular File Trees:** Never enumerate individual file paths that change frequently (causes rapid documentation rot).
- **No Monolithic Domain Tutorials:** Never embed full CSS conventions, database migration steps, API specs, or PR delivery checklists directly in the root file.
- **No Preemptive Speculation:** Never add rules for errors the AI has not actually made. Ground rules in verified project mistakes or requirements.

---

## 2. Monorepo & Nested AGENTS.md Files

- In multi-package workspaces or monorepos (e.g. `apps/backend/`, `apps/frontend/`), place package-specific instructions in a nested `AGENTS.md` within that package folder.
- The root `AGENTS.md` remains high-level; the nested `AGENTS.md` provides scoped context only when the agent operates within that subdirectory.

---

## 3. Harness Parity & Symlinks

Different AI agents and IDE harnesses look for different configuration filenames:
- Standard: `AGENTS.md`
- Lowercase: `agents.md`
- Anthropic Claude Code: `CLAUDE.md`
- Google Antigravity & Gemini CLI: `GEMINI.md`
- Cursor: `.cursorrules`
- Windsurf: `.windsurfrules`
- GitHub Copilot: `.github/copilot-instructions.md`

**Standard:** Maintain identical configuration across all harnesses by establishing filesystem symbolic links:
```bash
ln -sf AGENTS.md agents.md
ln -sf AGENTS.md CLAUDE.md
ln -sf AGENTS.md GEMINI.md
ln -sf AGENTS.md .cursorrules
ln -sf AGENTS.md .windsurfrules
mkdir -p .github && ln -sf ../AGENTS.md .github/copilot-instructions.md
```
Never duplicate content into separate files.

### Context Budget & Token Economy Directives
To prevent LLM context exhaustion, attention dilution, and model degradation:
- **Per-File Rule Size Cap (24 KB / 24,000 bytes):** Every rule file in `docs/rules/` must strictly stay under 24,000 bytes. Files exceeding this ceiling risk truncation across agent runtimes.
- **Aggregate Rules Token Budget (20,000 tokens):** Continuous and directory-scoped rules share an aggregate budget. Over-budget rules are demoted to file-pointer references. Always use concise, actionable directives rather than prose tutorials.
- **Progressive Offloading:** Offload deep specifications, schemas, or large lookup matrices to dedicated reference files loaded on demand.

---

## 4. Skills Architecture (`.agents/skills/<skill-name>/`)

Skills provide on-demand capabilities for **specialized, complex, or multi-step workflows** that should not pollute the global context.

### Front Matter Specification (`SKILL.md`)
```yaml
---
name: <skill-name>
description: <Imperative trigger description under 1024 characters. MUST start with 'Use when...'>
---
```
- **Description Requirements:**
  - Focus strictly on **user intent**, not just technology descriptions.
  - Explicitly state when to use: `Use when the user wants to...`
  - Explicitly state when NOT to use: `Do not use for...`
  - Never write generic summaries like `"A library for managing state"`.

### Body Guidelines
- Keep under **500 lines**.
- Ground instructions in real codebase experience, not generic documentation the LLM already knows.
- **Mandatory "Gotchas & What NOT to Do" section:** Explicitly list known AI anti-patterns and pitfalls.
- Include structured response templates and self-validation checklists for deterministic output.

### Progressive Disclosure Subdirectories
Adhere strictly to the standard agent skills folder taxonomy:
- `scripts/`: Deterministic executable scripts (bash, node, python) for tasks where LLMs produce non-deterministic drift.
- `references/`: Detailed sub-domain markdown manuals loaded on demand by the skill.
- `resources/`: Static templates, lookup tables, JSON schemas, or mock artifacts.
- `examples/`: Reference implementations and concrete code patterns.

### Deterministic Lifecycle Hooks (`.agents/hooks.json`)
To enforce non-negotiable safety guardrails and automated verification without stochastic agent failure:
- **`PreToolUse`**: Intercept destructive or dangerous CLI commands (`rm -rf`, DROP DATABASE, git push --force) and force explicit confirmation (`decision: ask`).
- **`PostToolUse`**: Automatically trigger fast linters (`npm run lint`), formatters, or unit test verification after tool runs.
- **`Stop`**: Intercept premature agent termination when background tasks are running or tests remain failing (`decision: continue`).

### Model Context Protocol (MCP) Integration (`.agents/mcp_config.json`)
When external tool capabilities are required (database introspectors, cloud telemetry, documentation search):
- Standardize on vendor-neutral **Model Context Protocol (MCP)** specifications.
- Declare local or containerized MCP tool servers in `.agents/mcp_config.json`.
- Treat MCP tools as secondary adapter driving ports, keeping domain logic decoupled from proprietary platform APIs.

### Explicit Prohibition: The "Library-as-a-Skill" Anti-Pattern
Never author or dynamically generate skills for commodity open-source packages or libraries (e.g. `react`, `tanstack`, `shadcn`, `zustand`, `testing-library`, `vitest`):
- **Prompt Bloat & Re-Explanation Tax:** Skill descriptions are continuously loaded into the agent's `<skills>` context. Proliferating skills for every library in a stack floods the prompt with thousands of redundant tokens and degrades model reasoning.
- **Parametric Redundancy:** Frontier LLMs already possess extensive parametric knowledge of open-source library APIs. Re-explaining basic imports and function signatures in a skill wastes context and creates documentation rot.
- **Trigger Collision & Agent Paralysis:** When a prompt touches UI, form validation, and data fetching, having 5 library skills triggers semantic collision, causing the agent to waste execution turns resolving which sub-skill to run.
- **The 4-Layer Resolution Standard:** Always resolve library stack knowledge through the **4-Layer Resolution Model**:
  1. *Layer 1 (Manifest Ground Truth):* Read `package.json`, `components.json`, or `tsconfig.json`.
  2. *Layer 2 (Stack Contract in `AGENTS.md`):* 3–5 line declaration in project entrypoint stamped by `/lets-build`.
  3. *Layer 3 (Universal Domain Rules):* Enforce architectural invariants (`frontend_architecture.md`, `test_driven_development.md`) rather than library syntax.
  4. *Layer 4 (Tool & CLI Execution):* Direct execution of official CLIs (`npx shadcn@latest add ...`) or local component inspection.

---

## 5. The Architectural Atomicity Mandate for Rules & Skills

Every rule, skill, workflow, and configuration component must adhere to the **Single Responsibility Principle (SRP)**: indivisible, self-contained, orthogonal, and composable.

### Rule Atomicity
- **One Domain Per Rule:** Each rule file in `docs/rules/` must govern exactly one architectural or engineering subdomain.
- **Completeness Without Stubs:** A rule must never be a shallow stub or placeholder; it must codify production-grade invariants, anti-patterns, and concrete code patterns.
- **Zero Cross-Leakage:** Rules must be mutually orthogonal—never duplicate or contradict directives across files.

### Skill Atomicity
- **One Capability Per Skill:** Each skill in `.agents/skills/` must encapsulate one discrete, multi-step workflow.
- **Bounded Negative Triggers:** Must define both what it does (`Use when...`) and explicitly what it does not do (`Do not use for...`).
- **Encapsulated Artifacts:** Scripts, assets, and reference docs must live within the skill's isolated directory tree.
- **Idempotent Execution:** Re-executing a skill against the same inputs must produce identical, deterministic results.

### Many-to-Many Skill Composability Models
Coding tasks and agentic skills exhibit an explicit **Many-to-Many ($M:N$) Relationship**:
1. **Multiple Skills per Coding Task:** Implementing a complex domain feature frequently requires composing several orthogonal skills:
   - `relentless-questioner` (resolves ambiguous invariants and failure edge cases).
   - `product-analyst` (decomposes into INVEST user stories and executable Gherkin criteria).
   - `compliance-audit` (verifies OWASP, SOC 2, and data isolation controls).
   - `clean-code-refactor` (applies GoF patterns, CQS, SLAP, and eliminates code smells during the TDD inner loop).
2. **Single Skill in Multiple Scenarios:** An atomic skill functions as a reusable capability across completely different business problems (e.g. `clean-code-refactor` applies equally to financial ledgers, order lifecycle state machines, and authentication middleware).

#### The 3 Composition Patterns:
- **Pattern 1: Sequential Pipeline Chaining (Workflow Composition):** Skill $A$ produces a structured artifact (e.g. Feature Alignment Spec) that serves as the direct input contract for Skill $B$ (e.g. Gherkin test suite generation).
- **Pattern 2: Dynamic Skill Stacking (Contextual Composition):** An agent activates multiple orthogonal skills simultaneously in its execution context, adhering to Progressive Disclosure without polluting global prompts.
- **Pattern 3: Multi-Agent Subagent Delegation (Division of Labor):** A coordinator agent delegates isolated sub-tasks to specialized subagents equipped with specific skills, synthesizing their outputs into a single atomic change.

#### Invariants for Valid Skill Composition:
- **Standardized Output Contracts:** Skills must emit predictable, structured markdown or JSON envelopes (e.g. FAS, Gherkin blocks, ADR templates).
- **Zero Cross-Contamination:** No skill may write code or modify files outside its declared functional boundary.
- **Pure Function Semantics:** Analysis skills must remain read-only and side-effect free.

## 6. The Mandatory YAGNI Gate Triad (Rules & Skills)

LLM coding agents have a natural statistical bias toward **Instruction Creep** and **Eager Pattern Application**: when provided with a rule explaining an advanced pattern, agents reflexively apply it everywhere, causing severe architectural bloat.

To prevent premature abstraction, every architectural pattern rule and skill must enforce the **YAGNI Gate Triad**:

1. **The Simple Baseline (Day 1 Default):**
   - The zero-overhead, default implementation that solves the immediate requirement without indirection (e.g. single database model before CQRS, relational indexes before Redis, standard React components before Server-Driven UI).
2. **The Anti-Triggers (Strictly Forbidden Scenarios):**
   - Explicit, negative conditions where applying the pattern or skill is forbidden as premature over-engineering (e.g. no caching for low-throughput queries, no state machines for 2-state boolean flags, no skills for routine typo fixes).
3. **The Empirical Tipping Point (Graduation Threshold):**
   - Measurable, verified criteria that MUST be breached before graduating to the pattern (e.g. p99 latency > 200ms after indexing, 3+ non-linear lifecycle states with transition guards, untrusted third-party user scripts).

### Foundational Leverage vs. Speculative Over-Engineering
A common misunderstanding is that YAGNI forbids using external libraries. **This is completely false**:
- **YAGNI Attacks:** Speculative custom code, home-grown frameworks, custom wheel reinvention, and premature multi-tier distributed architectures.
- **YAGNI Mandates:** Adopting battle-tested, open-source building blocks (`shadcn/ui`, `Tailwind CSS`, `Zod`, `TanStack Query`, `Lombok`) to solve concrete, present requirements with the minimum amount of custom code (preventing Not-Invented-Here / NIH syndrome).

---

## 7. The Relentless Skill Architecture Inquiry

Never architect or modify a skill based on assumptions. Before authoring any `SKILL.md`, run the **7 Core Skill Inquiry Branches**:

```mermaid
flowchart TD
    Req["New Skill / Rule Request"] --> B1["Branch 1: Placement<br/>AGENTS.md, Rule, or Skill?"]
    B1 --> B2["Branch 2: Trigger Boundaries<br/>Exact 'Use when...' & 'Do NOT use for...'?"]
    B2 --> B3["Branch 3: Domain Ground Truth<br/>Generic textbook tutorials purged?"]
    B3 --> B4["Branch 4: Gotchas & Anti-Patterns<br/>What AI mistakes MUST be forbidden?"]
    B4 --> B5["Branch 5: Determinism vs LLM<br/>Deterministic steps scripted in scripts/?"]
    B5 --> B6["Branch 6: Progressive Bloat<br/>SKILL.md < 500 lines with sub-docs in references/?"]
    B6 --> B7["Branch 7: Verification Loop<br/>Output templates & self-checklists present?"]
    B7 --> Ready["Ready to Author / Update Skill"]
```

### The 7 Core Inquiry Branches

| # | Inquiry Branch | What to Interrogate | If Unanswered |
|---|---|---|---|
| **1** | **Placement & Scope** | Does this apply to all prompts (Root `AGENTS.md`), one package (Nested `AGENTS.md`), a continuous coding domain (`docs/rules/`), or an on-demand task (`.agents/skills/`)? | Stop and categorize correctly. Never bloat root configs. |
| **2** | **Trigger Intent** | What explicit user intent wakes this skill? What are the negative conditions? | Interrogate the user on exact workflow boundaries. |
| **3** | **Domain Truth** | Is this grounded in this project's architecture, or generic fluff the LLM already knows? | Purge generic definitions (e.g. "What is a PDF/REST API"). |
| **4** | **Gotchas & Anti-Patterns** | What exact mistakes has the AI repeatedly made in this task? | Formulate 3–5 explicit negative "DO NOT" rules. |
| **5** | **Determinism** | Are there brittle CLI sequences that need a bash/Node script instead of stochastic LLM generation? | Create helper scripts in `scripts/`. |
| **6** | **Progressive Bloat** | Does `SKILL.md` exceed 500 lines? | Extract sub-topic guides into `references/`. |
| **7** | **Verification Loop** | How will the agent and user prove the skill succeeded? | Provide structured response templates & validation checklists. |

---

## 8. The Continuous Refinement Loop

When an AI produces suboptimal code or documentation:
1. Preserve the original AI output draft.
2. Make manual corrections to produce the desired gold-standard output.
3. Diff the original draft against the corrected version to identify specific gaps.
4. Update the relevant skill's "What NOT to do" or guideline section to prevent repeating that mistake.

---

## 9. Workspace Sovereignty & Zero Global Interference

Enforce strict workspace containment within the workspace root (`./`):
- **Ground Truth Boundary**: Only files, dependencies, configuration files (`package.json`, `tsconfig.json`, `docker-compose.yml`), and verified command executions within the local workspace (`./`) constitute project truth.
- **Zero Global Contamination**: Never import, execute, or assume tools, environment variables, or conventions from global system directories (e.g. `~/.config`, `/tmp`, `~/.gemini/antigravity-cli`, or parent directories) unless explicitly defined within local workspace configuration.
- **Sibling Project Isolation**: Strictly ignore external or legacy projects. Do not read from or write to directories outside the local repository (`./`).
- **Subagent Context Sandboxing**: When spawning subagents or executing commands, ensure working directories are anchored strictly to `./`.

---

## 10. Continuous Learning & The Direct Rule Ingestion Loop

Whenever an error, test failure, build friction, or architectural anti-pattern occurs during development, immediately execute the 4-step loop:

```
1. Capture Defect ──► 2. Root Cause Analysis ──► 3. Synthesize Invariant ──► 4. Update Rule / Skill
```

1. **Capture Defect**: Record the failure symptoms, stack trace, and failing test case.
2. **Root Cause Analysis**: Identify the fundamental architectural or operational gap (not just the surface symptom).
3. **Synthesize Invariant**: Formulate a concrete, positive architectural invariant and code example showing the correct implementation.
4. **Update Rule / Skill**:
   - Update the governing domain rule in `docs/rules/<domain>.md` or specialized skill in `.agents/skills/` directly.
   - If the lesson introduces an architectural trade-off or paradigm shift, record a lightweight ADR in [`memory.md`](../../memory.md).
   - Run verification (`npm test && npm run validate`) to ensure 100% integrity.

---

## 11. Architectural Decision Records (ADR) Standards

Significant architectural, technical stack, or invariant decisions must be captured in [`memory.md`](../../memory.md):

### Required ADR Envelope:
```markdown
#### ADR-XXX: <Imperative Action-Oriented Title>
- **Date:** YYYY-MM-DD | **Status:** PROPOSED | ACCEPTED | SUPERSEDED | DEPRECATED
- **Context:** The specific operational or technical problem, constraint, or trade-off requiring a decision.
- **Decision:** Concrete, unambiguous architecture choice and positive invariants.
- **Consequences:** Direct benefits and deliberate operational trade-offs accepted.
- **Enforced In:** Links to specific rule files in `docs/rules/` or code paths.
```

### Numbering & Immutability:
- ADR numbers are monotonically increasing (`ADR-001`, `ADR-002`, ...).
- ADR entries are **immutable history**. Never edit past accepted ADRs to represent new decisions; author a new ADR that explicitly supersedes the former.
- **Fresh Project Baseline (ADR Clean Slate):** When starting or bootstrapping a new project from this starter template, the memory ledger in [`memory.md`](../../memory.md) must be a clean slate with zero prior decisions recorded. The initial technical foundation derived during `/lets-build` must always be recorded as **`ADR-001`**. Template development history from `azcodr` must never bleed into downstream project memory ledgers.

