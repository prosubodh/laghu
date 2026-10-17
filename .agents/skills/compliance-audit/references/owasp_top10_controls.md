# OWASP Top 10 Verification Reference

Verification guidelines for evaluating codebase resistance against the OWASP Top 10 vulnerabilities.

| Vulnerability | Verification Target | Required Implementation Pattern |
|---|---|---|
| **A01: Broken Access Control** | Controllers, Route Guards | Server-side role and tenant checks on every endpoint. No client-only route security. |
| **A02: Cryptographic Failures** | Config, Auth Services | TLS 1.3, Argon2id/Bcrypt for passwords, AES-256-GCM for sensitive fields. No custom hashing. |
| **A03: Injection** | Database queries, OS calls | Parameterized Prisma queries; prohibit string template concatenation in SQL; avoid `child_process.exec`. |
| **A04: Insecure Design** | Architectural Flows | Rate-limiting on public/auth routes via Redis; defense-in-depth threat modeling. |
| **A05: Security Misconfig** | HTTP Headers, Errors | Helmet headers (`CSP`, `HSTS`, `nosniff`); mask stack traces via Standard Error Envelope. |
| **A06: Vulnerable Components** | Dependencies | Zero high/critical CVEs in `npm audit` / `trivy fs .`; lockfiles committed and verified. |
| **A07: Auth Failures** | Auth Controller, JWT | In-memory access tokens, HttpOnly refresh cookies, instant Redis JTI blocklisting. |
| **A08: Software Integrity** | CI/CD, Dependencies | Lockfile SHA-512 hashes enforced; open-source `cosign` container signing. |
| **A09: Logging Failures** | Logging, Middleware | Structured JSON logs (`pino`) with `x-request-id`; zero credentials or PII in logs. |
| **A10: SSRF** | Outbound HTTP Clients | Block outbound requests to internal/private IPs (`127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`). |
