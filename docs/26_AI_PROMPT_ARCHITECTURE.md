# 26 — AI Prompt Architecture

**Status:** Frozen specification for every IPP AI interaction  
**Constitution:** Docs `05`, `11`, `12`, `20`–`25`  
**Canonical philosophy:** The platform never fabricates business information. AI reasons over evidence. AI never invents evidence.

---

## 0. Global AI Constitution

### 0.1 AI MAY

Summarize, classify, compare, prioritize, recommend, extract facts **present in inputs**, calculate scores from defined formulas, detect duplicates, translate, structure JSON.

### 0.2 AI MUST NEVER generate

| Forbidden output |
|------------------|
| Companies that are not in inputs / sources |
| Contacts / people not evidenced in inputs |
| Emails, phones, LinkedIn URLs not present in inputs |
| Projects / CAPEX / tenders not supported by evidence text |
| Buying signals without citing evidence_ids |
| Product recommendations without evidence_ids + signal_ids |
| Fabricated confidence “proof” |
| Silent instructions to write CRM records |

### 0.3 Global I/O contract

Every AI call returns:

```json
{
  "ok": true,
  "result": {},
  "confidence": 0.0,
  "evidence_refs": [],
  "warnings": [],
  "model_meta": { "prompt_key": "", "vertical_pack": "", "version": "" }
}
```

If a field cannot be evidenced: return `null` + warning — **never guess**.

### 0.4 Global validation

- Reject outputs that introduce URLs/emails/phones not substring-matching inputs (except normalized scheme `https://`).  
- Reject signal/recommendation objects missing required id arrays.  
- Clamp confidence to `[0,1]`.  
- Schema validation before persistence.

### 0.5 Global retry strategy

| Failure | Action |
|---------|--------|
| Timeout / 5xx | Retry ≤2 with backoff |
| Invalid JSON | One repair prompt with schema only |
| Validation fail | Do not retry creatively; return `ok:false` |
| Empty extraction | Return empty result, confidence 0 |

### 0.6 Defaults (override per capability)

| Param | Default |
|-------|---------|
| Temperature | 0.1 (extraction) / 0.2 (summarize) / 0.0 (scoring assist) |
| Max tokens | 2000–4000 unless noted |
| Target latency | < 30s typical; < 60s scrape-augmented |

**Recommended model class:** Base44 `InvokeLLM` production default; prefer strongest available JSON-mode model for extraction; cheaper model for summarization if quality gates pass.

---

## 1. Company extraction

| | |
|--|--|
| **Purpose** | Extract firmographic claims about a company from provided artifacts only |
| **Allowed inputs** | `artifact_texts[]`, `artifact_urls[]`, `hints` (name/country optional), `vertical_pack` |
| **Expected outputs** | name, website, domain, country, industry_raw, description, size_enum or null |
| **JSON schema** | See §1.1 |
| **Validation** | Website must parse as URL if present; size ∈ CRM enum or null; no invented domain |
| **Confidence** | Mean of per-field confidence; field null ⇒ exclude from mean |
| **Failure** | No identifiable org name in inputs |
| **Retry** | One schema repair |
| **Model / temp / tokens** | Strong extract · 0.1 · 2500 |
| **Exec time** | < 20s |

### 1.1 Schema

```json
{
  "type": "object",
  "required": ["company", "confidence", "evidence_refs"],
  "properties": {
    "company": {
      "type": "object",
      "properties": {
        "name": { "type": ["string", "null"] },
        "website": { "type": ["string", "null"] },
        "domain": { "type": ["string", "null"] },
        "country": { "type": ["string", "null"] },
        "industry_raw": { "type": ["string", "null"] },
        "description": { "type": ["string", "null"] },
        "size": { "type": ["string", "null"], "enum": ["1-10","11-50","51-200","201-500","501-1000","1000+", null] }
      }
    },
    "field_confidence": { "type": "object" },
    "confidence": { "type": "number" },
    "evidence_refs": { "type": "array", "items": { "type": "string" } },
    "warnings": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

## 2. Decision maker extraction

| | |
|--|--|
| **Purpose** | Extract people **named in inputs** relevant to industrial buying |
| **Allowed inputs** | Artifacts, optional role targets from VerticalPack |
| **Expected outputs** | Array of `{ full_name, job_title, email, phone, linkedin_url }` with nulls allowed |
| **Validation** | Email/phone/linkedin only if literally present (or clearly published); else null |
| **Confidence** | Per contact; downweight if only title without name |
| **Failure** | No named persons → empty array (success with empty) |
| **Retry** | None creative |
| **Model / temp / tokens** | Strong · 0.0 · 3000 |
| **Exec time** | < 25s |

**MUST NEVER:** Pattern-generate `firstname.lastname@domain`.

---

## 3. Website extraction

| | |
|--|--|
| **Purpose** | Structure about/products/contact pages from HTML/text |
| **Allowed inputs** | Page texts, URLs, company_id optional |
| **Expected outputs** | products[], locations[], published_contacts[], claims[] |
| **Validation** | Same anti-fabrication contact rules; enrichLead-style email bans apply |
| **Confidence** | Based on page type (contact page higher) |
| **Failure** | Empty/blocked page |
| **Retry** | One with truncated input |
| **Model / temp / tokens** | Strong · 0.1 · 4000 |
| **Exec time** | < 45s (includes fetch outside model) |

---

## 4. Evidence extraction

| | |
|--|--|
| **Purpose** | Turn artifacts into atomic Evidence claims |
| **Allowed inputs** | Artifact text/url, source_type, company_id |
| **Expected outputs** | `{ type, claim, observed_at?, expires_hint?, excerpt }` |
| **Validation** | claim ≤ 500 chars; type ∈ Evidence types (`21`/`12`); excerpt from input |
| **Confidence** | `W_source * parse_quality` |
| **Failure** | No factual claim |
| **Retry** | One |
| **Model / temp / tokens** | Strong · 0.0 · 2000 |
| **Exec time** | < 15s |

---

## 5. Buying signal extraction

| | |
|--|--|
| **Purpose** | Map evidence → BuyingSignal codes (Doc `12` taxonomy) |
| **Allowed inputs** | evidence records, VerticalPack.allowed_signal_codes |
| **Expected outputs** | `{ code, intensity, evidence_ids[], rationale }` |
| **Validation** | code ∈ pack allowlist; evidence_ids length ≥ 1; all ids in input |
| **Confidence** | Per Doc `12` signal confidence norms |
| **Failure** | No matching signal → empty array |
| **Retry** | None |
| **Model / temp / tokens** | Strong · 0.0 · 2000 |
| **Exec time** | < 20s |

```json
{
  "signals": [
    {
      "code": "water_treatment",
      "intensity": "strong",
      "evidence_ids": ["ev_123"],
      "rationale": "Permit text cites new RO capacity",
      "confidence": 0.82
    }
  ]
}
```

---

## 6. Opportunity scoring (assist)

| | |
|--|--|
| **Purpose** | Propose factor inputs for Doc `11` §9.2 — **final score computed in code** |
| **Allowed inputs** | Opportunity + evidence + signals snapshots |
| **Expected outputs** | Factor suggestions (value_band, timing_class, etc.) with evidence_refs |
| **Validation** | Code recalculates Opportunity Score; AI must not return final score as authority |
| **Confidence** | N/A for final; factor confidences optional |
| **Failure** | Insufficient evidence → factors null |
| **Model / temp / tokens** | Medium · 0.0 · 1500 |
| **Exec time** | < 15s |

---

## 7. Relationship scoring (assist)

| | |
|--|--|
| **Purpose** | Extract engagement features; **final Rel score in code** (Doc `11` §9.1) |
| **Allowed inputs** | Company activities, emails, meetings, contacts |
| **Expected outputs** | Feature counts/dates only |
| **Validation** | Deterministic scorer is source of truth |
| **Model / temp / tokens** | Cheap · 0.0 · 1000 |

---

## 8. Product recommendation

| | |
|--|--|
| **Purpose** | Suggest products/services from VerticalPack rules + evidenced signals |
| **Allowed inputs** | signals[], evidence[], pack.product_recommendation_rules, pack.typical_products |
| **Expected outputs** | ProductRecommendation drafts with evidence_ids + signal_ids |
| **Validation** | Every recommendation must cite ≥1 evidence_id and ≥1 signal_id from inputs; product_code ∈ pack catalog |
| **Confidence** | Min(signal confidences cited) |
| **Failure** | No rule match → `[]` |
| **Retry** | None |
| **Model / temp / tokens** | Strong · 0.1 · 2500 |
| **Exec time** | < 20s |

**MUST NEVER:** Invent opportunities or suppliers.

---

## 9. Duplicate detection

| | |
|--|--|
| **Purpose** | Suggest duplicate Company pairs |
| **Allowed inputs** | Candidate companies (name, domain, country, website) |
| **Expected outputs** | `{ matches: [{ a_id, b_id, score, reason }] }` |
| **Validation** | score ∈ [0,1]; never auto-merge |
| **Model / temp / tokens** | Medium · 0.0 · 1500 |

---

## 10. Company matching

| | |
|--|--|
| **Purpose** | Match import row → existing Company |
| **Allowed inputs** | Import firmographics + search candidates |
| **Expected outputs** | best_match_id or null + confidence |
| **Validation** | Prefer domain match; null if < 0.7 |
| **Model / temp / tokens** | Medium · 0.0 · 1200 |

---

## 11. Supplier matching (FUTURE — post-V1)

| | |
|--|--|
| **Purpose** | Opportunity → SupplierCapability matches |
| **V1** | **Not implemented**; if called → `501` |
| **Future rules** | Same anti-fabrication; matches cite opportunity evidence + supplier capability evidence |
| **Model / temp / tokens** | TBD · 0.1 · 3000 |

---

## 12. Company summarization

| | |
|--|--|
| **Purpose** | 360° narrative for Company from linked evidence only |
| **Allowed inputs** | Company fields + evidence claims + signals (no web invent) |
| **Expected outputs** | `{ summary, open_questions[], evidence_refs[] }` |
| **Validation** | Every sentence claimable from evidence_refs |
| **Temp** | 0.2 · tokens 2000 · < 20s |

---

## 13. News summarization

| | |
|--|--|
| **Purpose** | Summarize news artifact; extract industrial claims |
| **Allowed inputs** | Article text + url |
| **Expected outputs** | summary, claims[], possible_signal_codes[] (hypothesis only) |
| **Validation** | Claims must quote/support from text |
| **Temp** | 0.2 · 2000 |

---

## 14. Tender summarization

| | |
|--|--|
| **Purpose** | Extract tender scope, deadline, buyer, value if present |
| **Allowed inputs** | Tender document text |
| **Expected outputs** | Structured tender fields or nulls |
| **Validation** | No invented deadlines/values |
| **Temp** | 0.0 · 3000 · < 30s |

---

## 15. Prompt packaging (VerticalPack)

Each VerticalPack stores `prompt_template_keys` referencing this doc’s capability ids:

`company_extraction`, `decision_maker_extraction`, `website_extraction`, `evidence_extraction`, `buying_signal_extraction`, `product_recommendation`, `company_summarization`, …

Pack may append industry glossary; may **not** override MUST NEVER rules.

---

## 16. Canonical glossary (AI/docs lock)

| Term | Meaning |
|------|---------|
| Company | Industrial org hub (legacy prose “Account” = Company) |
| Lead | DB entity for Contact |
| BuyingSignal | Entity; informal “signal” |
| OpportunityConfidence | 0–1 evidence pack confidence (`12`) |
| Opportunity Score | 0–100 commercial score (`11`) |
| Intelligence Inbox | Approval queue ≠ InboxStats |

---

## 17. Freeze note

Changing this document requires product owner approval. Implementation prompts must cite capability section numbers.
