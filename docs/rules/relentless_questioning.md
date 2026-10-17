# Relentless Questioning Loop & Dynamic Interrogation Protocol

> **Core Mandate:** Enforce context-aware, adaptive interrogation of requirements, technical constraints, and failure modes before code authoring, dynamically branching questions based on previous answers to eliminate all hidden assumptions.

---

## 1. The Context-Aware Interrogation Lifecycle

Never write speculative code or draft implementation plans based on underspecified user prompts. Every non-trivial feature, database modification, or architectural task must pass through the **4-Stage Relentless Questioning Loop**:

```
1. CLASSIFY (Detect Archetype) ──► 2. ADAPTIVE BRANCHING (Context Questions) ──► 3. TENSION RECONCILIATION (Rule Conflicts) ──► 4. CONVERGENCE (Signed-Off Spec)
```

1. **Stage 1: Intent & Archetype Classification**: Analyze the incoming prompt to identify core domains (e.g. Financial/Ledger, Multi-Tenant Mutation, Async/Event-Driven, External Integration, Public API, or Read-Heavy Analytics).
2. **Stage 2: Context-Aware Adaptive Branching**: Ask targeted questions in digestible batches (2–4 questions per turn). **Question $N+1$ must directly incorporate the answer to Question $N$**, exploring deep technical trade-offs rather than reciting generic checklists.
3. **Stage 3: Architectural Tension Reconciliation**: If the user's proposed approach violates an existing workspace rule (e.g. dual-writes without an outbox, sparse nullable columns, or missing tenant isolation), immediately highlight the architectural conflict and propose compliant alternatives.
4. **Stage 4: Convergence & Feature Alignment Specification (FAS)**: Lock down the scope with an unambiguous summary covering Invariants, Negative Scope (Non-Goals), Error Matrix, and Test Verification Strategy.

---

## 2. Adaptive Contextual Decision Branches

Questions must dynamically pivot depending on the technical archetype:

### Branch A: State Mutations & Financial Transactions

_Trigger:_ The feature involves balances, orders, payments, inventories, or status transitions.

- _Adaptive Inquiries:_ What isolation level is required (`REPEATABLE READ` vs `SERIALIZABLE`)? What is the idempotency key TTL? In the event of a downstream gateway failure, how is the compensating rollback (Saga) triggered? How is concurrent mutation race condition prevented (Optimistic Concurrency Control vs row lock)?

### Branch B: Multi-Tenancy & Data Boundaries

_Trigger:_ The feature touches tenant-scoped entities or custom fields.

- _Adaptive Inquiries:_ How is the tenant context resolved if accessed via background workers? Which isolation model applies (AST interceptor, database RLS, or schema namespace)? If custom fields are needed, does the tenant's JSON Schema govern validation?

### Branch C: Asynchronous Tasks & Event Streaming

_Trigger:_ The feature processes background jobs, emails, webhooks, or messaging.

- _Adaptive Inquiries:_ Is message delivery at-least-once or exactly-once? How are dual-writes prevented (Transactional Outbox)? How are poison pills and retries handled (Dead-Letter Queue with exponential backoff)?

### Branch D: External Integrations & 3rd-Party APIs

_Trigger:_ The feature interacts with external SaaS, webhooks, or cloud services.

- _Adaptive Inquiries:_ What is the project-owned Port/Adapter boundary interface? What are the rate-limiting and circuit-breaking parameters? How are mock test doubles constructed without mocking third-party types directly?

### Branch E: User Interface, Experience Duality & Interaction Flows

_Trigger:_ The feature introduces or modifies user interfaces, web pages, screen layouts, form mutations, or navigation.

- _Adaptive Inquiries:_ Who is the target user persona (Operator/Admin dense workspace vs Consumer/Member portal)? How does the view fit into the Persistent App Shell (collapsible sidebar, global header) vs Dynamic Canvas? What is the URL state synchronization strategy (`useSearchParams` for `?tab=`, `?q=`, `?page=`, `?modal=`)? What server-state cache manager synchronizes data (TanStack Query)? How are validation feedback and errors displayed (RFC 9457 inline/toast alerts, WCAG 2.2 live regions, zero native `window.alert()`)?

---

## 3. Anti-Assumption Guardrails

- **Zero Implicit Defaults**: If the user does not specify a behavior (e.g. timeout duration, error status code, rollback behavior), treat it as strictly unknown and ask.
- **Explicit Non-Goals (Negative Scope)**: Every inquiry must establish what the feature will **NOT** do, preventing scope creep and unrequested architectural bloat.
- **Mandatory User Confirmation**: Never transition from interrogation to code generation without an explicit confirmation from the user on the synthesized alignment specification.
