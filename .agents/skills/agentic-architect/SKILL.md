---
name: agentic-architect
description: Use when creating, modularizing, auditing, or updating agentic configuration files, including AGENTS.md, CLAUDE.md, rule documentation files, or skills under .agents/skills/ following the progressive disclosure architecture. Do not use for writing application business logic.
---

# Agentic Architect Skill

> **Core Philosophy:** Eliminate context bloat and model degradation through progressive disclosure, lean entrypoints, strict skill front matter, automated symlink parity, and relentless questioning during skill architecture.

---

## 1. When to Use This Skill
- Auditing existing `AGENTS.md` or `CLAUDE.md` files for token bloat or giant bullet lists.
- Decoupling large domain sections (testing, database, auth, UI) into modular rule files.
- Authoring new specialized skills under `.agents/skills/` using relentless questioning.
- Establishing harness parity across different AI coding environments via symlinks.
- Implementing the continuous refinement loop to update skills based on AI mistakes.

---

## 2. Step-by-Step Execution Workflow

### Step 1: Relentless Skill Architecture Inquiry (Question Everything)
Before writing a single line of a skill or rule, execute the **7 Core Inquiry Branches**:
1. **Placement & Scope:** Does this belong in root `AGENTS.md` (all prompts), nested `AGENTS.md` (one package), a continuous rule in `docs/rules/`, or an on-demand skill in `.agents/skills/`?
2. **Trigger Boundaries & YAGNI Gate:** What is the explicit imperative trigger (`Use when...`), the anti-triggers (`Do NOT use for...`), and the empirical tipping points that justify unlocking this capability?
3. **Domain Ground Truth:** Have all generic textbook tutorials been purged? Is this grounded in verified codebase evidence?
4. **Gotchas & Anti-Patterns:** What exact mistakes has the AI repeatedly made in this domain that must be forbidden?
5. **Determinism vs. LLM:** Can brittle tasks be converted into deterministic scripts under `scripts/`?
6. **Progressive Bloat:** Is `SKILL.md` strictly under 500 lines, offloading deep manuals to `references/` and templates to `resources/`?
7. **Verification & Proof:** What structured response template and self-validation checklist will prove success?
*Rule:* If any branch is unanswered or ambiguous, **STOP and ask the user** (or inspect workspace files). Never fill gaps with assumptions.

### Step 2: Audit Existing Agent Configuration
Inspect current agent files and measure their token and line footprint:
- File length > 120–150 lines in root `AGENTS.md`.
- Giant bullet lists accumulated from past one-off bugs.
- Human onboarding guides (cloning instructions, dev machine setup).
- Framework-specific deep tutorials that only apply to a minority of tasks.
- Deep, fragile file paths that rot over time.

### Step 3: Decouple Domain Directives into Modular Rules
Extract continuous technical requirements into dedicated markdown files under `docs/rules/`:
- `docs/rules/clean_code.md` (Clean Code, Pragmatic Programmer, CQS, SLAP)
- `docs/rules/cloud_native.md` (12-Factor 2026, OpenTelemetry, API-first)
- `docs/rules/security_compliance.md` (SOC 2 Type II, ISO 27001, GDPR)
- `docs/rules/devops_ci_cd.md` (Shift-left pipelines, trunk-based CI, OCI distroless)
- `docs/rules/requirements_engineering.md` (INVEST user stories, Gherkin criteria)

### Step 4: Streamline Root AGENTS.md
Refactor root `AGENTS.md` to be strictly bounded:
1. **Mission Statement & Open-Source Mandate:** 1–2 sentences defining project domain, purpose, and 100% open-source requirement.
2. **Runtime & Scripts:** Declared package manager (Node >=18, recommended 24 / npm >=10) and core scripts.
3. **Core Operating Framework:** Zero-Assumption Rule, Relentless Questioning Loop, 5-stage lifecycle, action boundaries.
4. **Progressive Disclosure Index:** Markdown table mapping each domain to its `docs/rules/*.md` file.

### Step 5: Author Specialized Skills via Progressive Disclosure
When a task is complex, multi-step, or specialized, encapsulate it into `.agents/skills/<skill-name>/`:
1. **Front Matter:**
   - `name`: kebab-case identifier.
   - `description`: < 1024 characters. Must start with imperative `Use when...` defining exact trigger conditions and when NOT to use.
2. **Body:**
   - Keep under 500 lines.
   - Ground in verified project experience, not general documentation the AI already knows.
   - Include a mandatory **"Gotchas & What NOT to Do"** section.
   - Provide structured output templates.
3. **Progressive Subdirectories:**
   - `references/`: Reference manuals loaded only on demand.
   - `scripts/`: Deterministic code (bash/node) to prevent stochastic AI divergence.
   - `resources/`: Static templates, lookup tables, and schemas.
   - `examples/`: Reference implementations and code patterns.

### Step 6: Enforce Harness Parity via Symlinks
Prevent divergence across Claude Code, Google Antigravity, Cursor, Windsurf, and standard AGENTS.md:
```bash
ln -sf AGENTS.md CLAUDE.md
ln -sf AGENTS.md agents.md
ln -sf AGENTS.md GEMINI.md
ln -sf AGENTS.md .cursorrules
ln -sf AGENTS.md .windsurfrules
```

### Step 7: Apply the Continuous Refinement Loop
1. Save the initial raw AI output draft.
2. Produce the human-adjusted gold standard version.
3. Diff the two versions to identify repeated flaws or stylistic divergence.
4. Update the skill's "What NOT to Do" section with concrete negative examples.

---

## 3. Gotchas & What NOT to Do

- **DO NOT** guess what a skill should do. Run the Relentless Skill Architecture Inquiry first.
- **DO NOT** author architectural rules or skills without a YAGNI Gate (Simple Baseline, Anti-Triggers, Empirical Tipping Point).
- **DO NOT** confuse battle-tested open-source libraries (shadcn, Tailwind, Zod, Lombok) with speculative custom over-engineering.
- **DO NOT** let root `AGENTS.md` exceed 120–150 lines. Every extra token degrades LLM attention.
- **DO NOT** write passive skill descriptions like `"Tanstack query documentation"`. Use `"Use when implementing Tanstack Query caches..."`.
- **DO NOT** include human "Getting Started" guides. Agents already have the workspace open.
- **DO NOT** hardcode individual file paths that change frequently. Reference architectural layers instead.
- **DO NOT** duplicate content across `CLAUDE.md` and `AGENTS.md`. Always use symbolic links.
- **DO NOT** add preemptive rules before the agent has actually made the mistake. Ground additions in real experience.

---

## 4. Verification Checklist

Before finalizing any agent configuration update, verify:
- [ ] Relentless Skill Architecture Inquiry completed for all 7 branches.
- [ ] Architectural pattern rules and skills enforce the YAGNI Gate Triad (Baseline, Anti-Triggers, Tipping Point).
- [ ] Root `AGENTS.md` is under 120 lines and loads within minimal tokens.
- [ ] Specialized domain instructions are decoupled into `docs/rules/`.
- [ ] Progressive disclosure table in `AGENTS.md` contains valid, clickable markdown links.
- [ ] All skills have front matter with `name` and imperative `description` starting with `Use when...`.
- [ ] All skills are under 500 lines or offload sub-content to `references/`.
- [ ] Every skill contains a "Gotchas & What NOT to Do" section.
- [ ] Symlinks (`CLAUDE.md`, `agents.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`) resolve to `AGENTS.md`.

---

## 5. Subdirectories & Progressive Resources
- [references/skill_architecture_inquiry.md](./references/skill_architecture_inquiry.md): The interactive 7-branch relentless questioning guide for skills.
- [references/agents_md_template.md](./references/agents_md_template.md): Boilerplate template for lean root and nested `AGENTS.md` files.
- [references/skill_template.md](./references/skill_template.md): Boilerplate template for authoring production-grade `SKILL.md` files.
- [references/refinement_workflow.md](./references/refinement_workflow.md): Step-by-step guide for capturing AI draft diffs against human edits to update skills.
- [scripts/validate_agentic_configs.sh](./scripts/validate_agentic_configs.sh): Deterministic Bash script validating front matter, line ceilings, link health, and symlink parity.
