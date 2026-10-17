# Project Management, Work-In-Progress Limits & Definition of Done

> **Core Mandate:** Enforce strict Work-In-Progress (WIP) limits, vertical task slicing, SMART developer task decomposition, explicit task lifecycle states, and an uncompromising Definition of Done (DoD).

---

## 1. Task Lifecycle & WIP Limits

- **Task States**: Every operational task must progress through explicit states:
  ```
  BACKLOG ──► TODO ──► IN_PROGRESS ──► REVIEW ──► DONE
  ```
- **Strict WIP Limit**: Maintain a Work-In-Progress (WIP) limit of **exactly 1 atomic task** at any given time. Never begin a new task while a previous task is incomplete or failing tests.
- **Vertical Task Slicing**: Stories must deliver full-stack value across UI, API, Domain, and DB layers (no horizontal layers like "create migration only").

---

## 2. Decomposing Stories into SMART Developer Tasks

While user stories represent customer-facing value (governed by the INVEST model), engineering execution requires decomposing each story into technical developer tasks. Apply Bill Wake's **SMART** criteria to all developer tasks:

- **S - Specific:** The task scope is clearly defined so every team member understands what is involved. Avoids overlapping with concurrent work and ensures all tasks aggregate into the complete story.
- **M - Measurable:** Defined by the question: *"Can we objectively mark it as done?"* Completion requires that:
  1. The code fulfills its intended behavior.
  2. Automated tests are written and passing.
  3. Clean code principles and refactoring have been applied.
- **A - Achievable:** The task owner has the skills and context to complete it. Establish a psychological safety norm: anyone can ask for help immediately if a task encounters unexpected obstacles.
- **R - Relevant:** Every developer task directly contributes to delivering the parent user story. Technical infrastructure tasks must be justified by the business capability they unlock.
- **T - Time-Boxed:** Each task has a bounded duration expectation (typically 2–4 hours, never exceeding 1 day). Exceeding the time-box acts as an automatic trigger to pause, split the task, pair with a peer, or adjust the plan.

---

## 3. Definition of Done (DoD)

A user story or task is only marked `DONE` when all of the following verifiable criteria are met:
- [ ] **Lifecycle Provenance**: Code developed strictly via the 5-Phase Agile Domain Lifecycle (Requirements ➔ Domain Analysis ➔ Outer Acceptance RED ➔ Inner Unit RED-GREEN-REFACTOR ➔ Outer GREEN). Zero production code written before tests.
- [ ] **Tests Green**: 100.00% full-stack test coverage maintained across statement, branch, function, and line metrics (`npm test` / `pnpm test`).
- [ ] **Boundary Verified**: Cross-package boundary smoke tests passed against live running servers (`scripts/smoke_test.sh`).
- [ ] **Zero Lints & Types**: 0 ESLint warnings and 0 TypeScript compilation errors (`npm run lint && npm run typecheck`).
- [ ] **No Unverified Assumptions**: All behavior backed by tests, schema invariants, or verified command evidence.
- [ ] **ADR Logged**: An Architectural Decision Record is logged in `memory.md` if architectural trade-offs were made.
- [ ] **Documentation Clean**: Zero broken markdown links across workspace files and relevant knowledge documents updated.

---

## 4. Blocker Escalation & Risk Management

- If a blocker or ambiguity arises, immediately transition the task to `BLOCKED`, halt execution, and interrogate the root cause.
- Never guess or write speculative code to bypass an unresolved requirement.
