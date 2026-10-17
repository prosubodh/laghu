# Database Design, Relational Integrity & Transactions

> **Core Mandate:** Enforce relational constraints at the database engine level (FKs, CHECKs, EXCLUDEs), the Canonical 6 Total Audit Fields, partial soft-delete indexes, ACID transactional boundaries, and the Transactional Outbox pattern.

---

## 1. Relational Integrity & Engine-Level Constraints

Data integrity must be enforced by the relational database engine, not delegated exclusively to application code:

```mermaid
flowchart TD
    App["Application Layer<br/>Validates DTOs (Zod / Pydantic / Bean Validation)"] --> DB["Database Engine (Final Arbiter of Truth)"]
    subgraph EngineRules["Engine Constraints"]
        DB --> FK["FOREIGN KEY<br/>Referential Integrity"]
        DB --> CHECK["CHECK<br/>Domain Invariants & Ranges"]
        DB --> EXCLUDE["EXCLUDE USING gist<br/>Temporal Non-Overlaps"]
        DB --> PARTIAL["Partial Unique Indexes<br/>UNIQUE ... WHERE deleted_at IS NULL"]
    end
```

### Invariants:
1. **Mandatory Foreign Keys**: Every relational association must define an explicit foreign key constraint with explicit `ON DELETE` semantics (`ON DELETE RESTRICT` or `ON DELETE CASCADE`).
2. **Domain `CHECK` Constraints**: Enforce domain value ranges at the schema level:
   ```sql
   ALTER TABLE orders ADD CONSTRAINT check_positive_amount CHECK (total_amount >= 0);
   ALTER TABLE users ADD CONSTRAINT check_valid_role CHECK (role IN ('ADMIN', 'OPERATOR', 'MEMBER'));
   ```
3. **Temporal Non-Overlap (`EXCLUDE`)**: Scheduling, booking, or reservation systems must prevent double-booking using PostgreSQL range exclusion constraints:
   ```sql
   ALTER TABLE bookings ADD CONSTRAINT no_overlapping_reservations
     EXCLUDE USING gist (room_id WITH =, reservation_period WITH &&);
   ```

---

## 2. The Canonical 6 Total Audit Fields

Every mutable stateful entity in the database must implement the **Canonical 6 Total Audit Fields** to guarantee complete traceability for compliance and security audits:

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- The Canonical 6 Total Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);
```

### Rules & Append-Only Exception:
- **Mutable Tables:** All 6 fields are mandatory. Application repositories must automatically populate `createdBy`/`updatedBy` from the ambient authenticated user context.
- **Append-Only Event / Ledger Tables:** Immutable financial ledgers, audit logs, and domain events omit `updated_at`, `updated_by`, `deleted_at`, and `deleted_by` (immutable rows are never updated or deleted).

---

## 3. Soft-Delete Invariants & Partial Unique Indexes

When implementing soft-delete (`deleted_at IS NOT NULL`):
1. **Never Use Unfiltered Unique Constraints**: A standard `UNIQUE(slug)` constraint prevents creating a new record with the same slug after deleting an old record.
2. **Mandatory Partial Unique Index**:
   ```sql
   -- Correct: Allows reusing slug after soft-deletion
   CREATE UNIQUE INDEX idx_resources_tenant_slug_active 
     ON resources (tenant_id, slug) 
     WHERE deleted_at IS NULL;
   ```
3. **Soft-Delete Query Filtering**: All read queries must filter `WHERE deleted_at IS NULL` unless explicitly requesting archived records.

---

## 4. ACID Transactions & Isolation Levels

Every operation mutating multiple database rows or coordinating interrelated aggregates must execute within an explicit **ACID Transaction**:

### Transaction Guidelines:
- **Single Aggregate Transactions**: Strive to keep transactions bounded to a single aggregate root.
- **Isolation Level Selection**:
  - `READ COMMITTED` (Default): Acceptable for standard CRUD operations.
  - `REPEATABLE READ` / `SERIALIZABLE`: Mandatory for financial ledger balances, inventory decrements, and ticket allocations where phantom reads cause double-spending.
- **Defensive Timeouts**: Transactions must never run indefinitely. Always set a defensive statement and transaction timeout:
  ```sql
  SET LOCAL statement_timeout = '5s';
  SET LOCAL idle_in_transaction_session_timeout = '10s';
  ```

---

## 5. The Transactional Outbox Pattern (Dual-Write Defense)

Never execute a database write and a message broker publish sequentially in application code. If the network fails between the two operations, the system enters an inconsistent, corrupted state (**The Dual-Write Anti-Pattern**).

```mermaid
sequenceDiagram
    autonumber
    actor Caller
    participant App as Application Service
    participant DB as PostgreSQL Database
    participant Relay as CDC Relay / Worker
    participant Broker as Message Broker (Kafka/SQS)

    Caller->>App: Execute Command
    activate App
    Note over App,DB: Atomic ACID Transaction
    App->>DB: 1. Mutate Domain State (UPDATE accounts...)
    App->>DB: 2. Insert Outbox Event (INSERT INTO outbox_events...)
    App->>DB: COMMIT
    App-->>Caller: Success Response
    deactivate App

    Note over Relay,Broker: Asynchronous Processing
    Relay->>DB: 3. Read unpublished outbox_events (CDC / Polling)
    Relay->>Broker: 4. Publish Event to Broker
    Relay->>DB: 5. Mark Event Published / Purge
```

### Outbox Invariants:
1. **Atomic Ingestion**: Domain entity mutation and event insertion must share the identical database transaction.
2. **Guaranteed At-Least-Once Delivery**: The outbox relay guarantees delivery to consumers; consumers must implement idempotency.
