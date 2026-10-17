# SOC 2 Type II & ISO 27001 Controls Reference

Mapping of technical compliance controls to concrete software verification steps.

---

## 1. Access Control (SOC 2 CC6.1 / ISO 27001 A.9)
- **Tenant Boundary Isolation**: Every database interaction must filter by the authenticated tenant ID (`where: { tenantId, ... }`). Cross-tenant access must return 403 or 404.
- **Role Immutability**: Built-in system roles (e.g. `SUPER_ADMIN`, `SYSTEM`) must reject modification or deletion with an explicit `403 Forbidden` response.
- **Session Expiry**: User access tokens must have short lifespans (15–30 minutes) stored in-memory; refresh tokens must be revoked immediately upon logout via Redis blocklist.

---

## 2. Audit Trails & Monitoring (SOC 2 CC7.2 / ISO 27001 A.12)
- **Immutable Log Storage**: All state mutations must write an audit record with:
  - `timestamp`: ISO-8601 UTC string.
  - `actorId`: User ID initiating the mutation.
  - `tenantId`: Tenant context ID.
  - `action`: e.g. `CREATE_ROLE`, `DELETE_MEMBER`, `UPDATE_PAYMENT`.
  - `entityType` & `entityId`.
  - `ipAddress` & `userAgent`.
- **Log Integrity**: Audit records must never be updated or deleted by standard application operations.

---

## 3. Cryptography & Data Protection (SOC 2 CC6.6 / ISO 27001 A.10)
- **In-Transit**: TLS 1.3 enforced on reverse proxy / ingress. Strict Transport Security (`HSTS`) header enabled with `max-age=31536000; includeSubDomains`.
- **At-Rest**: Database disks encrypted via AES-256; sensitive tokens or credentials stored as salted hashes (`argon2id` or `bcrypt`) or encrypted payloads.
