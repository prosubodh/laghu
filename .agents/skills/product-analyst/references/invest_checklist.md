# INVEST Checklist & Vertical Slicing Reference

Use this checklist to evaluate whether a user story is ready for development, adheres to Bill Wake's original INVEST model, and embodies Ron Jeffries' 3 C's.

---

## 1. The 3 C's Pre-Flight Check

- [ ] **Card:** Does the physical card or issue title capture the essential intent without drowning in premature implementation details?
- [ ] **Conversation:** Has there been a collaborative discussion between the Product Owner, domain expert, and engineers to co-create details and discover edge cases?
- [ ] **Confirmation:** Are there concrete, executable acceptance criteria (Gherkin scenarios) that prove whether the story is satisfied?

---

## 2. INVEST Evaluation Matrix

| Criterion | Evaluation Question | Pass / Fail Check |
|---|---|---|
| **I - Independent** | Can this story be scheduled, implemented, and released independently of parallel stories? Does it avoid tight coupling or circular dependency? | [ ] No blocking dependencies on concurrent in-flight stories. |
| **N - Negotiable** | Does the story focus on the user need and business value rather than prescribing rigid code syntax or immutable UI design? | [ ] Leaves implementation discovery and technical details open to the engineering pair. |
| **V - Valuable** | Is the customer value observable? Does it slice vertically through the "multi-layer cake" (UI, API, Domain, DB)? | [ ] Sliced vertically; delivers usable, working software to the end user. |
| **E - Estimable** | Is the scope sufficiently bounded and understood by the team to gauge complexity? | [ ] Architectural unknowns isolated; time-boxed spike completed if necessary. |
| **S - Small** | Is the slice small enough to be completed within 1–2 development days? | [ ] Not a multi-week epic; decomposed into fine-grained vertical increments. |
| **T - Testable** | Are there unambiguous pass/fail criteria? Are non-functional requirements (NFRs) operationalized as tests? | [ ] Executable Gherkin scenarios defined; verifiable via automated acceptance tests. |

---

## 3. The Multi-Layer Cake Slicing Test

When decomposing epics into stories, visualize a multi-layer cake with presentation, business logic, domain entities, and persistence layers.

### Slicing Violations (Reject immediately)
- ❌ *"Create database migration and table schema for resources"* (Horizontal layer: Zero customer value).
- ❌ *"Build UI form components for resource review"* (Horizontal layer: Dummy mock with zero persistence).
- ❌ *"Write backend REST controller for submitting actions"* (Horizontal layer: Orphaned API endpoint).

### Slicing Success (Accept)
- ✅ *"Self-service resource review and approval execution"* (Vertical slice: User reviews terms in UI ➔ Submits confirmation ➔ API verifies actor ➔ Domain validates state invariants ➔ Record persisted with audit trail ➔ Transactional confirmation notification dispatched).
