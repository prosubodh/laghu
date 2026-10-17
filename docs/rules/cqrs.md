# CQRS (Command Query Responsibility Segregation) & YAGNI Defense

> **Core Mandate:** Enforce evolutionary graduation across the CQRS spectrum, protect against premature abstraction (YAGNI), bound CQRS strictly to high-contention subdomains, decouple write aggregates from read projections, and prevent eventual consistency hazards.

---

## 1. The YAGNI Defense: Default Architecture vs. CQRS

CQRS separates the data model used for state mutations (**Commands**) from the data model used for read operations (**Queries**). While powerful, **CQRS is one of the most frequently over-engineered patterns in modern software**. 

```mermaid
flowchart LR
    subgraph DefaultModel["Default Single-Model (CRUD) - Start Here"]
        D1["• 1 Unified Data Schema (ACID)<br/>• Immediate Strong Consistency<br/>• Zero Projection Infrastructure<br/>• Minimal Mental Overhead"]
    end

    subgraph DistributedCQRS["Distributed CQRS (Level 3) - Graduate on Proof"]
        C1["• Dual Schemas & Dual Databases<br/>• Eventual Consistency & Lag<br/>• Outbox, Message Bus, CDC Workers<br/>• Projection Versioning & Replays"]
    end

    DefaultModel -.->|Graduate ONLY on high read-write asymmetry or SLA breaches| DistributedCQRS
```

### The YAGNI Rule for CQRS
1. **Default to Single Model / Single Database**: Start every application, microservice, or bounded context with a standard single data model (Hexagonal/DDD) where repositories handle both reads and writes.
2. **Never Use CQRS as Top-Level System Architecture**: CQRS must never be applied globally across an entire system. It is strictly a bounded-context tactical pattern. Generic subdomains (Auth, Settings, Billing, Organizations) must remain simple transactional CRUD.
3. **Explicit Graduation Tipping Points**: Do not introduce segregated read databases or asynchronous projections until empirical metrics prove that a unified relational model cannot meet operational constraints:
   - **Read/Write Asymmetry**: Read volume exceeds writes by > 50:1, and heavy read queries cause lock contention that starves transactional write operations.
   - **Impedance Mismatch**: Constructing UI views requires joining 10+ relational tables across multiple consistency boundaries, causing query latency to violate SLAs (> 500ms).
   - **Polyglot Query Topology**: Complex full-text search, spatial filtering, or columnar aggregation fundamentally requires specialized search engines (Elasticsearch, Meilisearch, ClickHouse) that cannot act as the primary write store.

---

## 2. The 4-Tier Evolutionary CQRS Spectrum

Rather than treating CQRS as a binary switch, systems must graduate incrementally across four explicit architectural tiers:

```mermaid
flowchart TD
    L0["Level 0: Method CQS (Bertrand Meyer)<br/>Functions either mutate state or return data; zero architectural overhead. Always mandatory."]
    L1["Level 1: Segregated Handlers in Code (Single DB, Single Schema)<br/>Command Handlers load Aggregates; Query Handlers bypass domain model for flat DTOs."]
    L2["Level 2: Segregated Read Models / Materialized Views (Single DB)<br/>Read queries query indexed SQL views or JSON cache tables populated synchronously via ACID transactions."]
    L3["Level 3: Polyglot Persistence & Asynchronous Projections (Multi-Store)<br/>Write DB (Postgres) + Read DB (Elastic/Redis). Synchronized asynchronously via Transactional Outbox + CDC."]

    L0 --> L1 --> L2 --> L3
```

### Level 0: Method-Level CQS (Command-Query Separation)
- Mandatory across all codebases (see [`docs/rules/clean_code.md`](./clean_code.md)).
- Any function that modifies state must return `void` or a `Result<void, DomainError>`. It must never return the mutated entity.
- Any function that queries state must be pure and cause zero observable side-effects.

### Level 1: Segregated Handlers in Code (Single DB, Single Schema)
- When domain aggregates become rich with business logic, hydrating deep aggregate graphs (with children, value objects, and invariant checks) simply to render a flat summary list is wasteful.
- **Commands**: Flow through `CommandHandler` ➔ loads `AggregateRoot` from `Repository` ➔ executes domain methods ➔ commits transaction.
- **Queries**: Flow through `QueryHandler` ➔ bypasses domain repositories ➔ issues direct projection queries (SQL `SELECT` or ORM raw select) ➔ returns read-only `DTO`.
- *Zero distributed complexity; 100% ACID consistency.*

### Level 2: Segregated Read Models (Single DB, Synchronous)
- When read queries require expensive aggregations or multi-table joins, create dedicated read tables, database views, or PostgreSQL JSONB projection columns in the same database.
- Projections are updated **synchronously within the same database transaction** as the command mutation (or via database triggers).
- *Guarantees immediate read-your-own-writes consistency without distributed outbox pipelines.*

### Level 3: Polyglot Persistence & Asynchronous Projections
- Writes commit to the transactional primary database (e.g. PostgreSQL).
- Events are emitted via the Transactional Outbox pattern and streamed to secondary read stores (e.g. Elasticsearch for search, Redis for caches, ClickHouse for telemetry).
- *Requires strict handling of eventual consistency, projection replay, and outbox delivery.*

---

## 3. Tactical Implementation Patterns (TypeScript)

### 1. Command Side: Enforcing Invariants via Aggregates
Commands express user intent, encapsulate validation, and mutate state through the Aggregate Root:

```typescript
// commands/create_order.command.ts
export interface CreateOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly items: ReadonlyArray<{ productId: string; quantity: number; unitPriceCents: number }>;
}

// handlers/create_order.handler.ts
export class CreateOrderCommandHandler {
  constructor(
    private readonly orderRepo: OrderRepositoryPort,
    private readonly outbox: TransactionalOutboxPort
  ) {}

  async execute(command: CreateOrderCommand): Promise<Result<void, OrderDomainError>> {
    // 1. Load or instantiate Aggregate Root
    const orderResult = OrderAggregate.create({
      id: command.orderId,
      customerId: command.customerId,
      items: command.items
    });

    if (orderResult.isFailure) {
      return Result.fail(orderResult.error);
    }

    const order = orderResult.value;

    // 2. Commit aggregate mutation and outbox event atomically in 1 transaction
    await this.orderRepo.transaction(async (tx) => {
      await this.orderRepo.save(order, tx);
      for (const event of order.pullDomainEvents()) {
        await this.outbox.stageEvent(event, tx);
      }
    });

    return Result.ok();
  }
}
```

### 2. Query Side: Fast Direct Projection DTOs
Queries bypass domain entities and ORM aggregate hydration entirely, executing direct, index-optimized reads:

```typescript
// queries/get_customer_orders.query.ts
export interface GetCustomerOrdersQuery {
  readonly customerId: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface CustomerOrderSummaryDTO {
  readonly orderId: string;
  readonly totalCents: number;
  readonly status: string;
  readonly itemCount: number;
  readonly createdAt: string;
}

// handlers/get_customer_orders.handler.ts
export class GetCustomerOrdersQueryHandler {
  constructor(private readonly db: ReadDatabaseClient) {}

  async execute(query: GetCustomerOrdersQuery): Promise<CustomerOrderSummaryDTO[]> {
    // Direct SQL projection - zero domain aggregate hydration overhead
    return await this.db.query<CustomerOrderSummaryDTO>(
      `SELECT order_id as "orderId", total_cents as "totalCents", 
              status, item_count as "itemCount", created_at as "createdAt"
       FROM order_summaries_view
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [query.customerId, query.limit]
    );
  }
}
```

---

## 4. Asynchronous Projection Invariants (Level 3 CQRS)

When graduating to Level 3 (asynchronous read stores), you must prevent data corruption, drift, and race conditions:

### 1. Zero Dual-Writes (Strict Outbox Mandate)
Never write to the command database and then publish to a message broker (RabbitMQ/Kafka) in two independent operations. Network failure between the two operations corrupts read models. Always use the **Transactional Outbox Pattern** (see [`docs/rules/database_design.md`](./database_design.md)).

### 2. Monotonic Sequence & Idempotent Projectors
Every domain event must carry an aggregate version number. Read projectors must discard duplicate or out-of-order events:
```typescript
export async function projectOrderUpdated(event: OrderUpdatedEvent, db: ReadDb): Promise<void> {
  // Idempotent upsert guarded by monotonic version sequence
  await db.query(
    `UPDATE order_read_models 
     SET status = $1, version = $2, updated_at = $3
     WHERE order_id = $4 AND version < $2`,
    [event.newStatus, event.version, event.occurredAt, event.orderId]
  );
}
```

---

## 5. Defending Read-Your-Own-Writes Consistency

The biggest hazard of asynchronous CQRS is **eventual consistency lag**: a user submits a mutation (e.g. updating their display name), receives an HTTP `200 OK`, gets redirected to their profile, but still sees their old name because the background projection worker is lagging.

### Strategies to Eliminate User-Perceived Lag
1. **Optimistic UI Updates**: The frontend immediately updates the client cache with the submitted values upon HTTP 200 response, without refetching from the query API.
2. **Monotonic Version Headers**:
   - The command response returns the new entity version: `ETag: "v14"`.
   - Subsequent query requests include `If-None-Match: "v14"` or `X-Min-Version: 14`.
   - If the read projection has not caught up to `v14`, the query service waits (up to 500ms) or falls back to querying the primary write database.
3. **Session Read-Model Pinning**: Direct read requests from the mutating user's session to the primary database for 5 seconds after a command execution, while general traffic continues reading from the read replica.

---

## 6. Gotchas & Anti-Patterns

| Anti-Pattern | Why It Fails | Mandated Correction |
|---|---|---|
| **CQRS as Default Architecture** | Multiplies boilerplate, schemas, and cognitive load 3x on simple applications (YAGNI violation). | Default to Single Model / Single Database. Graduate only on measured bottlenecks. |
| **Conflating CQRS with Event Sourcing** | Event Sourcing stores all state as event streams; CQRS only separates read and write pathways. ES adds severe schema migration complexity. | Implement CQRS with standard relational state. Only add Event Sourcing if the business requires legal/temporal audit ledgers. |
| **Leaking Entities into Queries** | Hydrating full Domain Aggregates inside Query Handlers causes severe N+1 query cascades and memory bloat. | Query Handlers must bypass entities and return flat, serializable DTOs directly from the database. |
| **Dual-Write Projections** | Emitting HTTP calls or message queue pushes directly inside mutation services causes silent sync failures. | Write events to a local `outbox` table in the same DB transaction as the aggregate state change. |
| **CRUD Queries via Aggregate Roots** | Loading an entire Aggregate Root just to read 2 fields creates unnecessary lock contention and memory footprint. | Use direct projection queries (Level 1 CQRS) for read-only flows. |
