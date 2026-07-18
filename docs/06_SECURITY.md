# 06 — Security

## Auth model

1. Base44 token from URL / localStorage (`app-params.js`).  
2. `AuthContext` loads public settings; if token present, `base44.auth.me()`.  
3. `AuthenticatedApp` handles `auth_required` and `user_not_registered`.  
4. SDK created with **`requiresAuth: false`**.

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Client SDK does not require auth on every call | **High** | Security | Small |
| `ProtectedRoute.jsx` unused and broken (`authChecked` / `checkUserAuth` not exported) | **Medium** | Security / Maintainability | Small |
| Layout calls `auth.me()` separately from AuthContext (duplicate) | **Low** | Maintainability | Small |

**REFACTOR:** Enable consistent auth enforcement; fix or delete ProtectedRoute.  
**KEEP:** AuthContext + UserNotRegisteredError flow.

---

## Edge function authorization

| Pattern | Functions (examples) | Risk |
|---------|----------------------|------|
| Requires `auth.me()` | hubspotSync, hunterEmailFinder, linkedin*, apifyWebsiteSearch, smtpSendEmail (partial) | Better |
| Admin role | updateLeadTemperatures | Good for jobs |
| Service role, weak/no user check | enrichLead, apollo*, scrapeLeadsApify, findDecisionMakers, sendTrackedEmail, trackEmailEvent | **Abuse / data exposure if invoke is public** |

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Enrichment / scrape / email functions callable without consistent user auth | **Critical** | Security / Business | Medium |
| Service role used for bulk Lead updates | **High** | Security | Medium |
| trackEmailEvent updates via tracking_id (expected) but must remain unguessable | **Medium** | Security | Small |

**REFACTOR:** Standard auth middleware pattern: user session OR signed cron secret OR tracking token.

---

## Data access / RLS

- `InboxStats`: admin-only RLS in schema — **KEEP**.  
- Other entities: RLS not documented in-repo.

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Incomplete RLS visibility for Lead/Company/Task | **High** | Security | Medium |
| All authenticated users likely see all leads (typical shared CRM) | **Medium** | Security / Business | Large if multi-tenant needed |

---

## Secrets & integrations

Secrets via `Deno.env` (Apollo, Hunter, Apify, LeadIQ, SMTP). Connectors store OAuth tokens (HubSpot, LinkedIn).

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| SMTP credentials in env (expected) — ensure not logged | **Medium** | Security | Small |
| HTML scraping with browser UA — ToS / abuse risk | **Medium** | Business / Security | Medium |
| No evidence of secret scanning / rotation docs in repo | **Low** | Security | Small |

**KEEP:** Env-based secrets (correct pattern).  
**REMOVE:** Any future hardcoding of keys (none found in inspected source).

---

## UI security theater

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| HubSpot/LinkedIn “Connected” badges hardcoded | **Medium** | Business (trust) | Small |
| Dashboard fake “+12% this month” trends (if present) | **Low** | Business | Small |

---

## Supply chain / client

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Large unused dependency surface (Stripe, three, etc.) | **Low** | Security / Maintainability | Small |
| Token in localStorage (XSS risk class) | **Medium** | Security | Medium (platform constraint) |

---

## Security score: 4.0 / 10

Driven by soft client auth and uneven edge-function gates. Core Base44 auth exists but is inconsistently applied.

---

## KEEP / REFACTOR / REMOVE (security)

| Item | Action |
|------|--------|
| AuthContext + Base44 login redirect | **KEEP** |
| InboxStats admin RLS | **KEEP** |
| Admin check on temperature job | **KEEP** |
| requiresAuth: false | **REFACTOR** |
| Unauthenticated enrich/scrape/send paths | **REFACTOR** |
| ProtectedRoute (broken) | **REMOVE** |
| Fake Connected badges | **REMOVE** |
