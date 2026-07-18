# 10 — Quick Wins

High leverage, **Small** effort items. No rewrite. Do these before large IPP modeling.

---

## QW-1 — Fix HubSpot sync contract

| | |
|--|--|
| **Severity** | High |
| **Impact** | Business / Technical |
| **Effort** | Small |
| **Action** | **REFACTOR** |

Align `HubSpotPanel` payload with `hubspotSync` (`action: push_contacts | pull_contacts | get_stats`, pass `leads` when pushing), **or** adapt the function to accept `direction`.

**Why first:** Integration page is currently misleading/broken.

---

## QW-2 — Unify page registration

| | |
|--|--|
| **Severity** | High |
| **Impact** | Maintainability |
| **Effort** | Small |
| **Action** | **REFACTOR** |

Register Tasks, Templates, Outreach, Sequences, EmailOutreach in the same mechanism as Dashboard/Leads so Base44 regen cannot drop them.

---

## QW-3 — Add missing entity schemas to git

| | |
|--|--|
| **Severity** | High |
| **Impact** | Maintainability |
| **Effort** | Medium (still a quick win vs rewrite) |
| **Action** | **REFACTOR** |

Export/commit `Company.jsonc`, `Task.jsonc`, `Activity.jsonc` under `base44/entities/`. Add `hubspot` to Lead.source enum.

---

## QW-4 — Delete dead ProtectedRoute

| | |
|--|--|
| **Severity** | Medium |
| **Impact** | Maintainability |
| **Effort** | Small |
| **Action** | **REMOVE** |

File is unused and incompatible with AuthContext.

---

## QW-5 — Remove unused dependencies

| | |
|--|--|
| **Severity** | Low |
| **Impact** | Maintainability / Performance |
| **Effort** | Small |
| **Action** | **REMOVE** |

Candidates: `@stripe/*`, `three`, `react-leaflet`, `jspdf`, `html2canvas`, `canvas-confetti`, `moment` (if unused).

---

## QW-6 — Honest integration status

| | |
|--|--|
| **Severity** | Medium |
| **Impact** | Business |
| **Effort** | Small |
| **Action** | **REMOVE** fake / **REFACTOR** to live check |

Replace hardcoded “Connected” with connector status or “Configure”.

---

## QW-7 — Cap batch enrichment concurrency

| | |
|--|--|
| **Severity** | High |
| **Impact** | Performance / Business |
| **Effort** | Small–Medium |
| **Action** | **REFACTOR** |

Process batch enrich with concurrency 3–5; surface progress already partly exists.

---

## QW-8 — Package / brand identity cleanup

| | |
|--|--|
| **Severity** | Medium |
| **Impact** | Business / Maintainability |
| **Effort** | Small |
| **Action** | **REFACTOR** |

Rename `package.json` `name` to `top-ipp`; document MoldFlow as legacy Base44 app name. Defer full UI rebrand until IPP modules exist (**KEEP** Top Mold as vertical label).

---

## QW-9 — Document env & functions matrix

| | |
|--|--|
| **Severity** | Low |
| **Impact** | Maintainability |
| **Effort** | Small |
| **Action** | **KEEP** ops knowledge |

One markdown table: function → env keys → auth → scheduler. (Can live next to this audit.)

---

## QW-10 — Parameterize one enrichment prompt

| | |
|--|--|
| **Severity** | High (for IPP path) |
| **Impact** | Business |
| **Effort** | Small |
| **Action** | **REFACTOR** |

Replace hard-coded “plastic injection mold CRM” string in `enrichLead` with a `vertical` / `product_line` parameter defaulting to molds. Proves IPP extensibility without new entities yet.

---

## Suggested order (1 week)

1. QW-1 HubSpot  
2. QW-2 Routing  
3. QW-4 + QW-5 Cleanup  
4. QW-6 Badges  
5. QW-3 Schemas  
6. QW-7 Batch cap  
7. QW-10 Prompt parameter  
8. QW-8 / QW-9 Naming & docs  

---

## Executive scorecard (final)

| Dimension | Score |
|-----------|------:|
| Architecture | 5.5 |
| Database | 4.5 |
| Maintainability | 5.0 |
| Scalability | 4.0 |
| Security | 4.0 |
| AI Readiness | 6.5 |
| Industrial Intelligence Readiness | 3.0 |
| **Overall** | **4.5** |

**Interpretation:** Strong CRM seed with reusable enrichment/outreach gems. Far from IPP continuous discovery. Path forward is **stabilize → modularize → extend**, not rewrite.
