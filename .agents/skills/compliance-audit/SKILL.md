---
name: compliance-audit
description: Use when conducting a security, compliance, or vulnerability audit against SOC 2 Type II, ISO/IEC 27001, or OWASP Top 10 controls using open-source scanners (Trivy, Semgrep, Gitleaks, Steampipe, Syft, Grype). Do not use for writing application business logic or routine test authoring.
---

# Compliance & Security Audit Skill (100% Open-Source)

> **Core Purpose:** Execute systematic compliance and vulnerability evaluations against SOC 2 Type II Trust Services Criteria, ISO/IEC 27001 ISMS standards, and the OWASP Top 10 using exclusively open-source security toolchains.

---

## 1. When to Use This Skill
- Preparing for or validating SOC 2 Type II readiness (access controls, tamper-evident audit logging, encryption).
- Verifying ISO/IEC 27001 Annex A technical security controls.
- Running comprehensive static analysis and vulnerability scans before a production release.
- Generating software bill of materials (SBOM) and container vulnerability reports.
- Reviewing sensitive data handling and GDPR/privacy erasure compliance.

---

## 2. Step-by-Step Audit Workflow

```
1. Secrets & Credentials ──► 2. SAST Analysis ──► 3. Dependency CVEs ──► 4. Architecture & Access ──► 5. Audit Report
```

### Step 1: Secret & Credential Scan (Open-Source)
Run open-source secret scanners to verify zero committed keys, tokens, or credentials:
```bash
# Using open-source Gitleaks
gitleaks detect --source . -v
# Using open-source Secretlint
npx secretlint "**/*"
```
*Pass Criteria:* 0 detected secrets or private keys in git history and working tree.

### Step 2: Static Application Security Testing (SAST)
Run open-source `semgrep` with security rulesets to detect injection flaws, insecure deserialization, and dangerous sinks:
```bash
semgrep --config p/security-audit --config p/owasp-top-ten .
```
*Pass Criteria:* 0 High or Critical vulnerabilities.

### Step 3: Dependency & Container Vulnerability Scan
Run open-source `trivy` and `grype` to audit lockfiles and containers for known CVEs:
```bash
# Filesystem CVE scan via Trivy
trivy fs --severity HIGH,CRITICAL --scanners vuln,misconfig .
# Generate CycloneDX SBOM via Syft
syft dir:. -o cyclonedx-json=bom.json
# Scan SBOM via Grype
grype sbom:bom.json
```
*Pass Criteria:* 0 unpatched Critical or High CVEs in production dependencies.

### Step 4: SOC 2 & ISO 27001 Control Verification
Audit architectural implementation against compliance baselines:
- **Audit Logging (CC7.2 / A.12)**: Are all state mutations logged with `{ timestamp, actorId, tenantId, action, entityType, entityId, ipAddress, userAgent, changes: { before, after } }`? Are audit logs write-only and tamper-evident?
- **Access Control & RBAC (CC6.1 / A.9)**: Are built-in roles protected against mutation (`403 Forbidden`)? Is tenant isolation enforced on every query (`tenantId` predicate)?
- **Cryptography (CC6.6 / A.10)**: Is TLS 1.3 enforced? Are passwords hashed using Argon2id or bcrypt? Is AES-256-GCM used for sensitive data at rest?
- **Data Erasure & GDPR**: Does the tenant deletion endpoint cascade purge or pseudonymize user PII across all entities?

---

## 3. Gotchas & What NOT to Do

- **DO NOT** use proprietary cloud security scanners when open-source equivalents exist (`trivy`, `semgrep`, `gitleaks`, `syft`, `grype`).
- **DO NOT** ignore medium/low secrets warnings if they indicate staging credentials or API endpoints.
- **DO NOT** pass an audit if audit logs lack the `actorId` or `tenantId`. Traceability is a mandatory SOC 2 requirement.
- **DO NOT** accept raw SQL concatenation anywhere in the codebase. All queries must be parameterized.
- **DO NOT** recommend disabling security checks or silencing scanner rules without a documented ADR exception in `memory.md`.

---

## 4. Structured Audit Output Template

```markdown
# Security & Compliance Audit Report

- **Date:** [YYYY-MM-DD]
- **Auditor:** AI Assistant (Compliance Audit Skill)
- **Frameworks Evaluated:** SOC 2 Type II, ISO/IEC 27001, OWASP Top 10

---

## 1. Executive Summary
- **Overall Status:** [PASS / CONDITIONAL PASS / FAIL]
- **Critical Issues:** [Count]
- **High Issues:** [Count]

---

## 2. Open-Source Tool Execution Evidence
| Tool | Target | Status | Findings |
|---|---|---|---|
| `gitleaks` | Git Tree | PASS | 0 secrets found |
| `semgrep` | Source Code | PASS | 0 critical SAST flaws |
| `trivy` | Dependencies | PASS | 0 high/critical CVEs |

---

## 3. Compliance Control Evaluation Matrix
| Framework | Control ID | Control Description | Status | Evidence / Notes |
|---|---|---|---|---|
| **SOC 2** | CC6.1 | Least-privilege RBAC & tenant isolation | PASS | Scoped database queries / RLS |
| **SOC 2** | CC7.2 | Tamper-evident mutation audit logging | PASS | Audit table with actor tracing |
| **ISO 27001** | A.10.1 | Cryptographic controls (AES-256, TLS 1.3) | PASS | TLS 1.3 configured, Argon2id auth |
| **OWASP** | A01 | Broken Access Control checks | PASS | Server-side guards on all routes |

---

## 4. Required Remediation Actions
1. [Action item #1 with assigned file and timeline]
```

---

## 5. Subdirectories & Progressive Resources
- [references/soc2_iso_controls.md](./references/soc2_iso_controls.md): Detailed mapping of SOC 2 Trust Services Criteria and ISO 27001 Annex A controls.
- [references/owasp_top10_controls.md](./references/owasp_top10_controls.md): OWASP Top 10 verification checklist and remediation patterns.
