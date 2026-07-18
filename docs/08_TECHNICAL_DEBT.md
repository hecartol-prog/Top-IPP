# 08 — Technical Debt

## Debt register

Each item includes Severity / Impact / Effort.

### Critical / High

| ID | Debt | Severity | Impact | Effort | Action |
|----|------|----------|--------|--------|--------|
| TD-01 | Product is mold CRM; repo named Top-IPP; brands MoldFlow / Top Mold / Moldwise / Top Industrial mixed | **Critical** | Business / Maintainability | Medium | **REFACTOR** naming & product boundary |
| TD-02 | HubSpot UI ↔ `hubspotSync` contract mismatch | **High** | Business | Small | **REFACTOR** |
| TD-03 | Company / Task / Activity schemas missing from repo | **High** | Maintainability | Medium | **REFACTOR** |
| TD-04 | Soft auth + uneven edge auth | **High** | Security | Medium | **REFACTOR** |
| TD-05 | Dual routing (`pages.config` vs `App.jsx`) | **High** | Maintainability | Small | **REFACTOR** |
| TD-06 | Lead.source enum missing `hubspot` | **Medium** | Technical | Small | **REFACTOR** |

### Medium

| ID | Debt | Severity | Impact | Effort | Action |
|----|------|----------|--------|--------|--------|
| TD-07 | Fat pages (Leads, LeadDetails) | **Medium** | Maintainability | Large | **REFACTOR** incremental |
| TD-08 | Duplicate enrichment (client LLM vs server) | **Medium** | Maintainability / Performance | Medium | **REFACTOR** |
| TD-09 | Inline prompts everywhere | **Medium** | Maintainability | Medium | **REFACTOR** |
| TD-10 | Company↔Lead name matching | **Medium** | Business / Technical | Medium | **REFACTOR** |
| TD-11 | Fake Connected badges / vanity metrics | **Medium** | Business | Small | **REMOVE** |
| TD-12 | ProtectedRoute dead + API mismatch | **Medium** | Maintainability | Small | **REMOVE** |
| TD-13 | package.json name still `base44-app` | **Low** | Maintainability | Small | **REFACTOR** |

### Low

| ID | Debt | Severity | Impact | Effort | Action |
|----|------|----------|--------|--------|--------|
| TD-14 | Unused deps: Stripe, three, leaflet, jspdf, html2canvas, confetti, moment | **Low** | Maintainability / Performance | Small | **REMOVE** |
| TD-15 | Many unused shadcn primitives | **Low** | Maintainability | Small | **KEEP** kit / prune later |
| TD-16 | SDK version pin drift (functions import different `@base44/sdk` versions) | **Low** | Technical | Small | **REFACTOR** |
| TD-17 | Emoji in score labels / UI copy | **Low** | Maintainability | Small | Optional cleanup |

---

## Dead code

| Item | Evidence | Action |
|------|----------|--------|
| `ProtectedRoute.jsx` | Not imported; broken vs AuthContext | **REMOVE** |
| Unused npm packages | No imports in `src/` | **REMOVE** |
| Some `ui/*` components | Never imported by domain code | **KEEP** for now (scaffold) |

---

## Duplicate functionality

| Pair | Notes | Action |
|------|-------|--------|
| LeadDetails InvokeLLM vs enrichLead | Overlap | Prefer server |
| LinkedInImport vs extractLinkedInProfile | Overlap | Prefer server |
| sendTrackedEmail vs smtpSendEmail | Related but different entry | Document & clarify |
| lead CSV vs company CSV | Similar UX | **KEEP** (different entities) |

---

## Bad architecture decisions

1. Lead as sole “opportunity” object for industrial sales.  
2. Schema not fully in git.  
3. Integration UI that does not match backend.  
4. Auth optional at client SDK.  
5. Auto-generated page config fighting manual routes.

## Good architecture decisions

1. Domain folders under `components/`.  
2. Enrichment with validation guards.  
3. Email queue + inbox stats + tracking.  
4. Temperature / stall automation.  
5. React Query + Base44 entities for CRM speed.

---

## Maintainability score: 5.0 / 10

Recoverable without rewrite if debt is attacked in priority order (TD-02 → TD-05 → TD-03 → TD-04 → product model).
