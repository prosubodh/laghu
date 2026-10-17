# Enterprise Authentication, Token Rotation & WebAuthn

> **Core Mandate:** Enforce in-memory short-lived access tokens, cryptographic Refresh Token Rotation (RTR) with family revocation on replay detection, FIDO2/WebAuthn passkeys, and OIDC federation.

---

## 1. Token Lifecycles & Cryptographic Refresh Token Rotation (RTR)

- **Access Tokens**: Short-lived (max 15 minutes), held strictly in volatile application memory or client memory (never persisted in unencrypted browser storage). Standardize on **PASETO** (Platform-Agnostic Security Tokens) or **RFC 7519 JWT** with asymmetric RSA/EdDSA keys published via `/.well-known/jwks.json`.
- **Refresh Tokens**: Stored strictly in `HttpOnly`, `Secure`, `SameSite=Strict` cookies or encrypted OS keyrings.
- **Cryptographic Rotation & Replay Detection Protocol**:
  - Persist only cryptographically salted hashes (e.g. SHA-256 / Argon2id) of refresh tokens in storage.
  - Group tokens by `family_id` across rotation cycles.
  - If an expired or already-consumed token in a family is presented (replay attack), **immediately invalidate the entire token family**, terminate active sessions, and emit a high-priority security alert.

---

## 2. FIDO2 / WebAuthn Passkeys & Multi-Factor Authentication

- **FIDO2 / WebAuthn Standard**: Support hardware security keys (YubiKey, Apple Touch ID/Face ID, Windows Hello) conforming to the W3C WebAuthn Level 3 specification.
- **Server Cryptographic Verification**: Validate hardware-signed cryptographic challenges against stored credential public keys using language-native WebAuthn verifier ports.
- **Time-Based One-Time Passwords (TOTP)**: Implement RFC 6238 compliant TOTP verification as an alternative MFA factor.

---

## 3. Enterprise Identity Federation & Workload Identity

- **OIDC & OAuth 2.1**: Standardize on OpenID Connect 1.0 Authorization Code Flow with PKCE for enterprise single sign-on (SSO) with Okta, Azure AD, Keycloak, or Google Workspace.
- **SCIM 2.0 Provisioning**: Implement RFC 7644 SCIM endpoints for automated tenant user synchronization and lifecycle de-provisioning.
- **Service-to-Service Workload Identity**: Utilize **SPIFFE / SPIRE** for zero-trust mutual TLS (mTLS) cryptographic attestation between polyglot microservices.

---

## 4. Frontend Authentication Architecture & Production UX

- **Dedicated Auth Experience**:
  - Provide a clean, focused, professional sign-in interface (dedicated `/login` route or unpolluted modal) with zero clutter.
  - Require formal Zod schema validation on submit and blur using React Hook Form.
  - Enforce accessible error messaging using ARIA live regions (`role="alert"` / `aria-live="assertive"`).
  - Include "Remember me" session persistence and "Forgot password?" recovery options.
  - Provide a separate, dedicated registration flow (`/register`) with tenant organization initialization.
- **Post-Login Role-Based Redirection Matrix**:
  - Authentication must evaluate the user's primary active role and immediately redirect to their tailored domain experience:
    - `ADMIN`, `OPERATOR`, `MANAGER` ➔ `/` (Operator Executive Dashboard).
    - `MEMBER`, `CONSUMER` ➔ `/portal` (Self-Service Consumer Portal).
    - `PROSPECT`, `GUEST` ➔ `/catalog` or `/onboarding`.
- **Session State & Token Management**:
  - Store short-lived access tokens strictly in memory within the frontend application context.
  - Automatically refresh tokens in the background via `POST /api/v1/auth/refresh` using HttpOnly refresh cookies.
  - On application mount, restore session state and memberships gracefully without flashing unauthenticated screens or crashing.
- **Declarative Route & Role Guards**:
  - Wrap protected views in `<ProtectedRoute requiredRoles={[...]} fallbackUrl="...">`.
  - Unauthenticated access redirects to `/login?returnTo=<current_url>`.
  - Unauthorized access renders an accessible 403 Forbidden view with a "Return to My Dashboard" CTA.

---

## 5. Strict Decoupling of Developer Demo Personas from Production Authentication

- **The Toy Prototype Anti-Pattern**: Embedding test personas ("Admin Alice", "Operator Bob", "Member Charlie") directly inside user-facing login forms or modals severely compromises application credibility and confuses real users.
- **Mandatory Isolation**:
  - Developer demo personas must be **100% decoupled** from production authentication.
  - Demo personas must exist exclusively in a dedicated **Development Test Harness** (`<DevPersonaSwitcher />` or floating dev toolbar) rendered conditionally:
    ```tsx
    // Rendered ONLY in local development or preview environments
    if (import.meta.env.DEV) {
      return <DevPersonaToolbar />;
    }
    ```
  - The Dev Toolbar must be explicitly badge-labeled: `[DEV / TEST HARNESS: Switch Role]`.
  - When switching personas, the harness must:
    1. Clear stale TanStack Query caches to prevent data cross-contamination.
    2. Authenticate the selected demo persona and update auth context.
    3. Trigger role-appropriate navigation (e.g. switching to Member navigates to `/portal`; switching to Operator navigates to `/`).
- **Zero Production Leaks**: In production builds (`import.meta.env.PROD`), the developer persona switcher must be tree-shaken and completely stripped from the bundle.

