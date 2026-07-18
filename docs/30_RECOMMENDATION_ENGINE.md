# 30 — Recommendation Engine

**Status:** Frozen design  
**Constitution:** Docs `11`, `20`–`22`, `26`, `28`  
**Immutable rule:** Recommendations must **never** be speculative. Every recommendation references supporting **evidence**.

---

## 1. Engine purpose

Increase close probability by proposing the **right offer shape** and **next commercial move** given evidenced industrial reality — not by inventing demand.

```text
Evidence
  → AI Reasoning (constrained by VerticalPack rules)
  → Recommended Products
  → Recommended Services
  → Recommended Suppliers (FUTURE)
  → Recommended Decision Makers (evidenced only)
  → Recommended Next Action
  → Recommended Follow-up
  → Expected Confidence
```

---

## 2. Recommendation types (V1 vs later)

| Type | V1 | Requirement |
|------|----|-------------|
| Products | Yes | evidence_ids + signal_ids + product_code ∈ pack |
| Services | Yes | same (integration, FAT, commissioning, sourcing program) |
| Suppliers | **No** (future) | opportunity evidence + supplier capability evidence |
| Decision Makers | Yes | person must exist as Lead/Evidence; else “role gap” not a fake person |
| Next Action | Yes | tied to timeline stage + evidence gaps |
| Follow-up | Yes | Path A cadence or Path B pursuit |

---

## 3. Inputs

| Input | Role |
|-------|------|
| Company | Hub |
| Evidence[] | Truth |
| BuyingSignal[] | Demand indicators |
| VerticalPack | Catalog + rules + weights |
| Opportunity (optional) | Context / stage |
| Relationship Score | Softens/raises nurture vs pursue |
| Strategic Fit factors | Filter unfit products |

---

## 4. Processing pipeline

### Step 1 — Eligibility

- Discard expired/quarantined evidence.  
- Signals must have ≥1 active evidence_id.  
- If Strategic Fit would be 0 for pack, return empty products (still may return Path A nurture actions).

### Step 2 — Rule match

Apply `product_recommendation_rules` (deterministic first):

```text
IF signal_code IN rules AND evidence supports
THEN emit product/service candidates
```

### Step 3 — AI reasoning (`26` §8)

- May refine rationale and rank candidates.  
- May **not** add products outside pack catalog.  
- May **not** invent signals.

### Step 4 — Decision maker recommendations

- Prefer existing verified Leads whose titles match pack decision_maker_roles.  
- If gap: recommend **role to find** + evidence sources — **not** a fabricated name/email.

### Step 5 — Next action / follow-up

| Situation | Example next action |
|-----------|---------------------|
| Strong tender evidence | “Prepare tender compliance pack” |
| Soft hiring cluster only | “Needs research — corroborate CAPEX” |
| High Rel, no Opp | “Quarterly nurture + newsletter” |
| Approved Opp `verified` | “Book engineering discovery call” |
| Missing published contact | “Find published DM on website/registry” |

### Step 6 — Confidence

```text
recommendation_confidence =
  min( cited_evidence_confidences ) * rule_prior * fit_penalty
```

Clamp `[0,1]`. Below threshold (default 0.4) → hide or mark weak.

---

## 5. Output schema

```json
{
  "company_id": "",
  "opportunity_id": null,
  "products": [
    {
      "product_code": "ro_system",
      "label": "RO Water Treatment",
      "evidence_ids": ["ev1"],
      "signal_ids": ["sig1"],
      "rationale": "Environmental permit cites new process water capacity",
      "confidence": 0.78
    }
  ],
  "services": [
    {
      "service_code": "integration_fat",
      "label": "Integration + FAT",
      "evidence_ids": ["ev1"],
      "signal_ids": ["sig1"],
      "confidence": 0.7
    }
  ],
  "suppliers": [],
  "decision_makers": [
    {
      "lead_id": "L1",
      "role": "Plant Manager",
      "evidence_ids": ["ev2"],
      "confidence": 0.8
    }
  ],
  "role_gaps": [
    { "role": "Procurement Manager", "suggested_sources": ["official_website", "registry"] }
  ],
  "next_action": {
    "code": "schedule_discovery_call",
    "label": "Book engineering discovery call",
    "evidence_ids": ["ev1"],
    "confidence": 0.75
  },
  "follow_up": {
    "code": "day_14_value_send",
    "label": "Send RO capability brief in 14 days",
    "evidence_ids": ["ev1"],
    "confidence": 0.65
  },
  "expected_confidence": 0.74,
  "warnings": []
}
```

Persist products/services via `ProductRecommendation` entity (`21`).

---

## 6. Example (non-speculative)

**Signal:** New bottling plant (`new_plant_greenfield` / `new_production_line`)  
**Evidence:** Construction permit + investment PR URLs  

**Allowed suggestions (if Food & Beverage / Packaging pack rules say so):**  
Complete bottling line, RO water treatment, automation, conveyors, packaging, compressors, energy solutions — **each row cites the same evidence/signal ids**.

If only a hiring post for a marketing role exists → **no** bottling line recommendation.

---

## 7. Failure conditions

| Condition | Behavior |
|-----------|----------|
| No evidence | Empty recommendations + warning |
| Signal without evidence | Invalid — reject upstream |
| Product not in pack | Drop |
| Speculative AI add | Validation strip + Learning warning |
| Supplier match requested in V1 | `501` / empty suppliers |

---

## 8. Integration points

| System | Hook |
|--------|------|
| `recommendProducts` service (`22`) | Core |
| Intelligence Inbox (`23`) | Display |
| Opportunity detail | Display / accept/dismiss |
| VerticalPack (`28`) | Rules + catalog |
| AI Prompt (`26` §8) | Reasoning |
| Future Supplier Matching | Extends `suppliers[]` |

---

## 9. Governance

- Accept/dismiss recommendations → LearningEvent.  
- Dismissed speculative items must not reappear without new evidence.  
- Engine changes require update to this doc + pack rules — not silent prompt edits alone.

---

## 10. Freeze note

Recommendation **contract** (evidence-bound, pack-scoped, no speculation) is frozen. Rule content per pack may evolve.
