# Cloud-Native 12-Factor Standards (2026 Edition)

> **Core Mandate:** Enforce stateless isolates, OpenTelemetry (OTel) observability, API-first design, fast startup, and graceful disposal on SIGTERM across all execution runtimes.

---

## 1. Stateless Isolates & Shared-Nothing

- Application processes must be strictly stateless and share nothing.
- Any persistent state must reside in external, managed backing services (relational databases, document stores, distributed caches, object storage).
- User sessions and conversational state must never be held in local process memory.

---

## 2. OpenTelemetry (OTel) Standardization

- Standardize exclusively on open-source **OpenTelemetry** across all language runtimes.
- Export traces, metrics, and logs in vendor-neutral **OTLP (OpenTelemetry Protocol)** format over gRPC (port 4317) or HTTP (port 4318) to an OpenTelemetry Collector.
- Propagate distributed trace context across service boundaries using standard W3C `traceparent` and `tracestate` headers.

---

## 3. Disposability & Graceful Shutdown

All application processes and containers must handle graceful termination:
- Trap operating system `SIGTERM` and `SIGINT` signals.
- Cease accepting new inbound HTTP/gRPC requests immediately upon signal receipt.
- Drain active, in-flight connections within a bounded timeout window (e.g. 10 seconds).
- Gracefully flush telemetry buffers, terminate background workers, and close database/cache connection pools cleanly before exiting with code 0:

```mermaid
flowchart TD
    subgraph GracefulShutdown["Graceful Shutdown Flow (Universal / Agnostic)"]
        Sig["onSignal (SIGTERM | SIGINT)"] --> S1["1. Set health check probe to UNHEALTHY (drain LB)"]
        S1 --> S2["2. Stop server listening for new connections"]
        S2 --> S3["3. Wait for in-flight requests (timeout: 10s)"]
        S3 --> S4["4. Close database and cache connection pools"]
        S4 --> S5["5. Flush OpenTelemetry trace & log buffers"]
        S5 --> S6["6. Terminate process with exit code 0"]
    end
```
