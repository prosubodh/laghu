# Product Backlog Ordering & Prioritization Techniques

> **Core Concept:** Prioritizing product backlog items (PBIs) requires disciplined, objective frameworks rather than arbitrary stakeholder pressure. Use this guide to select and apply the right prioritization technique for the product stage.

---

## 1. Prioritization Framework Comparison Matrix

| Framework | Primary Focus | Best Used When... | Key Metric / Input |
|---|---|---|---|
| **The Kano Model** | Customer emotional satisfaction vs. investment level | Discovering baseline expectations vs. competitive differentiators | Functional vs. Dysfunctional customer responses |
| **MoSCoW** | Release scope packaging & non-negotiable boundaries | Planning fixed-date releases or MVP feature gating | Critical path vs. optional enhancements |
| **RICE Scoring** | Objective algorithmic ranking based on measurable impact | Resolving prioritization disputes across diverse feature requests | $(Reach \times Impact \times Confidence) / Effort$ |
| **Buy a Feature** | Stakeholder consensus under budget constraints | Engaging cross-functional stakeholders or customer advisory boards | Constrained allocation of currency |

---

## 2. The Kano Model

Categorizes features based on how customer satisfaction correlates with implementation completeness:

```
Satisfaction (Delighted)
          ▲
          │          Attractive (Delighters)
          │         /
          │        /    Performance (Linear)
          │       /    /
          │      /    /
          │     /    /
──────────┼────/────/────────────────────────► Completeness (Invested)
          │   /    /
          │  /    /
          │ /    /   Must-be (Basic Expectations)
          │/____/
          ▼
Dissatisfaction (Frustrated)
```

### The 5 Kano Categories
1. **Must-be (Basic / Threshold):** Table stakes. Taken for granted when present, but causes catastrophic dissatisfaction when absent (e.g., database ACID transactions, secure authentication, password resets). *Rule: Must be fully delivered before optimizing performance.*
2. **Performance (One-Dimensional):** Satisfaction is linearly proportional to execution (e.g., faster page load, higher search speed, larger export limits). *Rule: Optimize strategically where competitive advantage exists.*
3. **Attractive (Delighters / Excitement):** Unexpected innovations that trigger disproportionate joy and buzz (e.g., instant one-click self-service onboarding, predictive issue alerts). *Rule: Include at least one delighter per major release to drive adoption.*
4. **Indifferent:** Features that customers do not care about either way. *Rule: Eliminate immediately; do not waste engineering capacity.*
5. **Reverse:** Features that actively cause frustration if added (e.g., excessive mandatory onboarding modals, invasive popups). *Rule: Avoid or remove.*

---

## 3. MoSCoW Prioritization

Essential for packaging release increments and enforcing negative scope:

- **Must Have (M):**
  - Non-negotiable core invariants.
  - Without this, the system cannot operate legally, securely, or fundamentally.
  - *Example:* "Users must be able to view their pending agreement."
- **Should Have (S):**
  - Highly important and valuable, but not critical for launch; a temporary workaround exists.
  - *Example:* "Automated transactional notifications upon signing" (workaround: manual status check).
- **Could Have (C):**
  - Desirable enhancements that provide delight, but are easily deferred if time is constrained.
  - *Example:* "Downloadable execution certificate with custom styling."
- **Won't Have This Time (W):**
  - Explicitly agreed as out-of-scope for the current release. Protects the team from scope creep.
  - *Example:* "Multi-party commercial co-signer execution flows."

---

## 4. RICE Scoring Framework

When competing stakeholder requests clash, calculate the objective RICE score:

$$\text{RICE Score} = \frac{\text{Reach} \times \text{Impact} \times \text{Confidence}}{\text{Effort}}$$

### Component Definitions & Scoring Scales
1. **Reach (R):** Number of users or events impacted over a defined timeframe (e.g., per month).
   - *Example:* 500 active customers signing agreements per quarter $\rightarrow Reach = 500$.
2. **Impact (I):** Qualitative impact on individual users or conversion:
   - $3.0$ = Massive impact
   - $2.0$ = High impact
   - $1.0$ = Medium impact
   - $0.5$ = Low impact
   - $0.25$ = Minimal impact
3. **Confidence (C):** Percentage reflecting empirical backing vs. speculation:
   - $100\%$ = High confidence (backed by verified user interviews and analytics)
   - $80\%$ = Medium confidence (backed by qualitative feedback)
   - $50\%$ = Low confidence (speculative assumption / gut feeling)
4. **Effort (E):** Estimated development effort in person-weeks or person-sprints:
   - *Example:* 1 person-week of engineering $\rightarrow Effort = 1$.

### Example Calculation:
- **Feature A (Digital Agreement Execution):**
  - $R = 500$, $I = 3.0$, $C = 100\%$, $E = 1.0 \rightarrow \text{RICE} = \frac{500 \times 3.0 \times 1.0}{1.0} = 1500$
- **Feature B (Custom Dark Mode Themes):**
  - $R = 200$, $I = 0.5$, $C = 50\%$, $E = 2.0 \rightarrow \text{RICE} = \frac{200 \times 0.5 \times 0.5}{2.0} = 25$
- *Conclusion: Feature A takes clear priority.*

---

## 5. Buy a Feature

A collaborative budgeting game ideal for quarterly roadmap planning:
1. List 10–15 candidate features.
2. Price each feature proportionally to its engineering effort (e.g., Small = \$50, Medium = \$150, Large = \$400).
3. Allocate each participant (or group) a constrained budget of fictitious currency equal to roughly 50% of the total cost of all features.
4. Encourage participants to negotiate and pool their funds to "buy" the features that matter most.
5. High-priced features that get bought through shared pooling reveal true, undeniable consensus value.
