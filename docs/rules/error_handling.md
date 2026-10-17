# Error Handling, Request Tracing & Schema Validation

> **Core Mandate:** Enforce fail-fast schema validation at startup, structured OpenTelemetry/JSON request tracing, standardized RFC 9457 problem details, and an explicit canonical DomainError hierarchy.

---

## 1. Fail-Fast Configuration & Environment Validation

Validate all configuration parameters and environment variables at process bootstrap using strict schema definitions before initializing servers or database connection pools:
- **Immediate Process Termination**: Halt startup immediately with non-zero exit code if any mandatory variable is missing, malformed, or insecure.
- **Strict Prohibition of Secret Fallbacks**: Never provide default fallback values for production secrets, database credentials, or private cryptographic keys.

---

## 2. Structured Tracing & Correlation (OpenTelemetry / W3C)

- **Standardized Correlation IDs**: Bind a unique `x-request-id` (UUID v4) and W3C `traceparent` to every inbound request. Forward these identifiers across all downstream RPC calls, database queries, and async broker messages.
- **Structured JSON Logging**: Format all application logs in structured JSON conforming to OpenTelemetry Resource Schemas or Elastic Common Schema (ECS) (`timestamp`, `severity`, `trace_id`, `span_id`, `request_id`, `tenant_id`, `message`).

---

## 3. Standardized Error Response Envelope (RFC 9457)

Enforce a uniform error envelope across all external HTTP/REST endpoints conforming to the **RFC 9457 Problem Details** standard.

> **Spec currency:** RFC 7807 was **obsoleted by RFC 9457** (July 2023). The wire format is unchanged — `type`/`title`/`status`/`detail`/`instance` plus the `application/problem+json` media type — so this is a citation correction, not a migration. Cite RFC 9457; do not reference RFC 7807 as a current standard.

```json
{
  "type": "https://api.domain.com/errors/RESOURCE_LOCKED",
  "title": "Resource Conflict",
  "status": 409,
  "detail": "The requested order is currently undergoing payment processing.",
  "instance": "/v1/orders/123",
  "code": "ORDER_LOCKED",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "invalidParams": []
}
```

- **Production Masking Invariant**: Strictly mask internal database error codes, raw SQL queries, file system paths, and stack traces from external client responses in non-local environments.

---

## 4. Canonical Domain Error Hierarchy & Type-Safe Narrowing

- **Canonical DomainError Hierarchy**: Model operational domain failures using an explicit `DomainError` base class with canonical subclasses:
  - `ValidationError` (maps to HTTP 400 / 422)
  - `UnauthorizedError` (maps to HTTP 401)
  - `ForbiddenError` (maps to HTTP 403)
  - `NotFoundError` (maps to HTTP 404)
  - `ConflictError` (maps to HTTP 409)
  - `ExpiredError` (maps to HTTP 410)
- **Eliminate Untyped Error Monkey-Patching**: Strictly prohibit monkey-patching arbitrary properties onto error objects at catch sites (e.g. `(err as any).statusCode = 404`). Use clean `instanceof` narrowing in HTTP error middleware to map domain errors deterministically to RFC 7807 status codes with full compiler type safety.
