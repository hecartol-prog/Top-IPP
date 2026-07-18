# 09 — Recommendations

## Guiding principle

**Do not rewrite.** Evolve the mold CRM into an IPP by:

1. Stabilizing what works (CRM module).  
2. Fixing broken contracts and security.  
3. Introducing IPP core entities beside Lead.  
4. Generalizing AI prompts into vertical packs.

---

## Strategic roadmap (phased)

### Phase 0 — Stabilize (1–2 weeks)

| Action | KEEP/REFACTOR/REMOVE | Severity addressed | Effort |
|--------|----------------------|--------------------|--------|
| Fix HubSpot panel ↔ function contract | **REFACTOR** | High | Small |
| Unify routing registration | **REFACTOR** | High | Small |
| Commit Company/Task/Activity schemas | **REFACTOR** | High | Medium |
| Remove ProtectedRoute; prune unused deps | **REMOVE** | Low–Medium | Small |
| Replace fake Connected badges with real status | **REMOVE**/replace | Medium | Small |

### Phase 1 — Harden (2–4 weeks)

| Action | Effort |
|--------|--------|
| Standardize edge-function auth (user / cron secret) | Medium |
| Server-first enrichment; client LLM = suggest only | Medium |
| Add pagination / capped batch enrich | Medium |
| Document env secrets & connector setup | Small |

### Phase 2 — IPP core model (4–8 weeks)

Introduce entities (conceptually):

- **Account** (industrial company / plant)  
- **Opportunity** (project: desal, line, automation, machinery, OEM/ODM)  
- **Signal** (source event with URL, confidence, vertical)  
- **Vertical** taxonomy enums  

Map existing **Lead** → Contact linked to Account + Opportunity (CRM module).

| Issue if skipped | Severity | Impact | Effort if done |
|------------------|----------|--------|----------------|
| Remain a mold CRM forever | **Critical** | Business | Large |

### Phase 3 — Intelligence loops

- Scheduled discovery jobs (reuse EmailQueue pattern).  
- Verification workflow UI.  
- Prioritization engine extending `leadScoring` with IPP signals.  
- Prompt packs per vertical (parameterize mold prompts).

---

## Module map (target)

| Module | Status | Action |
|--------|--------|--------|
| Sales CRM (Leads, Pipeline, Tasks, Companies) | Exists | **KEEP** as module |
| Enrichment | Exists | **KEEP** / harden |
| Outreach (templates, sequences, SMTP) | Exists | **KEEP** |
| Integrations | Partial | **REFACTOR** HubSpot |
| Discovery / Signals | Missing | Build new (not rewrite CRM) |
| Opportunity Intelligence | Missing | Build new |
| Verification | Missing | Build new |

---

## Recommendations by theme

### Architecture

- Keep Base44 short/medium term.  
- Draw module boundaries in folders + docs before microservices.  
- Avoid second CRM rewrite on another stack.

### Database

- Version all entities in git.  
- Add Opportunity without deleting Lead.  
- Link Company/Account by id.

### AI

- Extract prompts to versioned packs.  
- Reuse enrichLead validators.  
- Add confidence + evidence fields on Opportunity/Signal.

### Security

- `requiresAuth` consistency.  
- Gate expensive functions.  
- Real connector health checks.

### Product / branding

- Align UI brand with Top-IPP when IPP modules land.  
- Keep “Top Mold” as a **vertical pack / tenant config**, not the whole platform name.

---

## Anti-recommendations

| Do not | Why |
|--------|-----|
| Rewrite in Next.js/Nest/etc. now | Throws away working enrichment + outreach |
| Delete Lead entity | CRM module still needed |
| Expand to 6 verticals before Opportunity model | Creates more mold-shaped debt |
| Add more LLM call sites without cost caps | Cost and quality risk |

---

## Success criteria (IPP readiness)

1. Opportunity objects exist for ≥1 non-mold vertical.  
2. Continuous signal job runs on a schedule.  
3. Enrichment writes provenance + confidence.  
4. CRM remains usable for mold sales unchanged.  
5. Auth gates on all mutating edge functions.
