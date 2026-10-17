# Application Security, Cryptography & Regulatory Compliance

> **Core Mandate:** Enforce OWASP Top 10 security defenses, cryptographic rigor, token bucket rate limiting, SOC 2 Type II security controls, ISO/IEC 27001 standards, and GDPR data erasure rights.

---

## 1. OWASP Top 10 Application Security Defenses

Production software must systematically eliminate OWASP Top 10 attack vectors:

1. **Injection Defense (SQL / Command / LDAP)**:
   - Always use parameterized queries and prepared statements. Never concatenate untrusted strings into database queries or shell command strings.
2. **Cross-Site Scripting (XSS)**:
   - Standardize on modern framework auto-escaping (React, Vue, Svelte). Strictly forbid `dangerouslySetInnerHTML` or `v-html` unless sanitized by a verified sanitizer (e.g. DOMPurify).
3. **Server-Side Request Forgery (SSRF)**:
   - When fetching URLs provided by users, validate hostnames against an explicit domain allowlist. Never make outbound requests to private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) or cloud metadata endpoints (`169.254.169.254`).
4. **Security Misconfiguration & Headers**:
   - Enforce secure HTTP response headers:
     ```http
     Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
     X-Content-Type-Options: nosniff
     X-Frame-Options: DENY
     Content-Security-Policy: default-src 'self'; script-src 'self';
     ```

---

## 2. Cryptographic Standards & Rate Limiting

### Cryptographic Rigor
- **Password Hashing**: Use **Argon2id** (minimum 64MB memory, 3 iterations) or **bcrypt** (work factor $\ge 12$). Never use SHA-256, SHA-1, or MD5 for password storage.
- **Data Encryption at Rest**: Encrypt sensitive PII, access tokens, and secrets using **AES-256-GCM** or **ChaCha20-Poly1305** with authenticated encryption.
- **Data in Transit**: Mandate **TLS 1.3** across all external and internal microservice communication.

### Distributed Rate Limiting
Protect APIs against brute force, scraping, and denial-of-service (DoS) attacks using a distributed Token Bucket or Leaky Bucket algorithm backed by Redis:
- **Authentication Endpoints (`/login`, `/signup`)**: Strict limit of 5 requests per minute per IP.
- **Public API Endpoints**: Default limit of 100 requests per minute per IP/API token.
- **Response Headers**: Return RFC 6585 headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `429 Too Many Requests` when exceeded.

---

## 3. Regulatory Compliance: SOC 2, ISO 27001 & GDPR

All systems handling sensitive, customer, or enterprise data must satisfy fundamental compliance controls:

1. **Immutable Audit Trails (SOC 2 CC6.8 / ISO 27001 A.12.4)**:
   - All state mutations, privilege changes, and authentication events must write to an immutable audit log recording: `timestamp`, `actorId`, `tenantId`, `action`, `resourceId`, `clientIp`, and `userAgent`.
   - Audit logs must be retained in append-only storage and protected from tampering or deletion.
2. **GDPR Data Erasure Rights (Article 17 "Right to be Forgotten")**:
   - Systems must provide an automated data erasure pipeline capable of permanently deleting or cryptographically pseudonymizing user PII across all databases and backups within 30 days of a verified request.
3. **Least Privilege Access (SOC 2 CC6.1)**:
   - Developers and runtime services must operate under strict principle of least privilege. Production database credentials and encryption keys must never be accessible in local development environments.
