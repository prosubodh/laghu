# Clean Code & Pragmatic Programming Directives

> **Core Mandate:** Enforce intention-revealing naming, small focused functions, Command-Query Separation (CQS), Single Level of Abstraction (SLAP), and DRY pragmatic architecture across all codebases.

---

## 1. Clean Code Standards (Robert C. Martin)

- **Intention-Revealing Naming**: Names of variables, functions, and classes must describe why they exist, what they do, and how they are used. Avoid abbreviations, single-letter variables, and type-encoding prefixes.
- **Function Guidelines**:
  - **Small and Focused**: Functions should do one thing, do it well, and do only that (Single Responsibility Principle). Max 20–30 lines per function.
  - **Single Level of Abstraction (SLAP)**: Statements within a function must belong to the exact same level of abstraction.
  - **Command-Query Separation (CQS)**: A function must either perform an action (mutate state) or return a value (query state), never both.
  - **Argument Limit**: Limit function arguments to 3 or fewer. Bundle additional parameters into typed configuration DTOs or Value Objects.
- **Eliminate Side-Effects**: Functions must not have unexpected side effects (e.g. modifying passed arguments in-place or mutating global state) without explicit naming.
- **Dead Code**: Never leave commented-out code; rely entirely on version control history.

---

## 2. The Pragmatic Programmer Directives (Hunt & Thomas)

- **DRY (Don't Repeat Yourself)**: Every piece of knowledge must have a single, unambiguous, authoritative representation within the system. DRY applies to business domain knowledge, not superficial syntax duplication.
- **Orthogonality**: Eliminate coupling between unrelated modules. Changing one component must not cascade unexpected side effects into another.
- **Broken Windows Theory**: Never leave bad code, failing lint checks, or out-of-date documentation unfixed. Fix defects immediately before entropy normalizes.
- **Design by Contract (DbC)**: Define explicit preconditions (runtime boundary validation), postconditions (guaranteed response envelopes), and domain invariants.

---

## 3. Evolutionary Architecture & Architectural Tipping Points (Ford, Parsons & Fowler)

Architecture is not a static Day 1 monument; it evolves incrementally as complexity grows. AI coding tools naturally take the path of least resistance (local token minimization), repeatedly appending code to simple files until they rot into a Big Ball of Mud. To eliminate **AI-Accelerated Architectural Drift**, the agent must pause and execute an architectural upgrade whenever code hits a **Deterministic Tipping Point**:

| Simple Baseline (Day 1) | Tipping Point / Mutation Trigger | Required Architectural Upgrade |
|---|---|---|
| **Flat Script / Single File** | File exceeds **250 lines**, or coordinates **>2 distinct I/O resources**, or is imported by **>3 distinct callers**. | **Extract Modular Subsystems:** Decouple domain logic from platform I/O; split into dedicated, focused submodules. |
| **Inline `if/else` or `switch` Cascades** | **Rule of Three:** The 3rd branching variant, payment provider, or protocol format is introduced. | **Strategy Pattern / Registry:** Replace conditional branching with a polymorphic Strategy interface or handler registry; update `memory.md`. |
| **In-Memory Store / Global State** | State requires **concurrent mutations**, **persistence across process restarts**, or **transactional rollback**. | **Repository Pattern & Persistence Port:** Introduce an explicit storage port contract; swap in-memory mock for a persistent database adapter. |
| **Direct Platform / Third-Party Calls** | External SDK or platform API is called from **>2 places**, or SDK throws untyped exceptions across boundaries. | **Adapter Pattern (Anti-Corruption Layer):** Wrap external SDK inside an application-owned port interface; mock only the owned interface in tests. |
| **Monolithic Domain Model** | The same business noun represents divergent lifecycles or definitions across workflows (e.g. `User` in Auth vs `User` in Billing). | **Bounded Context Split:** Separate into isolated domain contexts with explicit DTO / Anti-Corruption translation between them. |

---

## 4. The "Refactor-Before-Add" Protocol (Kent Beck's Rule)

> *"Make the change easy (warning: this may be hard), then make the easy change."* — Kent Beck

Before writing production code for any new feature or user story, the agent must execute the **Refactor-Before-Add Check**:
1. **Assess Tipping Points**: Will adding this requirement cause any module, function, or data structure to cross an architectural tipping point?
2. **Phase A — Structural Refactoring (Under Green)**: If yes, refactor the existing architecture *first* while existing test suites remain 100% green. Zero behavioral changes; purely structural evolution.
3. **Phase B — ADR Mutation**: When an architectural tipping point is crossed, log a Lightweight Architectural Decision Record in `memory.md` summarizing the new structural boundary and trade-off.
4. **Phase C — Feature Implementation (Inner TDD)**: Only once the architecture cleanly accommodates the new capability, write the failing micro-test and implement the feature.

---

## 5. Architectural Fitness Functions (Automated Tripwires)

Prevent AI-generated code rot using automated fitness functions integrated into linting and continuous verification:
- **File Length Gates**: Maximum 250–300 lines per file (ESLint `max-lines`).
- **Function Length Gates**: Maximum 20–30 lines per function (ESLint `max-lines-per-function`).
- **Dependency Direction & Boundary Gates**: Enforce unidirectional import rules and cycle prevention natively with Azcodr's zero-dependency boundary linter (`npx azcodr boundaries [dir]`) or polyglot equivalents (ArchUnit, dependency-cruiser) ensuring domain core never imports infrastructure or transport adapters, and circular dependencies are forbidden.
- **Complexity Budgets**: Enforce cyclomatic complexity limits (maximum 10 per function).
If an AI attempt to add code violates any fitness function, the build fails immediately, blocking completion until the architecture is refactored.

### Polyglot Fitness Function Standards

When bootstrapping projects via `/lets-build`, `bootstrap_workspace.sh` emits the pinned gate configuration for the recorded language (never invented, never absent); the agent then installs the named tool, wires the project's lint entry to it, and proves the gate in Phase 5. Gates must match these exact rules:

| Language | Linter / Static Tool | Max File Lines (300) | Max Function Lines (30) | Max Complexity (10) | Max Arguments (3) |
|---|---|---|---|---|---|
| **TypeScript / Node** | `eslint` | `max-lines: [error, 300]` | `max-lines-per-function: [error, 30]` | `complexity: [error, 10]` | `max-params: [error, 3]` |
| **Python** | `ruff` + `flake8` | `flake8-lines: max-line-count = 300` | `flake8-functions: max-function-length = 30` | `mccabe: max-complexity = 10` | `flake8-functions: max-parameters = 3` |
| **Rust** | `cargo clippy` | `#![deny(clippy::too_many_lines)]` | `clippy::too_many_lines = 30` | `clippy::cognitive_complexity = 10` | `clippy::too_many_arguments = 3` |
| **Go** | `golangci-lint` | `maintidx: 300` | `funlen: lines = 30` | `gocyclo: min-complexity = 10` | `funlen: statements = 25` |
| **Java** | `Checkstyle` + `ArchUnit` | `FileLength: max 300` | `MethodLength: max 30` | `CyclomaticComplexity: max 10` | `ParameterNumber: max 3` |
| **C# / .NET** | `.editorconfig` + Roslyn | `file_length = 300:error` | `method_length = 30:error` | `CA1502: Avoid excessive complexity <= 10` | `CA1501: max 3 params` |
| **C / C++** | `clang-tidy` | project lint entry (no native check) | `readability-function-size LineThreshold = 30` | `readability-function-cognitive-complexity Threshold = 10` | `readability-function-size ParameterThreshold = 3` |
