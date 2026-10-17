# Enterprise Authorization, Policy-as-Code & ReBAC

> **Core Mandate:** Enforce granular Role-Based, Attribute-Based, and Relationship-Based Access Control (RBAC/ABAC/ReBAC) via Open Policy Agent (OPA), OpenFGA, or Cerbos across all API boundaries.

---

## 1. Declarative Policy-as-Code with Open Policy Agent (OPA)

Standardize on **Open Policy Agent (OPA)** and the **Rego** language for externalized, auditable policy evaluation:

```rego
package app.authz

default allow = false

# Allow tenant admin to manage all resources within their tenant
allow if {
    input.user.role == "ADMIN"
    input.user.tenant_id == input.resource.tenant_id
}

# Allow standard member to update drafts in their tenant
allow if {
    input.action == "update"
    input.resource.type == "Order"
    input.resource.status == "DRAFT"
    input.user.tenant_id == input.resource.tenant_id
}
```

### High-Performance In-Process Evaluation (OPA WebAssembly)
- In addition to running OPA as a local daemon or sidecar over HTTP/gRPC, compile Rego policies to **`.wasm`** binaries.
- Embedded OPA Wasm modules evaluate policies directly within application process memory across any language (Rust, Go, Python, Java, Node) with sub-millisecond latency and zero network roundtrips.

---

## 2. Relationship-Based Access Control (ReBAC): OpenFGA / Zanzibar

For multi-tenant organizational hierarchies, shared folders, and delegated permissions, standardize on **OpenFGA** (CNCF):

```
type user
type organization
  relations
    define admin: [user]
    define member: [user]

type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor or member from parent_org
    define parent_org: [organization]
```

Evaluated via standard gRPC/REST clients from any polyglot service:
`check(user="user:alice", relation="editor", object="document:doc-100")`

---

## 3. Server-Side Policy Enforcement Point (PEP) Guarding

- **Mandatory Enforcement**: Never rely on client-side permission checks. Every backend endpoint or command handler must verify authorization at the boundary before executing domain logic:
  ```
  decision = PolicyEngine.evaluate({
    principal: currentUser,
    action: "Order.Update",
    resource: targetOrder,
    context: { ip: request.ip, time: now() }
  })
  if (!decision.allowed) {
    return Forbidden("INSUFFICIENT_PERMISSIONS")
  }
  ```
- **Immutable System Role Invariants**: System-level roles (e.g. `OWNER`, `SECURITY_ADMIN`) must be protected by explicit policy rules preventing self-demotion or unauthorized role grants.
