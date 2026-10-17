# Domain-Driven Design (DDD) & Ubiquitous Language

> **Core Mandate:** Separate Problem Space from Solution Space, establish unambiguous Ubiquitous Language definitions, isolate Bounded Contexts, guarantee Domain-Code Language Agreement, and protect Aggregate invariants.

---

## 1. Problem Space vs. Solution Space (Evans & Vernon)

Software engineering fails when teams jump directly into the **Solution Space** (choosing languages, frameworks, databases, and microservices) before fully defining the **Problem Space**.

```mermaid
flowchart TD
    subgraph ProblemSpace["The Problem Space (The Essence)"]
        direction TB
        P1["Business Problem ➔ Subdomains (Core / Supporting / Generic) ➔ Invariants"]
        P2["Operational Constraints: Execution target, Latency budget, GC limits"]
        P1 --- P2
    end

    subgraph SolutionSpace["The Solution Space (The Accidents)"]
        direction TB
        S1["Bounded Contexts ➔ Architectural Style (DOD, Hexagonal, Pipeline)"]
        S2["Emergent Toolchain: Programming Language, Runtime, Persistence"]
        S1 --- S2
    end

    ProblemSpace -->|Shapes & Dictates| SolutionSpace
```

- **The Problem Space (The Essence - Fred Brooks):** Concerns *what* problem is being solved, the entities, state transitions, and operational constraints (e.g. 16.6ms frame budget for games, zero-install browser sandbox for extensions, or ACID compliance for banking). **Zero technology, stack, or database choices are permitted in the Problem Space.**
- **The Solution Space (The Accidents):** Concerns *how* the system is realized. Runtimes, programming languages (C, Rust, TS, Go, Java), and storage engines are **emergent outputs** derived strictly from Problem Space constraints.
- **The Golden Hammer Anti-Pattern:** Selecting tools (e.g., "Let's use Next.js and PostgreSQL") before mapping problem constraints forces the domain to fit the tool, creating massive accidental complexity.

### Strategic Subdomain & Capability Mapping
Structure enterprise business capabilities into three distinct tiers:
1. **Core Subdomain / Capabilities**: Proprietary value drivers and business differentiators (e.g. specialized workflow engines, dynamic pricing algorithms). Allocate 80% of architectural effort here.
2. **Supporting Subdomain / Capabilities**: Business functions specific to the domain but not competitive differentiators (e.g. order tracking, invoice rendering).
3. **Generic Subdomain / Capabilities**: Standard commoditized software (e.g. authentication, audit logging, email transport). Rely exclusively on standard open-source libraries.

---

## 2. Domain-Code Language Agreement

The fundamental premise of Domain-Driven Design (Eric Evans) is that **the code is the model, and the model is the code**. Any divergence between the mental model of domain experts and the source code is called **Linguistic Drift**.

### Principles of Linguistic Alignment
1. **Zero Synonyms (The Single Name Rule)**: Every domain concept has exactly one authoritative term. Synonyms (e.g. `Client` vs `User`, `Account` vs `Organization`, `Contract` vs `Agreement`) are strictly forbidden across code, tests, and user interfaces.
2. **Eliminate Technical Jargon from Domain Core**: Domain models must not leak technical implementation terms (e.g. `UserRecord`, `TenantRow`, `DataDTO`, `IsActiveFlag`). The domain language must be pure business vocabulary.
3. **Contextual Isolation**: When a single English word has multiple meanings across business units, split the terms or isolate them within dedicated Bounded Contexts:
   - *Example*: In multi-tenant infrastructure, a system isolation boundary is an **Organization** / **Tenant Workspace**. In application operations, a participant is a **Member**, **User**, or **Customer**. Using "Tenant" for both creates semantic ambiguity and catastrophic bugs.

---

## 3. Living Ubiquitous Language Glossary

Every project must maintain an authoritative, version-controlled **Living Ubiquitous Language Glossary** at [`docs/knowledge/ubiquitous_language.md`](../knowledge/ubiquitous_language.md).

### Structure of a Glossary Entry
Each entry must define:
- **Canonical Term**: The agreed domain name.
- **Definition**: The business meaning agreed with stakeholders.
- **Bounded Context**: The domain subsystem where this definition holds authority.
- **Forbidden Synonyms**: Banned terms that must never appear in code, schemas, or UI.
- **Code Representations**: Exact class, type, interface, and database table names.

---

## 4. Automated Enforcement & Linters

To prevent linguistic drift over time, teams must employ mechanical enforcement:

### 1. Static Analysis / Linter Rules
Configure custom linter rules (e.g. ESLint `id-denylist` or custom AST rules) to forbid banned synonyms in identifiers:
```json
{
  "rules": {
    "id-denylist": ["error", "client_user", "account_org", "raw_data_dto"]
  }
}
```

### 2. Branded Nominal Types
Prevent "Primitive Obsession" where generic strings or IDs are conflated across domain boundaries:
```typescript
export type UserId = string & { readonly __brand: unique symbol };
export type OrganizationId = string & { readonly __brand: unique symbol };
export type OrderId = string & { readonly __brand: unique symbol };

// The compiler prevents accidentally passing an OrganizationId where a UserId is required:
function assignUserToOrder(orderId: OrderId, userId: UserId): void { ... }
```

### 3. Living Executable Specifications (Gherkin BDD)
Acceptance criteria must be written strictly in Ubiquitous Language, serving as executable contracts that verify domain terminology in automated test runners.

---

## 5. Tactical Patterns & Invariants

1. **Entities**: Objects defined by identity that persists across state changes (e.g. `User`, `Order`, `Invoice`).
2. **Value Objects**: Immutable objects defined strictly by their attributes with no identity (e.g. `Money`, `DateRange`, `EmailAddress`).
3. **Aggregates & Aggregate Roots**: Clusters of domain objects treated as a single transactional consistency boundary. All mutations must pass through explicit methods on the Aggregate Root that assert invariants before committing state:
   - **Zero Anemic Domain Models**: Domain entities must encapsulate state and validation logic. Never expose public setters that allow outside code to corrupt business rules.
   - **Aggregate Root Gatekeeper Pattern**:
     ```typescript
     export class OrderAggregate {
       private constructor(private order: OrderState) {}

       submit(): Result<void, DomainError> {
         if (this.order.items.length === 0) {
           return err(new DomainError('Cannot submit empty order'));
         }
         if (this.order.status !== 'DRAFT') {
           return err(new DomainError('Order already submitted'));
         }
         this.order.status = 'SUBMITTED';
         return ok(undefined);
       }
     }
     ```
4. **Anti-Corruption Layer (ACL)**: When integrating with third-party APIs or legacy systems that use different terminology, translate external payloads into the internal Ubiquitous Language at the boundary adapter before they enter the domain core.
5. **Cross-Aggregate Coordination in Use Cases**: While an Aggregate Root guards its own internal invariants, business operations frequently span multiple aggregates (e.g. reserving an inventory item for an agreement). Application use cases or orchestrators must coordinate aggregate transitions atomically: asserting resource availability prior to state change, transitioning the constrained entity (e.g. `ALLOCATED`), and restoring state (`AVAILABLE`) upon cancellation, avoiding double-allocation race conditions without coupling aggregates directly.
