# Milestone 1.1 — Foundation Migration Report

**Sprint:** Foundation Migration  
**Date:** 2026-07-18  
**Scope:** Structural preparation only (no Discovery, AI, scrape, recommendations UI)  
**Status:** Schemas + backfill function landed; app build verified

---

## 1. Architecture Compliance Report

### Current state (before sprint)

| Area | Finding |
|------|---------|
| In-repo entities | Lead, EmailTemplate, OutreachCampaign, EmailOutreach, EmailQueue, InboxStats |
| Cloud-only (used, not in git) | Company, Task, Activity |
| Missing IPP entities | Evidence, BuyingSignal, Opportunity, ProductRecommendation, VerticalPack, IntelligenceInboxItem, LearningEvent |
| Lead.company_id | Missing |
| Opportunity scores / timeline | Missing |
| FK graph | Name-match Company↔Lead only |
| Indexes in Base44 JSONC | Not supported in existing schema format |

### Gaps vs Entity Dictionary (`33`)

| Item | Status before | Action this sprint |
|------|---------------|-------------------|
| Company IPP fields | Missing from git | **Created** `Company.jsonc` with dictionary fields + legacy UI fields |
| Lead.company_id | Missing | **Added** |
| Lead.source hubspot/discovery | Missing | **Added** |
| Evidence | Missing | **Created** |
| BuyingSignal | Missing | **Created** |
| Opportunity + scores + timeline + evidence_ids/signal_ids | Missing | **Created** |
| ProductRecommendation | Missing | **Created** |
| VerticalPack | Missing | **Created** |
| IntelligenceInboxItem | Missing | **Created** |
| LearningEvent | Missing | **Created** |
| Task / Activity in git | Missing | **Created** (preserve existing field usage + company_id/opportunity_id) |
| EmailOutreach.company_id | Missing | **Added** |
| Supplier stubs | Future | **Not created** (out of M1.1 explicit list) |
| Team/Organization/AIJob | Not in architecture | **Not invented** |

### Naming / duplicates

- Contact remains **Lead** entity (correct).  
- Intelligence Inbox ≠ InboxStats (correct; both schemas present).  
- No duplicate entity concepts introduced.

### Data integrity risks (pre-migration)

| Risk | Mitigation |
|------|------------|
| Orphan Leads without company_id | Nullable FK + `migration_unresolved` + backfill dry-run |
| Ambiguous company names | Backfill marks unresolved; never fabricates match |
| Destructive overwrite | Backfill never overwrites existing company_id |

---

## 2. Migration Plan

| Entity | Existing | New fields | New indexes | Data conversion |
|--------|----------|------------|-------------|-----------------|
| Company | Cloud UI fields | IPP hub fields; keep industry/location/annual_revenue/potential_needs | Logical only (see §4) | Normalize name/domain on backfill create |
| Lead | Yes | company_id, evidence_ids, migration_unresolved; source enum expand | Logical company_id | backfillCompanies |
| Evidence | No | Full create | Logical | None (empty) |
| BuyingSignal | No | Full create | Logical | None |
| Opportunity | No | Full create | Logical | None |
| ProductRecommendation | No | Full create | Logical | None |
| VerticalPack | No | Full create | Logical | Seed later (Sprint 2.1) |
| IntelligenceInboxItem | No | Full create | Logical | None |
| LearningEvent | No | Full create | Logical | None |
| Task | Cloud | company_id, opportunity_id + git schema | Logical | None |
| Activity | Cloud | company_id, opportunity_id + git schema | Logical | None |
| EmailOutreach | Yes | company_id | Logical | Optional later |

**No destructive changes. Backward compatibility mandatory.** Legacy `company_name` preserved.

---

## 3. Files Modified / Added

### Added
- `base44/entities/Company.jsonc`
- `base44/entities/Evidence.jsonc`
- `base44/entities/BuyingSignal.jsonc`
- `base44/entities/Opportunity.jsonc`
- `base44/entities/ProductRecommendation.jsonc`
- `base44/entities/VerticalPack.jsonc`
- `base44/entities/IntelligenceInboxItem.jsonc`
- `base44/entities/LearningEvent.jsonc`
- `base44/entities/Task.jsonc`
- `base44/entities/Activity.jsonc`
- `base44/functions/backfillCompanies/entry.ts`
- `docs/MILESTONE_1_1_FOUNDATION_REPORT.md` (this file)

### Modified
- `base44/entities/Lead.jsonc` — company_id, evidence_ids, migration_unresolved, source enum
- `base44/entities/EmailOutreach.jsonc` — company_id

### Not modified (by design)
- All `src/**` UI pages/components  
- Discovery/AI/scrape functions  
- Styling, routes (except no route changes)

---

## 4. Database Changes

### Relationships (logical FKs as string id fields)

| Child | FK field | Parent |
|-------|----------|--------|
| Lead | company_id | Company |
| Evidence | company_id, opportunity_id | Company, Opportunity |
| BuyingSignal | company_id, evidence_ids[], vertical_pack_id | Company, Evidence, VerticalPack |
| Opportunity | company_id, vertical_pack_id, evidence_ids[], signal_ids[] | Company, VerticalPack, Evidence, BuyingSignal |
| ProductRecommendation | company_id, opportunity_id, evidence_ids[], signal_ids[] | Company, Opportunity, Evidence, BuyingSignal |
| IntelligenceInboxItem | company_id, opportunity_id | Company, Opportunity |
| LearningEvent | company_id, opportunity_id, inbox_item_id | Company, Opportunity, Inbox |
| Task | company_id, lead_id, opportunity_id | Company, Lead, Opportunity |
| Activity | company_id, lead_id, opportunity_id | Company, Lead, Opportunity |
| EmailOutreach | company_id, lead_id | Company, Lead |
| Company | duplicate_of_id | Company |

Base44 does not expose SQL foreign-key constraints in `.jsonc`; integrity is enforced by services + application rules.

### Indexes

Requested indexes documented as **logical** on entity descriptions.  
**Base44 entity JSONC has no supported index DDL** in this repo’s existing schema pattern — platform-side indexing is opaque. No fake index keys invented.

---

## 5. Remaining Technical Debt

| Item | Priority |
|------|----------|
| Deploy/sync schemas to Base44 cloud production | High |
| Run `backfillCompanies` dry_run then apply in staging | High |
| Seed VerticalPack `plastic_molds` + `industrial_water` | Next sprint (2.1) |
| Unify pages.config routing (QW-2 / Sprint 0.1) | Next |
| HubSpot contract fix | Next |
| company_id not yet used in UI LeadForm | Later (UI sprint) |
| Supplier stubs not created (deferred by M1.1 scope) | Future |
| True DB FK/index enforcement depends on Base44 platform | Platform limit |

---

## 6. Build Status

| Check | Result |
|-------|--------|
| `npm install` | **Pass** |
| `npm run build` (vite) | **Pass** (exit 0) |
| App compilation | **Success** — production bundle builds |

No import/routing/entity-registration failures introduced by this sprint. UI source untouched.

---

## 7. Test Status

| Test | Result |
|------|--------|
| Vite production build | **Pass** |
| `npm run typecheck` | **Fail (pre-existing)** — hundreds of UI/shadcn prop typing errors across `src/pages` and `src/components`; **none caused by entity JSONC / backfill**. Out of M1.1 scope (no unrelated refactor). |
| Entity unit tests | N/A (none in repo) |
| `backfillCompanies` | Implemented; requires Base44 auth + deployed schemas. Default `dry_run: true`. |

**Compile gate for this sprint:** satisfied via `npm run build`.

---

## 8. Next Recommended Sprint

**After cloud schema sync:**

1. Deploy/sync new `.jsonc` entities to Base44 production.  
2. Run `backfillCompanies` `{ dry_run: true }` → review → `{ apply: true }`.  
3. **Sprint 2.1** — Seed VerticalPack `plastic_molds` + `industrial_water`.  
4. Optionally Sprint 0.1/0.2 — routing unify + HubSpot contract.

Do **not** start Discovery Engine / AI extraction until backfill is reviewed.
