# Problem-First Architecture Interview Matrix

> **Core Philosophy:** Software architecture must be derived from problem constraints, domain invariants, and execution targets—never from preemptive tool selection. Tools, runtimes, and databases are emergent outputs of the Problem Space.

---

## Tier 1: Problem Space Definition & System Topology

### Dimension 1: The Core Problem & Domain Essence
- **Problem Statement:** What real-world problem or capability does this system address? What data moves, and what transformations occur?
- **Domain Invariants:** What core business, legal, mathematical, or physical rules must never be violated?
- **Domain Subdivisions:** Identify subdomains:
  - *Core Subdomain:* The unique differentiator (e.g. proprietary physics simulation, smart filter inversion, bidding algorithm).
  - *Supporting Subdomain:* Necessary domain-specific capabilities (e.g. user preferences, level editor).
  - *Generic Subdomain:* Solved industry utilities (e.g. authentication, logging).

### Dimension 2: System Topology Classification
Classify the system into its primary operational topology:
1. **Topology A — Web SaaS / Cloud Applications:** Network-facing systems with multi-tenant data persistence, ranging from Fullstack Web Applications (API Backend + Web Frontend) to Headless Microservices (API-only).
2. **Topology B — Browser Extension:** Client-side sandboxed extension (Chrome/Firefox MV3) orchestrating content scripts, background service workers, and popup UI.
3. **Topology C — Game Engine / High-Performance Simulator:** Low-level, frame-budgeted application directly interfacing with GPU APIs (Vulkan, DirectX, Metal) and system memory.
4. **Topology D — Browser / Canvas Game:** Sandboxed web game running inside the browser DOM/Canvas via Canvas2D, WebGL, or WebGPU.
5. **Topology E — Desktop Application / CLI Utility:** Standalone OS binary (POSIX/Windows) executed locally via terminal arguments or native desktop UI.
6. **Topology F — Systems / Embedded / Cryptographic Library:** Headless shared library or crate compiled for specific hardware targets or WASM runtimes.

---

## Tier 2: Physical & Operational Constraints

### Dimension 3: Latency & Time Budgets
- **Hard Real-Time:** Frame budget enforced (e.g. 16.6ms for 60 FPS, 6.94ms for 144 FPS). Any jitter causes dropped frames.
- **Interactive Low-Latency:** Sub-10ms response for user inputs (e.g. keystrokes in a code editor, real-time audio DSP).
- **Service Request-Response:** Soft latency (e.g. p99 < 200ms for web APIs; p95 < 50ms for internal RPC).
- **Asynchronous / Batch:** Throughput-optimized batch or event stream processing (seconds to minutes).

### Dimension 4: Memory Management & Garbage Collection Tolerance
- **Zero GC Pause Tolerance:** Latency spikes or unpredictable GC pauses are unacceptable. Demands deterministic, manual, or compile-time memory management (C, C++, Rust, Zig).
- **High-Throughput Managed GC:** GC pauses (< 10ms) are completely imperceptible within network I/O latency. Managed runtimes maximize developer velocity (Go, Java 21+ with Loom, C# .NET 9).
- **Single-Threaded Event Loop:** JavaScript / TypeScript runtime in browser sandbox or Node/Bun.

### Dimension 5: Concurrency & Execution Topology
- **Single-Threaded Cooperative:** Event loop with non-blocking async I/O (browser JS, Node.js).
- **Multi-Threaded Work-Stealing:** Parallel pipelines across CPU cores (physics, rendering, audio) requiring data-race safety.
- **Data-Parallel / SIMD:** Vectorized computation over contiguous arrays or GPU compute shaders.
- **Distributed Shared-Nothing:** Clustered actor nodes or horizontal stateless containers.

### Dimension 6: Persistence & Connectivity Demands
- **Zero Persistence:** In-memory state only (e.g. real-time canvas game, transient CLI filter).
- **Local Embedded / Flat Storage:** Local binary files, JSON configuration, or embedded SQLite.
- **Client-Side Platform Storage:** Browser `chrome.storage.local` / `sync`, `localStorage`, or IndexedDB.
- **Enterprise Relational / Document RDBMS:** PostgreSQL, MySQL, MongoDB, CockroachDB with ACID transactions.
- **Network Interface:** Pure local IPC/pipes (zero network), WebSockets, UDP packets, or HTTP/REST/gRPC.

---

## Tier 3: Architectural Style Derivation (Topology Alignment)

Match the architectural style strictly to the system topology:

| Topology | Mandatory Architectural Style | Rationale | Anti-Pattern to Ban |
|---|---|---|---|
| **Web SaaS / Backend** | **Hexagonal (Ports & Adapters) / Clean** | Decouples business rules from databases, HTTP frameworks, and external APIs. | Fat controllers with inline SQL; leaky abstractions. |
| **Browser Extension** | **Platform Scripting Architecture** | Direct, lean coordination of `background`, `content`, `popup`, and browser storage APIs. | Forcing Hexagonal ports, use-case classes, or `/healthz` probes. |
| **Game Engine** | **Data-Oriented Design (DOD / ECS)** | Cache-friendly contiguous memory layout (dense component arrays) for SIMD vectorization. | Deep OOP inheritance hierarchies; GC-managed wrappers. |
| **Canvas Game** | **Game Loop Architecture** | Structured `Input ➔ Update ➔ Render` loop driven by `requestAnimationFrame`. | Enterprise repository and layered CRUD ceremony. |
| **Desktop CLI** | **Command Pipeline Architecture** | Streamlined `Arg Parser ➔ Command Handler ➔ Stream I/O`. | Embedding REST servers, microservices, or Docker containers. |

---

## Tier 4: Emergent Toolchain & Language Derivation

Derive the programming language, runtime, and package manager strictly from the constraints established above:

| Language Profile | Optimal Fit | Primary Trade-Off |
|---|---|---|
| **C (C99 / C11)** | Game engines, embedded systems, OS kernels. | Raw pointer control, instant compile times; manual memory management. |
| **Rust** | Game engines, code editors, CLI tools, systems services. | Zero GC, compile-time memory safety, fearless concurrency; steeper learning curve, slower builds. |
| **TypeScript / JS** | Browser extensions, canvas games, web frontends, fullstack apps. | Instant browser compatibility, rich UI ecosystem; single-threaded event loop, runtime typing. |
| **Go** | Cloud microservices, CLI tools, network proxies. | Fast startup, simple concurrency (goroutines); basic GC, limited generics. |
| **Java 21+ / C# (.NET 9)** | Enterprise transaction platforms, high-throughput microservices. | Massive enterprise ecosystem, virtual threads; higher memory footprint. |
| **Python** | Data analysis, ML pipelines, quick automation scripts. | Expressive syntax, unmatched ML libraries; slower execution, GIL constraints. |

---

## Tier 5: Targeted Invariants (Strictly Topology-Scoped, 100% YAGNI)

Inquire *only* into the dimensions relevant to the selected topology. **Never ask non-backend projects about databases, containers, or API versioning!**

### For Web SaaS & Enterprise Cloud Applications ONLY:
- **Application Interface Scope:** Headless API service (no UI) vs Fullstack Web Application (API Backend + Web Frontend Client).
- **Frontend UI Stack (If Fullstack Web Application):**
  - **Framework & Runtime:** React + Vite, Vue 3, Svelte 5, Next.js.
  - **Component Primitives & Styling:** Tailwind CSS + Accessible Headless Primitives (Radix UI / shadcn/ui) per [docs/rules/frontend_architecture.md](../../../../docs/rules/frontend_architecture.md).
  - **Client Structure:** Paired Client (`client/` + `src/` backend) vs Monorepo (`apps/web` + `apps/api`).
  - **Design Triage & App Shell:** Persistent App Shell (collapsible sidebar, global header) vs Dynamic Canvas per [docs/rules/ui_ux_architecture.md](../../../../docs/rules/ui_ux_architecture.md).
- **API Protocols:** REST (OpenAPI 3.1) vs gRPC (Protobuf v3 via Buf) vs GraphQL.
- **Database Migrations:** Declarative (Atlas) vs Versioned SQL (Flyway, Goose).
- **Multi-Tenancy Isolation:** AST Query Interceptor vs Database RLS vs Schema-per-tenant.
- **Authentication & AuthZ:** OIDC, OAuth 2.1, PASETO, OPA Rego, or OpenFGA ReBAC.
- **Container Infrastructure:** Minimal Distroless/Scratch OCI containers and Docker Compose.

### For Browser Extensions ONLY:
- **Manifest Version:** Chrome/Firefox Manifest V3.
- **Script Isolation & Bundling:** Self-contained IIFE for content scripts (zero external ES module chunk imports).
- **State Synchronization:** `chrome.storage.sync` with local fallback and unidirectional event application.
- **Permissions:** Principle of least privilege for `manifest.json`.

### For Game Engines & High-Performance Simulators ONLY:
- **Graphics Backend:** Native Vulkan, DirectX 12, Metal, or portable `wgpu`.
- **Memory Allocation Strategy:** Linear allocators, frame allocators, arena allocators, or pool allocators.
- **Entity Model:** Archetype ECS (e.g. `bevy_ecs`, `hecs`, `EnTT`) vs dense component arrays.

### For Desktop CLIs ONLY:
- **CLI Framework:** Zero-dependency argument parser vs battle-tested CLI library (e.g. `clap` for Rust, `cobra` for Go).
- **I/O Protocols:** Standard POSIX streams (`stdin`, `stdout`, `stderr`), exit codes (0 for success, non-zero for error), JSON output flags (`--json`).
