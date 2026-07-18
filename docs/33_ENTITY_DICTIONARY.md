# 33 — Entity Dictionary (Canonical)

**Status:** Single source of truth for all IPP entities  
**Architecture:** FROZEN (`31`) — this dictionary does not redesign; it consolidates  
**Platform:** Base44 entities  
**Rule:** No persistence entity may be implemented unless it appears here as **Persistence Entity**. Logical aliases are documented explicitly and must not be created as duplicate tables.

---

## 0. Consistency report (read before definitions)

The requested name list was checked against docs `03`, `11`, `12`, `20`–`32`.  
**No new entities were invented.** Items that are **not** separate persistence entities in the approved architecture are listed below and mapped to the approved representation.

| Requested name | Status in frozen architecture | Canonical representation |
|----------------|------------------------------|---------------------------|
| Company | Persistence Entity | `Company` |
| Contact | **Alias** | DB entity **`Lead`** (UI: Contact) |
| Evidence | Persistence Entity | `Evidence` |
| SourceRecord | **Not defined as entity** | Provenance fields on `Evidence` + Source Catalog (`27`) codes |
| BuyingSignal | Persistence Entity | `BuyingSignal` |
| Opportunity | Persistence Entity | `Opportunity` |
| OpportunityTimeline | **Not an entity** | Field `Opportunity.timeline_stage` + stage enum (`21` §8) |
| Relationship | **Not an entity** | `Company.path_a_status` + activities/emails graph (`29`) |
| RelationshipScore | **Not an entity** | Field `Company.relationship_score` (0–100) |
| OpportunityScore | **Not an entity** | Field `Opportunity.opportunity_score` (0–100) |
| StrategicFitScore | **Not an entity** | Field `Opportunity.strategic_fit_score` (0–100) |
| Recommendation | **Alias** | Persistence entity **`ProductRecommendation`** |
| VerticalPack | Persistence Entity | `VerticalPack` |
| DiscoverySource | **Not an entity** | Catalog entries (`27`); referenced by `VerticalPack.discovery_source_ids` |
| AIJob | **Not defined as entity** | Use function/job patterns; `EmailQueue` is the existing job entity; do **not** invent `AIJob` without PO redesign |
| IntelligenceInbox | **Alias** | Persistence entity **`IntelligenceInboxItem`** |
| Activity | Persistence Entity | `Activity` |
| Task | Persistence Entity | `Task` |
| Meeting | **Logical subtype** | `Activity` with `type = meeting` (`29`) |
| Email | **Split across entities** | `EmailOutreach`, `EmailQueue`, `EmailTemplate` |
| TradeShow | **Logical / evidence** | Evidence + Activity/tags — not a first-class table in V1 (`29`) |
| Document | **Logical / evidence** | `Evidence.artifact_url` / uploads — not a first-class table in V1 (`29`) |
| Quote | **Logical** | `Opportunity.timeline_stage = quoted` + Activity/Evidence (`29`) |
| User | **Platform** | Base44 Auth user — no custom IPP schema in `21` |
| Team | **Not in architecture** | **Do not invent** |
| Organization | **Not in architecture** | **Do not invent** (would collide with Company) |
| Product | **Catalog value** | Codes inside `VerticalPack.typical_products` / recommendation rules |
| ProductCategory | **Not in architecture** | **Do not invent** |
| Service | **Catalog value** | Service codes in Recommendation Engine (`30`) |
| Supplier | Future Persistence Entity | Stub (`21`) |
| SupplierCapability | Future Persistence Entity | Stub (`21`) |

### Additional persistence entities already approved (must be in dictionary)

| Entity | Source |
|--------|--------|
| Lead | `03`, `21` |
| EmailTemplate | `03`, `21` |
| OutreachCampaign | `03`, `21` |
| EmailOutreach | `03`, `21` |
| EmailQueue | `03`, `21` |
| InboxStats | `03`, `21` |
| LearningEvent | `21` |
| OpportunitySupplierMatch | Future stub (`21`) |
| Priority Index | Computed field on `IntelligenceInboxItem` — not an entity |

### Naming lock

- **Company** not Account  
- **Lead** = Contact (DB name)  
- **BuyingSignal** not bare “Signal” entity  
- **IntelligenceInboxItem** ≠ **InboxStats**  
- **ProductRecommendation** = Recommendation  

---

## 1. Dictionary template key

Each **Persistence Entity** section uses the required fields.  
**Logical / Score / Alias** sections use a reduced template and state “Not a persistence entity.”

**Cascade default (unless stated):** Soft-archive preferred; hard delete of Company is admin-only and blocked if Opportunities exist (recommended rule).

---

# PART A — CORE PERSISTENCE ENTITIES (V1)

---

## Company

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Company |
| **Purpose** | Industrial organization hub; convergence of Path A and Path B |
| **Business Definition** | A real-world industrial buyer/account that may be nurtured without a project and/or pursued when evidenced opportunities exist |
| **Technical Definition** | Base44 entity `Company`; root node of Company Intelligence Graph (`29`) |
| **Owner Module** | CRM + Intelligence (hub); Discovery writes, CRM executes |
| **Primary Responsibilities** | Identity, verification, Relationship Score, Path A status, link contacts/evidence/opportunities |
| **Lifecycle** | observed → verified → nurtured → customer → churn_risk (`path_a_status`); verification_status independent |
| **Status Values** | `verification_status`: unverified \| pending \| verified \| rejected · `path_a_status`: observed \| verified \| nurtured \| customer \| churn_risk |
| **Required Fields** | name |
| **Optional Fields** | normalized_name, website, domain, country, industry_raw, vertical_pack_ids[], size, description, linkedin_url, verification_*, relationship_score*, source_provenance, tags, notes, duplicate_of_id, supplier_match_enabled |
| **Relationships** | 1:N Lead, Evidence, BuyingSignal, Opportunity, IntelligenceInboxItem, Task, Activity, EmailOutreach; M:N VerticalPack via ids |
| **Incoming References** | Lead.company_id, Evidence.company_id, … |
| **Outgoing References** | duplicate_of_id → Company; vertical_pack_ids → VerticalPack |
| **Created By** | Human, Discovery (`companyDiscover`), backfill, HubSpot/CRM import |
| **Modified By** | Verification, scoring jobs, CRM users, Inbox promote |
| **Validation Rules** | No fabricated domain; evidence-backed description preferred |
| **Duplicate Rules** | domain+country unique when domain set; else normalized_name+country soft unique; merge via duplicate_of_id |
| **Source of Truth** | Company record + linked Evidence for factual claims |
| **AI Permissions** | May extract/suggest fields from artifacts; may NOT invent company; may recommend match/dedupe |
| **Allowed Operations** | CRUD (auth); verify; score; merge (admin) |
| **Future Compatibility** | supplier_match_enabled; never means Supplier |

---

## Lead (Contact)

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Lead *(canonical DB)* / Contact *(UI)* |
| **Purpose** | Person related to a Company for relationship and outreach |
| **Business Definition** | Decision maker or stakeholder; not the project itself |
| **Technical Definition** | Existing Base44 `Lead` + `company_id` (`21`) |
| **Owner Module** | CRM |
| **Primary Responsibilities** | Contact data, cadence, enrichment provenance, outreach targeting |
| **Lifecycle** | CRM pipeline status: new → contacted → qualified → proposal → negotiation → won \| lost *(contact/deal hybrid legacy; project truth is Opportunity)* |
| **Status Values** | status, priority, temperature, apollo_*, website_scan_status (existing) |
| **Required Fields** | first_name, last_name, company_name *(legacy)*; **target:** company_id required after backfill |
| **Optional Fields** | email, phone, job_title, linkedin_url, all existing Lead enrichment/WhatsApp/sequence fields, evidence_ids[] |
| **Relationships** | N:1 Company; 1:N Task, Activity, EmailOutreach |
| **Incoming References** | Task.lead_id, Activity.lead_id, EmailOutreach |
| **Outgoing References** | company_id → Company |
| **Created By** | Human, DecisionMakerDiscover, import, HubSpot; **never AI invention** |
| **Modified By** | CRM users, enrichment (verified fields only) |
| **Validation Rules** | Email/phone only if evidenced or dual-verified; banned placeholder emails (`enrichLead` pattern) |
| **Duplicate Rules** | Unique email per company when email present |
| **Source of Truth** | Lead row; contact facts prefer Evidence |
| **AI Permissions** | Extract published contacts; suggest enrichment; NEVER invent emails/phones/people |
| **Allowed Operations** | CRUD; enrich suggest; link company |
| **Future Compatibility** | Remains Contact entity name in DB |

---

## Evidence

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Evidence |
| **Purpose** | Attributable artifact-backed claim |
| **Business Definition** | Proof that a fact about a Company (or Opportunity) is real |
| **Technical Definition** | Base44 `Evidence` (`12`, `21`) |
| **Owner Module** | Discovery / Verification |
| **Primary Responsibilities** | Provenance, confidence, freshness, quarantine |
| **Lifecycle** | active → expired \| quarantined |
| **Status Values** | active \| expired \| quarantined |
| **Required Fields** | company_id, type, claim, source_type; artifact_url **OR** manual_attestation+user |
| **Optional Fields** | opportunity_id, artifact_hash, source_weight, confidence, observed_at, expires_at, extractor, raw_excerpt |
| **Relationships** | N:1 Company; N:1 Opportunity optional; supports BuyingSignal/Opportunity via id arrays |
| **Incoming References** | BuyingSignal.evidence_ids, Opportunity.evidence_ids, ProductRecommendation.evidence_ids |
| **Outgoing References** | company_id, opportunity_id |
| **Created By** | evidenceIngest, human attestation, imports |
| **Modified By** | evidenceVerify, expiry jobs |
| **Validation Rules** | No evidence without artifact/attestation; claim atomic |
| **Duplicate Rules** | artifact_url + claim hash |
| **Source of Truth** | This entity for factual claims |
| **AI Permissions** | Extract claims from artifacts; NEVER invent artifacts/URLs/facts |
| **Allowed Operations** | Create, verify, quarantine, expire |
| **Future Compatibility** | Types extensible per `12` |

*Note: Requested **SourceRecord** is not separate — Evidence + `source_type` is SoT.*

---

## BuyingSignal

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | BuyingSignal |
| **Purpose** | Classified buying indicator derived from Evidence |
| **Business Definition** | A coded industrial demand/trigger (e.g. factory expansion, tender) |
| **Technical Definition** | Base44 `BuyingSignal`; codes from `12` taxonomy |
| **Owner Module** | Intelligence (Discovery/Signal) |
| **Primary Responsibilities** | Link evidence → taxonomy → Opportunity scoring inputs |
| **Lifecycle** | active → expired \| dismissed |
| **Status Values** | active \| expired \| dismissed · intensity soft\|medium\|strong |
| **Required Fields** | company_id, code, evidence_ids (≥1) |
| **Optional Fields** | confidence, observed_at, vertical_pack_id, geography, intensity |
| **Relationships** | N:1 Company; M:N Evidence via evidence_ids; consumed by Opportunity.signal_ids |
| **Incoming References** | Opportunity.signal_ids |
| **Outgoing References** | company_id, vertical_pack_id, evidence_ids |
| **Created By** | signalDetect (AI classify + rules); human |
| **Modified By** | Expiry, dismiss, intensity upsert |
| **Validation Rules** | evidence_ids min 1; code ∈ VerticalPack allowlist when pack set |
| **Duplicate Rules** | Upsert same company+code+day |
| **Source of Truth** | Signal row + cited Evidence |
| **AI Permissions** | Classify from evidence; NEVER create signal without evidence_ids |
| **Allowed Operations** | Create, dismiss, expire |
| **Future Compatibility** | Taxonomy growth via `12` |

---

## Opportunity

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Opportunity |
| **Purpose** | Project-shaped commercial pursuit (Path B) |
| **Business Definition** | An industrial project hypothesis/approved opportunity tied to a Company |
| **Technical Definition** | Base44 `Opportunity` including **timeline_stage** (Opportunity Timeline is this field, not another entity) |
| **Owner Module** | Sales / Intelligence (promote) |
| **Primary Responsibilities** | Scores, timeline, evidence binding, CRM promotion |
| **Lifecycle (Opportunity Timeline)** | signal → research → verified → qualified → quoted → negotiation → won → lost → repeat_business |
| **Status Values** | timeline_stage (above); inbox_status: pending\|approved\|rejected\|needs_research\|nurture_only |
| **Required Fields** | company_id, evidence_ids (≥1 for create/promote) |
| **Optional Fields** | title, summary, vertical_pack_id, opportunity_score, strategic_fit_score, confidence (OpportunityConfidence 0–1), estimated_value, currency, signal_ids, product_recommendation_ids, reject_reason_code, crm_promoted_at, owner, next_action |
| **Relationships** | N:1 Company; M:N Evidence/Signals; 1:N ProductRecommendation, Task, Activity; 1:1-ish Inbox item |
| **Incoming References** | IntelligenceInboxItem.opportunity_id, Task.opportunity_id |
| **Outgoing References** | company_id, vertical_pack_id, evidence_ids, signal_ids |
| **Created By** | Inbox promote / analyst; never raw scrape alone |
| **Modified By** | Sales stage moves, scoring jobs |
| **Validation Rules** | Anti-fabrication: no empty evidence_ids; Approve landing stage `verified` (or `qualified`) — **not** `new` (`29`) |
| **Duplicate Rules** | Same company + overlapping evidence cluster ≤30d → merge suggest |
| **Source of Truth** | Opportunity + Evidence |
| **AI Permissions** | Summarize, factor assist for scores, recommend products; NEVER invent opportunity without evidence |
| **Allowed Operations** | Create (gated), update stage, score, attach recommendations |
| **Future Compatibility** | OpportunitySupplierMatch |

---

## ProductRecommendation (Recommendation)

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | ProductRecommendation |
| **Purpose** | Evidence-bound product/service suggestion |
| **Business Definition** | Proposed offer element justified by signals/evidence — never speculative |
| **Technical Definition** | Base44 `ProductRecommendation` (`21`, `30`) |
| **Owner Module** | AI / Recommendation Engine |
| **Primary Responsibilities** | Store recommendations for Inbox/Opportunity UI |
| **Lifecycle** | suggested → accepted \| dismissed |
| **Status Values** | suggested \| accepted \| dismissed |
| **Required Fields** | evidence_ids (≥1), signal_ids (≥1), product_code/label (or service equivalent in payload) |
| **Optional Fields** | company_id, opportunity_id, rationale, confidence |
| **Relationships** | N:1 Company/Opportunity; cites Evidence & BuyingSignal |
| **Created By** | recommendProducts |
| **Modified By** | Human accept/dismiss |
| **Validation Rules** | product_code ∈ VerticalPack catalog; ids must exist in inputs |
| **Duplicate Rules** | Same opportunity+product_code upsert |
| **Source of Truth** | Recommendation row + cited evidence |
| **AI Permissions** | Create suggestions only; NEVER invent evidence or opportunities |
| **Allowed Operations** | Create suggest, accept, dismiss |
| **Future Compatibility** | suppliers[] empty until Supplier matching |

---

## VerticalPack

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | VerticalPack |
| **Purpose** | Plug-in industrial sector configuration |
| **Business Definition** | All sector-specific sources, signals, products, prompts, KPIs without redesign |
| **Technical Definition** | Base44 `VerticalPack` (`21`, `28`) |
| **Owner Module** | Admin / Config |
| **Primary Responsibilities** | Constrain discovery, scoring weights, recommendations |
| **Lifecycle** | draft → active → inactive |
| **Status Values** | active boolean |
| **Required Fields** | code, name |
| **Optional Fields** | discovery_source_ids, buying_signal_codes, decision_maker_roles, typical_equipment/products, sales_cycle_*, prompt_template_keys, kpi_defs, score_weights, product_recommendation_rules |
| **Relationships** | Referenced by Company, Opportunity, BuyingSignal |
| **Created By** | Admin |
| **Modified By** | Admin |
| **Validation Rules** | Unique code; signal codes ⊆ Doc `12` |
| **Duplicate Rules** | Unique code |
| **Source of Truth** | This config entity |
| **AI Permissions** | Read-only for prompts; may NOT redefine MUST NEVER rules |
| **Allowed Operations** | Admin CRUD |
| **Future Compatibility** | Unlimited packs |

*DiscoverySource is **not** a child entity — ids point at catalog `27`.*

---

## IntelligenceInboxItem (Intelligence Inbox)

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | IntelligenceInboxItem |
| **Purpose** | Human/policy approval gate before CRM pollution |
| **Business Definition** | Work item for Path A nurture and/or Path B opportunity decisions |
| **Technical Definition** | Base44 `IntelligenceInboxItem` (`21`) |
| **Owner Module** | Intelligence Inbox |
| **Primary Responsibilities** | Queue, snapshot scores, capture decisions |
| **Lifecycle** | pending → approved \| rejected \| needs_research \| nurture_only |
| **Status Values** | pending \| approved \| rejected \| needs_research \| nurture_only · path A\|B\|AB |
| **Required Fields** | company_id, status |
| **Optional Fields** | opportunity_id, priority_index, score snapshots, recommendation_summary, assignee, decision_* |
| **Relationships** | N:1 Company; optional Opportunity; produces LearningEvent |
| **Created By** | Scoring/Inbox services after discovery |
| **Modified By** | Human decide / policy |
| **Validation Rules** | Reject requires reason_code |
| **Duplicate Rules** | One pending item per opportunity hypothesis cluster |
| **Source of Truth** | Inbox item + snapshots |
| **AI Permissions** | Rank/recommend action; NEVER auto-approve unless future policy; NEVER fabricate item facts |
| **Allowed Operations** | List, decide, promote (via service) |
| **Future Compatibility** | Auto-approve policy (default off) |

---

## LearningEvent

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | LearningEvent |
| **Purpose** | Record approve/reject/win/loss for continuous learning |
| **Technical Definition** | Base44 `LearningEvent` (`21`) |
| **Owner Module** | Intelligence / Learning |
| **Required Fields** | type, created_at |
| **Optional Fields** | inbox_item_id, opportunity_id, reason_code, payload |
| **AI Permissions** | System writes; AI may consume later — may NOT rewrite history |
| **Implementation Priority** | Core V1 |
| *(Other template fields)* | Lifecycle: immutable append-only; Relationships: optional FKs to Inbox/Opportunity |

---

## Activity

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Activity |
| **Purpose** | CRM/intel activity log (calls, notes, meetings, outcomes) |
| **Business Definition** | What happened with a contact/company/opportunity |
| **Technical Definition** | Existing Activity (+ company_id, opportunity_id) |
| **Owner Module** | CRM |
| **Status Values** | completed boolean; type includes **meeting** (Meeting is not separate) |
| **Required Fields** | Per existing usage: typically lead_id or company_id, type, title |
| **Optional Fields** | description, outcome, opportunity_id, company_id |
| **Relationships** | N:1 Lead/Company/Opportunity |
| **AI Permissions** | May create summary notes from evidenced actions; NEVER invent meetings |
| **Allowed Operations** | CRUD |
| **Implementation Priority** | Core V1 |

---

## Task

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Task |
| **Purpose** | Actionable work item |
| **Owner Module** | CRM |
| **Status Values** | completed; priority; type (call\|email\|follow_up\|…) |
| **Required Fields** | title; typically lead_id or company_id |
| **Optional Fields** | opportunity_id, due_date, notes, auto_generated, stage_trigger |
| **Relationships** | N:1 Lead, Company, Opportunity |
| **AI Permissions** | May recommend next tasks; human/system creates; no fake completion |
| **Implementation Priority** | Core V1 |

---

## EmailTemplate

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | EmailTemplate |
| **Purpose** | Reusable outreach/nurture content |
| **Owner Module** | CRM / Outreach |
| **AI Permissions** | May draft; human owns publish |
| **Implementation Priority** | Core V1 (KEEP) |

---

## OutreachCampaign

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | OutreachCampaign |
| **Purpose** | Multi-step sequences |
| **Owner Module** | CRM / Outreach |
| **Implementation Priority** | Core V1 (KEEP) |

---

## EmailOutreach

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | EmailOutreach |
| **Purpose** | Tracked sent email record |
| **Owner Module** | CRM / Outreach |
| **Relationships** | lead_id, company_id optional; tracking_id |
| **AI Permissions** | May draft body; send is system/human; NEVER invent recipients |
| **Implementation Priority** | Core V1 |

---

## EmailQueue

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | EmailQueue |
| **Purpose** | SMTP outbound job queue |
| **Owner Module** | CRM / Outreach |
| **Status Values** | pending \| sent \| failed \| skipped |
| **Note** | Closest approved “job” entity; **AIJob was not approved** — do not create parallel job entity in V1 |
| **Implementation Priority** | Core V1 |

---

## InboxStats

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | InboxStats |
| **Purpose** | Daily SMTP per-inbox send/fail counts |
| **Owner Module** | CRM / Outreach |
| **Status Values** | N/A (date+inbox keyed) |
| **Critical** | **Not** Intelligence Inbox |
| **RLS** | Admin-only (`03`) |
| **Implementation Priority** | Core V1 |

---

# PART B — FUTURE PERSISTENCE ENTITIES

---

## Supplier (Future)

| Attribute | Definition |
|-----------|------------|
| **Entity Name** | Supplier |
| **Purpose** | Manufacturer/partner party (≠ buyer Company) |
| **Owner Module** | Supplier Intelligence (future) |
| **AI Permissions** | Future match only with capability evidence; V1: no UI/logic |
| **Implementation Priority** | Future |
| **Allowed Operations V1** | Schema stub only |

---

## SupplierCapability (Future)

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Machines, processes, MOQ, lead time, industries, countries, certs, references |
| **Owner Module** | Supplier Intelligence |
| **Relationships** | N:1 Supplier |
| **Implementation Priority** | Future |

---

## OpportunitySupplierMatch (Future)

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Opportunity → recommended suppliers |
| **Owner Module** | Supplier Intelligence |
| **Validation** | Cite opportunity evidence + supplier capability evidence (`30`) |
| **Implementation Priority** | Future |

---

# PART C — LOGICAL CONCEPTS & SCORES (NOT PERSISTENCE ENTITIES)

---

## OpportunityTimeline

| Attribute | Definition |
|-----------|------------|
| **Kind** | Enum field lifecycle on Opportunity |
| **Values** | signal → research → verified → qualified → quoted → negotiation → won → lost → repeat_business |
| **Owner Module** | Sales |
| **Do not create** | Separate `OpportunityTimeline` table |

---

## Relationship (Path A)

| Attribute | Definition |
|-----------|------------|
| **Kind** | Graph concept |
| **Storage** | Company.path_a_status + Activities/Emails/Leads |
| **Owner Module** | CRM / Market Intelligence |
| **Do not create** | Separate Relationship entity in V1 |

---

## RelationshipScore

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Path A trust/access score |
| **Owner** | Company / Scoring service `scoreRelationship` |
| **Calculation Source** | Doc `11` §9.1 deterministic code |
| **Range** | 0–100 |
| **Update Trigger** | Engagement, new DM, quarterly job, manual recompute |
| **Dependencies** | Leads, Emails, Activities, wins |
| **Display Rules** | Company 360 + Inbox snapshot |
| **AI** | May extract features; code owns final score |
| **Storage** | `Company.relationship_score` |

---

## OpportunityScore

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Path B project strength |
| **Owner** | Opportunity / `scoreOpportunity` |
| **Calculation Source** | Doc `11` §9.2 |
| **Range** | 0–100 |
| **Update Trigger** | New evidence/signals; Inbox build |
| **Dependencies** | Evidence, BuyingSignals, value/timing fields |
| **Display Rules** | Opportunity + Inbox |
| **Distinct from** | OpportunityConfidence (0–1 evidence quality) |
| **Storage** | `Opportunity.opportunity_score` |

---

## StrategicFitScore

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Fit to integrator + China supply model |
| **Owner** | Opportunity / `scoreStrategicFit` |
| **Calculation Source** | Doc `11` §9.3 + VerticalPack.score_weights |
| **Range** | 0–100 |
| **Update Trigger** | Pack change, opportunity update |
| **Dependencies** | VerticalPack, geography, capability |
| **Display Rules** | Opportunity + Inbox |
| **Storage** | `Opportunity.strategic_fit_score` |

---

## Priority Index

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Inbox ranking only |
| **Formula** | 0.45·Opp + 0.35·Fit + 0.20·Rel (`11`) |
| **Storage** | `IntelligenceInboxItem.priority_index` |
| **Not** | A separate entity |

---

## Meeting / TradeShow / Document / Quote / Email (logical)

| Logical | Storage |
|---------|---------|
| Meeting | Activity.type = meeting |
| TradeShow | Evidence + Activity/tags |
| Document | Evidence.artifact_* |
| Quote | Opportunity.timeline_stage = quoted + Activity/Evidence |
| Email (generic) | EmailOutreach / EmailQueue / EmailTemplate |

---

## Product / Service / ProductCategory

| Logical | Storage |
|---------|---------|
| Product | VerticalPack catalog codes + ProductRecommendation.product_code |
| Service | Recommendation Engine service_code (`30`) |
| ProductCategory | **Not approved** — do not invent |

---

## User / Team / Organization

| Name | Status |
|------|--------|
| User | Base44 Auth platform user (owner emails on records) |
| Team | **Not in frozen architecture** — report only; no entity |
| Organization | **Not in frozen architecture** — use Company for industrial orgs; tenant = Base44 app |

---

## SourceRecord / DiscoverySource / AIJob

| Name | Status |
|------|--------|
| SourceRecord | **Not approved** — use Evidence provenance |
| DiscoverySource | **Catalog concept** (`27`), not Base44 entity |
| AIJob | **Not approved** — use existing queues/functions; escalate to PO if dedicated job entity required later |

---

# PART D — RELATIONSHIP RULES (GLOBAL)

| From → To | Cardinality | Required | Cascade / Delete |
|-----------|-------------|----------|------------------|
| Company → Lead | 1:N | company_id required post-migration | Delete Company blocked if Leads/Opps (soft) |
| Company → Evidence | 1:N | Required on Evidence | Evidence orphan forbidden |
| Company → BuyingSignal | 1:N | Required | Cascade soft-dismiss on company merge |
| Company → Opportunity | 1:N | Required | Block hard delete |
| Company → InboxItem | 1:N | Required | Soft-close on merge |
| Evidence → BuyingSignal | M:N (ids) | ≥1 evidence | If evidence quarantined, signals recompute/dismiss |
| BuyingSignal → Opportunity | M:N (ids) | Optional until promote | — |
| Opportunity → ProductRecommendation | 1:N | Optional | Delete with opportunity soft |
| Opportunity → Task/Activity | 1:N | Optional | Keep history |
| Lead → EmailOutreach | 1:N | Optional | Keep |
| VerticalPack → Opportunity | 1:N | Optional | Pack deactivate does not delete opps |
| Opportunity → SupplierMatch | 1:N future | — | Future |
| Ownership | — | — | Company owned jointly; child rows owned by creating module |

---

# PART E — MATRICES

## Entity relationship matrix (Company-centric)

```text
Company
 ├── Lead (Contact)
 ├── Evidence
 │    └── BuyingSignal (via evidence_ids)
 ├── BuyingSignal
 ├── Opportunity
 │    ├── timeline_stage (Opportunity Timeline)
 │    ├── opportunity_score / strategic_fit_score / confidence
 │    ├── ProductRecommendation
 │    ├── Task
 │    ├── Activity (incl. Meeting)
 │    └── OpportunitySupplierMatch (Future)
 ├── IntelligenceInboxItem
 │    └── LearningEvent
 ├── Task
 ├── Activity
 ├── EmailOutreach
 ├── EmailQueue (account sends)
 ├── relationship_score / path_a_status
 └── vertical_pack_ids → VerticalPack
      ├── discovery_source_ids → Catalog 27 (not entity)
      ├── typical_products (Product codes)
      └── product_recommendation_rules

Standalone CRM KEEP
 ├── EmailTemplate
 ├── OutreachCampaign
 └── InboxStats

Future
 ├── Supplier
 │    └── SupplierCapability
 └── OpportunitySupplierMatch
```

## Ownership matrix

| Entity / Concept | Owner Module |
|------------------|--------------|
| Company | CRM + Intelligence (hub) |
| Lead (Contact) | CRM |
| Evidence | Discovery |
| BuyingSignal | Intelligence |
| Opportunity | Sales |
| Opportunity Timeline (field) | Sales |
| ProductRecommendation | AI / Recommendation |
| VerticalPack | Admin / Config |
| IntelligenceInboxItem | Intelligence Inbox |
| LearningEvent | Intelligence |
| Activity | CRM |
| Task | CRM |
| EmailTemplate / OutreachCampaign / EmailOutreach / EmailQueue | CRM / Outreach |
| InboxStats | CRM / Outreach |
| RelationshipScore | Scoring (on Company) |
| OpportunityScore | Scoring (on Opportunity) |
| StrategicFitScore | Scoring (on Opportunity) |
| Supplier* | Supplier Intelligence (Future) |
| DiscoverySource catalog | Config (doc `27`) |
| User | Platform Auth |

## Implementation priority

| Priority | Items |
|----------|-------|
| **Core V1** | Company, Lead, Evidence, BuyingSignal, Opportunity, ProductRecommendation, VerticalPack, IntelligenceInboxItem, LearningEvent, Activity, Task, EmailTemplate, OutreachCampaign, EmailOutreach, EmailQueue, InboxStats, all three scores + Priority Index (fields) |
| **Phase 2** | Richer TradeShow/Document first-class if PO elevates; Site/HQ hierarchy; dedicated job entity **only if PO redesign**; auto-approve; expanded packs |
| **Future** | Supplier, SupplierCapability, OpportunitySupplierMatch, Supplier matching AI |

---

# PART F — FINAL VALIDATION

| Check | Result |
|-------|--------|
| Every **approved** persistence entity from `21` is in this dictionary | **Pass** |
| Requested names that are not entities are reported, not invented | **Pass** (§0) |
| Relationships documented | **Pass** (Part D + matrix) |
| Owner modules defined | **Pass** |
| Every score has owner + calculation source | **Pass** |
| AI permissions defined for AI-touch entities | **Pass** |
| No duplicate persistence definitions (Contact≠second table) | **Pass** |
| No contradiction with freeze: Company hub, Path A/B, evidence rules | **Pass** |
| Team / Organization / ProductCategory / AIJob / SourceRecord **not invented** | **Pass** (reported absent) |

---

**This document is the definitive Entity Dictionary for all future implementation.**  
Implementers and agents must use these names and must not create persistence entities marked “Not an entity” / “Not in architecture” without an explicit product-owner redesign.
