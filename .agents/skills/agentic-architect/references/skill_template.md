# Progressive Disclosure Skill Template

Use this template when creating new skills under `.agents/skills/<skill-name>/SKILL.md`.

---

```markdown
---
name: <skill-name>
description: Use when [clear trigger conditions, e.g. implementing authentication, generating emails, running migrations]. Do not use for [explicit boundaries, e.g. general bug fixes or frontend styling].
---

# [Skill Title]

> **Purpose:** [Brief 1–2 sentence summary of what this skill achieves].

---

## 1. Trigger Conditions
- When the user explicitly requests: `[Examples]`
- When performing tasks involving: `[File patterns or domains]`
- **Do NOT trigger when:** `[Negative conditions]`

---

## 2. Core Workflow Steps
1. **[Step 1: Discover & Validate]**: Inspect current state before modifying code.
2. **[Step 2: Execute Core Logic]**: Follow established patterns.
3. **[Step 3: Self-Check & Verify]**: Run test commands or validation scripts.

---

## 3. Gotchas & What NOT to Do
- **DO NOT** [Specific common AI mistake #1].
- **DO NOT** [Specific common AI mistake #2].
- **DO NOT** [Specific common AI mistake #3].

---

## 4. Structured Output Template
Provide consistent formatting for results:
```markdown
### Summary of Changes
- **Action**: ...
- **Files Affected**: ...
- **Verification Evidence**: ...
```

---

## 5. Subdirectories & Progressive Resources
- Deep reference documentation: `references/`
- Deterministic helper scripts: `scripts/`
- Static schemas, templates, or mock data: `resources/`
- Reference implementations and patterns: `examples/`
```
