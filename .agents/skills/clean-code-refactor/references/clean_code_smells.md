# Code Smells & Refactoring Cures Reference

Catalog of common code smells and their remedies in modern TypeScript codebases.

---

## 1. Bloated Functions (> 25–30 Lines)
- **Smell**: A single function performs input parsing, business calculation, database persistence, and response formatting.
- **Cure**: Apply *Extract Function* and *Single Level of Abstraction (SLAP)*. Group lower-level details into descriptive helper functions.

---

## 2. Deep Conditional Nesting (Arrow Anti-Pattern)
- **Smell**: 3+ levels of nested `if / else` blocks checking permissions, status, and input validity.
- **Cure**: Apply *Guard Clauses* (Return Early) or the *Strategy Pattern* for polymorphic behavior.

---

## 3. Direct 3rd-Party Coupling
- **Smell**: Domain controllers directly importing external SDKs (e.g. `import Stripe from 'stripe'`).
- **Cure**: Apply the *Adapter Pattern*. Define an interface `IPaymentGateway` owned by the domain. Create an infrastructure adapter implementing the interface.

---

## 4. Primitive Obsession & Long Parameter Lists (> 3 Parameters)
- **Smell**: Methods taking 6 primitive strings and numbers (`createUser(first, last, email, role, phone, tenantId)`).
- **Cure**: Bundle related fields into a strongly typed DTO or Zod schema (`CreateUserInput`).
