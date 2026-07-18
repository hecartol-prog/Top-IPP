# Sprint 2.2 — Production Connectors Report

**Sprint:** Production Connectors (Real Data)  
**Date:** 2026-07-18  
**Depends on:** Sprint 2.1 Discovery Engine Foundation  
**Status:** Complete — connector tests green; app build verified  
**Constitution:** docs `12`, `27`, `28`, `33`, `25`

---

## 1. Connector Architecture Report

### Principle

Quality over quantity. Connectors import attributable industrial artifacts into the existing Discovery pipeline. Nothing bypasses validation. No fabrication, inference, or hallucination.

### Flow

```text
Source Registry (config)
        ↓
Production Connector (shared interface)
        ↓
RawDocument
        ↓
Parser → Normalization → Company Match
        ↓
Evidence Extraction → Validation
        ↓
Store Evidence → IntelligenceInboxItem (pending)
```

### Shared connector interface

```text
DiscoveryConnector {
  type: string
  fetch(source: SourceRegistryEntry, ctx?: ConnectorContext) → ConnectorResult
}

ConnectorResult { ok, document?, error?, errorCode? }
```

Services never hardcode source URLs. URLs come only from the Source Registry (or test payloads).

### Error resilience

Each connector / source run survives:

| Failure | Behavior |
|---------|----------|
| Network timeout | Typed error; continue |
| 404 / 5xx | Typed error; continue |
| Bad HTML / XML / CSV | Empty parse or typed error; no crash |
| Invalid JSON | `errorCode=invalid_json` |
| Redirects | Followed by fetch |
| Encoding errors | Typed error |
| Connector throw | Caught by runner; remaining sources continue |

### Explicitly not built

BuyingSignal, Opportunity, AI/LLM, Email, CRM automation, Supplier matching, Recommendations.

---

## 2. Source Registry Design

**Not a Base44 entity** (docs/33: DiscoverySource = catalog concept).

| Field | Purpose |
|-------|---------|
| id | Stable source id |
| name | Display name |
| type | Connector type |
| country | Primary geography |
| industry | Industry label |
| vertical_pack | Pack code |
| url | Collection URL (only place URLs live) |
| language | Primary language |
| refresh_interval | e.g. `6h`, `24h`, `manual` |
| enabled | Toggle |
| priority | Run order (lower first) |
| last_success / last_error | Run status |
| supported_countries | Filter metadata |
| supported_languages | Filter metadata |
| supported_vertical_packs | Filter metadata |
| parser / normalizer | Pipeline bindings |
| source_weight / source_type | Evidence provenance |

API: `createSourceRegistry()`, `register`, `update`, `list`, `markSuccess`, `markError`, `loadAll`.

Seed: `src/discovery/config/sources.js` (13 production sources). Placeholder hosts use `*.example-industrial.invalid` so offline tests inject payloads without accidental live scrapes.

---

## 3. Supported Connector List

| Type | Module | Notes |
|------|--------|-------|
| RSS Feed | `rssConnector` | RSS/Atom XML payload or fetch |
| Sitemap/XML | `sitemapConnector` / `xmlConnector` | urlset; orphans without company skipped |
| Public JSON API | `jsonApiConnector` | Rejects invalid JSON safely |
| CSV Import | `csvConnector` | Import sheets / RFQs |
| Manual URL | `manualUrlConnector` | HTML/JSON/XML page by registry URL |
| Manual PDF Upload | `manualPdfConnector` | **Metadata only** — no PDF text extraction |

---

## 4. Files Created / Modified

### Created

| Path | Role |
|------|------|
| `src/discovery/config/verticalPacks.js` | 5 production packs |
| `src/discovery/config/sources.js` | Source Registry seed |
| `src/discovery/registry/types.js` | Registry / connector types |
| `src/discovery/registry/index.js` | SourceRegistry |
| `src/discovery/connectors/http.js` | Timed fetch + status handling |
| `src/discovery/connectors/index.js` | Unified connectors |
| `src/discovery/runner/index.js` | Multi-source runner + metrics |
| `src/discovery/verification/dedupe.js` | Mark duplicates (no delete) |
| `src/discovery/fixtures/sample.sitemap.xml` | Sitemap fixture |
| `src/discovery/fixtures/sample.manual-url.html` | Manual URL fixture |
| `src/discovery/fixtures/sample.pdf-meta.json` | PDF metadata fixture |
| `src/discovery/fixtures/malformed.*` | Malformed XML/CSV/JSON/HTML |
| `src/discovery/tests/run-connectors.mjs` | Sprint 2.2 tests |
| `docs/SPRINT_2_2_PRODUCTION_CONNECTORS_REPORT.md` | This report |

### Modified

| Path | Change |
|------|--------|
| `src/discovery/index.js` | Export Sprint 2.2 API |
| `src/discovery/types.js` | registration_number, MATCH_SCORES, extractor 2.2.0 |
| `src/discovery/parser/index.js` | Sitemap parser; crash-safe parse; reg fields |
| `src/discovery/normalization/index.js` | registration_number |
| `src/discovery/verification/companyMatch.js` | Priority match + threshold |
| `src/discovery/verification/validateEvidence.js` | Attested file:// artifacts |
| `package.json` | `test:connectors` script |

### Vertical packs configured

1. `industrial_water` — Industrial Water & Desalination  
2. `production_lines` — Production Lines  
3. `factory_automation` — Factory Automation  
4. `industrial_machinery` — Industrial Machinery  
5. `plastic_manufacturing` — Plastic Manufacturing  

### Company match priority

1. Domain → 2. Website → 3. Registration number → 4. Exact name → 5. Normalized name  
Threshold: **0.85**. Below threshold → create new Company (never auto-merge).

---

## 5. Test Results

```text
npm run test:discovery   → 40 passed, 0 failed
npm run test:connectors  → 47 passed, 0 failed
```

Coverage: registry, all 6 connector types, malformed inputs, 404/500/timeout-style failures, match priority, full offline production run, dedupe marks without delete.

---

## 6. Performance Metrics

Offline fixture production run (7 sources, including 1 malformed):

| Metric | Value |
|--------|------:|
| Wall duration | ~6–7 ms |
| Evidence created | 9 |
| Companies created | 9 |
| Companies matched | 0 (cold repos) |
| Healthy sources ok | 6 / 7 |
| Errors (expected malformed) | 2 |
| Pipeline crashes | 0 |

Live network latency depends on source hosts; connector timeout default **15s** per fetch.

---

## 7. Remaining Work for Sprint 2.3

| Item | Notes |
|------|-------|
| Live source URL cutover | Replace `*.invalid` placeholders with approved real feeds (ops-owned registry edit) |
| `evidenceIngest` Base44 function | Auth-gated ingest API (backlog) |
| VerticalPack seed function | Persist 5 packs to Base44 via `toVerticalPackEntity` |
| Scheduled refresh worker | Honor `refresh_interval` via scheduler hooks |
| BuyingSignal detect (`signalDetect`) | **Sprint 2.3 focus** — evidence_ids required; no fabrication |
| Source weight calibration | Per-pack W overrides from docs `27` |
| HTML depth | Structured extract still non-AI |
| Observability export | Persist run metrics to Activity/log store |

**Still forbidden until scheduled:** Opportunity creation, AI extraction, recommendations, email/CRM automation from discovery.

---

## Definition of done

- [x] Shared connector interface  
- [x] Source Registry (no hardcoded service URLs)  
- [x] 5 production vertical packs configured  
- [x] Discovery rules via existing pipeline + validation  
- [x] Company match priority + threshold  
- [x] Dedup marks (no delete)  
- [x] Error survival across sources  
- [x] Run metrics logging  
- [x] Fixtures including malformed  
- [x] Tests green; repository builds  

---

**End of Sprint 2.2 report.**
