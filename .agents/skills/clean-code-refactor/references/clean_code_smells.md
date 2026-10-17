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
- **Cure**: Bundle related fields into a strongly typed DTO, Value Object, or Zod schema (`CreateUserInput`).

---

## 5. Flag Arguments (Boolean Control Parameters)
- **Smell**: Functions taking boolean parameters to alter internal flow (e.g. `renderUser(user, true)` vs `renderUser(user, false)`).
- **Cure**: Flag arguments prove the function violates Single Responsibility by doing two different things. Split into two clear, intention-revealing functions (`renderAdminUser(user)` and `renderStandardUser(user)`).

---

## 6. Train Wrecks & Inappropriate Intimacy (Law of Demeter)
- **Smell**: Long chaining of method calls traversing object relationships (e.g. `order.getCustomer().getAddress().getZipCode().validate()`).
- **Cure**: Apply the Law of Demeter ("talk only to immediate friends") and *Tell, Don't Ask*. Delegate the operation to the containing entity: `order.validateDeliveryZipCode()`.

---

## 7. Feature Envy & Misplaced Responsibility
- **Smell**: A method in Class A spends more time accessing data from Class B than its own data (e.g. calculating tax by fetching 5 fields from `OrderLine`).
- **Cure**: Move the method to Class B where the data naturally lives, encapsulating behavior together with state.

---

## 8. Dead Code & Speculative Generality
- **Smell**: Unused parameters, unreachable methods, commented-out code blocks, or generic abstractions built for hypothetical future needs.
- **Cure**: Delete ruthlessly. Version control preserves history; speculative code adds mental overhead, maintenance cost, and false test coverage targets.

---

## 9. Floating-Point Currency Representation
- **Smell**: Using standard floating-point numbers (`number`, `float`, `double`) to represent monetary sums or billing amounts.
- **Cure**: Wrap currency into a dedicated `Money` Value Object storing amounts as integer minor units (e.g. integer cents) or using an arbitrary-precision library to prevent rounding errors.

---

## 10. Null Propagation & Sentinel Error Codes
- **Smell**: Functions returning `null`, `-1`, or `false` to signal failure or missing values, forcing every caller to write boilerplate null checks.
- **Cure**: Return an explicit `Result<T, E>` (for errors), `Option<T>` (for absence), or use the Null Object Pattern to provide safe default polymorphic behavior.

---

## 11. Shotgun Surgery (Martin Fowler - *Refactoring*)
- **Smell**: Making a single logical change requires touching small, scattered pieces of code across 5–10 different files or classes.
- **Cure**: Apply *Move Function* and *Move Field* to consolidate related logic into a single cohesive module or bounded context.

---

## 12. Divergent Change (Martin Fowler - *Refactoring*)
- **Smell**: A single class or module is frequently modified for multiple unrelated business reasons (e.g. changing database schemas AND changing financial calculation algorithms in the same file).
- **Cure**: Apply *Split Phase* and *Extract Class* to ensure each class has one, and only one, reason to change (Single Responsibility Principle).

---

## 13. Data Clumps (Martin Fowler - *Refactoring*)
- **Smell**: The exact same 3–4 primitive fields repeatedly appear together across parameters or data structures (e.g. `startDate`, `endDate`, `timezone`).
- **Cure**: Apply *Extract Class* or *Introduce Parameter Object* to transform the data clump into a unified, self-validating Value Object (`DateRange`).

---

## 14. Imperative Loop Accumulators vs. Functional Pipelines (Martin Fowler)
- **Smell**: Nested `for` or `while` loops with mutable index variables, flag booleans, and intermediate state arrays.
- **Cure**: Apply *Replace Loop with Pipeline* using pure functional operations (`map`, `filter`, `reduce`, `flatMap`), making data transformations declarative and eliminating off-by-one bugs.
