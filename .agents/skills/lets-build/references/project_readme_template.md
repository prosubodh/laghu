# {{PROJECT_NAME}}

> **{{PROJECT_TAGLINE_OR_MISSION}}**

---

## 🌟 Architecture & Stack

- **Architecture:** Hexagonal (Ports & Adapters) with strict systemic atomicity and zero-downtime database patterns.
- **Language & Runtime:** {{LANGUAGE_AND_RUNTIME}}
- **Package Manager & Build:** {{PACKAGE_MANAGER_AND_BUILD_TOOL}}
- **Primary Transport:** {{TRANSPORT_PROTOCOL_AND_FRAMEWORK}}
- **Persistence Engine:** {{DATABASE_ENGINE}} (Migrations via {{MIGRATION_TOOL}})
- **Multi-Tenancy Isolation:** {{TENANCY_ISOLATION_MODEL}}
- **Dynamic Extensibility:** Common Expression Language (CEL) / JSON Schema Draft 2020-12
- **Observability:** OpenTelemetry (OTel) OTLP export over gRPC/HTTP
- **Security & DevSecOps:** Semgrep SAST, Gitleaks, Trivy scanning, CycloneDX SBOM

---

## 🗂️ Project Structure

```
.
├── specs/                            # Canonical contract specifications
│   ├── openapi/                      # OpenAPI 3.1 REST specifications
│   ├── protobuf/                     # Protocol Buffers v3 definitions
│   ├── schemas/                      # Universal JSON Schema Draft 2020-12
│   └── tokens/                       # W3C DTCG Design Tokens
├── src/                              # Hexagonal Application Source
│   ├── domain/                       # Core Invariant Domain (Entities, Value Objects)
│   ├── ports/                        # Primary (Use Cases) and Secondary (Repositories) Ports
│   └── adapters/                     # Ingress (HTTP/gRPC) and Egress (SQL/Broker) Adapters
├── tests/
│   ├── unit/                         # Fast unit tests using test doubles
│   ├── integration/                  # Adapter tests with transactional rollback
│   ├── contracts/                    # Consumer contract tests (Pact)
│   └── acceptance/                   # BDD Gherkin / Cucumber features
├── deploy/                           # OCI Distroless Dockerfiles & Compose manifests
├── docs/rules/                       # 28 cohesive single-responsibility architectural rules
├── memory.md                         # Master memory hub & Lightweight ADR ledger
└── AGENTS.md                         # Lean agentic directives (< 120 lines)
```

---

## ⚡ Quickstart & Development

### 1. Prerequisites
- {{PREREQUISITES_LIST}}
- Docker & Docker Compose

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
{{INSTALL_COMMAND}}
```

### 4. Run Development Environment
```bash
{{DEV_RUN_COMMAND}}
```

### 5. Run Tests & Verification
```bash
{{TEST_COMMAND}}
```

---

## 🏛️ Architecture Governance & Decisions

This project is governed by the **28 Cohesive Domain Rules** located in `docs/rules/` and Architectural Decision Records in `memory.md`:
- **ADR Ledger:** See `memory.md` for project-specific Architectural Decision Records.
- **Architectural Rules:** See `docs/rules/` for TDD, Clean Code, Multi-Tenancy, Database Design, and DevSecOps directives.
