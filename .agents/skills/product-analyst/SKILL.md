---
name: product-analyst
description: Use when analyzing product requirements, aligning features with OKRs and Product Goals, prioritizing backlogs with Kano/MoSCoW/RICE, decomposing epics into INVEST user stories and SMART tasks, authoring Gherkin Given-When-Then acceptance criteria, or mapping domain models and failure edge cases. Do not use for writing application code, debugging implementation bugs, or running tests.
---

# Product Analyst & Requirements Architect Skill

> **Core Purpose:** Bridge strategic business intent and engineering execution by grounding feature requirements in OKRs, maximizing product value via empirical backlog ordering (Kano, MoSCoW, RICE), and decomposing scope into vertically sliced INVEST user stories with Gherkin acceptance criteria and SMART developer tasks.

---

## 1. When to Use This Skill
- Decomposing a broad business request, feature idea, or PRD into actionable vertical slices.
- Evaluating alignment with strategic **Objectives & Key Results (OKRs)** and the overarching **Product Goal**.
- Ordering and prioritizing Product Backlog items using **Kano**, **MoSCoW**, **RICE**, or **Buy a Feature**.
- Distinguishing user-facing stories from non-story requirements (system invariants, NFRs, architectural spikes).
- Formulating Gherkin acceptance tests before kicking off Outside-In TDD.
- Decomposing INVEST stories into actionable, time-boxed **SMART developer tasks**.
- Establishing Ubiquitous Language definitions for new domain models.

---

## 2. Step-by-Step Analysis Workflow

```
1. OKR & Goal Alignment ──► 2. Backlog Triage & Ordering ──► 3. Story vs. NFR Classification ──► 4. INVEST Stories & Gherkin ──► 5. SMART Tasks & Edge Cases
```

### Step 1: Align with OKRs & the Product Goal
- **Product Goal Validation:** Verify how this feature advances the long-term Product Goal.
- **OKR Mapping:** Map the feature to a specific **Objective** (qualitative "what") and its associated **Key Results** (quantitative "how").
- **Satisfaction Gap Check:** Identify which customer pain point or satisfaction gap is addressed:
  $$\text{Satisfaction Gap} = \text{Desired Customer Experience} - \text{Current Customer Experience}$$
- **Deciding What NOT to Do:** Explicitly identify and eliminate speculative, low-impact sub-features.

### Step 2: Prioritize via Backlog Ordering Models
Consult [`references/backlog_ordering_techniques.md`](./references/backlog_ordering_techniques.md) to apply the optimal prioritization model:
- **Kano Model:** Classify as *Must-be* (table stakes), *Performance* (linear satisfaction), or *Attractive* (delighter). Reject *Indifferent* or *Reverse* items.
- **MoSCoW:** Categorize into *Must*, *Should*, *Could*, or *Won't have this time*.
- **RICE Scoring:** Compute $(Reach \times Impact \times Confidence) / Effort$ to break ranking ties objectively.

### Step 3: Classify User Stories vs. Non-Story Requirements
Recognize that **user stories are not requirements**, but a technique to express them:
- **User Story (3 C's: Card, Conversation, Confirmation):** Fits user-facing features where customer/business perspective is translated into software behavior via a "pidgin language".
- **Non-Story Requirements:** If the requirement represents a system invariant, data integrity rule, security policy (OWASP), latency SLA, or an architectural spike, model it directly as a technical specification, architectural fitness test, or spike task rather than forcing an artificial `"As a user..."` persona.

### Step 4: Author User Stories (INVEST Framework & Vertical Cake Slicing)
Ensure every user story conforms to Bill Wake's **INVEST** criteria:
- **Independent:** Sliced vertically through all layers (UI ➔ API ➔ Domain ➔ DB) without circular dependencies.
- **Negotiable:** Captures essence and value, leaving implementation details open for pairing co-creation.
- **Valuable:** Delivers observable benefit to the customer or business stakeholder.
- **Estimable:** Right-sized and bounded. Spikes used for major unknowns.
- **Small:** Sized to be completable in 1–2 development days.
- **Testable:** Accompanied by executable, unambiguous Gherkin acceptance criteria.

**The Multi-Layer Cake Rule & UI Integration:**
- **Never slice horizontally** (e.g. *"Create database schema only"* or *"Create backend API only"*). Always slice vertically through the full stack so that every story delivers working software.
- **Mandatory UI/UX Triage Gate for User-Facing Applications:** If the project has a frontend or user interface (Fullstack Web SaaS, Extension, Desktop), execute the **7-Pillar Design Architecture Triage Gate** ([`ui_ux_architecture.md`](../../../docs/rules/ui_ux_architecture.md)) before finalizing stories:
  1. *Role & Identity:* Define who the user is and their operational boundary.
  2. *Information Architecture:* Define how the view fits into the Persistent App Shell vs Dynamic Canvas.
  3. *Experience Duality:* Clarify whether the screen belongs to an Enterprise Operator Workspace or Consumer Portal.
  4. *Navigation & Wayfinding:* Specify sidebar route, active tab, breadcrumbs, and command palette entries.
  5. *State & URL Synchronization:* Specify query params (`?tab=`, `?q=`, `?page=`, `?modal=`).
  6. *Access Control:* Specify route guards and permission checks.
  7. *Accessibility & Feedback:* Specify accessible notifications, focus trapping, and zero native alerts.
- **Every user-facing story MUST specify:** (1) The UI view/component & user interaction, (2) The API Command/Query DTO, (3) The core domain invariant, and (4) The persistence change.

### Step 5: Decompose Stories into SMART Developer Tasks
For engineering execution, translate INVEST user stories into Bill Wake's **SMART** developer tasks:
- **S - Specific:** Unambiguous scope without conceptual overlap.
- **M - Measurable:** Clear pass/fail criteria (tests pass, clean code, DoD met).
- **A - Achievable:** Realistically executable; triggers early help request if blocked.
- **R - Relevant:** Justified by direct contribution to parent story.
- **T - Time-boxed:** Limited to 2–4 hours (never exceeding 1 day).

### Step 6: Construct the Edge Case & Failure Matrix
Map all failure paths to HTTP status codes (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`) and RFC 9457 problem details.

---

## 3. Gotchas & What NOT to Do

- **DO NOT** confuse output (features shipped, story points burned) with outcome (value delivered, satisfaction gap closed).
- **DO NOT** write horizontal, technical user stories (e.g., *"As a developer, I want a database table"* or *"As an API, I want a REST endpoint"*).
- **DO NOT** author backend-only user stories or ignore the UI when analyzing a user-facing system. If the system has a web frontend or client interface, slicing must start with user interactions and views.
- **DO NOT** force technical constraints, security policies, or infrastructure upgrades into user story syntax. Treat them as non-story requirements or architectural spikes.
- **DO NOT** omit the Out-of-Scope ("Won't Have this time") section. Lack of negative boundaries causes runaway scope bloat.
- **DO NOT** allow developer tasks to be open-ended without a measurable time-box. If a task exceeds 4 hours, it must be split or paired.
- **DO NOT** skip failure paths in Gherkin scenarios. Happy-path-only requirements lead to production defects.

---

## 4. Structured Output Template

```markdown
# Product Specification: [Feature Name]

## 1. Strategic Alignment & Product Goal
- **Product Goal:** [Target milestone / commitment]
- **Target OKR:**
  - **Objective:** [Qualitative, inspiring What]
  - **Key Result(s):** [Quantitative, measurable outcome How]
- **Target Satisfaction Gap:** [Customer pain point addressed]
- **Prioritization Category:** [Kano: Must-be / Performance / Attractive | MoSCoW: Must / Should | RICE Score: X]

## 2. In-Scope vs. Out-of-Scope (Non-Goals)
- **In-Scope (Must/Should):** ...
- **Out-of-Scope (Won't Have This Time):** ...

## 3. Ubiquitous Language & Entity Relationships
- **[Term 1]**: [Definition grounded in domain invariants]
- **[Term 2]**: [Definition grounded in domain invariants]

## 4. User Stories & Gherkin Acceptance Scenarios

### US-01: [User Story Title]
**As a** [role]  
**I want to** [action]  
**So that** [value]

```gherkin
Scenario: [Happy path]
  Given ...
  When ...
  Then ...

Scenario: [Edge case / Failure path]
  Given ...
  When ...
  Then ...
```

## 5. SMART Developer Tasks (Inner-Loop Breakdown)
- [ ] **Task 1 [Specific & Time-boxed: 2h]:** [Technical description, e.g. Domain entity and value object invariants with unit test RED-GREEN]
- [ ] **Task 2 [Specific & Time-boxed: 3h]:** [Use case & secondary repository implementation with integration tests]
- [ ] **Task 3 [Specific & Time-boxed: 2h]:** [HTTP controller endpoint & RFC 9457 error handling]
- [ ] **Task 4 [Specific & Time-boxed: 3h]:** [UI view integration, TanStack query hooks, accessible Radix primitives]

## 6. Edge Case & Error Response Matrix
| Condition | HTTP Status | Error Code | Expected Behavior |
|---|---|---|---|
| Invalid payload | 400 | `VALIDATION_ERROR` | Return field errors |
| Cross-tenant attempt | 403 / 404 | `FORBIDDEN` | Mask existence or block |
| Duplicate invariant | 409 | `CONFLICT` | Prevent double-submission |
```

---

## 5. Subdirectories & Progressive Resources
- [references/invest_checklist.md](./references/invest_checklist.md): Checklist for evaluating user stories against Bill Wake's INVEST criteria and cake-slicing rules.
- [references/smart_tasks.md](./references/smart_tasks.md): Guide and patterns for breaking stories into SMART developer tasks.
- [references/backlog_ordering_techniques.md](./references/backlog_ordering_techniques.md): Matrix and decision trees for Kano, MoSCoW, RICE, and Buy a Feature.
- [references/okr_alignment_guide.md](./references/okr_alignment_guide.md): Framework for authoring Objectives, Key Results, and connecting them to Product Goals.
- [references/gherkin_patterns.md](./references/gherkin_patterns.md): Reusable Gherkin scenario patterns for REST APIs and UI interactions.
