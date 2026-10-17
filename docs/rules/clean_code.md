# Clean Code & Pragmatic Programming Directives

> **Core Mandate:** Enforce intention-revealing naming, small focused functions, Command-Query Separation (CQS), Single Level of Abstraction (SLAP), and DRY pragmatic architecture across all codebases.

---

## 1. Clean Code Standards (Robert C. Martin & Craftsmanship Heuristics)

- **The Boy Scout Rule** (Uncle Bob): Always leave the code cleaner than you found it. Every edit, commit, and PR must improve the maintainability of the touched file.
- **Intention-Revealing Naming**: Names of variables, functions, and classes must describe why they exist, what they do, and how they are used. Avoid abbreviations, single-letter variables, and type-encoding prefixes.
- **Function Guidelines**:
  - **Small and Focused**: Functions should do one thing, do it well, and do only that (Single Responsibility Principle). Max 20–30 lines per function.
  - **The Stepdown Rule & Newspaper Metaphor**: Code should read top-to-bottom like a newspaper narrative. Every function should be followed by helper functions at the next lower level of abstraction.
  - **Single Level of Abstraction (SLAP)**: Statements within a function must belong to the exact same level of abstraction.
  - **Command-Query Separation (CQS)**: A function must either perform an action (mutate state) or return a value (query state), never both.
  - **Argument Limit & No Flag Arguments**: Limit function arguments to 3 or fewer. Bundle additional parameters into typed configuration DTOs or Value Objects. Boolean "flag arguments" are strictly forbidden; they prove the function does two different things. Split into separate, intention-revealing functions.
- **Law of Demeter (Principle of Least Knowledge)**: A module should not know about the innards of objects it manipulates ("shy code"). Never write "train wreck" method chains (e.g. `order.getCustomer().getAddress().getCity()`). Instead, tell, don't ask: `order.getDeliveryCity()`.
- **Extract Error Handling**: Error handling is a single responsibility. Functions that execute `try/catch/finally` blocks should contain nothing else; delegate the underlying business operation to a focused helper function.
- **Eliminate Side-Effects**: Functions must not have unexpected side effects (e.g. modifying passed arguments in-place or mutating global state) without explicit naming.
- **Never Return or Pass Null**: Null references trigger cascading runtime exceptions. Return explicit `Result<T, E>`, `Option<T>`, or the Null Object Pattern.
- **The Barricade Technique (Defensive Programming)** (Steve McConnell - *Code Complete*): Partition software into untrusted and trusted zones. All data crossing external boundaries (HTTP requests, files, user inputs) must be validated and sanitized at the boundary barricade (using Zod, Pydantic, etc.). Once data passes inside the barricade, internal domain routines operate on trusted, validated data without redundant defensive checks.
- **Variable Span & Live Time** (Steve McConnell - *Code Complete*): Minimize variable span (lines between references) and live time (statements between declaration and last use). Declare and initialize variables immediately before their first use, localizing their scope.
- **Table-Driven Methods** (Steve McConnell - *Code Complete*): Replace deeply nested conditional logic with declarative table or map lookups, isolating dynamic business variations into structured configuration tables.
- **The Two Hats Principle** (Martin Fowler - *Refactoring*): Strictly separate structural refactoring from behavioral feature addition. When wearing the "Refactoring Hat", restructure code without altering external behavior under 100% green tests. When wearing the "Feature Hat", add new behavior driven by failing tests. Never wear both hats at once.
- **Screaming Architecture & The Inward Dependency Rule** (Robert C. Martin - *Clean Architecture*): Software directory structures must scream the business domain (e.g. `billing`, `inventory`, `shipping`), not the delivery framework (e.g. `controllers`, `react`, `express`). Dependencies must point strictly inward toward business policy; frameworks, databases, and UI are replaceable details that depend on the domain, never vice versa.
- **The Floating-Point Currency Trap** (Chuck Allison): Never use IEEE 754 floating-point numbers (`float`, `double`, `number`) for money, financial balances, or exact integer counts. Rounding errors corrupt ledgers. Represent currency in integer minor units (e.g. cents) or arbitrary-precision decimals.
- **Comments as "Why", Code as "What"** (Kevlin Henney): Code clearly communicates *what* and *how*; comments must only explain *why* (business rationale, non-obvious trade-offs, regulatory requirements). Never write redundant comments that merely restate the syntax.
- **Dead Code**: Never leave commented-out code; rely entirely on version control history.

---

## 2. The Pragmatic Programmer Directives (Hunt & Thomas)

- **DRY (Don't Repeat Yourself)**: Every piece of knowledge must have a single, unambiguous, authoritative representation within the system. DRY applies to business domain knowledge, not superficial syntax duplication.
- **"Beware the Share"** (Udi Dahan): Prematurely sharing code across different Bounded Contexts creates tight, artificial coupling. Duplication of code is far cheaper than the wrong abstraction.
- **Orthogonality**: Eliminate coupling between unrelated modules. Changing one component must not cascade unexpected side effects into another.
- **Broken Windows Theory**: Never leave bad code, failing lint checks, or out-of-date documentation unfixed. Fix defects immediately before entropy normalizes.
- **Design by Contract (DbC)**: Define explicit preconditions (runtime boundary validation), postconditions (guaranteed response envelopes), and domain invariants.
- **Make Invalid States Unrepresentable & "Parse, Don't Validate"**: Model domain structures and state machines using algebraic types, tagged unions, and value objects so that illegal states fail at compile time or at the parse boundary.
- **Dead Programs Tell No Lies (Crash Early & Fail Fast)**: When an impossible condition occurs or an invariant is breached, fail immediately. Continuing execution with corrupted in-memory state leads to silent data destruction downstream.
- **Assertive Programming vs Error Handling**: Use internal assertions exclusively for invariant checks that should *never* occur in correct software. Never use assertions for anticipated operational failures (bad user input, network outages, missing files); handle them with explicit typed results.
- **Finish What You Start (Resource Balancing)**: The function or class that allocates a resource (file handle, socket, transaction, lock) must deallocate it. Leverage RAII, `using`, or guaranteed `try...finally` teardown.
- **Tracer Bullets vs Prototypes**: Tracer bullets are thin, end-to-end production code paths connecting all architectural layers from Day 1 to prove integration; prototypes are disposable experiments intended to be discarded. Never convert prototypes into production code.

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

When bootstrapping projects via `/lets-build`, `bootstrap_workspace.mjs` emits the pinned gate configuration for the recorded language (never invented, never absent); the agent then installs the named tool, wires the project's lint entry to it, and proves the gate in Phase 5. Gates must match these exact rules:

| Language | Linter / Static Tool | Max File Lines (300) | Max Function Lines (30) | Max Complexity (10) | Max Arguments (3) |
|---|---|---|---|---|---|
| **TypeScript / Node** | `eslint` | `max-lines: [error, 300]` | `max-lines-per-function: [error, 30]` | `complexity: [error, 10]` | `max-params: [error, 3]` |
| **Python** | `ruff` + `flake8` | `flake8-lines: max-line-count = 300` | `flake8-functions: max-function-length = 30` | `mccabe: max-complexity = 10` | `flake8-functions: max-parameters = 3` |
| **Rust** | `cargo clippy` | `#![deny(clippy::too_many_lines)]` | `clippy::too_many_lines = 30` | `clippy::cognitive_complexity = 10` | `clippy::too_many_arguments = 3` |
| **Go** | `golangci-lint` | `maintidx: 300` | `funlen: lines = 30` | `gocyclo: min-complexity = 10` | `funlen: statements = 25` |
| **Java** | `Checkstyle` + `ArchUnit` | `FileLength: max 300` | `MethodLength: max 30` | `CyclomaticComplexity: max 10` | `ParameterNumber: max 3` |
| **C# / .NET** | `.editorconfig` + Roslyn | `file_length = 300:error` | `method_length = 30:error` | `CA1502: Avoid excessive complexity <= 10` | `CA1501: max 3 params` |
| **C / C++** | `clang-tidy` | project lint entry (no native check) | `readability-function-size LineThreshold = 30` | `readability-function-cognitive-complexity Threshold = 10` | `readability-function-size ParameterThreshold = 3` |
