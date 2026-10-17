# Root & Nested AGENTS.md Template

Use this template when bootstrapping or restructuring an `AGENTS.md` file according to the progressive disclosure architecture.

---

```markdown
# AGENTS.md

> **[Workspace / Package Name] Directives**  
> **Rule Zero:** Assume nothing. Every action must be grounded in verified evidence from this workspace or direct instructions from the user.

---

## 1. Project Overview & Environment
- **Purpose:** [1–2 sentences explaining what this project does and its core domain].
- **Runtime & Tools:** [e.g. Node 24 / npm 11, package manager, key global scripts].
- **High-Level Layout:**
  - `apps/` — [High-level package boundaries].
  - `packages/` — [Shared libraries/utilities].
  - `docs/rules/` — [Modular progressive disclosure rules].

---

## 2. Core Operating Framework
- **Ground Truth Only:** A statement is only true if proven by a file, command output, or direct user instruction.
- **Relentless Questioning Loop:** Before acting, answer:
  1. What is current state?
  2. What is exact goal?
  3. What tools are available?
  4. What could break?
  5. How will we prove it works?
- **Execution Stages:** `DISCOVER` ➔ `INTERROGATE` ➔ `PLAN` ➔ `EXECUTE` ➔ `VERIFY`.
- **Action Boundaries:**
  - **ALWAYS:** Read before editing; verify commands before running; verify results with evidence.
  - **ASK FIRST:** Adding dependencies, deleting files, modifying DB schemas or existing tests.
  - **NEVER:** Guess paths or flags; silently ignore errors; import external assumptions.

---

## 3. Progressive Disclosure Rules

Read these specialized rule files on demand when performing relevant tasks:

| Domain | Rule Reference File | When to Consult |
|---|---|---|
| **Testing** | [docs/rules/test_driven_development.md](../../../../docs/rules/test_driven_development.md) | Writing acceptance/unit tests, coverage checks. |
| **Multi-Tenancy** | [docs/rules/multitenancy_architecture.md](../../../../docs/rules/multitenancy_architecture.md) | Tenant context resolution, PostgreSQL RLS. |
| **Database** | [docs/rules/database_design.md](../../../../docs/rules/database_design.md) | Relational integrity, ACID transactions, outbox pattern. |

---

## 4. Harness Parity
Keep `AGENTS.md`, `CLAUDE.md`, `agents.md`, `GEMINI.md`, `.cursorrules`, and `.windsurfrules` in sync via filesystem symlinks:
```bash
ln -sf AGENTS.md CLAUDE.md
ln -sf AGENTS.md agents.md
ln -sf AGENTS.md GEMINI.md
ln -sf AGENTS.md .cursorrules
ln -sf AGENTS.md .windsurfrules
```
```
