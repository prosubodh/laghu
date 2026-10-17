# SMART Developer Tasks Reference

> **Core Concept:** While user stories represent customer-facing value (evaluated via the **INVEST** model), engineering execution requires breaking each story down into technical developer tasks. Apply Bill Wake's **SMART** acronym to ensure tasks are clear, bounded, and actionable.

---

## 1. The SMART Developer Task Framework

| Letter | Attribute | Description & Quality Standard | Anti-Pattern to Avoid |
|---|---|---|---|
| **S** | **Specific** | The task scope is crystal clear and bounded. Everyone on the team understands exactly what needs to be created or modified. | Vague tasks like *"Fix auth issues"* or *"Refactor backend"*. |
| **M** | **Measurable** | Answers: *"Can we objectively mark it as done?"* Completion requires working behavior, automated tests passing, clean code, and zero lint/type errors. | Tasks marked "done" when code is written but tests are unwritten or failing. |
| **A** | **Achievable** | The developer or pair has the capability, permissions, and tools to complete it. Team norm: anyone can ask for help immediately without stigma. | Assigning a complex cryptographic or database optimization task without necessary context or pairing support. |
| **R** | **Relevant** | The task directly contributes to delivering the parent user story. Every developer task must be justifiable to the customer's value proposition. | Building gold-plated utility libraries, speculative abstractions, or unrequested features. |
| **T** | **Time-Boxed** | The task has an explicit bounded duration expectation (typically 2–4 hours, never exceeding 1 working day). Exceeding the time-box triggers a pause, task splitting, or pairing. | Open-ended tasks that span multiple days without intermediate commits or observable progress. |

---

## 2. Example: Decomposing an INVEST Story into SMART Tasks

### Parent Story: Customer Digital Agreement Execution
- **Story Description:** *As an approved prospective customer, I want to review my agreement terms and digitally execute the contract in the portal, so that my subscription becomes active immediately.*

### Decomposed SMART Tasks:

#### Task 1: Domain Entity Invariants & Digital Signature Value Object
- **Specific:** Add `Signature` value interface to `Agreement` entity; validate signer name presence and actor ID consistency in `Agreement.sign()`.
- **Measurable:** 100% unit test coverage in `agreement_domain.test.ts` testing valid signatures, empty signer name throws, and unauthorized actor rejection.
- **Achievable:** Developer familiar with TypeScript domain models and Vitest.
- **Relevant:** Core business invariant required to make digital execution legally defensible.
- **Time-Boxed:** 2 hours.

#### Task 2: Persistence Schema Evolution & Repository Implementation
- **Specific:** Add `termsJson` and `signatureJson` to persistence schema; update repository to serialize/deserialize signature JSON.
- **Measurable:** Database schema sync clean; repository integration tests pass; round-trip serialization verified.
- **Achievable:** Standard persistence repository workflow in monorepo.
- **Relevant:** Persists the legal audit trail in the primary database.
- **Time-Boxed:** 2 hours.

#### Task 3: Use Case State Transition & Async Event Notification
- **Specific:** Add `signAgreement()` to `AgreementUseCase`; enqueue `agreement.signed` on `JobQueuePort`; register event handler in `EventNotificationDispatcher` to send confirmation notification.
- **Measurable:** Integration test verifies confirmation notification delivery to customer upon signing; tests green.
- **Achievable:** Uses existing `JobQueuePort` and notification adapters.
- **Relevant:** Provides transactional transparency to both customer and operator.
- **Time-Boxed:** 3 hours.

#### Task 4: REST API Endpoint & Error Handling
- **Specific:** Add `POST /api/v1/agreements/:id/sign` route to HTTP controller; validate request body; return RFC 9457 problem details on failure.
- **Measurable:** API acceptance tests pass; covers 200, 400 (validation), 404 (not found).
- **Achievable:** Standard HTTP controller pattern.
- **Relevant:** Exposes digital signing capability to web clients.
- **Time-Boxed:** 2 hours.

#### Task 5: Consumer Portal UI Integration & Document Download
- **Specific:** Connect `CustomerAgreementPage.tsx` to TanStack `useMutation`; build terms review section, legal acknowledgment checkbox, typed signature modal, and receipt download.
- **Measurable:** Component builds without TypeScript errors; visual smoke test verifies interactive signing workflow.
- **Achievable:** Uses existing design system and UI primitives.
- **Relevant:** Final customer-facing touchpoint closing the satisfaction gap.
- **Time-Boxed:** 3 hours.
