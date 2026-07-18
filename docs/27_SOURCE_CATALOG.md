# 27 — Source Catalog

**Status:** Master catalog of intelligence sources (frozen for V1 priorities)  
**Constitution:** Docs `12` §3, `20`–`22`, `26`  
**Rule:** Sources feed Evidence. Sources never authorize fabrication.

---

## 0. Catalog fields (every source)

| Field | Meaning |
|-------|---------|
| Source Name | Canonical name |
| Category | identity / demand / media / trade / enrichment / internal / partner |
| Reliability | Tier A–E (`12`) + numeric W default |
| Freshness | Typical staleness risk |
| Collection Method | API / Scraper / Manual / Import |
| Cost | Free / Low / Medium / High |
| Refresh frequency | Suggested cadence |
| Confidence | Typical claim confidence band |
| Typical data returned | |
| Typical buying signals | Codes from `12` |
| Limitations | |
| Priority | P0 V1 · P1 near-term · P2 later |

---

## 1. Official Websites

| Field | Value |
|-------|-------|
| Category | identity / firmographic |
| Reliability | Tier B · W≈0.80 |
| Freshness | Medium (pages stale) |
| Method | Scraper + Manual |
| Cost | Low |
| Refresh | 30–90 days / on demand |
| Confidence | 0.70–0.85 firmographics; lower for future plans |
| Data | Products, plants, contact pages, newsrooms |
| Signals | soft: new_product_launch, automation_upgrade (if stated) |
| Limitations | Marketing fluff |
| Priority | **P0** |

---

## 2. Government Registries

| Field | Value |
|-------|-------|
| Category | identity |
| Reliability | Tier A · W≈0.95 |
| Freshness | High for legal status |
| Method | API / Manual / Scraper (jurisdiction-dependent) |
| Cost | Free–Low |
| Refresh | 180–365 days |
| Confidence | 0.90–0.98 existence |
| Data | Legal name, status, officers (varies) |
| Signals | rarely direct |
| Limitations | Sparse project data |
| Priority | **P0** (verification backbone) |

---

## 3. Tender Portals

| Field | Value |
|-------|-------|
| Category | demand |
| Reliability | Tier A · W≈0.95 |
| Freshness | High (deadline-bound) |
| Method | API / Scraper / Manual |
| Cost | Low–Medium |
| Refresh | Daily–weekly |
| Confidence | 0.90–0.98 as opportunity signal |
| Data | Scope, buyer, deadlines, sometimes value |
| Signals | `tender_published`, `government_investment`, equipment-specific |
| Limitations | Competition; eligibility |
| Priority | **P0** Path B |

---

## 4. Trade Show Exhibitors

| Field | Value |
|-------|-------|
| Category | trade / relationship |
| Reliability | Tier C · W≈0.65 |
| Freshness | Event-tied |
| Method | Import / Manual / Scraper |
| Cost | Low–Medium |
| Refresh | Per event |
| Confidence | 0.75 presence; 0.40–0.60 buyer intent alone |
| Data | Company lists, booths, verticals |
| Signals | `trade_show_participation` |
| Limitations | Exhibitors ≠ buyers |
| Priority | **P0** Path A |

---

## 5. Industrial Associations

| Field | Value |
|-------|-------|
| Category | identity / network |
| Reliability | Tier B–C · W≈0.70 |
| Freshness | Medium |
| Method | Import / Manual / Scraper |
| Cost | Low–Medium |
| Refresh | Quarterly–yearly |
| Confidence | 0.70 membership |
| Data | Member directories |
| Signals | weak |
| Limitations | Paywalls; stale |
| Priority | **P1** |

---

## 6. Import / Export Databases

| Field | Value |
|-------|-------|
| Category | trade |
| Reliability | Tier D · W≈0.55–0.85 |
| Freshness | Lag common |
| Method | API / Import |
| Cost | Medium–High |
| Refresh | Monthly |
| Confidence | 0.55–0.85 |
| Data | HS codes, shippers, machinery classes |
| Signals | `new_machinery`, `china_sourcing_intent`, `export_expansion` |
| Limitations | Incomplete mapping |
| Priority | **P1** (Strategic Fit / China) |

---

## 7. News

| Field | Value |
|-------|-------|
| Category | media |
| Reliability | Tier C · W≈0.50–0.80 by outlet |
| Freshness | High |
| Method | API / Scraper |
| Cost | Low–Medium |
| Refresh | Daily |
| Confidence | 0.50–0.80 — corroborate |
| Data | Expansions, investments, incidents |
| Signals | `factory_expansion`, `acquisition`, `joint_venture`, … |
| Limitations | Errors, PR spin |
| Priority | **P0** |

---

## 8. Press Releases

| Field | Value |
|-------|-------|
| Category | media |
| Reliability | Tier C · W≈0.65–0.85 |
| Freshness | High |
| Method | Scraper / Manual / API |
| Cost | Free |
| Refresh | Weekly |
| Confidence | 0.65–0.85 |
| Data | First-party claims |
| Signals | `investment` class, `new_product_launch`, `new_plant_greenfield` |
| Limitations | Aspirational |
| Priority | **P0** |

---

## 9. Construction Permits

| Field | Value |
|-------|-------|
| Category | demand / regulatory |
| Reliability | Tier A · W≈0.90 |
| Freshness | Medium–High |
| Method | Scraper / Manual / API |
| Cost | Low–Medium |
| Refresh | Weekly–monthly |
| Confidence | 0.85–0.95 expansion; lower for equipment type |
| Data | Site, applicant, project type |
| Signals | `construction_permit`, `factory_expansion`, `new_warehouse`, `new_plant_greenfield` |
| Limitations | Rarely names OEM |
| Priority | **P0** Path B |

---

## 10. Environmental Permits

| Field | Value |
|-------|-------|
| Category | regulatory |
| Reliability | Tier A · W≈0.90 |
| Freshness | Medium |
| Method | Scraper / Manual |
| Cost | Low–Medium |
| Refresh | Weekly–monthly |
| Confidence | 0.85–0.95 |
| Data | Water/waste/air permits |
| Signals | `environmental_approval`, `water_treatment`, `water_discharge_permit` |
| Limitations | Jurisdiction coverage |
| Priority | **P0** (Industrial Water pack) |

---

## 11. Investment Announcements

| Field | Value |
|-------|-------|
| Category | demand / media |
| Reliability | Tier B–C · W≈0.70–0.90 |
| Freshness | High |
| Method | News/PR pipelines |
| Cost | Low |
| Refresh | Daily–weekly |
| Confidence | 0.70–0.90 |
| Data | CAPEX intent, location |
| Signals | `government_investment`, expansion family |
| Limitations | Cancellations |
| Priority | **P0** |

---

## 12. Hiring Pages / Job Posts

| Field | Value |
|-------|-------|
| Category | operational |
| Reliability | Tier D · W≈0.55–0.75 |
| Freshness | High short half-life |
| Method | Scraper / API |
| Cost | Low–Medium |
| Refresh | Weekly |
| Confidence | Soft signal; higher if clustered |
| Data | Roles, locations |
| Signals | `hiring_engineers`, `hiring_maintenance`, `hiring_automation`, `hiring_production`, `hiring_procurement` |
| Limitations | Not always CAPEX |
| Priority | **P1** |

---

## 13. LinkedIn Company

| Field | Value |
|-------|-------|
| Category | media / enrichment |
| Reliability | Tier D · W≈0.50–0.70 |
| Freshness | Medium |
| Method | API / Manual / connector |
| Cost | Medium |
| Refresh | On demand |
| Confidence | Soft |
| Data | Headcount trends, posts, titles |
| Signals | hiring_*, leadership_change |
| Limitations | ToS/access; **no invented emails** |
| Priority | **P1** |

---

## 14. HubSpot

| Field | Value |
|-------|-------|
| Category | internal / import |
| Reliability | As CRM hygiene · re-verify |
| Freshness | Variable |
| Method | API (connector) |
| Cost | Included |
| Refresh | On sync |
| Confidence | Inherit + re-verify |
| Data | Contacts, companies, deals |
| Signals | `repeat_interest` if reopen |
| Limitations | Duplicates; not Path B truth alone |
| Priority | **P0** CRM bridge |

---

## 15. Apollo

| Field | Value |
|-------|-------|
| Category | enrichment |
| Reliability | Tier E · W≈0.35 — **cap confidence 0.55 unless corroborated** |
| Freshness | Stale risk |
| Method | API |
| Cost | Medium–High |
| Refresh | On enrich |
| Confidence | Suggest only |
| Data | Firmographics, contacts |
| Signals | none alone |
| Limitations | Wrong titles/emails — quarantine |
| Priority | **P0** assist Path A only |

---

## 16. Customer Referrals

| Field | Value |
|-------|-------|
| Category | partner |
| Reliability | High commercially · W≈0.85–0.95 |
| Freshness | Event |
| Method | Manual |
| Cost | Free |
| Refresh | Ad hoc |
| Confidence | High intro quality |
| Data | Warm path, context |
| Signals | `referral_intro` |
| Limitations | Sparse |
| Priority | **P0** |

---

## 17. Existing CRM

| Field | Value |
|-------|-------|
| Category | internal |
| Reliability | Historical variable |
| Freshness | Activity-based |
| Method | Import / internal |
| Cost | Free |
| Refresh | Continuous |
| Confidence | Based on wins/recency |
| Data | Leads, activities, quotes history |
| Signals | `repeat_interest` |
| Limitations | Mold-era bias |
| Priority | **P0** |

---

## 18. Supplier References

| Field | Value |
|-------|-------|
| Category | partner (future-heavy) |
| Reliability | Medium–High |
| Freshness | Medium |
| Method | Manual / Import |
| Cost | Free |
| Refresh | Quarterly |
| Confidence | 0.70–0.90 for capability claims with docs |
| Data | Capabilities, certs, references |
| Signals | indirect |
| Limitations | V1: catalogued for Supplier Intelligence later |
| Priority | **P2** (schema ready; collection later) |

---

## 19. Engineering Companies / EPCs / Consultants

| Field | Value |
|-------|-------|
| Category | partner / network |
| Reliability | Medium–High |
| Freshness | Medium |
| Method | Manual / Associations / Web |
| Cost | Low |
| Refresh | Quarterly |
| Confidence | Relationship path strong |
| Data | Project involvement, specialties |
| Signals | often via tenders/news |
| Limitations | Indirect buyers |
| Priority | **P1** |

---

## 20. Industry Magazines

| Field | Value |
|-------|-------|
| Category | media |
| Reliability | Tier C · W≈0.55–0.75 |
| Freshness | Medium |
| Method | Scraper / Manual / API |
| Cost | Low–Medium |
| Refresh | Weekly–monthly |
| Confidence | Corroborate |
| Data | Plant features, tech trends |
| Signals | expansion / technology family |
| Limitations | Advertorials |
| Priority | **P2** |

---

## 21. Priority matrix (V1 operations)

| Priority | Sources |
|----------|---------|
| P0 | Official Websites, Government Registries, Tenders, Trade Shows, News, Press, Construction Permits, Environmental Permits, Investment Announcements, HubSpot, Apollo (assist), Referrals, Existing CRM |
| P1 | Associations, Import/Export, Hiring, LinkedIn, Engineering/EPC network |
| P2 | Supplier References (full), Industry Magazines |

---

## 22. VerticalPack binding

Each VerticalPack selects a **subset** of this catalog + weight overrides (e.g. Water pack elevates Environmental Permits). Adding a sector does **not** require new architecture — only pack configuration referencing these Source Names.
