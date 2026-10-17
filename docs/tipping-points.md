# Deterministic Architectural Tipping Points

> **Core Mandate:** Architecture evolves incrementally as complexity grows. AI coding agents naturally take the path of least resistance (local token minimization), repeatedly appending code to simple files until they rot into a Big Ball of Mud. Whenever code crosses one of the 5 Deterministic Tipping Points, the agent must pause and execute an architectural refactor under green tests before adding new features.

---

## The 5 Deterministic Tipping Points

| # | Simple Baseline (Day 1) | Tipping Point / Mutation Trigger | Required Architectural Upgrade |
|---|---|---|---|
| **1** | **Flat Script / Single File** | File exceeds **250 lines**, coordinates **>2 distinct I/O resources**, or is imported by **>3 distinct callers**. | **Extract Modular Subsystems:** Decouple domain logic from platform I/O; split into dedicated, cohesive submodules. |
| **2** | **Inline Branching (`if/else` / `switch`)** | **Rule of Three:** The 3rd branching variant, payment provider, or protocol format is introduced. | **Strategy Pattern / Registry:** Replace conditional cascades with a polymorphic Strategy interface or handler registry; update `memory.md`. |
| **3** | **In-Memory Store / Global State** | State requires **concurrent mutations**, **persistence across restarts**, or **transactional rollback**. | **Repository Pattern & Persistence Port:** Introduce an explicit storage port contract; swap in-memory mock for a persistent database adapter. |
| **4** | **Direct Platform / Third-Party SDK Calls** | External SDK or platform API is called from **>2 places**, or throws untyped exceptions across boundaries. | **Adapter Pattern (Anti-Corruption Layer):** Wrap external SDK inside an application-owned port interface; mock only the owned interface in tests. |
| **5** | **Monolithic Domain Model** | The same business noun represents divergent lifecycles or definitions across workflows (e.g. `User` in Auth vs `User` in Billing). | **Bounded Context Split:** Separate into isolated domain contexts with explicit DTO / Anti-Corruption translation between them. |

---

## Refactor-Before-Add Protocol (Kent Beck's Rule)

> *"Make the change easy (warning: this may be hard), then make the easy change."* — Kent Beck

Before writing production code for any new feature or user story:

1. **Assess Tipping Points**: Will adding this requirement cause any module, function, or data structure to cross an architectural tipping point?
2. **Phase A — Structural Refactoring (Under Green)**: If yes, refactor the existing architecture *first* while existing test suites remain 100% green. Zero behavioral changes; purely structural evolution.
3. **Phase B — ADR Mutation**: When an architectural tipping point is crossed, log a Lightweight Architectural Decision Record in `memory.md` summarizing the new structural boundary and trade-off.
4. **Phase C — Feature Implementation (Inner TDD)**: Only once the architecture cleanly accommodates the new capability, write the failing micro-test and implement the feature.

---

## References

- [Clean Code & Pragmatic Directives](./rules/clean_code.md)
- [Design Patterns & Result Types](./rules/design_patterns.md)
- [Domain-Driven Design](./rules/domain_driven_design.md)
- [Test-Driven Development](./rules/test_driven_development.md)
