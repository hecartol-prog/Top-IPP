# 29 — Company Intelligence Model

**Status:** Company 360° / Industrial Knowledge Graph (frozen)  
**Canonical entity name:** **Company** (legacy prose “Account” = Company)  
**Constitution:** Docs `11`, `12`, `20`–`23`, `21`

---

## 1. Purpose

Company is the **single convergence node** for:

- **Path A** — Market Intelligence (relationships without projects)  
- **Path B** — Opportunity Intelligence (projects without prior relationship)

Companies exist even when no Opportunity exists.  
Opportunities may attach to Companies with Relationship Score = 0.

---

## 2. Knowledge graph overview

```text
                         COMPANY
            ┌───────────────┼───────────────────┐
            │               │                   │
     Path A graph     Evidence core        Path B graph
            │               │                   │
     Contacts(Lead)    BuyingSignals      Opportunities
     Relationships*    Documents*         ProductRecommendations
     Emails            News*              Quotes*
     Meetings*         TradeShows*        Timeline stages
     Tasks             Provenance         Tasks/Activities
     Newsletter*       Confidence         Scores (Opp/Fit)
     Rel Score                             
            │               │                   │
            └───────────────┴───────────────────┘
                              │
                    Intelligence Inbox decisions
                              │
                    LearningEvents
                              │
                    Suppliers* (future, separate nodes)
```

\* = object may be first-class entity, Activity subtype, or linked artifact in V1; graph relation is mandatory even if storage is Activity/Evidence.

---

## 3. Node catalog

| Node | Storage (V1) | Relation to Company |
|------|--------------|---------------------|
| **Company** | Company entity | Root |
| **Evidence** | Evidence | `company_id` required |
| **Contacts** | Lead | `company_id` |
| **Relationships** | Derived + path_a_status + Rel score | On Company; touches via Activity/Email |
| **Projects** | Opportunity | `company_id` (alias: project = Opportunity) |
| **Buying Signals** | BuyingSignal | `company_id` + evidence_ids |
| **Emails** | EmailOutreach / EmailQueue | `company_id` + `lead_id` |
| **Meetings** | Activity type meeting | `company_id` / `lead_id` / `opportunity_id` |
| **Tasks** | Task | `company_id` / `lead_id` / `opportunity_id` |
| **Trade Shows** | Evidence type or tag + Activity | Linked via Evidence/Activity |
| **News** | Evidence (media) | `company_id` |
| **Documents** | Evidence artifact_url / uploads | `company_id` |
| **Suppliers** | Supplier* future | **Not** children of buyer Company; matched later |
| **Quotes** | Opportunity stage `quoted` + Activity/doc Evidence | Via Opportunity |
| **Activities** | Activity | Multi-link |
| **Timeline** | Opportunity.timeline_stage + Company activity stream | Dual timelines (see §6) |
| **Relationship Score** | Company.relationship_score | Path A |
| **Opportunity Score** | On each Opportunity | Path B |
| **Strategic Fit Score** | On each Opportunity | Path B |
| **Confidence** | Evidence.confidence; OpportunityConfidence; verification_confidence | Multi-layer |
| **Source Provenance** | source_type / evidence links / extractor | On Company + Evidence + Opp snapshots |

---

## 4. Edge definitions (how objects relate)

| From | To | Edge meaning |
|------|-----|--------------|
| Company | Lead | employs / has contact |
| Company | Evidence | evidenced_by |
| Evidence | BuyingSignal | supports |
| BuyingSignal | Opportunity | indicates |
| Evidence | Opportunity | supports (direct) |
| Opportunity | ProductRecommendation | recommends |
| ProductRecommendation | Evidence/Signal | justified_by |
| Opportunity | Task/Activity | execution |
| Lead | EmailOutreach | messaged |
| Company | EmailOutreach | account-level send |
| Company | IntelligenceInboxItem | queued_as |
| Inbox | LearningEvent | decided |
| Opportunity | OpportunitySupplierMatch | future matched_to Supplier |

**Invariant:** No Opportunity edge without Evidence support.  
**Invariant:** No Contact email edge fabricated.

---

## 5. Scores on the graph

| Score | Lives on | Independent? |
|-------|----------|--------------|
| Relationship Score | Company | Yes — Path A |
| Opportunity Score | Opportunity | Yes — Path B |
| Strategic Fit Score | Opportunity | Yes |
| Priority Index | Inbox item | Composite for ranking only |
| OpportunityConfidence | Opportunity / pack | Evidence quality 0–1 ≠ Opp Score |
| verification_confidence | Company | Identity truth |

---

## 6. Timelines (do not conflate)

| Timeline | Owner | Stages |
|----------|-------|--------|
| **Opportunity Timeline** | Opportunity | signal → research → verified → qualified → quoted → negotiation → won → lost → repeat_business (`21`) |
| **Path A status** | Company | observed → verified → nurtured → customer → churn_risk |
| **Lead pipeline status** | Lead (CRM execution) | new → contacted → qualified → proposal → negotiation → won → lost |
| **Activity stream** | Company 360 UI | Chronological Evidence, emails, meetings, decisions |

**Approve landing (canonical lock):** Inbox Approve sets Opportunity.timeline_stage = `verified` (or `qualified` if sales already qualifies in-decision). Never `new`. Legacy Lead.status may remain `new` for contact cadence.

---

## 7. Company 360 view model (IA)

Sections (see `23`):

1. Header: name, country, vertical packs, verification, Rel score  
2. Path A: contacts, nurture, emails, relationship factors  
3. Evidence & signals  
4. Opportunities (scores, timeline, recommendations)  
5. Tasks / activities / documents  
6. Provenance & confidence  
7. Inbox/decision history  

---

## 8. Provenance model

Every important field should carry or inherit:

- `source_type` (catalog `27`)  
- `evidence_ids` when factual  
- `extractor` / `updated_by`  
- `observed_at` / `expires_at`  

Manual attestation: `created_by` + note.

---

## 9. Future: Supplier nodes

Suppliers are **separate graph parties** with capabilities.  
Matching connects Opportunity → Supplier without merging into buyer Company.  
V1: reserved entities only (`21`).

---

## 10. Freeze note

Company-as-hub and edge invariants are frozen. Storage optimizations allowed; graph meaning is not.
