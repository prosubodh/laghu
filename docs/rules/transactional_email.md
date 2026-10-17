# Transactional Email Subsystem

> **Core Mandate:** Enforce declarative email templates, strict HTML sanitization, decoupled asynchronous dispatch, and deterministic local test delivery through Mailpit SMTP routing.

---

## 1. Declarative & Typed Email Templates

- **Declarative Template Definition**: Author transactional email templates using language-agnostic markup formats (such as **MJML - Mailjet Markup Language**) or typed component schemas to ensure cross-client rendering consistency across Outlook, Gmail, and Apple Mail.
- **Strict HTML Sanitization & Injection Defense**: Strictly prohibit unescaped raw HTML string concatenation. Centralize variable interpolation through a strict escaping utility neutralizing `&`, `<`, `>`, `"`, and `'` to prevent Cross-Site Scripting (XSS) and template injection vulnerabilities.

---

## 2. Decoupled Transport & Background Queues

- **Async Queue Decoupling**: Decouple notification delivery from synchronous HTTP request-response cycles via an asynchronous job queue (e.g. BullMQ, Celery, or Transactional Outbox workers). API responses must never block on external network SMTP socket round-trips.
- **Zero-Dependency Native Sockets**: Prefer socket-based SMTP adapters adhering to RFC 5321 commands over heavy third-party mailer libraries to eliminate supply chain risks and transitive dependencies.

---

## 3. Local Mail Transport & Integration Verification

- **Local SMTP via Mailpit**:
  - Route local and CI SMTP traffic to **Mailpit** (SMTP port 1025 / Web UI port 8025).
  - Never route emails to public mail transfer agents (MTAs) or external API gateways during automated test runs or local development.
- **Deterministic API Assertion Protocol**:
  - Assert email delivery in integration tests by querying Mailpit's REST API (`GET /api/v1/messages`) or testing against in-memory notification sinks to inspect recipient headers, delivery status, HTML body content, and verification links without timing dependencies.
