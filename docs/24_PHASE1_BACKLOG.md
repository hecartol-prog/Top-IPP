# 24 — Phase 1 Backlog (Hour-Sized Sprints)

**Goal:** Every sprint leaves the app **runnable**. No big-bang rewrite.  
**Constitution:** Docs `20`–`23`, `01`–`12`.  
**Rule:** Each sprint lists files expected to change and files that MUST NOT change.

Effort key: **S** ≤ 3h · **M** 3–6h · Risk: L/M/H

---

## Sprint 0.1 — Unify routing

| | |
|--|--|
| **Goal** | All pages registered consistently so regen cannot drop CRM routes |
| **Effort** | S · **Risk** | L |
| **Files expected** | `src/pages.config.js`, possibly `src/App.jsx` |
| **MUST NOT change** | Edge functions, entity schemas, Lead business logic |
| **Acceptance** | Tasks, Templates, Outreach, Sequences, EmailOutreach reachable after clean load |
| **Rollback** | Revert the two files |
| **Test** | Click each nav item; no 404 |

---

## Sprint 0.2 — Fix HubSpot contract

| | |
|--|--|
| **Goal** | HubSpotPanel payload matches `hubspotSync` |
| **Effort** | S · **Risk** | M |
| **Files expected** | `src/components/integrations/HubSpotPanel.jsx` and/or `base44/functions/hubspotSync/entry.ts` |
| **MUST NOT change** | Lead schema, Inbox (not built yet) |
| **Acceptance** | Push/pull returns structured success/error; no silent no-op |
| **Rollback** | Revert those files |
| **Test** | Invoke push with 1 test lead in staging |

---

## Sprint 0.3 — Remove dead ProtectedRoute + fake badges

| | |
|--|--|
| **Goal** | Delete broken ProtectedRoute; honest integration status text |
| **Effort** | S · **Risk** | L |
| **Files expected** | `src/components/ProtectedRoute.jsx` (delete), `src/Layout.jsx`, HubSpot/LinkedIn panels |
| **MUST NOT change** | AuthContext behavior beyond badge copy |
| **Acceptance** | App boots; no “Connected” lie |
| **Rollback** | Restore deleted file from git |
| **Test** | Login + Integrations page |

---

## Sprint 0.4 — Commit missing entity schemas

| | |
|--|--|
| **Goal** | `Company`, `Task`, `Activity` JSONC in repo; Lead.source + hubspot |
| **Effort** | M · **Risk** | L |
| **Files expected** | `base44/entities/*.jsonc` |
| **MUST NOT change** | UI pages |
| **Acceptance** | Schemas match production fields used in UI |
| **Rollback** | Remove new files |
| **Test** | Typecheck/lint; spot-check Companies/Tasks pages |

---

## Sprint 1.1 — Company hub fields

| | |
|--|--|
| **Goal** | Extend Company schema: verification, relationship_score, provenance, vertical_pack_ids |
| **Effort** | M · **Risk** | M |
| **Files expected** | `base44/entities/Company.jsonc` |
| **MUST NOT change** | Scoring services (not yet), Lead UI beyond reading new fields |
| **Acceptance** | New fields exist; old Companies CRUD still works |
| **Rollback** | Revert schema; nullable fields unused |
| **Test** | Create/edit Company |

---

## Sprint 1.2 — Lead.company_id

| | |
|--|--|
| **Goal** | Add `company_id` to Lead; optional select in LeadForm |
| **Effort** | M · **Risk** | M |
| **Files expected** | `Lead.jsonc`, `LeadForm.jsx`, maybe `Leads.jsx` |
| **MUST NOT change** | Enrichment functions logic |
| **Acceptance** | Can link Lead→Company; legacy leads with null company_id still list |
| **Rollback** | Hide UI field; keep column |
| **Test** | Create lead with/without company |

---

## Sprint 1.3 — Company backfill job (manual-safe)

| | |
|--|--|
| **Goal** | Script/function: distinct company_name → Company + set company_id where unique |
| **Effort** | M · **Risk** | H |
| **Files expected** | New function e.g. `base44/functions/backfillCompanies/entry.ts` |
| **MUST NOT change** | Delete any Lead |
| **Acceptance** | Dry-run mode; apply mode idempotent; duplicates flagged |
| **Rollback** | Do not run apply; or clear company_id only |
| **Test** | Dry-run on staging copy |

---

## Sprint 1.4 — Relationship Score calculator (pure)

| | |
|--|--|
| **Goal** | Implement Doc 11 Rel score pure function + unit-testable module |
| **Effort** | S · **Risk** | L |
| **Files expected** | New `src/lib/scoring/relationshipScore.js` (or server util) |
| **MUST NOT change** | leadScoring.jsx behavior yet |
| **Acceptance** | Fixtures match Doc 11 factor caps |
| **Rollback** | Remove module |
| **Test** | Fixture table assertions |

---

## Sprint 1.5 — Wire Rel score to Company

| | |
|--|--|
| **Goal** | Function `scoreRelationship` updates Company.relationship_score |
| **Effort** | M · **Risk** | M |
| **Files expected** | New edge function; call from Activity/Email hooks or manual button |
| **MUST NOT change** | Opportunity entities (not ready) |
| **Acceptance** | Button/recompute updates score on Company 360 |
| **Rollback** | Feature flag off |
| **Test** | Touch engagement → score changes |

---

## Sprint 2.1 — VerticalPack entity + seed

| | |
|--|--|
| **Goal** | VerticalPack schema; seed `plastic_molds`, `industrial_water` |
| **Effort** | M · **Risk** | L |
| **Files expected** | `base44/entities/VerticalPack.jsonc`, seed function or admin JSON |
| **MUST NOT change** | CRM outreach |
| **Acceptance** | List two active packs |
| **Rollback** | Deactivate packs |
| **Test** | Read packs via SDK |

---

## Sprint 2.2 — Evidence entity + create API

| | |
|--|--|
| **Goal** | Evidence schema + `evidenceIngest` rejects missing artifact |
| **Effort** | M · **Risk** | M |
| **Files expected** | Evidence.jsonc, `evidenceIngest/entry.ts` |
| **MUST NOT change** | Lead.create paths |
| **Acceptance** | 422 without artifact; 200 with URL attestation |
| **Rollback** | Disable function |
| **Test** | API cases above |

---

## Sprint 2.3 — BuyingSignal entity + detect

| | |
|--|--|
| **Goal** | Signals require evidence_ids; classify subset of Doc 12 codes |
| **Effort** | M · **Risk** | M |
| **Files expected** | BuyingSignal.jsonc, `signalDetect/entry.ts` |
| **MUST NOT change** | UI Inbox (next) |
| **Acceptance** | Cannot save signal with empty evidence_ids |
| **Rollback** | Disable function |
| **Test** | Fixture evidence → signal code |

---

## Sprint 2.4 — Evidence UI (minimal)

| | |
|--|--|
| **Goal** | From Company, add Evidence list/create |
| **Effort** | M · **Risk** | L |
| **Files expected** | New components under `src/components/intelligence/`, Company page |
| **MUST NOT change** | Pipeline.jsx |
| **Acceptance** | Analyst can attach evidence to company |
| **Rollback** | Hide nav entry |
| **Test** | Manual create + list |

---

## Sprint 3.1 — Opportunity + Timeline fields

| | |
|--|--|
| **Goal** | Opportunity entity with timeline_stage + score fields + evidence_ids required |
| **Effort** | M · **Risk** | M |
| **Files expected** | Opportunity.jsonc |
| **MUST NOT change** | Supplier stubs beyond reserved names |
| **Acceptance** | Schema enforces evidence_ids presence at service layer |
| **Rollback** | Unused entity |
| **Test** | Create rejected without evidence |

---

## Sprint 3.2 — Opp + Fit score calculators

| | |
|--|--|
| **Goal** | Pure functions Doc 11 §9.2–9.3 + priority index |
| **Effort** | S · **Risk** | L |
| **Files expected** | `src/lib/scoring/opportunityScore.js`, `strategicFitScore.js`, `priorityIndex.js` |
| **MUST NOT change** | UI |
| **Acceptance** | Fixtures pass |
| **Rollback** | Remove files |
| **Test** | Unit fixtures |

---

## Sprint 3.3 — Scoring edge functions

| | |
|--|--|
| **Goal** | `scoreOpportunity`, `scoreStrategicFit`, `scorePriority` |
| **Effort** | M · **Risk** | M |
| **Files expected** | New functions under `base44/functions/` |
| **MUST NOT change** | SMTP functions |
| **Acceptance** | Persists scores on Opportunity |
| **Rollback** | Flag off |
| **Test** | Seed opportunity with evidence |

---

## Sprint 3.4 — IntelligenceInboxItem + list API

| | |
|--|--|
| **Goal** | Inbox entity + list pending by priority |
| **Effort** | M · **Risk** | M |
| **Files expected** | IntelligenceInboxItem.jsonc, `inboxList/entry.ts` |
| **MUST NOT change** | Auto-promote |
| **Acceptance** | Items sortable by priority_index |
| **Rollback** | Disable |
| **Test** | Insert 2 items; order correct |

---

## Sprint 3.5 — Inbox UI (decide without promote)

| | |
|--|--|
| **Goal** | Inbox page: view + Reject/Needs research only |
| **Effort** | M · **Risk** | L |
| **Files expected** | `src/pages/IntelligenceInbox.jsx`, Layout nav, pages.config |
| **MUST NOT change** | CRM promote |
| **Acceptance** | Reject requires reason_code |
| **Rollback** | Remove route |
| **Test** | Reject flow |

---

## Sprint 4.1 — inboxPromoteToCrm

| | |
|--|--|
| **Goal** | Approve → Opportunity timeline + Company link + LearningEvent |
| **Effort** | M · **Risk** | H |
| **Files expected** | `inboxPromoteToCrm/entry.ts`, LearningEvent.jsonc |
| **MUST NOT change** | Fabricate contacts |
| **Acceptance** | Approve blocked without evidence; success creates Opportunity |
| **Rollback** | Flag `ipp_v1_inbox` off |
| **Test** | Approve/reject/promote cases |

---

## Sprint 4.2 — Opportunities list by Timeline

| | |
|--|--|
| **Goal** | Opportunities module listing stages Signal→… |
| **Effort** | M · **Risk** | L |
| **Files expected** | `src/pages/Opportunities.jsx`, components |
| **MUST NOT change** | Lead Pipeline board behavior |
| **Acceptance** | Stages visible; filter by company |
| **Rollback** | Hide nav |
| **Test** | Promote then see in list |

---

## Sprint 4.3 — Company 360 convergence UI

| | |
|--|--|
| **Goal** | Company detail shows Rel score + Opportunities + Evidence |
| **Effort** | M · **Risk** | M |
| **Files expected** | Companies page/detail components |
| **MUST NOT change** | EmailQueue |
| **Acceptance** | Path A and B visible on one Company |
| **Rollback** | Revert UI files |
| **Test** | Linked lead + opportunity appear |

---

## Sprint 5.1 — ProductRecommendation entity + engine

| | |
|--|--|
| **Goal** | Rules from VerticalPack; recommendations require evidence+signal ids |
| **Effort** | M · **Risk** | M |
| **Files expected** | ProductRecommendation.jsonc, `recommendProducts/entry.ts`, pack rules JSON |
| **MUST NOT change** | Supplier matching |
| **Acceptance** | Bottling-style example only when pack rules + signals exist; else empty |
| **Rollback** | Disable recommend |
| **Test** | Water pack signal → RO suggestion with evidence link |

---

## Sprint 5.2 — Recommendations in Inbox/Opportunity UI

| | |
|--|--|
| **Goal** | Show recommendations with links to evidence |
| **Effort** | S · **Risk** | L |
| **Files expected** | Inbox + Opportunity detail components |
| **MUST NOT change** | Scoring formulas |
| **Acceptance** | Click-through to evidence |
| **Rollback** | Hide panel |
| **Test** | Manual UX |

---

## Sprint 5.3 — Supplier schema stubs only

| | |
|--|--|
| **Goal** | Add Supplier + SupplierCapability + OpportunitySupplierMatch schemas **unused** |
| **Effort** | S · **Risk** | L |
| **Files expected** | `base44/entities/Supplier*.jsonc` |
| **MUST NOT change** | Any UI; no matching function |
| **Acceptance** | Schemas present; documented deferred |
| **Rollback** | Remove schemas |
| **Test** | Repo contains files |

---

## Sprint 6.1 — Auth gate on IPP mutators

| | |
|--|--|
| **Goal** | evidenceIngest, inboxDecide, promote require auth.me() |
| **Effort** | M · **Risk** | M |
| **Files expected** | Listed IPP functions only |
| **MUST NOT change** | trackEmailEvent public pixel behavior without care |
| **Acceptance** | Unauth → 401 |
| **Rollback** | Revert function auth blocks |
| **Test** | Call without token |

---

## Sprint 6.2 — Dashboard IPP KPIs (minimal)

| | |
|--|--|
| **Goal** | Show verified companies, signals count, inbox pending, qualified opps |
| **Effort** | M · **Risk** | L |
| **Files expected** | `Dashboard.jsx`, small widgets |
| **MUST NOT change** | Invent fake +12% trends |
| **Acceptance** | Numbers from entities; no fabricated trends |
| **Rollback** | Revert dashboard |
| **Test** | Compare counts to DB |

---

## Sprint 6.3 — V1 acceptance dry-run

| | |
|--|--|
| **Goal** | Execute Doc 20 AC1–AC12 checklist |
| **Effort** | M · **Risk** | L |
| **Files expected** | Docs only if gaps found (`20`/`24` updates) |
| **MUST NOT change** | Unrelated modules |
| **Acceptance** | Checklist signed |
| **Rollback** | N/A |
| **Test** | Full UAT script |

---

## Sprint sequencing summary

```text
0.1 → 0.2 → 0.3 → 0.4
 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5
 → 2.1 → 2.2 → 2.3 → 2.4
 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5
 → 4.1 → 4.2 → 4.3
 → 5.1 → 5.2 → 5.3
 → 6.1 → 6.2 → 6.3
```

Parallelism allowed only within same prefix when files do not conflict (e.g. 3.2 scores while 2.4 UI).

---

## Global MUST NOT (every sprint)

- Do not fabricate companies, contacts, emails, phones, projects.  
- Do not implement Supplier matching UI/engine.  
- Do not rewrite CRM outreach from scratch.  
- Do not contradict Docs `11`–`12`.  
- Do not expand scope beyond listed files without updating this backlog.
