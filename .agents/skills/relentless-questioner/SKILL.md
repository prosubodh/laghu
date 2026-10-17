---
name: relentless-questioner
description: Use when initiating a new feature, complex user story, architectural mutation, or ambiguous task to execute a context-aware relentless questioning loop that dynamically adapts subsequent questions based on user answers before planning or coding. Do not use for routine bug fixes with obvious solutions, minor typo corrections, or running tests.
---

# Relentless Questioner: Context-Aware Dynamic Interrogation Skill

> **Core Purpose:** Eliminate ambiguity, hidden assumptions, and premature coding by executing an interactive, context-aware interrogation loop where every subsequent question directly adapts to the user's previous answers, producing an unambiguous Feature Alignment Specification (FAS) before implementation begins.

---

## 1. When to Use This Skill

- When starting any non-trivial feature, API endpoint, or database modification.
- When user requirements are high-level, ambiguous, or open-ended (e.g. *"add webhook support"*, *"create billing integration"*, *"allow users to export reports"*).
- When a task involves conflicting architectural trade-offs (consistency vs latency, synchronous vs asynchronous).
- When explicitly triggered via slash command `/grill-me`, `/interrogate`, or `/relentless-questioning`.
- **Do NOT use for**:
  - Routine typo fixes, dependency version bumps, or minor formatting changes.
  - Trivial bugs where the defect, root cause, and fix are already verified and obvious.
  - Routine test execution or build script maintenance.

---

## 2. Step-by-Step Execution Workflow

```
1. CLASSIFY (Detect Archetype) ──► 2. ADAPTIVE DRILL-DOWN (Chained Questions) ──► 3. RECONCILE (Rule Invariants) ──► 4. CONVERGE (Signed-Off FAS)
```

---

### Phase 1: Intent & Technical Archetype Classification
Upon receiving a user task or feature prompt, classify the functional archetype into one or more categories using [references/adaptive_question_trees.md](./references/adaptive_question_trees.md):
- **Archetype A: State Mutations & Financials** (balances, orders, payments, inventories)
- **Archetype B: Multi-Tenancy & Authorization** (tenant boundaries, custom fields, permissions)
- **Archetype C: Asynchronous & Event Streaming** (background jobs, webhooks, queues, pub/sub)
- **Archetype D: 3rd-Party & External Integrations** (external APIs, payment gateways, mailers)
- **Archetype E: Read Performance & Search** (dashboards, aggregations, high-scale read traffic)
- **Archetype F: User Interface, Experience Duality & Interaction Flows** (personas, app shell, screen journeys, URL synchronization, WCAG accessibility per [`ui_ux_architecture.md`](../../../docs/rules/ui_ux_architecture.md) and [`frontend_architecture.md`](../../../docs/rules/frontend_architecture.md))

---

### Phase 2: Context-Aware Dynamic Interrogation
Do NOT dump a massive 20-question static checklist. Execute the interview in **dynamic batches of 2–3 questions**:

1. **Initial Archetype Branch**: Ask the foundational branching questions for the detected archetype.
2. **Contextual Chaining (The Adaptive Rule)**:
   - Carefully parse the user's response.
   - **Every subsequent question MUST build on the previous answer**:
     `"Because you specified [Choice A], how should we handle [Specific Consequence / Failure Mode B]?"`
   - If the user selects a synchronous API integration, branch into timeouts and circuit breakers; do NOT ask about background queue retries.
   - If the user selects an asynchronous queue, branch into at-least-once delivery, idempotency, and dead-letter queues.
3. **Negative Scope Interrogation**:
   - Always ask: *"What is explicitly OUT OF SCOPE for this initial increment (Non-Goals)?"*
4. **Error Matrix Interrogation**:
   - Always ask: *"What are the expected client and server error states and corresponding status codes?"*

---

### Phase 3: Architectural Friction & Rule Reconciliation
Check the user's proposed answers against the **cohesive domain rules** in `docs/rules/`:
- If the user proposes writing to the database and publishing an event sequentially ➔ **Flag the dual-write anti-pattern** and mandate the Transactional Outbox pattern ([`database_design.md`](../../../docs/rules/database_design.md)).
- If the user proposes storing tenant data without an isolation mechanism ➔ **Flag the tenant leak risk** and mandate an isolation model ([`multitenancy_architecture.md`](../../../docs/rules/multitenancy_architecture.md)).
- If the user proposes arbitrary untrusted script execution ➔ **Flag the host security vulnerability** and mandate Wasm sandboxing ([`multitenancy_architecture.md`](../../../docs/rules/multitenancy_architecture.md)).
- If the user proposes a fullstack feature but ignores user workflows or screens ➔ **Flag the Anemic Core anti-pattern** and mandate Outside-In interaction discovery ([`frontend_architecture.md`](../../../docs/rules/frontend_architecture.md)).
- If the user proposes ad-hoc modal alerts or unstructured page navigation ➔ **Flag UX debt** and enforce the 7-Pillar Design Architecture Triage Gate ([`ui_ux_architecture.md`](../../../docs/rules/ui_ux_architecture.md)).
- Reconcile the conflict collaboratively before proceeding.

---

### Phase 4: Convergence & Feature Alignment Specification (FAS)
Synthesize the answers into an unambiguous **Feature Alignment Specification (FAS)** using the template in Section 4.
**STOP AND ASK FOR CONFIRMATION**: Present the FAS to the user and obtain explicit sign-off before writing any production code or plans.

---

## 3. Gotchas & What NOT to Do

- **DO NOT** use static checklists that ignore user responses. Every question turn must reflect the user's prior answers.
- **DO NOT** ask 10+ questions at once. Keep batches small (2–3 questions) to maintain a collaborative conversation.
- **DO NOT** start coding or planning in parallel while the interrogation is in progress.
- **DO NOT** let the user bypass critical failure branches (e.g. *"we'll handle errors later"*). Insist on defining failure states.
- **DO NOT** compromise on the cohesive domain rules. If a user request introduces an architectural violation, surface it immediately.

---

## 4. Structured Output Templates

### Feature Alignment Specification (FAS) Template
```markdown
# Feature Alignment Specification (FAS): [Feature Name]

## 1. Domain Purpose & Value
- **User Story:** As a [role], I want [capability], so that [benefit].
- **Core Invariant:** [Immutable business rule that must never be violated].

## 2. Technical Decisions & Boundaries
- **Interaction Archetype:** [Mutating / Read-Only / Async Event / 3rd-Party]
- **Tenant Isolation Model:** [AST Interceptor / DB RLS / Schema / Instance]
- **Transaction Boundary:** [Isolation level, timeouts, Outbox requirements]
- **Port/Adapter Boundary:** [Project-owned interface for any external dependency]

## 3. Negative Scope (Non-Goals)
- [Explicitly excluded feature 1]
- [Explicitly excluded feature 2]

## 4. Error & Edge Case Matrix
| Scenario | Error Code | HTTP / RPC Status | Recovery Action |
|---|---|---|---|
| [Scenario 1] | `RESOURCE_CONFLICT` | 409 Conflict | Return latest version |
| [Scenario 2] | `TENANT_NOT_FOUND` | 404 Not Found | Terminate request |

## 5. Verification & Acceptance Criteria
- **Outside-In Acceptance Scenario (Gherkin):**
  ```gherkin
  Scenario: [Name]
    Given [Precondition]
    When [Action]
    Then [Observable Outcome]
  ```
- **Test Strategy:** [Contract / Integration / Unit tests required; 100% on all metrics, assertion-free tests rejected]
```

---

## 5. Subdirectories & Progressive Resources
- [references/adaptive_question_trees.md](./references/adaptive_question_trees.md): Contextual branching trees for state mutations, multi-tenancy, integrations, and caching.
