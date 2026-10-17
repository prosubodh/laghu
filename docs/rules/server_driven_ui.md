# Server-Driven UI (SDUI) & Dynamic Theming

> **Core Mandate:** Enforce metadata-driven UI rendering from declarative backend schemas, eliminating client-side tenant code forks, and inject white-label branding via W3C Design Tokens (DTCG).

---

## 1. The YAGNI Gate: Static Client Components vs. Server-Driven UI

Server-Driven UI requires building and maintaining a JSON schema specification, schema versioning, validation, and multi-platform component interpreters. **Never build a Server-Driven UI when standard client-side components and modern web deployments solve the problem.**

```mermaid
flowchart TD
    subgraph SDUIGate["Server-Driven UI YAGNI Gate"]
        B1["1. Simple Baseline (Day 1)<br/>• Standard React/JSX components styled with Tailwind CSS<br/>• Instant web deployments via continuous delivery<br/>• Zero dynamic layout interpreters or backend schema JSONs"]
        B2["2. Anti-Triggers (Forbidden)<br/>• Web-only SaaS dashboards, internal admin tools, or landing pages<br/>• Early-stage products iterating on UI layouts<br/>• Teams without multi-platform client parity requirements"]
        B3["3. The Tipping Point (Graduation)<br/>• Native mobile apps (iOS/Android) where app store review cycles delay urgent UI/flow mutations<br/>• Multi-tenant white-label products where customers dynamically construct custom form layouts<br/>• Cross-platform parity: 1 backend drives layout across Web, iOS SwiftUI, and Android Jetpack Compose"]
        B1 -->|Forbidden if web-only or early| B2
        B1 -->|Triggered by multi-platform or white-label| B3
    end
```

---

## 2. Declarative Client-Agnostic SDUI Schema

The backend provides a declarative UI layout schema describing fields, layouts, dynamic visibility rules (via Common Expression Language or JSON expressions), and allowed actions (`_actions`):

```json
{
  "view": "OrderEdit",
  "layout": "two-column",
  "sections": [
    {
      "id": "general",
      "title": "General Details",
      "components": [
        { "type": "TextInput", "id": "orderNumber", "label": "Order #", "readOnly": true },
        { "type": "TextInput", "id": "custom_attributes.poNumber", "label": "PO Number", "required": true }
      ]
    },
    {
      "id": "tax",
      "title": "Tax Exemption",
      "visibleIf": "order.custom_attributes.isTaxExempt == true",
      "components": [
        { "type": "TextInput", "id": "custom_attributes.taxExemptionId", "label": "Tax ID", "required": true }
      ]
    }
  ],
  "_actions": [
    { "action": "SUBMIT_FOR_APPROVAL", "label": "Submit Order", "method": "POST", "target": "/api/v1/orders/123/submit" }
  ]
}
```

---

## 3. Multi-Platform Component Registries

Frontend clients (Web, Mobile, Desktop) never contain hardcoded tenant branching. Each platform implements a local **Component Registry** mapping backend descriptors to native platform primitives:

- **Web Clients**: Rendered dynamically via accessible primitives (Web Components, React, Vue, Svelte, or Solid).
- **Mobile Clients**: Rendered natively via Flutter, iOS SwiftUI, or Android Jetpack Compose.
- **Desktop Clients**: Rendered natively via Tauri or cross-platform toolkits.

---

## 4. Universal Design Tokens (W3C DTCG Standard)

Manage tenant white-label branding and design systems via the **W3C Design Tokens Community Group (DTCG)** specification:

```json
{
  "color": {
    "brand": {
      "primary": { "$value": "#1e40af", "$type": "color" },
      "accent": { "$value": "#f59e0b", "$type": "color" }
    }
  },
  "dimension": {
    "radius": {
      "base": { "$value": "6px", "$type": "dimension" }
    }
  }
}
```

- **Universal Compilation**: Process tenant `tokens.json` files using **Style Dictionary** to compile dynamic themes at runtime for CSS Custom Properties (`--color-brand-primary`), Android XML / Compose, and iOS Swift tokens without code redeployments.
