# Adaptive Questioning Trees & Contextual Branching Matrices

> **Core Purpose:** Detailed decision trees for the `relentless-questioner` skill, demonstrating how subsequent questions adapt dynamically based on previous user responses.

---

## Decision Tree 1: Mutating Operations & State Changes

```mermaid
flowchart TD
  Q1["Does the operation mutate database state?"]
  Q1 -->|Yes| Q2["Does it involve multiple tables, monetary balances, or inventory?"]
  Q1 -->|No / Read Only| Q_Read["Branch: Read Performance & Consistency"]

  Q2 -->|Yes: Financial / Inventory| Q_Acid["1. Transaction Isolation: REPEATABLE READ or SERIALIZABLE?\n2. Lock Ordering: How to prevent deadlocks?\n3. Concurrency: Optimistic Concurrency Control (version) or pessimistic locking?"]
  Q2 -->|No: Standard Entity CRUD| Q_Crud["1. Soft delete or hard delete?\n2. Unique constraints across tenant?\n3. Cascading relations?"]

  Q_Acid --> Q3["Does the mutation emit domain events or notify external systems?"]
  Q_Crud --> Q3

  Q3 -->|Yes| Q_Outbox["How is the dual-write avoided?\n(Enforce Transactional Outbox pattern before broker publish)"]
  Q3 -->|No| Q4["Idempotency: Is an Idempotency-Key header required to guard against network retries?"]
```

---

## Decision Tree 2: Multi-Tenancy & Authorization Boundaries

```mermaid
flowchart TD
  Q1["Who executes this action and across which boundary?"]
  Q1 -->|End User via Web/API| Q_Auth["1. What roles are permitted (ADMIN, MEMBER, CUSTOMER)?\n2. Are dynamic ABAC attributes involved (e.g. order value threshold)?\n3. Can a user act across multiple tenants (switch tenant)?"]
  Q1 -->|System / Background Job| Q_Worker["1. How is tenant context established without an HTTP session?\n2. What service principal / token credentials are used?"]

  Q_Auth --> Q2["What happens if an unauthorized tenant accesses this resource ID?"]
  Q2 --> Q_Sec["1. Return 404 Not Found (enumeration masking) or 403 Forbidden?\n2. Is isolation enforced at the DB layer (RLS / AST interceptor)?"]
```

---

## Decision Tree 3: External Integrations & 3rd-Party APIs

```mermaid
flowchart TD
  Q1["Does the feature integrate with an external SaaS or network endpoint?"]
  Q1 -->|Yes| Q2["What is the failure tolerance of the integration?"]
  
  Q2 -->|Synchronous / Critical| Q_Sync["1. What is the strict HTTP timeout (e.g. 3000ms)?\n2. What is the circuit breaker threshold before fast-failing?\n3. What fallback response is served if the 3rd-party is down?"]
  Q2 -->|Asynchronous / Event-Driven| Q_Async["1. Does the external system provide webhooks?\n2. How are webhook signatures cryptographically verified?\n3. What is the retry backoff and dead-letter queue (DLQ) policy?"]

  Q_Sync --> Q_Port["How is the external SDK isolated?\n(Enforce application-owned Port interface so domain never imports SDK)"]
  Q_Async --> Q_Port
```

---

## Decision Tree 4: Read Performance, Caching & Search

```mermaid
flowchart TD
  Q1["What is the expected read volume and latency requirement?"]
  Q1 -->|High Volume / Sub-50ms Latency| Q2["Is stale data acceptable for seconds/minutes?"]
  
  Q2 -->|Yes| Q_Cache["1. What is the cache TTL and jitter window?\n2. What domain events trigger cache eviction?\n3. Is probabilistic early expiration (XFetch) needed?"]
  Q2 -->|No: Strict Read-After-Write Consistency| Q_Consistent["1. Read from primary database instance for 2s after mutation\n2. Bypass read replicas during write session"]

  Q_Cache --> Q_Page["Pagination Strategy: Enforce keyset/cursor pagination over OFFSET"]
  Q_Consistent --> Q_Page
```

---

## Decision Tree 5: User Interface, Experience Duality & Interaction Flows

```mermaid
flowchart TD
  Q1["Does the feature introduce or modify a user interface?"]
  Q1 -->|Yes| Q2["Who is the primary actor and operational persona?"]
  
  Q2 -->|Operator / Admin| Q_Op["1. Information Density: Dense tabular grid with filters?\n2. Persistent App Shell: Left collapsible sidebar route?\n3. Actions: Inline row actions or full-page drawer?"]
  Q2 -->|Consumer / Member| Q_Member["1. Experience Duality: Consumer portal (/portal)?\n2. Touch Ergonomics: Clean cards & mobile drawer?\n3. Simplified self-service actions?"]

  Q_Op --> Q3["Navigation & State Synchronization"]
  Q_Member --> Q3

  Q3 --> Q_State["1. URL State: Deep-link query params (?tab=, ?q=, ?page=, ?modal=)?\n2. Server Cache: TanStack Query hook with automated invalidation?\n3. Accessibility: Accessible headless dialogs & ARIA live regions?"]
```

---

## Contextual Follow-Up Patterns

When conducting the interview, use this exact syntax pattern to chain questions adaptively:

1. **Acknowledge and Pin Previous Answer**:
   `"Understood, you specified [Option A] for [Requirement X]."`
2. **Surface Immediate Architectural Implication**:
   `"Because of [Option A], [Potential Failure / Edge Case Y] becomes the primary risk."`
3. **Ask Context-Dependent Question**:
   `"How should the system behave when [Condition Y] occurs? Specifically:"`
   - *Sub-question 1*
   - *Sub-question 2*
