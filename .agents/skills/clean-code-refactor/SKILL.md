---
name: clean-code-refactor
description: Use when refactoring existing code to comply with Clean Code, SOLID principles, Pragmatic Programmer practices, or modern design patterns (Strategy, Adapter, Repository, Result pattern). Do not use when merely creating a new feature from scratch, fixing a minor typo, or writing initial tests.
---

# Clean Code & Design Patterns Refactoring Skill

> **Core Purpose:** Transform messy, coupled, or rigid code into clean, expressive, and maintainable implementations adhering to Robert C. Martin's Clean Code, The Pragmatic Programmer, and modern Gang of Four patterns without altering external behavior.

---

## 1. When to Use This Skill
- During the **REFACTOR** stage of the Outside-In TDD double loop (after tests are green).
- Resolving code smells: long functions (> 30 lines), large classes, excessive parameter lists (> 3 args), primitive obsession, duplicate domain knowledge.
- Decoupling 3rd-party dependencies using the **Adapter Pattern**.
- Replacing complex conditional logic (`switch`/`if-else` cascades) with the **Strategy Pattern**.
- Eliminating untyped exception throwing with the **Result / Either Pattern**.
- Removing dead or commented-out code to restore readability.

---

## 2. Step-by-Step Refactoring Workflow

```
1. Verify Green Tests ──► 2. Identify Code Smells ──► 3. Select Design Pattern ──► 4. Atomic Surgical Edit ──► 5. Verify 100% Green
```

### Step 1: Establish the Test Safety Net
- Never refactor without passing tests.
- Confirm all existing unit and acceptance tests pass: workspace test command (e.g. `npm test`, `cargo test`, `go test ./...`, `pytest`).
- If coverage is missing or incomplete, write tests *before* touching production code.

### Step 2: Identify Specific Code Smells
Target concrete flaws:
- **Long Method / Violating Single Responsibility**: Extract smaller private helper functions (SLAP principle).
- **Coupling to 3rd-Party SDK**: Wrap SDK calls inside an application-owned interface (Adapter pattern).
- **Duplicated Domain Rules**: Consolidate business logic into a single authoritative value object or service (DRY).
- **Leaky Exceptions**: Convert error throwing across controller/service boundaries into typed `Result<T, E>` unions.

### Step 3: Apply the Appropriate Pattern
- **Adapter**: Define an interface `IEmailAdapter` or `IPaymentAdapter`. Create an implementation wrapping the open-source library.
- **Strategy**: Define a strategy interface `ITenantPolicy`. Inject the appropriate strategy based on tenant configuration.
- **Factory**: Centralize instantiation of complex collaborator graphs.
- **Repository / Data Mapper**: Decouple domain entities from direct ORM queries.

### Step 4: Execute Atomic Surgical Edits
- Make one micro-refactor at a time (e.g. rename a method, extract a class).
- Maintain existing naming conventions and idiomatic type safety.
- Ensure zero lint or type errors: workspace linter and compiler (e.g. `npm run lint && npm run typecheck`, `cargo clippy`, `golangci-lint`, `mypy`).

### Step 5: Verify Continuous Green State
- Run tests after every single atomic change. Use the workspace's own command — do not assume one exists. Verify with the package manifest first (`node -p "JSON.stringify(require('./package.json').scripts)"`); for this template that is `npm test`, with `npm run test:coverage` for the coverage gate.
- Ensure coverage remains at **100.00%**.
- Verify architectural boundaries: Run `npx azcodr boundaries` to guarantee the refactoring introduced 0 circular dependencies and 0 layer boundary breaches.

---

## 3. Gotchas & What NOT to Do

- **DO NOT** change external functional behavior while refactoring. Refactoring is strictly structural.
- **DO NOT** refactor without automated tests. A green test suite is non-negotiable.
- **DO NOT** introduce over-engineering or speculative design patterns for simple, stable code (YAGNI).
- **DO NOT** mock external 3rd-party types directly in tests; always mock application-owned adapter interfaces.
- **DO NOT** leave commented-out blocks of old code behind. Clean up completely.

---

## 4. Structured Output Template

```markdown
### Clean Code Refactoring Summary: [Module / Class Name]

1. **Code Smells Identified**:
   - [Smell 1: e.g. Long method in UserController violating Single Responsibility]
   - [Smell 2: e.g. Direct coupling to external Stripe SDK in domain service]

2. **Refactoring Steps & Patterns Applied**:
   - Applied **Adapter Pattern**: Extracted `IPaymentAdapter` to isolate Stripe SDK.
   - Applied **SLAP & Extract Function**: Decomposed 60-line handler into three 15-line functions.
   - Applied **Result Pattern**: Replaced generic `throw Error` with typed `Result<Order, OrderError>`.

3. **Verification Evidence**:
   - Tests Status: PASS (100.00% statement, branch, and function coverage preserved)
   - Linter Status: PASS (0 ESLint warnings)
   - Typecheck / Compiler: PASS (0 errors)
```

---

## 5. Subdirectories & Progressive Resources
- [references/clean_code_smells.md](./references/clean_code_smells.md): Catalog of code smells and their refactoring cures.
- [references/design_patterns_ts.md](./references/design_patterns_ts.md): Reference implementations of Adapter, Strategy, and Result patterns (illustrated in TypeScript).
