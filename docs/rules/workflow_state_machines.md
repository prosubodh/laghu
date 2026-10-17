# Workflow Engines, State Machines & State Configurability

> **Core Mandate:** Separate non-negotiable core domain invariants (Aggregate Root FSM) from tenant-configurable operational workflows (Metadata-Driven State Machines / Orchestration Engines).

---

## 1. The YAGNI Gate: Simple Enums vs. State Machines

State machine libraries, declarative transition matrices, and workflow orchestration engines introduce significant cognitive and operational weight. **Never build a state machine when a simple enum or boolean flag suffices.**

```mermaid
flowchart TD
    subgraph StateMachineGate["State Machine YAGNI Gate"]
        B1["1. Simple Baseline (Day 1)<br/>• Discriminated union or enum column (status: 'PENDING' | 'DONE')<br/>• Simple guard clause in aggregate method (if (status !== 'A'))<br/>• Zero external state-machine libraries (no XState, Temporal, BPMN)"]
        B2["2. Anti-Triggers (Forbidden)<br/>• Binary lifecycle flags (is_active, is_verified, archived)<br/>• Strict linear forward-only progressions without branching/rollback<br/>• Synchronous single-table mutations within one ACID transaction"]
        B3["3. The Tipping Point (Graduation)<br/>• Entity has 3+ non-linear states with branching transitions, cancellations, or conditional rollbacks<br/>• Transitions require multi-step side-effects (emitting domain events, releasing authorizations)<br/>• Business/regulatory rules mandate an immutable transition audit<br/>• Durable orchestration (Temporal) justified ONLY when transitions depend on asynchronous multi-day callbacks"]
        B1 -->|Forbidden if linear or binary| B2
        B1 -->|Triggered by multi-step or non-linear branches| B3
    end
```

---

## 2. The Fallacy of Universal Configurability

A common architectural anti-pattern is the **"Universal Workflow Fallacy"** (a variant of the *Inner Platform Effect*), which presumes that *every* status and state transition in a system should be dynamically configurable by end-users or tenants.

### The Architectural Invariant
1. **Core Invariant States (Hard FSM / In-Aggregate)**:
   - Fundamental lifecycle states governed by business integrity, accounting invariants, or legal rules.
   - Enforced **strictly within the Aggregate Root** in compiled code.
   - Cannot be bypassed or arbitrarily restructured by tenant configuration.
   - *Examples*:
     - A `Payment` or `Transaction` with status `SETTLED` cannot transition back to `PENDING` without a compensating `REFUND` or reversal ledger entry.
     - An `Order` cannot become `FULFILLED` without valid payment authorization and inventory deduction.
2. **Operational / Business Process Stages (Soft FSM / Configurable Orchestration)**:
   - Tenant-specific pipeline stages, review checklists, approval tiers, and sub-statuses.
   - Managed via **Declarative State Transition Matrices**, **Workflow Engines** (Temporal / Camunda BPMN), or **CEL (Common Expression Language)** transition guards.
   - *Examples*:
     - An application/lead review pipeline: Tenant A uses `[NEW -> REVIEW -> ACCEPTED]`; Tenant B uses `[NEW -> VETTING -> INTERVIEW -> APPROVAL -> ACCEPTED]`.
     - A support/ticket resolution lifecycle.

---

## 3. State Machine Architectural Patterns

### Pattern A: In-Aggregate State Machine (Hard Invariants)
Model states as **Discriminated Unions** or the GoF **State Pattern** encapsulated inside the domain entity. Public mutations must be explicit domain actions:

```typescript
// Correct: Explicit domain command asserting state invariant
export class OrderAggregate {
  private constructor(private state: OrderState) {}

  fulfill(actorId: string): Result<void, DomainError> {
    if (this.state.status !== 'PAID') {
      return err(new DomainError(`Cannot fulfill order in status: ${this.state.status}`));
    }
    this.state.status = 'FULFILLED';
    this.state.updatedAt = new Date();
    this.state.updatedBy = actorId;
    return ok(undefined);
  }
}
```

### Pattern B: Declarative State Transition Matrix (Configurable FSM)
For tenant-configurable operational stages, store transitions as declarative metadata:

```json
{
  "workflow": "resource_review_pipeline",
  "tenantId": "org_123",
  "initialState": "SUBMITTED",
  "transitions": [
    {
      "from": "SUBMITTED",
      "to": "UNDER_REVIEW",
      "event": "START_REVIEW",
      "allowedRoles": ["MANAGER", "REVIEWER"],
      "guard": "resource.score >= 60"
    },
    {
      "from": "UNDER_REVIEW",
      "to": "APPROVED",
      "event": "APPROVE",
      "allowedRoles": ["ADMIN"],
      "guard": "resource.verified == true"
    }
  ]
}
```

### Pattern C: Durable Distributed Orchestration (Temporal / BPMN)
When a state transition requires coordination across multiple aggregates or asynchronous third parties (e.g. external payment gateway, background verification API, webhook delivery):
- Use a **Durable Workflow Engine** (Temporal or Camunda BPMN 2.0).
- The workflow coordinates activities by sending commands to Aggregate Roots and awaiting Domain Events.
- **Invariant**: The workflow engine never mutates aggregate state directly; it issues domain commands.

---

## 4. Mandatory State Transition Audit Trail

Every state change across any entity or workflow MUST be immutably recorded in a transition log:

| Field | Type | Description |
|---|---|---|
| `transitionId` | String (UUIDv7) | Unique identifier of the transition record. |
| `entityType` | String | Name of the entity (`Order`, `Application`, `Invoice`). |
| `entityId` | String | Target entity identifier. |
| `fromState` | String | Pre-transition state value. |
| `toState` | String | Post-transition state value. |
| `event` | String | Domain event or action triggering transition. |
| `actorId` | String | User ID or `SYSTEM` triggering the change. |
| `reason` | String? | Optional justification or audit comment. |
| `metadata` | JSON? | Snapshot of transition context or rule evaluation. |
| `createdAt` | DateTime | Immutable timestamp of transition. |
