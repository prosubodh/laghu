# Continuous Skill & Rule Refinement Workflow

> **Purpose:** Iteratively improve AI code output by harvesting manual developer edits and converting recurring mistakes into explicit skill rules.

---

## The 4-Step Refinement Loop

```
1. AI Draft Generated ──► 2. Human Manual Edit ──► 3. Extract Gaps & Anti-Patterns ──► 4. Update Skill
```

### 1. Capture Raw Output
When prompting the AI to execute a complex task (e.g. drafting an article, building a complex form, scaffolding an endpoint), retain the raw generated output before making edits.

### 2. Perform Gold-Standard Edits
Manually modify the generated file to match production quality:
- Adjust architectural choices.
- Fix styling, accessibility, or type annotations.
- Correct API response shapes or error handling.

### 3. Analyze the Diff
Compare the initial AI draft against the final human version:
- What did the AI assume that was incorrect?
- What repetitive boilerplate did the AI miss?
- What unnecessary packages, methods, or complex patterns did it introduce?

### 4. Feed Back into the Skill
Update the relevant skill or rule file:
- Add positive examples under the workflow section.
- **Crucial:** Add explicit negative rules in the **"Gotchas & What NOT to Do"** section (e.g. *"DO NOT use window.confirm; use @radix-ui/react-alert-dialog"*).
- If a step failed due to non-deterministic CLI flags, write an executable helper script under `scripts/`.
