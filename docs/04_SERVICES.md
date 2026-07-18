# 04 — Services

## Client service surface

Single gateway: [`src/api/base44Client.js`](../src/api/base44Client.js)

```js
createClient({ requiresAuth: false, ...appParams })
```

All UI calls go through `base44.entities.*`, `base44.functions.invoke`, `base44.integrations.Core.*`, `base44.auth.*`.

---

## Edge functions inventory

| Function | Role | Auth pattern | KEEP/REFACTOR/REMOVE |
|----------|------|--------------|----------------------|
| `enrichLead` | Multi-source + LLM enrich | Service role; no user gate observed | **KEEP** / harden auth |
| `apolloEnrich` | Apollo match + LLM fallback | Service role | **KEEP** |
| `apolloAutoEnrich` | On-create → apolloEnrich | Service role | **KEEP** |
| `hunterEmailFinder` | Hunter email finder | `auth.me()` | **KEEP** |
| `findDecisionMakers` | LLM decision-maker search | Service role | **KEEP** |
| `scrapeLeadsApify` | Apify scrape → LLM → Lead.create | Service role | **KEEP** |
| `apifyWebsiteSearch` | Website search via Apify | `auth.me()` | **KEEP** |
| `apifyEnrichCompany` | Company enrich via Apify | `auth.me()` | **KEEP** |
| `fetchPageLinks` | Page link fetch | (utility) | **KEEP** |
| `scanWebsiteWhatsApp` | WhatsApp discovery | Service role | **KEEP** |
| `hubspotSync` | Push/pull HubSpot contacts | `auth.me()` | **REFACTOR** (fix UI contract) |
| `syncLeadIQ` | LeadIQ list sync | Service role (scheduled) | **KEEP** |
| `linkedinGetProfile` | LinkedIn profile via connector | `auth.me()` | **KEEP** |
| `linkedinPostUpdate` | LinkedIn post | `auth.me()` | **KEEP** |
| `extractLinkedInProfile` | Apify/LLM LinkedIn extract | Service role + LLM | **KEEP** |
| `sendTrackedEmail` | Tracked SMTP send | Service role | **KEEP** |
| `trackEmailEvent` | Open/click webhook | Service role | **KEEP** |
| `smtpSendEmail` | Queue send / inbox rotate | Mixed | **KEEP** |
| `smtpQueueProcessor` | Invokes smtpSendEmail | Service role | **KEEP** |
| `updateLeadTemperatures` | Daily stall tasks + temp | Admin check | **KEEP** |

---

## External integrations

| Provider | Usage | Env / connector |
|----------|-------|-----------------|
| Apollo.io | Enrich / match | `APOLLO_API_KEY` |
| Hunter.io | Email finder | `HUNTER_API_KEY` |
| Apify | Scrape / LinkedIn / website | `APIFY_API_TOKEN` |
| LeadIQ | List sync | `LEADIQ_API_KEY` / `SECRET` |
| HubSpot | Contact sync | Base44 connector `hubspot` |
| LinkedIn | Profile / post | Base44 connector `linkedin` |
| Google Workspace SMTP | Outreach | `SMTP_*_USER/PASS` |
| Clearbit / DDG / Bing | Free/context scrape | No keys / HTML |
| Base44 Core | LLM + SendEmail | Platform |

**No Stripe usage in app code** despite `@stripe/*` in `package.json` → unused dependency.

---

## Critical service defect: HubSpot contract

**UI** (`HubSpotPanel.jsx`) sends:

```js
{ direction: 'to_hubspot' | 'from_hubspot' | 'both', entity_type: null }
```

**Function** (`hubspotSync`) expects:

```js
{ action: 'push_contacts' | 'pull_contacts' | 'get_stats', leads }
```

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| HubSpot sync UX is broken / non-functional vs backend | **High** | Business | Small |
| UI shows static “Connected” badge | **Medium** | Business | Small |
| UI promises companies/deals sync; backend is contacts-oriented | **Medium** | Business | Medium |

**REFACTOR:** Align panel payload to function (or adapt function to directions).  
**REMOVE:** Fake Connected state until connector health is queried.

---

## Frontend “services” (implicit)

Not a formal service layer — logic lives in components:

| Area | Components |
|------|------------|
| Scoring | `leadScoring.jsx` |
| Enrichment UX | ApolloEnrichPanel, BatchEnrichDialog, AIEditDialog, HunterPanel |
| Import | CSVImport, PasteLeadDialog, LinkedInImport, WebScraper |
| Outreach | ComposeEmailDialog, CampaignBuilderDialog, EmailOutreachPanel |
| Integrations | HubSpotPanel, LinkedInPanel |

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| No shared service module → duplication & fat components | **Medium** | Maintainability | Medium |

**REFACTOR:** Extract `services/enrichment`, `services/outreach` thin wrappers over SDK (no rewrite).

---

## Scheduled / background services

Likely Base44-scheduled (little/no UI invoke):

- `apolloAutoEnrich` (entity hook / on create)
- `syncLeadIQ`
- `smtpQueueProcessor`
- `updateLeadTemperatures`
- `trackEmailEvent` (tracking pixel / webhook)

**KEEP** these as IPP operational backbone for engagement.

---

## Duplicate functionality

| Duplication | Notes |
|-------------|-------|
| Enrichment paths | Client `InvokeLLM` in LeadDetails **and** server `enrichLead` / `apolloEnrich` |
| Email send | `sendTrackedEmail` vs `smtpSendEmail` queue path |
| LinkedIn extract | Client LinkedInImport LLM vs `extractLinkedInProfile` function |
| CSV import | Separate company vs lead CSV importers (appropriate but similar UX) |

**REFACTOR:** Prefer server enrichment as source of truth; client LLM for interactive suggest-only.

---

## Unused / low-use services

| Item | Assessment |
|------|------------|
| Stripe packages | **REMOVE** from deps if unused |
| three / react-leaflet / jspdf / html2canvas / canvas-confetti / moment | **REMOVE** if unused |
| ProtectedRoute | **REMOVE** (dead + broken) |
| Many shadcn ui primitives | **KEEP** kit; prune later if bundle matters |

---

## KEEP / REFACTOR / REMOVE (services)

| Item | Action |
|------|--------|
| Enrichment + Apollo/Hunter/Apify stack | **KEEP** |
| SMTP queue + tracking | **KEEP** |
| LeadIQ sync | **KEEP** |
| HubSpot function core | **KEEP** after contract fix |
| HubSpot panel as-is | **REFACTOR** |
| Ad-hoc client LLM enrichment overlapping server | **REFACTOR** |
| Unused npm integrations | **REMOVE** |
