# 20 — Implementation Master Plan (IPP V1)

**Status:** Engineering blueprint (no application code)  
**Constitution:** Docs `01`–`12` are binding. This plan implements them; it does not replace them.  
**Objective:** Smallest **production-ready** IPP V1 that generates qualified industrial opportunities while preserving a clean, trustworthy CRM.

---

## 0. Binding philosophy (updated)

> **The platform never fabricates leads or business information.**  
> It discovers companies, relationships, and opportunities supported by **verifiable evidence**.

CRM is the **execution layer**. Intelligence is the **product**.

### Two acquisition paths (mandatory)

| Path | Name | Purpose |
|------|------|---------|
| **A** | Market Intelligence | Continuously grow verified industrial **companies** and relationships (even with no buying need) |
| **B** | Opportunity Intelligence | Discover **evidence-backed** active industrial projects / buying signals |

Both paths converge on the same **Company** record.  
**Relationship Score** (Path A) and **Opportunity Score** (Path B) remain **independent**.  
CRM manages both dimensions.

```text
Path A: Sources → Company verify → Decision makers → Nurture → Relationship Score
Path B: Sources → Evidence → Signals → Opportunity Score → Inbox → Approval
                              ↓
                    Same Company record
                              ↓
                           CRM execution
```

---

## 1. Current State

| Area | State |
|------|-------|
| Product | Top Mold / MoldFlow CRM on Base44 |
| Core object | `Lead` (contact + deal hybrid) |
| Company | Weak parallel entity; name-matched |
| Intelligence | Enrichment + scrape; no Evidence/Signal/Inbox |
| Verticals | Mold-hardcoded prompts |
| Paths A/B | Not separated; “lead gen” conflated |
| Scores | Client `leadScoring` only (not Doc 11 triad) |
| Supplier Intelligence | Absent |
| Product recommendations | Absent |
| Opportunity timeline | Lead status only (CRM stages) |

**KEEP (from audit):** enrichment validation, SMTP queue, outreach, pipeline UI, Base44 hosting, domain folders.

---

## 2. Target State (V1)

### 2.1 In scope

1. **Company hub** — single industrial company record; Path A + B converge.  
2. **Lead** — person/contact linked to `company_id` (CRM execution).  
3. **Evidence + BuyingSignal + Opportunity** — Path B core.  
4. **Intelligence Inbox** — approve/reject before CRM pollution.  
5. **Scores** — Relationship, Opportunity, Strategic Fit (Doc 11 formulas).  
6. **Opportunity Timeline** — Signal → … → Repeat Business.  
7. **Vertical Packs** — config-driven; V1 ships ≥2 packs (e.g. Plastic Molds + Industrial Water).  
8. **Product Recommendation Engine (V1)** — evidence-linked suggestions only; no invented opportunities.  
9. **CRM modules preserved** — Tasks, Templates, Outreach, Sequences, Email.  
10. **Stabilize debt** — schemas in git, routing unity, HubSpot contract, no fake badges.

### 2.2 Explicitly out of V1 (architecture reserved)

| Capability | V1 | Later |
|------------|----|-------|
| Supplier Intelligence + matching | Schema hooks / stubs only | Full matching engine |
| Continuous multi-source crawlers at scale | Manual + limited connectors | Full SourceCrawler fleet |
| Auto-approve Inbox | Policy designed; default off | Tuned auto-approve |
| All vertical packs populated | 2 packs | Pack library |
| Rewrite off Base44 | No | Only if forced |

### 2.3 V1 success definition

A production user can:

1. Discover or import a **Company** with provenance (Path A).  
2. Attach **Evidence** and see classified **Signals** (Path B).  
3. Review an **Inbox** item with three scores + product recommendations.  
4. **Approve** → CRM Opportunity on timeline stage + Company link.  
5. Continue mold sales via existing CRM without data fabrication.  
6. Add a third Vertical Pack via config **without** redesigning services.

---

## 3. Migration Strategy

### 3.1 Principles

- **Do not rewrite** the CRM.  
- **Additive** entities first; migrate links second.  
- Preserve existing Lead IDs and outreach history.  
- Company becomes hub: backfill from Lead.company_name + Companies page.

### 3.2 Phases

| Phase | Name | Outcome |
|-------|------|---------|
| M0 | Stabilize | Safe CRM baseline |
| M1 | Company hub | Path A foundation |
| M2 | Evidence & signals | Path B foundation |
| M3 | Inbox & scores | Convergence gate |
| M4 | Opportunity timeline + CRM promote | Execution quality |
| M5 | Vertical packs + recommendations | Extensibility |
| M6 | Hardening & V1 launch | Production ready |

### 3.3 Data migration steps

1. Commit `Company`, `Task`, `Activity` schemas (git truth).  
2. Add `company_id` to Lead (nullable initially).  
3. Backfill Company from distinct `company_name` (+ website when present).  
4. Deduplicate Companies (domain + country + normalized name).  
5. Create Opportunities only via Inbox approval (no bulk fake opps).  
6. Map legacy Lead.status to CRM contact cadence; **Opportunity Timeline** is separate.

### 3.4 Dual-write window

During M1–M4: UI may show Company + Lead; writes update both until `company_id` coverage ≥ 95%.

---

## 4. Implementation Order

```text
M0 Stabilize
 → M1 Company + Relationship Score fields
 → M2 Evidence + Signal + VerticalPack config
 → M3 Scoring services + Intelligence Inbox
 → M4 Opportunity + Timeline + CRM promote
 → M5 Product recommendations + second vertical pack
 → M6 Auth/hardening + KPI dashboard + launch
```

**Dependencies:** See §5. Sprint detail: `24_PHASE1_BACKLOG.md`.

---

## 5. Dependencies

| Dependency | Required for | Notes |
|------------|--------------|-------|
| Base44 entities + Deno functions | All | KEEP platform |
| Existing enrichment functions | Path A contact verify | Adapt; do not invent emails |
| Doc 11 score formulas | M3 | Exact calculations |
| Doc 12 taxonomy / sources | M2 | Signal codes |
| SMTP / templates | Path A nurture | KEEP |
| HubSpot connector | Optional sync | Fix contract in M0 |
| Supplier entities | Post-V1 | Stubs in DB only |

---

## 6. Acceptance Criteria (V1 Release Gate)

| # | Criterion | Pass condition |
|---|-----------|----------------|
| AC1 | No fabrication | No Opportunity/Contact without evidence_ids (or explicit manual provenance) |
| AC2 | Path A | Can create/verify Company; Relationship Score updates on engagement |
| AC3 | Path B | Evidence → Signal → Opportunity Score visible in Inbox |
| AC4 | Convergence | Opportunity and Lead/Contact reference same Company |
| AC5 | Inbox gate | CRM Opportunity created only after Approve |
| AC6 | Timeline | Opportunity stages follow Doc § Opportunity Timeline |
| AC7 | Vertical packs | Switching pack changes sources/signals/recommendations config |
| AC8 | Recommendations | Each suggestion links to evidence_id + signal_id |
| AC9 | CRM trust | Existing outreach/pipeline still works for mold leads |
| AC10 | Supplier future | DB has reserved Supplier* entities or documented stubs; no matching UI required |
| AC11 | Docs | Constitution + 20–25 updated if implementation drifted |
| AC12 | Tests | Checklist in §8 green |

---

## 7. Rollback Strategy

| Layer | Rollback |
|-------|----------|
| Feature flags | `ipp_v1_inbox`, `ipp_v1_company_required`, `ipp_v1_recommendations` |
| Schema | Additive fields nullable; unused entities ignored by old UI |
| Promote path | Disable Inbox promote → CRM; revert to Lead-only sales |
| Data | Do not delete legacy Leads; Opportunities can be archived |
| Deploy | Base44 version pin; redeploy previous function bundle |

**Rule:** Never run destructive migrations that drop Lead columns in V1.

---

## 8. Testing Strategy

| Type | Focus |
|------|-------|
| Unit | Score calculators; signal classifier mapping; entity resolution normalize |
| Contract | Inbox approve payload → CRM objects |
| Integration | Evidence create → signal → score → inbox item |
| Regression | Lead CRUD, Pipeline, SMTP queue, templates |
| Anti-fabrication | Attempts to create Opportunity without evidence → rejected |
| Vertical pack | Pack B recommendations differ from Pack A for same signal fixture |
| Auth | Mutating IPP functions require auth (M6) |

Manual UAT scripts live in sprint checklists (`24_*`).

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CRM users confused by dual Lead/Opportunity | High | Clear IA (`23_*`); Company as primary navigation |
| Enrichment invents contacts | Critical | Enforce Doc 12 AI constitution; quarantine Tier-E |
| Scope creep into Supplier matching | High | Explicitly out of V1; stubs only |
| Fat pages grow further | Medium | New IPP UI modules separate from Leads.jsx |
| Base44 pages.config regen drops routes | Medium | Unify routing in M0 |
| Score gaming / wrong priorities | Medium | Human Inbox; weight config per pack |
| Migration duplicate Companies | Medium | Dedupe job + manual merge in Inbox |

---

## 10. Architecture additions (without redesign)

Aligned with constitution + requested improvements:

| Concept | V1 treatment |
|---------|--------------|
| Vertical Packs | First-class config entity/module |
| Product Recommendation Engine | Rule + AI-classify suggestions **bound to evidence** |
| Supplier Intelligence | Reserved schema / service boundary only |
| Opportunity Timeline | Field + transitions on Opportunity |
| Path A / Path B | Separate services; shared Company |

---

## 11. Document map

| Doc | Role |
|-----|------|
| `21_DATABASE_REFACTOR.md` | Entities & scores |
| `22_SERVICE_ARCHITECTURE.md` | Backend services |
| `23_UI_INFORMATION_ARCHITECTURE.md` | Modules & journeys |
| `24_PHASE1_BACKLOG.md` | Hour-sized sprints |
| `25_CURSOR_DEVELOPMENT_RULES.md` | Permanent engineering rules |

---

## 12. KEEP / REFACTOR / REMOVE (plan level)

| Item | Action |
|------|--------|
| CRM outreach, pipeline, enrichment validators | **KEEP** |
| Company as industrial hub | **REFACTOR** (elevate) |
| Lead as contact | **REFACTOR** (link company_id) |
| Fabricated lead generation as success metric | **REMOVE** |
| Fake Connected badges | **REMOVE** |
| Supplier matching UI | **Defer** (architect only) |
