# Requirements Engineering, INVEST Stories & Gherkin Criteria

> **Core Mandate:** Decompose business requirements into vertically sliced INVEST user stories, executable Gherkin acceptance criteria, and exhaustive edge case matrices, acknowledging that stories are conversation starters rather than full specification documents.

---

## 1. Are User Stories Requirements?

In modern product engineering (per Scrum.org and XP principles), **user stories are NOT requirements**. Rather, a user story is one specific, highly effective technique used to *express, capture, and explore* user-centric requirements.

### Key Distinctions
- **A Token for Conversation:** A user story is a "placeholder" or token promising a future conversation. It captures the essence, not every granular detail upfront.
- **The "Pidgin Language" Bridge:** A pidgin language is a simplified common language that allows people with different native tongues to trade and work together. User stories act as a pidgin language bridging the business/customer perspective and the software engineering architecture without forcing either side to abandon their domain language.
- **Ron Jeffries' 3 C's of User Stories:**
  1. **Card:** The physical index card or digital ticket capturing the intent (`As a... I want to... So that...`).
  2. **Conversation:** The collaborative discussion between Product Owner, stakeholders, and developers where details and trade-offs are co-created.
  3. **Confirmation:** The executable acceptance criteria and automated tests that prove whether the story satisfies its intent.

### Non-Story Requirements
Not all system requirements originate from an end-user persona or fit the user story syntax. High-integrity systems also require:
- **System Invariants:** Core domain rules (e.g., "A transaction cannot be completed without a verified payment instrument").
- **Non-Functional Requirements (NFRs):** Latency SLAs, encryption standards, concurrency limits, and accessibility compliance (WCAG 2.2 AA).
- **Architectural Spikes:** Time-boxed exploratory investigations to resolve technical unknowns.
- **Regulatory & Security Controls:** SOC 2 audit log immutability, GDPR data erasure rights, and OWASP Top 10 defenses.

These requirements should be operationalized as explicit acceptance constraints, architectural fitness functions, or dedicated technical backlog items.

---

## 2. INVEST User Story Framework & Vertical Cake Slicing

Ensure every user story satisfies Bill Wake's **INVEST** criteria:

- **I - Independent:** Sliced vertically to minimize conceptual overlap. Can be scheduled, implemented, and released in any sequence without blocking peer stories.
- **N - Negotiable:** Captures the core essence and problem space, not a rigid implementation contract. Specific details are co-created during pair programming and TDD.
- **V - Valuable:** Delivers observable, direct benefit to the customer or business stakeholder.
- **E - Estimable:** Well-understood and right-sized so the team can gauge complexity. Unknowns are resolved via prior time-boxed spikes.
- **S - Small:** Sized to be completed within 1–2 development days. Small stories yield higher estimation accuracy and rapid feedback.
- **T - Testable:** Accompanied by concrete pass/fail assertions. Non-functional requirements are operationalized into automated tests early.

### The Multi-Layer Cake Metaphor (Vertical Slicing)
Think of a complete feature as a multi-layer cake:
```mermaid
flowchart TD
    subgraph Cake["The Multi-Layer Cake (Vertical Slicing)"]
        direction TB
        L1["Presentation / UI Layer"]
        L2["Business Logic & Application Use Case"]
        L3["Domain Invariants & Entities"]
        L4["Persistence & Database Layer"]
        L1 --- L2 --- L3 --- L4
    end

    Slice["Vertical Cake Slice<br/>(Customer gets a taste of every layer)"]
    Slice --> L1
    Slice --> L2
    Slice --> L3
    Slice --> L4
```
- **Horizontal Slicing (Anti-Pattern):** Implementing only the database schema or only the UI mock. A full database table has zero observable value to the customer without presentation and logic layers.
- **Vertical Slicing (Golden Standard):** Slicing thin through all layers (UI ➔ API ➔ Domain ➔ DB). Even a minimal vertical slice provides working functionality that can be deployed, tested, and validated empirically.

---

## 3. Executable Gherkin Acceptance Criteria

Draft concrete, actionable scenarios directly convertible into automated acceptance tests:

```gherkin
Scenario: Successful Digital Agreement Execution
  Given an authenticated customer with an approved application
  And the agreement is in "PENDING_SIGNATURE" status
  When the customer provides their legal name "Alice Smith" and confirms agreement
  Then the response status is 200 OK
  And the agreement status transitions to "ACTIVE"
  And an execution audit record is persisted with timestamp, actorId, and IP address
  And a transactional confirmation notification is queued for delivery
```

### Writing Rules for Gherkin Scenarios
- **Use Active Voice:** State explicit actor actions (`When the user clicks "Confirm Agreement"` rather than passive `When the button is clicked`).
- **One Observable Behavior Per Scenario:** Focus each scenario on one specific state transition or business invariant.
- **Cover Both Happy and Unhappy Paths:** Every feature must include positive paths and negative failure assertions.

---

## 4. Negative Scope & Edge Case Matrices

- **Out-of-Scope (Non-Goals):** Explicitly document what will NOT be built in this increment to prevent scope creep and align expectations.
- **Edge Case Matrix:** Map all potential failure states to standardized RFC 9457 problem details and HTTP status codes:
  - `400 Bad Request`: Schema validation failures, missing required fields.
  - `401 Unauthorized`: Missing or invalid session tokens.
  - `403 Forbidden`: Cross-tenant boundary violations, role privilege deficits.
  - `404 Not Found`: Resource non-existence (or masked enumeration).
  - `409 Conflict`: Duplicate unique constraints, state machine transition invalidity.
  - `422 Unprocessable Entity`: Semantic domain invariant violations.
  - `429 Too Many Requests`: Rate limiter token exhaustion.
  - `500 Internal Server Error`: Unhandled upstream infrastructure failures.
