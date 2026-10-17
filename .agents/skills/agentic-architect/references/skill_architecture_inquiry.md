# Relentless Skill Architecture Inquiry Guide

> **Core Rule:** Never assume what a skill needs. Relentlessly interrogate all 7 branches before authoring or modifying any `SKILL.md`.

---

## The 7 Core Inquiry Branches

```
[Skill Request / Idea]
       │
       ▼
[Branch 1: Placement & Scope]
       ├─ All prompts repository-wide? ─────────► Root AGENTS.md
       ├─ One monorepo package only? ──────────► Nested package AGENTS.md
       ├─ Continuous domain coding rule? ──────► docs/rules/*.md
       └─ Specialized on-demand workflow? ─────► .agents/skills/<name>/
       │
       ▼
[Branch 2: Trigger Intent & Anti-Triggers]
       ├─ What explicit user request triggers this?
       ├─ Imperative phrasing: 'Use when the user wants to...' (< 1024 chars)
       └─ Negative boundaries: 'Do NOT use for...'
       │
       ▼
[Branch 3: Domain Ground Truth (Purge Fluff)]
       ├─ What does the LLM already know from pre-training? (PURGE)
       └─ What is strictly proprietary/unique to this repository? (KEEP)
       │
       ▼
[Branch 4: Anti-Patterns & Gotchas (What NOT to Do)]
       ├─ What mistakes has the AI actually made in past attempts?
       └─ Formulate 3–5 explicit negative constraints ('DO NOT...')
       │
       ▼
[Branch 5: Determinism vs. Stochastic LLM]
       ├─ Are there brittle command lines or JSON formatting steps?
       └─ Should these be deterministic helper scripts in scripts/?
       │
       ▼
[Branch 6: Progressive Disclosure (< 500 Lines)]
       ├─ Is SKILL.md under 500 lines?
       ├─ Are deep manuals offloaded to references/?
       └─ Are static schemas or templates offloaded to resources/?
       │
       ▼
[Branch 7: Verification & Feedback Loop]
       ├─ What structured output format proves success?
       ├─ What self-validation checklist must be satisfied?
       └─ How will diffs between AI drafts and human edits be harvested?
```

---

## Inquiry Interview Template

When asking the user or interrogating the workspace, use this questionnaire:

1. **Scope:** Is this workflow continuous (applies whenever writing code in this domain) or episodic (triggered only on explicit request)?
2. **Triggers:** When should the AI automatically reach for this skill? What tasks should it actively *refuse* to use this skill for?
3. **Pitfalls:** What has the AI historically messed up when doing this task (e.g. hallucinating dependencies, using wrong flags, creating leaky abstractions)?
4. **Determinism:** Are there shell commands or formatting rules that should be guaranteed with a script rather than left to LLM chance?
5. **Output Standard:** What does the ideal, gold-standard output look like?
