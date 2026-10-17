# Hexagonal Bootstrap Scaffolds & Templates

> **Core Purpose:** Standardized directory trees and foundational templates for bootstrapping projects across any language following the Hexagonal (Ports & Adapters) architecture.

---

## 1. Universal Directory Topology

Depending on whether the project target is a **Fullstack Web SaaS** (Frontend + Backend) or a **Headless Service** (API only), projects follow these standard layouts:

### Fullstack Web SaaS Topology (Web Frontend + Hexagonal Backend)
```
<project-root>/
├── .agents/skills/                   # Specialized agentic workflows (carried from azcodr template)
├── docs/
│   ├── knowledge/                    # Domain knowledge & living ubiquitous language glossary
│   └── rules/                        # 28 cohesive single-responsibility domain rules
├── specs/                            # Canonical contract specifications
│   ├── openapi/                      # OpenAPI 3.1 REST specifications (*.yaml)
│   ├── schemas/                      # Universal JSON Schema Draft 2020-12 (*.json)
│   └── tokens/                       # W3C DTCG Design Tokens (tokens.json)
├── client/                           # Web Frontend Application (Vite + React / SPA)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/               # Persistent Shell (Sidebar, Header, Breadcrumbs)
│   │   │   └── ui/                   # Accessible Headless Primitives (Radix / shadcn)
│   │   ├── pages/                    # Dynamic Canvas Route Views
│   │   ├── hooks/                    # Server-State Cache & URL State Synchronization
│   │   └── services/                 # Inbound API Client Adapters
│   └── public/                       # Static web assets
├── src/                              # Backend Application (Hexagonal Architecture)
│   ├── domain/                       # Core Invariant Domain (Entities, Value Objects, Invariants)
│   ├── ports/                        # Primary (driving) and Secondary (driven) Ports
│   │   ├── primary/                  # Inbound Use Cases, Commands, and Queries
│   │   └── secondary/                # Outbound Repositories, Caches, Event Brokers
│   └── adapters/                     # Concrete Polyglot Implementations
│       ├── primary/                  # HTTP controllers, gRPC handlers, CLI commands
│       └── secondary/                # SQL/NoSQL repositories, Redis caches, Kafka brokers
├── tests/
│   ├── unit/                         # Fast unit tests using test doubles
│   ├── integration/                  # Adapter integration tests with transactional rollback
│   ├── contracts/                    # Pact / OpenAPI contract verification
│   ├── client/                       # Frontend component and interaction tests
│   └── acceptance/                   # BDD Gherkin / Cucumber end-to-end features
├── deploy/                           # Deployment & Infrastructure as Code
│   ├── docker/                       # Minimal OCI Distroless/Scratch Dockerfiles
│   ├── compose/                      # Docker Compose multi-service topologies
│   └── k8s/                          # Kubernetes manifests or OpenTofu / Crossplane
├── AGENTS.md                         # Authoritative lean root directives (< 120 lines)
├── CLAUDE.md -> AGENTS.md            # Symlink for harness parity
├── agents.md -> AGENTS.md            # Symlink for harness parity
├── memory.md                         # Master memory hub & Lightweight ADR ledger
└── README.md                         # Project documentation
```

### Headless Service Topology (Backend API Only)
```
<project-root>/
├── .agents/skills/                   # Specialized agentic workflows
├── docs/                             # Domain knowledge & 28 domain rules
├── specs/                            # OpenAPI 3.1 & Schema contracts
├── src/                              # Domain, Ports, Adapters
├── tests/                            # Unit, Integration, Contracts, Acceptance
├── deploy/                           # Docker, Compose
├── AGENTS.md
└── memory.md
```

---

## 2. Language-Specific Source Layouts

### TypeScript Fullstack Scaffold (`client/` + `src/` via `package.json` / `pnpm`)
```
client/                               # Web Frontend (Vite + React / Vue / Svelte)
├── src/
│   ├── components/
│   │   ├── layout/                   # Persistent App Shell (Header, Collapsible Sidebar)
│   │   └── ui/                       # Accessible Headless Primitives (Radix / shadcn)
│   ├── pages/                        # Dynamic Canvas Route Views
│   ├── hooks/                        # Server-State Cache & URL State Synchronization
│   └── services/                     # Inbound API Client Adapters
└── public/
src/                                  # Core Backend (Hexagonal Ports & Adapters)
├── domain/
│   ├── entities/user.ts
│   └── value-objects/tenant-id.ts
├── ports/
│   ├── primary/create-user.usecase.ts
│   └── secondary/user-repository.port.ts
└── adapters/
    ├── primary/fastify-router.ts
    └── secondary/kysely-user-repository.ts
```

### Go Scaffold (`go.mod`)
```
src/
├── domain/
│   ├── entity/user.go
│   └── valueobject/tenant_id.go
├── ports/
│   ├── in/create_user_usecase.go
│   └── out/user_repository_port.go
└── adapters/
    ├── in/http/user_handler.go
    └── out/sql/pgx_user_repository.go
```

### Rust Scaffold (`Cargo.toml`)
```
src/
├── domain/
│   ├── entities/user.rs
│   └── value_objects/tenant_id.rs
├── ports/
│   ├── primary/create_user.rs
│   └── secondary/user_repository.rs
└── adapters/
    ├── primary/axum_handler.rs
    └── secondary/sqlx_repository.rs
```

### Python Scaffold (`pyproject.toml` / `uv`)
```
src/
├── domain/
│   ├── entities/user.py
│   └── value_objects/tenant_id.py
├── ports/
│   ├── primary/create_user_usecase.py
│   └── secondary/user_repository_port.py
└── adapters/
    ├── primary/fastapi_router.py
    └── secondary/asyncpg_repository.py
```

### TypeScript Backend-Only Scaffold (`package.json` / `pnpm`)
```
src/
├── domain/
│   ├── entities/user.ts
│   └── value-objects/tenant-id.ts
├── ports/
│   ├── primary/create-user.usecase.ts
│   └── secondary/user-repository.port.ts
└── adapters/
    ├── primary/fastify-router.ts
    └── secondary/kysely-user-repository.ts
```

---

## 3. Foundational Scaffold Invariants

1. **Domain Isolation**: Code in `src/domain/` must have **zero imports** from `src/adapters/`, `client/`, external web frameworks, or database drivers.
2. **Ports as Pure Contracts**: Code in `src/ports/` contains abstract interfaces, Command DTOs, Query DTOs, and Result containers.
3. **Adapters Depend on Ports**: `src/adapters/` implements ports defined in `src/ports/`. Adapters never depend directly on other adapters.
4. **Contract-First Synchronization**: Whenever an API or event interface changes, the canonical contract in `specs/` must be updated and validated before adapter code is generated or modified.
5. **Frontend Decoupling via Contract**: The frontend in `client/` consumes backend driving ports strictly via canonical OpenAPI contracts (`specs/openapi`) and W3C Design Tokens (`specs/tokens/tokens.json`). It follows the 7-Pillar Design Architecture Triage Gate ([docs/rules/ui_ux_architecture.md](../../../../docs/rules/ui_ux_architecture.md)) and accessible headless primitives ([docs/rules/frontend_architecture.md](../../../../docs/rules/frontend_architecture.md)).
